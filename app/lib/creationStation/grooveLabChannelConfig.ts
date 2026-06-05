/**
 * Groove Lab CH 33–48 — layer routing + per-channel sound (persisted).
 * Layers: CHORD, GUITAR, GROOVE LEAD, ORCH HITS, and work lanes.
 */
import type { ChordVoiceId } from '@/app/lib/creationStation/chordSequencerVoices';
import {
  CHORD_BASS_SEQ_CHANNEL_BASE,
  CHORD_BASS_SEQ_CHANNEL_COUNT,
} from '@/app/lib/creationStation/chordBassSequencerSession';
import type { GrooveLabAnyLeadSoundId } from '@/app/lib/creationStation/grooveLabLeadSounds';
import { GROOVE_LAB_LEAD_SOUND_DEFAULT } from '@/app/lib/creationStation/grooveLabLeadSounds';
import {
  grooveLabChannelIds,
  grooveLabDefaultLayerChannels,
  grooveLabPickChordChannel,
  grooveLabPickGuitarChannel,
  grooveLabPickMelodyChannel,
  grooveLabPickSampleChannel,
} from '@/app/lib/creationStation/grooveLabRoll';
import type { WaveLeafPresetId } from '@/app/lib/creationStation/waveLeafPresets';
import { WAVE_LEAF_DEFAULT_PRESET } from '@/app/lib/creationStation/waveLeafPresets';
import { GROOVE_GUITAR_SOUND_DEFAULT } from '@/app/lib/creationStation/grooveLabGuitarSoundBank';
import {
  GROOVE_ORCHESTRA_HIT_DEFAULT,
  resolveGrooveLabOrchestraHitId,
} from '@/app/lib/creationStation/grooveLabOrchestraHitSoundBank';
import type { OrchestraHitId } from '@/app/lib/creationStation/grooveLabOrchestraHitBank';

export type GrooveLabLayerRole = 'chord' | 'guitar' | 'waveleaf' | 'sample' | 'work';

export type GrooveLabLayerRouting = {
  chord: number;
  melody: number;
  guitar: number;
  sample: number;
};

export type GrooveLabChannelSoundKind = 'chord' | 'lead' | 'waveleaf' | 'orchestra';

export type GrooveLabChannelSoundConfig = {
  kind: GrooveLabChannelSoundKind;
  chordVoice?: ChordVoiceId;
  leadId?: GrooveLabAnyLeadSoundId;
  waveLeafPreset?: WaveLeafPresetId;
  orchestraHitId?: OrchestraHitId;
};

const STORAGE_SOUNDS = 'groove-lab-channel-sounds-v3';

const DEFAULT_GUITAR_LEAD_ID: GrooveLabAnyLeadSoundId = GROOVE_GUITAR_SOUND_DEFAULT;

export function grooveLabLayerRoleForChannel(
  ch: number,
  chordChannel: number,
  waveLeafChannel: number,
  guitarChannel?: number,
  sampleChannel?: number,
): GrooveLabLayerRole {
  if (ch === chordChannel) return 'chord';
  if (ch === waveLeafChannel) return 'waveleaf';
  if (guitarChannel != null && ch === guitarChannel) return 'guitar';
  if (sampleChannel != null && ch === sampleChannel) return 'sample';
  return 'work';
}

export function defaultGrooveLabChannelSound(role: GrooveLabLayerRole): GrooveLabChannelSoundConfig {
  switch (role) {
    case 'chord':
      return { kind: 'chord', chordVoice: 'grand' };
    case 'sample':
      return { kind: 'orchestra', orchestraHitId: GROOVE_ORCHESTRA_HIT_DEFAULT };
    case 'guitar':
      return { kind: 'lead', leadId: DEFAULT_GUITAR_LEAD_ID };
    case 'waveleaf':
      return { kind: 'waveleaf', waveLeafPreset: WAVE_LEAF_DEFAULT_PRESET };
    default:
      return { kind: 'lead', leadId: GROOVE_LAB_LEAD_SOUND_DEFAULT };
  }
}

