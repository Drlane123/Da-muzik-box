export type CreationStationPadGrid = number[][];

export type CreationStationMpcOptions = {
  pads?: number;
  steps?: number;
  bpm?: number;
  onPadTrigger?: (padId: number, step: number) => void;
};

/**
 * Independent MPC-style step engine with optional master-slave hook.
 * Uses performance clock timing and can be hard-slaved by external tick input.
 */
export class CreationStationMpc {
  readonly pads: number;
  readonly steps: number;
  readonly grid: CreationStationPadGrid;

  bpm: number;
  currentStep = 0;
  isPlaying = false;
  isSlaved = false;

  private timerId: number | null = null;
  private nextPerfMs = 0;
  private readonly onPadTrigger?: (padId: number, step: number) => void;

  constructor(opts: CreationStationMpcOptions = {}) {
    this.pads = Math.max(1, Math.floor(opts.pads ?? 16));
    this.steps = Math.max(1, Math.floor(opts.steps ?? 16));
    this.bpm = Math.max(1, opts.bpm ?? 120);
    this.onPadTrigger = opts.onPadTrigger;
    this.grid = Array.from({ length: this.pads }, () =>
      Array.from({ length: this.steps }, () => 0),
    );
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(1, bpm);
  }

  toggleNote(padIndex: number, stepIndex: number): void {
    if (padIndex < 0 || padIndex >= this.pads) return;
    if (stepIndex < 0 || stepIndex >= this.steps) return;
    const v = this.grid[padIndex]![stepIndex]!;
    this.grid[padIndex]![stepIndex] = v === 0 ? 1 : 0;
  }

  start(): void {
    if (this.isPlaying || this.isSlaved) return;
    this.isPlaying = true;
    this.nextPerfMs = performance.now();
    this.tick();
  }

  stop(): void {
    this.isPlaying = false;
    if (this.timerId != null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  setSlaved(slaved: boolean): void {
    this.isSlaved = slaved;
    if (slaved) this.stop();
  }

  /** Hard-lock to master step and execute immediately. */
  slaveTick(masterCurrentStep: number): void {
    this.isSlaved = true;
    this.stop();
    this.currentStep = ((Math.floor(masterCurrentStep) % this.steps) + this.steps) % this.steps;
    this.executeStep();
  }

  private tick(): void {
    if (!this.isPlaying || this.isSlaved) return;
    const start = performance.now();
    this.executeStep();
    const stepMs = (60_000 / this.bpm) / 4;
    this.nextPerfMs += stepMs;
    if (this.nextPerfMs < start - stepMs) this.nextPerfMs = start + stepMs;
    const delay = Math.max(0, this.nextPerfMs - performance.now());
    this.timerId = window.setTimeout(() => this.tick(), delay);
  }

  private executeStep(): void {
    const step = this.currentStep;
    for (let padId = 0; padId < this.pads; padId += 1) {
      if (this.grid[padId]![step] === 1) this.audioOutputTrigger(padId, step);
    }
    this.currentStep = (this.currentStep + 1) % this.steps;
  }

  private audioOutputTrigger(padId: number, step: number): void {
    if (this.onPadTrigger) {
      this.onPadTrigger(padId, step);
      return;
    }
    // Fallback for development tracing.
    console.debug(`[CreationStationMpc] Trigger pad ${padId} at step ${step}`);
  }
}

