/**
 * Studio Editor 2 — Geno Ultra Synth dedicated lane.
 */
import { genoUltraPresetById, genoUltraSanitizePresetId } from '@/app/lib/studio/genoUltraSynthPresets';
import type { GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import type { StudioEditor2MidiTrack } from '@/app/lib/studio/studioEditor2Midi';

export const SE2_GENO_ULTRA_SYNTH_ACCENT = '#A78BFA';

export type Se2GenoUltraSynthTrackFields = {
  kind: 'genoUltraSynth';
  genoUltraPresetId?: string;
  genoUltraPatchLabel?: string;
  /** When true, ARP preview follows SE2 transport play/stop and BPM (standalone ARP OFF when locked). */
  genoUltraArpSyncLocked?: boolean;
  /** Per-track standalone ARP tempo — independent of SE2 session BPM. */
  genoUltraArpBpm?: number;
};

export type Se2GenoUltraSynthTrack = StudioEditor2MidiTrack & Se2GenoUltraSynthTrackFields;

export function studioTrackIsGenoUltraSynthChannel(
  tr: { kind?: string } | undefined,
): tr is Se2GenoUltraSynthTrack {
  return tr?.kind === 'genoUltraSynth';
}

export function se2GenoUltraVoiceFromTrack(
  tr: Se2GenoUltraSynthTrack,
  storedVoice: GenoUltraSynthVoiceParams | undefined,
): GenoUltraSynthVoiceParams {
  const presetId = genoUltraSanitizePresetId(tr.genoUltraPresetId);
  const base = genoUltraPresetById(presetId);
  const label =
    tr.genoUltraPatchLabel?.trim() || storedVoice?.label?.trim() || base.label;
  /** Prefer the live edited voice; fall back to bank dry body. */
  if (storedVoice) {
    return {
      ...storedVoice,
      label: storedVoice.label || label,
      osc1: { ...storedVoice.osc1 },
      osc2: { ...storedVoice.osc2 },
      osc3: { ...storedVoice.osc3 },
      modSlots: storedVoice.modSlots.map((s) => ({ ...s })),
      fx: { ...storedVoice.fx },
    };
  }
  return { ...base, label };
}

export function se2GenoUltraPatchLabelFromTrack(tr: Se2GenoUltraSynthTrack): string {
  return tr.genoUltraPatchLabel?.trim() || se2GenoUltraVoiceFromTrack(tr, undefined).label;
}

export function nextGenoUltraSynthTrackName(tracks: readonly { kind?: string; name?: string }[]): string {
  const n = tracks.filter((t) => t.kind === 'genoUltraSynth').length + 1;
  return n === 1 ? 'Geno Ultra Synth' : `Geno Ultra Synth ${n}`;
}

export function se2DefaultGenoUltraSynthTrack(partial?: {
  id: string;
  name: string;
  colorHex: string;
  midiChannel?: number;
}): Se2GenoUltraSynthTrack & {
  id: string;
  name: string;
  colorHex: string;
  notes: [];
  audioClips: [];
} {
  const voice = genoUltraPresetById(genoUltraSanitizePresetId(undefined));
  return {
    id: partial?.id ?? 't-geno-ultra',
    name: partial?.name ?? 'Geno Ultra Synth',
    colorHex: partial?.colorHex ?? SE2_GENO_ULTRA_SYNTH_ACCENT,
    kind: 'genoUltraSynth',
    genoUltraPresetId: voice.id,
    genoUltraPatchLabel: voice.label,
    genoUltraArpSyncLocked: false,
    midiChannel: partial?.midiChannel,
    notes: [],
    audioClips: [],
  };
}

/** Piano-roll default register — C3–C5 Yamaha (MIDI 60–84; middle C = MIDI 60). */
export const SE2_GENO_ULTRA_PITCH_DEFAULT_LO = 60;
export const SE2_GENO_ULTRA_PITCH_DEFAULT_HI = 84;

export function se2GenoUltraEmptyPitchRange(): { min: number; max: number } {
  return { min: SE2_GENO_ULTRA_PITCH_DEFAULT_LO, max: SE2_GENO_ULTRA_PITCH_DEFAULT_HI };
}

export function se2GenoUltraPitchSpanNotes(): { pitch: number; startBeat: number; durationBeats: number; velocity: number }[] {
  const lo = SE2_GENO_ULTRA_PITCH_DEFAULT_LO;
  const hi = SE2_GENO_ULTRA_PITCH_DEFAULT_HI;
  const out: { pitch: number; startBeat: number; durationBeats: number; velocity: number }[] = [];
  for (let p = lo; p <= hi; p += 1) {
    out.push({ pitch: p, startBeat: 0, durationBeats: 0.25, velocity: 1 });
  }
  return out;
}