function parseStoredSound(raw: unknown): GrooveLabChannelSoundConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === 'bass') return null;
  const kind = o.kind;
  if (kind === 'chord' && typeof o.chordVoice === 'string') {
    return { kind: 'chord', chordVoice: o.chordVoice as ChordVoiceId };
  }
  if (kind === 'lead' && typeof o.leadId === 'string') {
    return { kind: 'lead', leadId: o.leadId as GrooveLabAnyLeadSoundId };
  }
  if (kind === 'waveleaf' && typeof o.waveLeafPreset === 'string') {
    return { kind: 'waveleaf', waveLeafPreset: o.waveLeafPreset as WaveLeafPresetId };
  }
  if (kind === 'orchestra' && typeof o.orchestraHitId === 'string') {
    return { kind: 'orchestra', orchestraHitId: resolveGrooveLabOrchestraHitId(o.orchestraHitId) };
  }
  return null;
}

export function readGrooveLabChannelSounds(): Record<number, GrooveLabChannelSoundConfig> {
  const defaults = grooveLabDefaultLayerChannels();
  const out: Record<number, GrooveLabChannelSoundConfig> = {};
  for (const ch of grooveLabChannelIds()) {
    const role = grooveLabLayerRoleForChannel(
      ch,
      defaults.chord,
      defaults.melody,
      defaults.guitar,
      defaults.sample,
    );
    out[ch] = defaultGrooveLabChannelSound(role);
  }
  if (typeof window === 'undefined') return out;
  try {
    const raw = window.localStorage.getItem(STORAGE_SOUNDS);
    if (!raw) return out;
    const obj = JSON.parse(raw) as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const ch = Number(key);
      if (!Number.isFinite(ch) || ch < CHORD_BASS_SEQ_CHANNEL_BASE) continue;
      if (ch >= CHORD_BASS_SEQ_CHANNEL_BASE + CHORD_BASS_SEQ_CHANNEL_COUNT) continue;
      const parsed = parseStoredSound(obj[key]);
      if (parsed) out[ch] = parsed;
    }
  } catch {
    /* ignore */
  }
  return out;
}

export function writeGrooveLabChannelSounds(sounds: Record<number, GrooveLabChannelSoundConfig>): void {
  if (typeof window === 'undefined') return;
  try {
    const flat: Record<string, GrooveLabChannelSoundConfig> = {};
    for (const ch of grooveLabChannelIds()) {
      if (sounds[ch]) flat[String(ch)] = sounds[ch]!;
    }
    window.localStorage.setItem(STORAGE_SOUNDS, JSON.stringify(flat));
  } catch {
    /* ignore */
  }
}

export function resolveGrooveLabChordVoiceId(
  sounds: Record<number, GrooveLabChannelSoundConfig>,
  chordChannel: number,
  fallback: ChordVoiceId,
): ChordVoiceId {
  const cfg = sounds[chordChannel];
  if (cfg?.kind === 'chord' && cfg.chordVoice) return cfg.chordVoice;
  return fallback;
}

export function resolveGrooveLabOrchestraHitSoundId(
  sounds: Record<number, GrooveLabChannelSoundConfig>,
  orchestraChannel: number,
  fallback: OrchestraHitId = GROOVE_ORCHESTRA_HIT_DEFAULT,
): OrchestraHitId {
  const cfg = sounds[orchestraChannel];
  if (cfg?.kind === 'orchestra' && cfg.orchestraHitId) {
    return resolveGrooveLabOrchestraHitId(cfg.orchestraHitId);
  }
  return fallback;
}

export function resolveGrooveLabWaveLeafPresetId(
  sounds: Record<number, GrooveLabChannelSoundConfig>,
  waveLeafChannel: number,
  fallback: WaveLeafPresetId,
): WaveLeafPresetId {
  const cfg = sounds[waveLeafChannel];
  if (cfg?.kind === 'waveleaf' && cfg.waveLeafPreset) return cfg.waveLeafPreset;
  return fallback;
}

export function resolveGrooveLabLeadSoundId(
  sounds: Record<number, GrooveLabChannelSoundConfig>,
  ch: number,
  fallback: GrooveLabAnyLeadSoundId,
): GrooveLabAnyLeadSoundId {
  const cfg = sounds[ch];
  if (cfg?.kind === 'lead' && cfg.leadId) return cfg.leadId;
  return fallback;
}

