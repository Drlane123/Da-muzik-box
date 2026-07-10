'use client';

import type { ReactNode } from 'react';
import { BeatPadsInstrumentAnalogKnob } from '@/app/components/creation/BeatPadsInstrumentAnalogKnob';
import { useBeatPadsFxMeterPulse } from '@/app/components/creation/BeatPadsFxSuiteInsert';
import { DelayEchoViz, ReverbRoomViz } from '@/app/components/studio/studioFxSuiteWidgets';
import {
  BEAT_PADS_DELAY_TEMPO_NOTE_OPTIONS,
  padSamplerDelayTimeLabel,
  padSamplerDelayTimeMs,
  type PadSamplerDelayFx,
  type PadSamplerDelayNote,
  type PadSamplerReverbFx,
} from '@/app/lib/creationStation/padSamplerFxRack';
import '@/app/styles/studioFxSuite.css';

function SendVizShell({ children }: { children: ReactNode }) {
  return (
    <div
      data-studio-fx-suite
      className="beat-pads-instrument-suite beat-pads-instrument-suite--viz-only beat-pads-send-suite__viz"
      style={{
        width: '100%',
        minWidth: 0,
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="beat-pads-instrument-suite__viz beat-pads-instrument-suite__viz--full flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function SendKnobRow({ children }: { children: ReactNode }) {
  return (
    <div className="beat-pads-instrument-phase-knobs beat-pads-send-suite__knobs" data-studio-fx-suite>
      {children}
    </div>
  );
}

export function BeatPadsDelaySuitePanel({
  delay,
  sessionBpm,
  onPatchDelay,
}: {
  delay: PadSamplerDelayFx;
  sessionBpm: number;
  onPatchDelay: (patch: Partial<PadSamplerDelayFx>) => void;
}) {
  const accent = '#6eb5ff';
  const activity = delay.enabled
    ? Math.max(0.18, delay.mix, delay.feedback * 0.45)
    : 0;
  const pulse = useBeatPadsFxMeterPulse(activity, delay.enabled);
  const simPeak = Math.max(pulse.inputL, pulse.inputR, pulse.mid * 0.85);
  const tempoNoteActive = (id: PadSamplerDelayNote) => delay.syncToBpm && delay.note === id;

  return (
    <div
      data-studio-fx-suite
      className="beat-pads-instrument-suite beat-pads-send-suite beat-pads-send-suite--delay"
      style={{
        width: '100%',
        minWidth: 0,
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <SendVizShell>
        <DelayEchoViz
          mix={delay.mix}
          feedback={delay.feedback}
          accent={accent}
          enabled={delay.enabled}
          trackIndex={-1}
          meterActive={false}
          simMeterPeak={simPeak}
          syncLabel={delay.syncToBpm ? delay.note : undefined}
        />
      </SendVizShell>

      <div className="beat-pads-delay-tempo-row beat-pads-send-suite__tempo">
        <button
          type="button"
          className="beat-pads-delay-tempo-sync"
          data-active={delay.syncToBpm ? 'true' : 'false'}
          onClick={() => onPatchDelay({ syncToBpm: !delay.syncToBpm })}
          title="Lock delay time to beat tempo"
        >
          {delay.syncToBpm ? 'TEMPO' : 'FREE'}
        </button>
        {delay.syncToBpm
          ? BEAT_PADS_DELAY_TEMPO_NOTE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="beat-pads-delay-tempo-note"
                data-active={tempoNoteActive(opt.id) ? 'true' : 'false'}
                onClick={() => onPatchDelay({ note: opt.id, syncToBpm: true })}
                title={`${opt.label} note @ ${Math.round(sessionBpm)} BPM`}
              >
                {opt.label}
              </button>
            ))
          : null}
        <span className="beat-pads-delay-tempo-readout" title={padSamplerDelayTimeLabel(sessionBpm, delay)}>
          {delay.syncToBpm
            ? `${delay.note} · ${padSamplerDelayTimeMs(sessionBpm, delay)} ms`
            : `${Math.round(delay.timeMs)} ms`}
        </span>
      </div>

      <SendKnobRow>
        <BeatPadsInstrumentAnalogKnob
          label="MIX"
          min={0}
          max={100}
          step={1}
          value={Math.round(delay.mix * 100)}
          onChange={(v) =>
            onPatchDelay({
              enabled: v > 2 || delay.enabled,
              mix: Math.max(0, Math.min(1, v / 100)),
            })
          }
          format={(v) => `${Math.round(v)}%`}
          accent={accent}
        />
        <BeatPadsInstrumentAnalogKnob
          label="FEEDBACK"
          min={0}
          max={92}
          step={1}
          value={Math.round(delay.feedback * 100)}
          onChange={(v) => onPatchDelay({ feedback: Math.max(0, Math.min(0.92, v / 100)) })}
          format={(v) => `${Math.round(v)}%`}
          accent={accent}
        />
        {!delay.syncToBpm ? (
          <BeatPadsInstrumentAnalogKnob
            label="TIME"
            min={20}
            max={2000}
            step={1}
            scale="log"
            value={Math.round(delay.timeMs)}
            onChange={(v) =>
              onPatchDelay({
                syncToBpm: false,
                timeMs: Math.max(20, Math.min(2000, Math.round(v))),
              })
            }
            format={(v) => `${Math.round(v)}ms`}
            accent={accent}
          />
        ) : null}
      </SendKnobRow>
    </div>
  );
}

export function BeatPadsReverbSuitePanel({
  reverb,
  onPatchReverb,
}: {
  reverb: PadSamplerReverbFx;
  onPatchReverb: (patch: Partial<PadSamplerReverbFx>) => void;
}) {
  const accent = '#a78bfa';
  const activity = reverb.enabled ? Math.max(0.18, reverb.mix) : 0;
  const pulse = useBeatPadsFxMeterPulse(activity, reverb.enabled);
  const simPeak = Math.max(pulse.inputL, pulse.inputR, pulse.outputL * 0.9);

  return (
    <div
      data-studio-fx-suite
      className="beat-pads-instrument-suite beat-pads-send-suite beat-pads-send-suite--reverb"
      style={{
        width: '100%',
        minWidth: 0,
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <SendVizShell>
        <ReverbRoomViz
          mix={reverb.mix}
          decaySec={reverb.decaySec}
          accent={accent}
          enabled={reverb.enabled}
          trackIndex={-1}
          meterActive={false}
          simMeterPeak={simPeak}
        />
      </SendVizShell>

      <SendKnobRow>
        <BeatPadsInstrumentAnalogKnob
          label="MIX"
          min={0}
          max={100}
          step={1}
          value={Math.round(reverb.mix * 100)}
          onChange={(v) =>
            onPatchReverb({
              enabled: v > 2 || reverb.enabled,
              mix: Math.max(0, Math.min(1, v / 100)),
            })
          }
          format={(v) => `${Math.round(v)}%`}
          accent={accent}
        />
        <BeatPadsInstrumentAnalogKnob
          label="DECAY"
          min={0.2}
          max={3}
          step={0.1}
          value={Math.round(reverb.decaySec * 10) / 10}
          onChange={(v) =>
            onPatchReverb({
              enabled: true,
              decaySec: Math.max(0.2, Math.min(3, v)),
            })
          }
          format={(v) => `${v.toFixed(1)}s`}
          accent={accent}
        />
      </SendKnobRow>
    </div>
  );
}
