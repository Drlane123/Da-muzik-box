/**
 * SE2 live-record UI session — MediaRecorder owns the take.
 * No ScriptProcessor / PCM tap (those caused record-start glitches and VU starvation).
 * Growing clip preview is a DOM overlay driven from the playhead beat.
 */

export class Se2LiveRecordingCapture {
  /** @deprecated kept for session shape — no audio graph tap. */
  startFromTap(_sourceNode: AudioNode): boolean {
    return false;
  }

  get sampleCount(): number {
    return 0;
  }

  getLivePeaks(): number[] {
    return [];
  }

  buildBuffer(): AudioBuffer | null {
    return null;
  }

  stop(): void {
    /* no-op */
  }
}

export type Se2LiveRecordUiSession = {
  sourceId: string;
  clipId: string;
  trackIndex: number;
  startBeat: number;
  capture: Se2LiveRecordingCapture;
  lastUiTickMs: number;
  previewEnabled: boolean;
  /** Track color for the live overlay. */
  colorHex: string;
};
