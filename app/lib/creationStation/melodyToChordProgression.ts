/**
 * Monophonic melody → closest chord progression candidates for Chord Builder.
 * Uses pitch-class histograms + diatonic chord scoring (no ML).
 */

import {
  GENRES,
  chordSymbolToMidi,
  chordSymbolToName,
  getModeChordSymbols,
  getModeDefaultChord,
  type ChordMode,
  type ChordSymbol,
} from '@/app/lib/creationStation/chordBuilder';
import {
  detectPitchACF,
  frequencyToMidiNote,
  type PitchEvent,
} from '@/app/lib/pitchDetection';

export interface MelodyProgressionCandidate {
  id: string;
  label: string;
  chords: ChordSymbol[];
  score: number;
}

export interface MelodyAnalysisResult {
  keyRoot: number;
  mode: ChordMode;
  barCount: number;
  candidates: MelodyProgressionCandidate[];
}

const KRUMHANSL_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KRUMHANSL_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const COMMON_TEMPLATES: { label: string; chords: ChordSymbol[] }[] = [
  { label: 'I–vi–IV–V', chords: ['I', 'vi', 'IV', 'V'] },
  { label: 'vi–IV–I–V', chords: ['vi', 'IV', 'I', 'V'] },
  { label: 'I–V–vi–IV', chords: ['I', 'V', 'vi', 'IV'] },
  { label: 'I–IV–V–IV', chords: ['I', 'IV', 'V', 'IV'] },
  { label: 'ii–V–I', chords: ['ii', 'V', 'I', 'I'] },
  { label: 'I–IV–I–V', chords: ['I', 'IV', 'I', 'V'] },
];

const COMMON_TEMPLATES_MINOR: { label: string; chords: ChordSymbol[] }[] = [
  { label: 'i–VI–VII', chords: ['i', 'VI', 'VII', 'i'] },
  { label: 'i–iv–V', chords: ['i', 'iv', 'V', 'i'] },
  { label: 'i–VII–VI', chords: ['i', 'VII', 'VI', 'i'] },
  { label: 'i–iv–v', chords: ['i', 'iv', 'v', 'i'] },
];

/** Decode an uploaded / recorded buffer into pitch events (monophonic ACF). */
export function extractPitchEventsFromAudioBuffer(buffer: AudioBuffer): PitchEvent[] {
  const channelData = buffer.getChannelData(0);
  const events: PitchEvent[] = [];
  const hopSize = 512;
  const frameSize = 4096;

  for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
    const frame = channelData.subarray(i, i + frameSize);
    const { frequency, confidence } = detectPitchACF(frame, buffer.sampleRate);
    if (confidence > 0.12 && frequency > 0) {
      events.push({
        time: (i / buffer.sampleRate) * 1000,
        frequency,
        confidence,
        velocity: 100,
      });
    }
  }
  return events;
}

function pitchClassHistogram(events: PitchEvent[], minConfidence = 0.2): number[] {
  const hist = new Array(12).fill(0);
  for (const e of events) {
    if (e.confidence < minConfidence || e.frequency <= 0) continue;
    const pc = frequencyToMidiNote(e.frequency) % 12;
    hist[pc] += e.confidence;
  }
  return hist;
}

function correlateProfile(hist: number[], profile: number[], root: number): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const rotated = profile[(i - root + 12) % 12]!;
    sum += hist[i]! * rotated;
  }
  return sum;
}

function estimateKey(events: PitchEvent[]): { keyRoot: number; mode: ChordMode } {
  const hist = pitchClassHistogram(events);
  const total = hist.reduce((a, b) => a + b, 0);
  if (total < 0.01) return { keyRoot: 0, mode: 'major' };

  let bestRoot = 0;
  let bestMode: ChordMode = 'major';
  let bestScore = -Infinity;

  for (let root = 0; root < 12; root++) {
    const maj = correlateProfile(hist, KRUMHANSL_MAJOR, root);
    const min = correlateProfile(hist, KRUMHANSL_MINOR, root);
    if (maj > bestScore) {
      bestScore = maj;
      bestRoot = root;
      bestMode = 'major';
    }
    if (min > bestScore) {
      bestScore = min;
      bestRoot = root;
      bestMode = 'minor';
    }
  }
  return { keyRoot: bestRoot, mode: bestMode };
}

