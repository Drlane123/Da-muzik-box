import type { CSSProperties } from 'react';
import { Link2 } from 'lucide-react';
import {
  CREATION_SESSION_MODULE_LABELS,
  type CreationSessionLinkModuleId,
  type CreationSessionLinkState,
} from '@/app/lib/creationStation/creationSessionLink';

const MODULE_ORDER: CreationSessionLinkModuleId[] = [
  'new-synth',
  'groove-lab',
  '808-lab',
  'chord-builder',
];

function miniToggleStyle(linked: boolean, kind: 'bpm' | 'play'): CSSProperties {
  const on = kind === 'bpm'
    ? { border: 'rgba(124,244,198,0.5)', bg: 'rgba(34,197,94,0.18)', color: '#86efac' }
    : { border: 'rgba(103,232,249,0.45)', bg: 'rgba(14,40,56,0.55)', color: '#67e8f9' };
  const off = { border: 'rgba(255,255,255,0.08)', bg: 'rgba(255,255,255,0.03)', color: '#52525b' };
  const c = linked ? on : off;
  return {
    padding: '2px 7px',
    minWidth: 0,
    borderRadius: 4,
    border: `1px solid ${c.border}`,
    background: c.bg,
    color: c.color,
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: 0.15,
    cursor: 'pointer',
    lineHeight: 1.35,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  };
}

export type CreationSessionLinkStripProps = {
  sessionBpm: number;
  linkState: CreationSessionLinkState;
  onToggleBpmLink: (moduleId: CreationSessionLinkModuleId) => void;
  onTogglePlayLink: (moduleId: CreationSessionLinkModuleId) => void;
  /** Groove Lab tab — optional PLAY → Beat Lab mirror (reverse of Sync). */
  grooveBeatlabMirror?: boolean;
  onToggleGrooveBeatlabMirror?: () => void;
  showGrooveBeatlabMirror?: boolean;
  compact?: boolean;
  disabled?: boolean;
};

export function CreationSessionLinkStrip({
  sessionBpm,
  linkState,
  onToggleBpmLink,
  onTogglePlayLink,
  grooveBeatlabMirror = false,
  onToggleGrooveBeatlabMirror,
  showGrooveBeatlabMirror = false,
  disabled = false,
}: CreationSessionLinkStripProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '4px 8px',
        minHeight: 28,
        borderRadius: 5,
        border: '1px solid rgba(124, 244, 198, 0.22)',
        background: 'rgba(5, 12, 8, 0.92)',
        boxSizing: 'border-box',
      }}
      title="Beat Lab = tempo master. BPM / Sync toggles link each module. Sync = transport follows Beat Lab play, pause, and stop."
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 9,
          fontWeight: 900,
          color: '#7cf4c6',
          letterSpacing: 0.4,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        <Link2 size={10} aria-hidden />
        Session Link
      </span>

      <span
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: '#4ade80',
          padding: '2px 8px',
          borderRadius: 4,
          border: '1px solid rgba(34, 197, 94, 0.35)',
          background: '#0d1812',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
        title="Beat Lab master tempo"
      >
        Beat Lab · {sessionBpm} BPM
      </span>

      <span style={{ width: 1, alignSelf: 'stretch', minHeight: 18, background: '#2a2a32', flexShrink: 0 }} aria-hidden />

      <div
        style={{
          flex: '1 1 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          minWidth: 0,
        }}
      >
        {MODULE_ORDER.map((id) => {
          const bpmOn = linkState.bpmLinked[id];
          const playOn = linkState.playLinked[id];
          const label = CREATION_SESSION_MODULE_LABELS[id];
          const active = bpmOn || playOn;
          return (
            <div
              key={id}
              style={{
                flex: '1 1 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 6,
                minWidth: 0,
                padding: '3px 8px',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.07)',
                background: active ? 'rgba(17,32,21,0.55)' : 'rgba(0,0,0,0.18)',
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: active ? '#d1fae5' : '#71717a',
                  letterSpacing: 0.15,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  flexShrink: 1,
                  textAlign: 'left',
                }}
                title={label}
              >
                {label}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggleBpmLink(id)}
                style={miniToggleStyle(bpmOn, 'bpm')}
                title={
                  bpmOn
                    ? `${label} BPM linked to Beat Lab ${sessionBpm} — click to unlink`
                    : `${label} own tempo — click to link BPM`
                }
              >
                BPM
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onTogglePlayLink(id)}
                style={miniToggleStyle(playOn, 'play')}
                title={
                  playOn
                    ? `${label} transport synced with Beat Lab — click to unsync`
                    : `${label} own transport — click to sync with Beat Lab`
                }
              >
                Sync
              </button>
              {id === 'groove-lab' && showGrooveBeatlabMirror && onToggleGrooveBeatlabMirror && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onToggleGrooveBeatlabMirror}
                  style={miniToggleStyle(grooveBeatlabMirror, 'play')}
                  title={
                    grooveBeatlabMirror
                      ? 'Groove Lab transport also starts Beat Lab — click to work in Groove only'
                      : 'Groove Lab only — click to also trigger Beat Lab on play, pause, and stop'
                  }
                >
                  BeatLab
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
