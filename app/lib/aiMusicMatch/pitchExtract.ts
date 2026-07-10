/**
 * Fast pitch extract for AI Music Match — avoids freezing on long uploads.
 */
import { filterPitchEventsForMatchSource, type AiMatchSource } from '@/app/lib/aiMusicMatch/aiMusicMatch';
import { detectPitchACF, type PitchEvent } from '@/app/lib/pitchDetection';

/** Music Match-style: key/chord match only needs ~30–45 sec of vocal content. */
export const AI_MATCH_MAX_ANALYZE_SEC = 45;

export function matchAnalysisWindowLabel(bufferDurationSec: number): string | null {
  if (bufferDurationSec <= AI_MATCH_MAX_ANALYZE_SEC + 2) return null;
  return `Analyzing first ${AI_MATCH_MAX_ANALYZE_SEC}s of ${Math.round(bufferDurationSec)}s clip (enough for key + chords)`;
}

function hopSizeForDuration(durationSec: number): number {
  if (durationSec > 90) return 2048;
  if (durationSec > 30) return 1024;
  return 512;
}

export async function extractPitchEventsForMatchAsync(
  buffer: AudioBuffer,
  onProgress?: (pct: number) => void,
): Promise<PitchEvent[]> {
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const maxSamples = Math.min(
    channelData.length,
    Math.floor(sampleRate * AI_MATCH_MAX_ANALYZE_SEC),
  );
  const frameSize = 4096;
  const hopSize = hopSizeForDuration(buffer.duration);
  const events: PitchEvent[] = [];

  const end = Math.max(0, maxSamples - frameSize);
  const totalSteps = Math.max(1, Math.ceil(end / hopSize));
  let step = 0;

  for (let i = 0; i < end; i += hopSize) {
    const frame = channelData.subarray(i, i + frameSize);
    const { frequency, confidence } = detectPitchACF(frame, sampleRate);
    if (confidence > 0.12 && frequency > 0) {
      events.push({
        time: (i / sampleRate) * 1000,
        frequency,
        confidence,
        velocity: 100,
      });
    }
    step += 1;
    if (step % 8 === 0) {
      onProgress?.(Math.min(100, Math.round((step / totalSteps) * 100)));
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  onProgress?.(100);
  return events;
}

/** Re-filter cached pitch when user changes "Based on" only. */
export function filterCachedPitchEvents(events: readonly PitchEvent[], source: AiMatchSource): PitchEvent[] {
  return filterPitchEventsForMatchSource(events, source);
}