function chordPitchClasses(symbol: ChordSymbol, keyRoot: number, mode: ChordMode): Set<number> {
  const midis = chordSymbolToMidi(symbol, keyRoot, mode);
  if (!midis) return new Set();
  return new Set(midis.map((m) => ((m % 12) + 12) % 12));
}

function eventsToBarPitchClasses(
  events: PitchEvent[],
  bpm: number,
  barCount: number,
): number[][] {
  const msPerBar = (60000 / Math.max(20, bpm)) * 4;
  const bars: number[][] = Array.from({ length: barCount }, () => []);
  for (const e of events) {
    if (e.confidence < 0.2 || e.frequency <= 0) continue;
    const bar = Math.floor(e.time / msPerBar);
    if (bar < 0 || bar >= barCount) continue;
    bars[bar]!.push(frequencyToMidiNote(e.frequency) % 12);
  }
  return bars;
}

function scoreBarAgainstChord(barPcs: number[], symbol: ChordSymbol, keyRoot: number, mode: ChordMode): number {
  if (barPcs.length === 0) return 0;
  const tones = chordPitchClasses(symbol, keyRoot, mode);
  if (tones.size === 0) return 0;
  let hits = 0;
  for (const pc of barPcs) {
    if (tones.has(pc)) hits += 1;
  }
  return hits / barPcs.length;
}

function bestChordForBar(
  barPcs: number[],
  keyRoot: number,
  mode: ChordMode,
  preferSimple: boolean,
): ChordSymbol {
  const symbols = getModeChordSymbols(mode);
  let best: ChordSymbol = getModeDefaultChord(mode);
  let bestScore = -1;

  for (const sym of symbols) {
    if (preferSimple && (sym.includes('7') || sym.includes('°') || sym.includes('ø'))) continue;
    const s = scoreBarAgainstChord(barPcs, sym, keyRoot, mode);
    if (s > bestScore) {
      bestScore = s;
      best = sym;
    }
  }
  if (bestScore <= 0) return getModeDefaultChord(mode);
  return best;
}

function mergeConsecutiveChords(chords: ChordSymbol[]): ChordSymbol[] {
  const out: ChordSymbol[] = [];
  for (const c of chords) {
    if (out[out.length - 1] !== c) out.push(c);
  }
  return out.length > 0 ? out : [getModeDefaultChord('major')];
}

function simplifySymbol(sym: ChordSymbol, mode: ChordMode): ChordSymbol {
  const triadMap: Record<string, string> =
    mode === 'minor'
      ? {
          i7: 'i',
          iv7: 'iv',
          V7: 'V',
          VImaj7: 'VI',
          VII7: 'VII',
          I7: 'III',
        }
      : {
          Imaj7: 'I',
          I7: 'I',
          ii7: 'ii',
          iii7: 'iii',
          IV7: 'IV',
          IVmaj7: 'IV',
          V7: 'V',
          vi7: 'vi',
        };
  return (triadMap[sym] ?? sym) as ChordSymbol;
}

function tileChordsToBars(chords: ChordSymbol[], barCount: number): ChordSymbol[] {
  if (chords.length === 0) return Array.from({ length: barCount }, () => 'I' as ChordSymbol);
  const per = Math.max(1, Math.round(barCount / chords.length));
  const out: ChordSymbol[] = [];
  for (const c of chords) {
    for (let i = 0; i < per && out.length < barCount; i++) out.push(c);
  }
  while (out.length < barCount) out.push(chords[chords.length - 1]!);
  return out.slice(0, barCount);
}

/** Expand a short Roman-numeral loop to one symbol per bar (Harmony Match / Groove Lab). */
export function expandProgressionToBars(chords: ChordSymbol[], barCount: number): ChordSymbol[] {
  return tileChordsToBars(chords, barCount);
}

function scoreTiledProgression(
  tiled: ChordSymbol[],
  barChords: ChordSymbol[],
  keyRoot: number,
  mode: ChordMode,
): number {
  if (tiled.length === 0) return 0;
  let sum = 0;
  const n = Math.min(tiled.length, barChords.length);
  for (let i = 0; i < n; i++) {
    const a = tiled[i]!;
    const b = barChords[i]!;
    if (a === b) sum += 1;
    else {
      const overlap = [...chordPitchClasses(a, keyRoot, mode)].filter((pc) =>
        chordPitchClasses(b, keyRoot, mode).has(pc),
      ).length;
      sum += overlap / Math.max(1, chordPitchClasses(a, keyRoot, mode).size);
    }
  }
  return sum / Math.max(1, n);
}

