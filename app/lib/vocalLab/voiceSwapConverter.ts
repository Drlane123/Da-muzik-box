/**
 * AI Voice Swap — browser DSP artist-tone presets on Hum Capture audio.
 */
import {
  audioBufferToWavBlob,
  decodeAudioBlob,
  renderVocalCharacterDsp,
  type VocalCharacterDsp,
} from '@/app/lib/vocalLab/rvcVoiceConverter';

export type VoiceSwapStyleId =
  | 'soulful'
  | 'gritty'
  | 'smooth'
  | 'warm'
  | 'energetic'
  | 'ethereal';

export type VoiceSwapStyle = {
  id: VoiceSwapStyleId;
  label: string;
  color: string;
  description: string;
  dsp: VocalCharacterDsp;
};

export const VOICE_SWAP_STYLES: readonly VoiceSwapStyle[] = [
  {
    id: 'soulful',
    label: 'Soulful',
    color: '#ff6b35',
    description: 'Rich mids, gentle warmth — R&B / soul lead',
    dsp: {
      pitchShiftCents: 0,
      bandShiftCents: { low: 60, mid: 140, high: 40 },
      eq: { low: 5, mid: 8, high: 1, presence: 5 },
    },
  },
  {
    id: 'gritty',
    label: 'Gritty',
    color: '#888',
    description: 'Forward mid grit, chest presence — rock / blues',
    dsp: {
      pitchShiftCents: 0,
      bandShiftCents: { low: -80, mid: 220, high: -60 },
      eq: { low: 7, mid: 9, high: -4, presence: 7 },
    },
  },
  {
    id: 'smooth',
    label: 'Smooth',
    color: '#00E5FF',
    description: 'Soft highs, even tone — pop ballad',
    dsp: {
      pitchShiftCents: 0,
      bandShiftCents: { low: 20, mid: 40, high: -40 },
      eq: { low: 2, mid: 4, high: -2, presence: 2 },
    },
  },
  {
    id: 'warm',
    label: 'Warm',
    color: '#ffcc00',
    description: 'Low body, rounded top — jazz / crooner',
    dsp: {
      pitchShiftCents: 0,
      bandShiftCents: { low: 120, mid: 60, high: -20 },
      eq: { low: 8, mid: 5, high: -3, presence: 3 },
    },
  },
  {
    id: 'energetic',
    label: 'Energetic',
    color: '#D500F9',
    description: 'Bright presence, punchy mids — pop / dance',
    dsp: {
      pitchShiftCents: 0,
      bandShiftCents: { low: -40, mid: 160, high: 120 },
      eq: { low: -2, mid: 7, high: 6, presence: 9 },
    },
  },
  {
    id: 'ethereal',
    label: 'Ethereal',
    color: '#a78bfa',
    description: 'Airy highs, lifted formants — ambient / dream pop',
    dsp: {
      pitchShiftCents: 0,
      bandShiftCents: { low: -60, mid: 80, high: 280 },
      eq: { low: -4, mid: 0, high: 9, presence: 8 },
    },
  },
] as const;

export type VoiceSwapResult = {
  audioBuffer: AudioBuffer;
  wavBlob: Blob;
  durationSec: number;
  styleId: VoiceSwapStyleId;
  styleLabel: string;
};

export function voiceSwapStyleById(id: VoiceSwapStyleId): VoiceSwapStyle {
  return VOICE_SWAP_STYLES.find((s) => s.id === id) ?? VOICE_SWAP_STYLES[0]!;
}

export async function convertVoiceSwap(
  liveCtx: AudioContext,
  sourceBlob: Blob,
  styleId: VoiceSwapStyleId,
  intensityPct: number,
): Promise<VoiceSwapResult> {
  const style = voiceSwapStyleById(styleId);
  const sourceBuffer = await decodeAudioBlob(liveCtx, sourceBlob);
  if (sourceBuffer.duration < 0.2) {
    throw new Error('Recording is too short — hum or sing at least a few seconds in Hum Capture.');
  }

  const audioBuffer = await renderVocalCharacterDsp(sourceBuffer, style.dsp, intensityPct);
  const wavBlob = audioBufferToWavBlob(audioBuffer);

  return {
    audioBuffer,
    wavBlob,
    durationSec: audioBuffer.duration,
    styleId: style.id,
    styleLabel: style.label,
  };
}

export function downloadVoiceSwapWav(blob: Blob, styleLabel: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `voice-swap-${styleLabel.toLowerCase().replace(/\s+/g, '-')}.wav`;
  a.click();
  URL.revokeObjectURL(url);
}