/** Assign CHORD, GUITAR, GROOVE LEAD, ORCH HITS, or work lane to a channel. */
/** Ensure four distinct CH 33–48 layer assignments (safe after storage / partial state). */
export function grooveLabSanitizeLayerRouting(
  partial?: Partial<GrooveLabLayerRouting>,
): GrooveLabLayerRouting {
  const d = grooveLabDefaultLayerChannels();
  let chord = partial?.chord ?? d.chord;
  let melody = partial?.melody ?? d.melody;
  let guitar = partial?.guitar ?? d.guitar;
  let sample = partial?.sample ?? d.sample;
  if (!grooveLabChannelIds().includes(chord)) chord = d.chord;
  if (!grooveLabChannelIds().includes(melody) || melody === chord) {
    melody = grooveLabPickMelodyChannel(chord);
  }
  if (
    !grooveLabChannelIds().includes(guitar) ||
    guitar === chord ||
    guitar === melody
  ) {
    guitar = grooveLabPickGuitarChannel(chord, melody, undefined, sample);
  }
  if (
    !grooveLabChannelIds().includes(sample) ||
    sample === chord ||
    sample === melody ||
    sample === guitar
  ) {
    sample = grooveLabPickSampleChannel(chord, melody, guitar);
  }
  return { chord, melody, guitar, sample };
}

export function grooveLabAssignLayerToChannel(
  ch: number,
  role: GrooveLabLayerRole,
  current: GrooveLabLayerRouting,
): GrooveLabLayerRouting {
  const ids = grooveLabChannelIds();
  if (!ids.includes(ch)) return grooveLabSanitizeLayerRouting(current);

  let { chord, melody, guitar, sample } = grooveLabSanitizeLayerRouting(current);

  if (role === 'work') {
    if (ch === chord) {
      chord = grooveLabPickChordChannel(undefined);
      if (melody === ch) melody = grooveLabPickMelodyChannel(chord, undefined, sample);
      if (guitar === ch) guitar = grooveLabPickGuitarChannel(chord, melody, undefined, sample);
      if (sample === ch) sample = grooveLabPickSampleChannel(chord, melody, guitar);
    }
    if (ch === melody) {
      melody = grooveLabPickMelodyChannel(chord, undefined, sample);
      if (guitar === ch) guitar = grooveLabPickGuitarChannel(chord, melody, undefined, sample);
      if (sample === ch) sample = grooveLabPickSampleChannel(chord, melody, guitar);
    }
    if (ch === guitar) {
      guitar = grooveLabPickGuitarChannel(chord, melody, undefined, sample);
      if (sample === ch) sample = grooveLabPickSampleChannel(chord, melody, guitar);
    }
    if (ch === sample) {
      sample = grooveLabPickSampleChannel(chord, melody, guitar);
    }
    return grooveLabSanitizeLayerRouting({ chord, melody, guitar, sample });
  }

  if (role === 'chord') {
    if (ch === melody) melody = grooveLabPickMelodyChannel(chord, undefined, sample);
    if (ch === guitar) guitar = grooveLabPickGuitarChannel(ch, melody, undefined, sample);
    if (ch === sample) sample = grooveLabPickSampleChannel(ch, melody, guitar);
    return grooveLabSanitizeLayerRouting({ chord: ch, melody, guitar, sample });
  }

  if (role === 'guitar') {
    if (ch === chord) chord = grooveLabPickChordChannel(undefined);
    if (ch === melody) melody = grooveLabPickMelodyChannel(chord, undefined, sample);
    if (ch === sample) sample = grooveLabPickSampleChannel(chord, melody, ch);
    return grooveLabSanitizeLayerRouting({ chord, melody, guitar: ch, sample });
  }

  if (role === 'sample') {
    if (ch === chord) chord = grooveLabPickChordChannel(undefined);
    if (ch === melody) melody = grooveLabPickMelodyChannel(chord, undefined, sample);
    if (ch === guitar) guitar = grooveLabPickGuitarChannel(chord, melody, undefined, ch);
    return grooveLabSanitizeLayerRouting({ chord, melody, guitar, sample: ch });
  }

  if (ch === chord) chord = grooveLabPickChordChannel(undefined);
  if (ch === guitar) guitar = grooveLabPickGuitarChannel(chord, ch, undefined, sample);
  if (ch === sample) sample = grooveLabPickSampleChannel(chord, ch, guitar);
  return grooveLabSanitizeLayerRouting({ chord, melody: ch, guitar, sample });
}
