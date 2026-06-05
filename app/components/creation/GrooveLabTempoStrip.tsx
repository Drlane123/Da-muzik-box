import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronUp, Link2, Zap } from 'lucide-react';
import {
  clampGrooveLabBpm,
  formatGrooveLabBarDuration,
  GROOVE_LAB_BPM_MAX,
  GROOVE_LAB_BPM_MIN,
} from '@/app/lib/creationStation/grooveLabTempo';

export interface GrooveLabTempoStripProps {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  /** When true, tempo is the same clock as Creation Station transport / Beat Lab. */
  sessionLocked?: boolean;
  disabled?: boolean;
  transportPlaying?: boolean;
  /** Smaller control for progression panel / tight toolbars (no slider). */
  compact?: boolean;
  /** Single-row BPM + slider inside Groove Lab transport bar. */
  transportBar?: boolean;
}

export function GrooveLabTempoStrip({
  bpm,
  onBpmChange,
  sessionLocked = false,
  disabled = false,
  transportPlaying = false,
  compact = false,
  transportBar = false,
}: GrooveLabTempoStripProps) {
  const safeBpm = clampGrooveLabBpm(bpm);
  const [bpmInput, setBpmInput] = useState(String(safeBpm));

  useEffect(() => {
    setBpmInput(String(clampGrooveLabBpm(bpm)));
  }, [bpm]);

  const commit = useCallback(
    (next: number) => {
      if (disabled) return;
      onBpmChange(clampGrooveLabBpm(next));
    },
    [disabled, onBpmChange],
  );

  const barLabel = formatGrooveLabBarDuration(safeBpm);

  const bpmInputBox = (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        background: '#0a1018',
        border: '1px solid #1f3a29',
        borderRadius: 5,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: transportBar ? '1px 6px' : '2px 8px' }}>
        <Zap size={transportBar ? 10 : 11} style={{ color: '#7cf4c6', flexShrink: 0 }} />
        <input
          type="text"
          inputMode="numeric"
          readOnly={disabled}
          value={bpmInput}
          onChange={(e) => {
            if (disabled) return;
            setBpmInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === 'Enter') e.currentTarget.blur();
            else if (e.key === 'Escape') {
              setBpmInput(String(safeBpm));
              e.currentTarget.blur();
            }
          }}
          onBlur={() => {
            if (disabled) return;
            const v = parseInt(bpmInput.trim(), 10);
            if (Number.isFinite(v)) commit(v);
            else setBpmInput(String(safeBpm));
          }}
          onFocus={(e) => e.currentTarget.select()}
          title={`Tempo ${GROOVE_LAB_BPM_MIN}–${GROOVE_LAB_BPM_MAX} BPM — Enter to apply`}
          style={{
            width: transportBar ? 38 : 44,
            background: 'transparent',
            border: 'none',
            color: '#7cf4c6',
            fontSize: transportBar ? 12 : 14,
            fontFamily: 'monospace',
            fontWeight: 800,
            outline: 'none',
            textAlign: 'center',
            cursor: disabled ? 'not-allowed' : 'text',
            opacity: disabled ? 0.45 : 1,
          }}
        />
        <span style={{ fontSize: transportBar ? 8 : 9, color: '#6b7280', fontWeight: 800 }}>BPM</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid #1f3a29' }}>
        <button
          type="button"
          disabled={disabled || safeBpm >= GROOVE_LAB_BPM_MAX}
          onClick={() => commit(safeBpm + 1)}
          style={stepBtn(disabled)}
          aria-label="Increase BPM"
        >
          <ChevronUp size={transportBar ? 11 : 13} />
        </button>
        <button
          type="button"
          disabled={disabled || safeBpm <= GROOVE_LAB_BPM_MIN}
          onClick={() => commit(safeBpm - 1)}
          style={{ ...stepBtn(disabled), borderTop: '1px solid #1f3a29' }}
          aria-label="Decrease BPM"
        >
          <ChevronDown size={transportBar ? 11 : 13} />
        </button>
      </div>
    </div>
  );

  if (transportBar) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
          maxWidth: 'min(100%, 280px)',
        }}
        title={`4/4 · ${barLabel}s per bar${sessionLocked ? ' · session BPM locked' : ''}`}
      >
        <span
          style={{
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: 0.4,
            color: sessionLocked ? '#7cf4c6' : '#6b7280',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            whiteSpace: 'nowrap',
          }}
        >
          {sessionLocked ? <Link2 size={9} /> : null}
          TEMPO
          {transportPlaying ? <span style={{ color: '#4ade80' }}>▶</span> : null}
        </span>
        {bpmInputBox}
        <input
          type="range"
          min={GROOVE_LAB_BPM_MIN}
          max={GROOVE_LAB_BPM_MAX}
          step={1}
          disabled={disabled}
          value={safeBpm}
          onChange={(e) => commit(Number(e.target.value))}
          style={{
            width: 96,
            height: 5,
            margin: 0,
            flexShrink: 1,
            minWidth: 72,
            cursor: disabled ? 'not-allowed' : 'pointer',
            accentColor: '#7cf4c6',
            opacity: disabled ? 0.45 : 1,
          }}
          title={`Drag tempo — ${GROOVE_LAB_BPM_MIN}–${GROOVE_LAB_BPM_MAX} BPM`}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 6 : 10,
        flexShrink: 0,
      }}
    >
      {!compact ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 2,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: 0.5,
              color: sessionLocked ? '#7cf4c6' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title={
              sessionLocked
                ? 'Locked to Creation Station session BPM — transport, chords, and bass use this tempo'
                : 'Project tempo for this groove'
            }
          >
            {sessionLocked ? <Link2 size={9} /> : null}
            {sessionLocked ? 'SESSION BPM' : 'TEMPO'}
            {transportPlaying ? (
              <span style={{ color: '#4ade80', marginLeft: 2 }}>▶</span>
            ) : null}
          </span>
          <span style={{ fontSize: 7, color: '#4b5563', fontFamily: 'monospace' }}>
            4/4 · {barLabel}s / bar
          </span>
        </div>
      ) : (
        <span
          style={{
            fontSize: 7,
            fontWeight: 800,
            color: sessionLocked ? '#7cf4c6' : '#6b7280',
            letterSpacing: 0.3,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            whiteSpace: 'nowrap',
          }}
          title="Same BPM as Groove Lab transport and piano roll"
        >
          {sessionLocked ? <Link2 size={8} /> : null}
          GROOVE BPM
        </span>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 0 : 4, flexShrink: 0 }}>
        {bpmInputBox}
        {!compact ? (
          <input
            type="range"
            min={GROOVE_LAB_BPM_MIN}
            max={GROOVE_LAB_BPM_MAX}
            step={1}
            disabled={disabled}
            value={safeBpm}
            onChange={(e) => commit(Number(e.target.value))}
            style={{
              width: '100%',
              minWidth: 128,
              maxWidth: 168,
              height: 6,
              margin: 0,
              cursor: disabled ? 'not-allowed' : 'pointer',
              accentColor: '#7cf4c6',
              opacity: disabled ? 0.45 : 1,
            }}
            title={`Drag tempo — ${GROOVE_LAB_BPM_MIN}–${GROOVE_LAB_BPM_MAX} BPM`}
          />
        ) : null}
      </div>
    </div>
  );
}

function stepBtn(disabled: boolean): CSSProperties {
  return {
    flex: 1,
    padding: '0 6px',
    border: 'none',
    background: '#111820',
    color: '#7cf4c6',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 10,
    fontWeight: 800,
    opacity: disabled ? 0.45 : 1,
  };
}
