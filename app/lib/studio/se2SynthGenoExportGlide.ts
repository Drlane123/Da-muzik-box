/**
 * Bake Geno Build 1/2 glide & slide into note flex curves for piano-roll apply + transport playback.
 */
import type { Se2SynthGenoPluginDraft } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import { genoApplyBassGlide } from '@/app/lib/studio/se2SynthGenoBassEngine';
import { planLiveChordVoiceLeading } from '@/app/lib/studio/se2SynthGenoLiveChordGlide';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';

export function genoBassSlideGlideBeats(bpm: number): number {
  return Math.max(0.04, Math.min(0.2, (0.09 * 120) / Math.max(40, bpm)));
}

export function genoChordGlideBeats(bpm: number): number {
  return Math.max(0.05, Math.min(0.25, (0.11 * 120) / Math.max(40, bpm)));
}

/** Bass slide — legato overlap + pitch bend at note starts (export + track playback). */
export function genoApplyBassSlideExport(
  notes: readonly StudioEditor2GenNote[],
  opts?: { bpm?: number; overlapBeats?: number },
): StudioEditor2GenNote[] {
  if (notes.length === 0) return [];
  const glideBeats = genoBassSlideGlideBeats(opts?.bpm ?? 120);
  const withOverlap = genoApplyBassGlide(notes, { overlapBeats: opts?.overlapBeats ?? 0.1 });
  const sorted = [...withOverlap].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  const out: StudioEditor2GenNote[] = [];
  let prevPitch: number | undefined;

  for (const n of sorted) {
    const note: StudioEditor2GenNote = { ...n };
    if (prevPitch != null && prevPitch !== note.pitch) {
      const holdBeat = Math.max(glideBeats * 2, note.durationBeats * 0.35);
      note.flexCurve = [
        { beatOffset: 0, pitch: prevPitch },
        { beatOffset: glideBeats, pitch: note.pitch },
        { beatOffset: holdBeat, pitch: note.pitch },
      ];
    }
    out.push(note);
    prevPitch = note.pitch;
  }
  return out;
}

function chordBlockKey(startBeat: number): number {
  return Math.round(startBeat * 10000) / 10000;
}

/** Chord glide — voice-leading pitch bends between chord blocks (export + track playback). */
export function genoApplyChordGlideExport(
  notes: readonly StudioEditor2GenNote[],
  opts?: { bpm?: number },
): StudioEditor2GenNote[] {
  if (notes.length === 0) return [];
  const glideBeats = genoChordGlideBeats(opts?.bpm ?? 120);
  const byBeat = new Map<number, StudioEditor2GenNote[]>();
  for (const n of notes) {
    const key = chordBlockKey(n.startBeat);
    const list = byBeat.get(key) ?? [];
    list.push({ ...n });
    byBeat.set(key, list);
  }

  const beats = [...byBeat.keys()].sort((a, b) => a - b);
  let prevTones: number[] = [];
  const out: StudioEditor2GenNote[] = [];

  for (const beat of beats) {
    const block = byBeat.get(beat)!;
    block.sort((a, b) => a.pitch - b.pitch);
    const toTones = block.map((n) => n.pitch);
    const pairs = planLiveChordVoiceLeading(prevTones, toTones);

    for (let i = 0; i < block.length; i += 1) {
      const note = block[i]!;
      const from = pairs[i]?.from;
      if (from != null && from !== note.pitch) {
        const holdBeat = Math.max(glideBeats * 2, note.durationBeats * 0.25);
        note.flexCurve = [
          { beatOffset: 0, pitch: from },
          { beatOffset: glideBeats, pitch: note.pitch },
          { beatOffset: holdBeat, pitch: note.pitch },
        ];
      }
      out.push(note);
    }
    prevTones = toTones;
  }
  return out;
}

export function se2SynthGenoApplyExportGlideToDraft(
  draft: Se2SynthGenoPluginDraft,
  opts: { bassGlide?: boolean; chordGlide?: boolean; bpm?: number },
): Se2SynthGenoPluginDraft {
  const bpm = opts.bpm ?? 120;
  return {
    ...draft,
    chordNotes:
      opts.chordGlide && draft.chordNotes.length > 0
        ? genoApplyChordGlideExport(draft.chordNotes, { bpm })
        : draft.chordNotes,
    bassNotes:
      opts.bassGlide && draft.bassNotes.length > 0
        ? genoApplyBassSlideExport(draft.bassNotes, { bpm })
        : draft.bassNotes,
  };
}