function collectPresetProgressions(mode: ChordMode): { label: string; chords: ChordSymbol[] }[] {
  const out: { label: string; chords: ChordSymbol[] }[] = [];
  const seen = new Set<string>();
  for (const g of GENRES) {
    if (g.mode !== mode && mode !== 'major' && mode !== 'minor') continue;
    if ((mode === 'major' || mode === 'minor') && g.mode !== mode) continue;
    for (const p of g.progressions) {
      const key = p.chords.join('|');
      if (seen.has(key) || p.chords.length < 2) continue;
      seen.add(key);
      out.push({ label: p.name, chords: p.chords });
    }
  }
  return out;
}

function formatCandidateLabel(chords: ChordSymbol[], keyRoot: number, mode: ChordMode): string {
  const names = chords.slice(0, 4).map((c) => chordSymbolToName(c, keyRoot, mode));
  const suffix = chords.length > 4 ? '…' : '';
  return names.join('–') + suffix;
}

/**
 * Analyze monophonic pitch events and return up to four progression options.
 */
export function analyzeMelodyToProgressions(
  events: PitchEvent[],
  bpm: number,
  opts?: {
    keyRootHint?: number;
    modeHint?: ChordMode;
    maxBars?: number;
    topK?: number;
  },
): MelodyAnalysisResult | null {
  if (events.length < 8) return null;

  const estimated = estimateKey(events);
  const keyRoot = opts?.keyRootHint ?? estimated.keyRoot;
  const mode = opts?.modeHint ?? estimated.mode;

  const msPerBar = (60000 / Math.max(20, bpm)) * 4;
  const durationMs = events[events.length - 1]!.time;
  const inferredBars = Math.max(4, Math.min(opts?.maxBars ?? 16, Math.ceil(durationMs / msPerBar)));
  const barCount = Math.min(16, inferredBars);

  const barPcs = eventsToBarPitchClasses(events, bpm, barCount);
  const barChords = barPcs.map((pcs) => bestChordForBar(pcs, keyRoot, mode, false));
  const barChordsSimple = barPcs.map((pcs) => bestChordForBar(pcs, keyRoot, mode, true));

  const direct = mergeConsecutiveChords(barChords);
  const simple = mergeConsecutiveChords(barChordsSimple.map((c) => simplifySymbol(c, mode)));

  const templates = mode === 'minor' ? COMMON_TEMPLATES_MINOR : COMMON_TEMPLATES;
  const presets = collectPresetProgressions(mode);

  const rawCandidates: MelodyProgressionCandidate[] = [
    {
      id: 'direct',
      label: `Bar match · ${formatCandidateLabel(direct, keyRoot, mode)}`,
      chords: direct,
      score: 1,
    },
    {
      id: 'simple',
      label: `Triads · ${formatCandidateLabel(simple, keyRoot, mode)}`,
      chords: simple,
      score: 0.95,
    },
  ];

  for (const t of templates) {
    const tiled = tileChordsToBars(t.chords, barCount);
    const score = scoreTiledProgression(tiled, barChords, keyRoot, mode);
    rawCandidates.push({
      id: `tpl-${t.label}`,
      label: t.label,
      chords: t.chords,
      score,
    });
  }

  for (const p of presets.slice(0, 40)) {
    const tiled = tileChordsToBars(p.chords, barCount);
    const score = scoreTiledProgression(tiled, barChords, keyRoot, mode);
    if (score < 0.35) continue;
    rawCandidates.push({
      id: `preset-${p.label}`,
      label: p.label,
      chords: p.chords,
      score,
    });
  }

  rawCandidates.sort((a, b) => b.score - a.score);

  const deduped: MelodyProgressionCandidate[] = [];
  const seenKeys = new Set<string>();
  for (const c of rawCandidates) {
    const k = c.chords.join('|');
    if (seenKeys.has(k)) continue;
    seenKeys.add(k);
    deduped.push(c);
    if (deduped.length >= (opts?.topK ?? 4)) break;
  }

  if (deduped.length === 0) return null;

  return { keyRoot, mode, barCount, candidates: deduped };
}
