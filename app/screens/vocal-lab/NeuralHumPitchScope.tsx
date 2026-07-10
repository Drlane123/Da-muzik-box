/**
 * Dubler-inspired circular pitch scope — 12 pitch classes + live note wedge markers.
 */
import { NEURAL_HUM_KEY_NAMES } from '@/app/lib/vocalLab/neuralHumKeyLock';
import { NH_SCALE } from '@/app/lib/vocalLab/neuralHumTheme';

type NeuralHumPitchScopeProps = {
  /** Pitch classes 0–11 allowed in current key (highlighted). Empty = chromatic. */
  scalePitchClasses: readonly number[];
  livePitchClass: number | null;
  liveMidi: number | null;
  trail: readonly number[];
  keyLabel: string | null;
  isRecording: boolean;
};

const NOTE_LABELS = NEURAL_HUM_KEY_NAMES;

/** ~same footprint as original r=5 / r=3 outer dots. */
const MARKER_IN = 5;
const MARKER_OUT = 3;

/** Compact inward wedge — tip on spoke, small flare on outer ring. */
function scopeNoteWedgePath(
  cx: number,
  cy: number,
  angle: number,
  outerR: number,
  markerR: number,
): string {
  const depth = markerR * 0.55;
  const baseOutset = markerR * 0.5;
  const spread = markerR / outerR;

  const tipR = outerR - depth;
  const tipX = cx + Math.cos(angle) * tipR;
  const tipY = cy + Math.sin(angle) * tipR;

  const baseR = outerR + baseOutset;
  const a1 = angle - spread;
  const a2 = angle + spread;
  const bx1 = cx + Math.cos(a1) * baseR;
  const by1 = cy + Math.sin(a1) * baseR;
  const bx2 = cx + Math.cos(a2) * baseR;
  const by2 = cy + Math.sin(a2) * baseR;

  return `M ${tipX.toFixed(2)} ${tipY.toFixed(2)} L ${bx1.toFixed(2)} ${by1.toFixed(2)} L ${bx2.toFixed(2)} ${by2.toFixed(2)} Z`;
}

export default function NeuralHumPitchScope({
  scalePitchClasses,
  livePitchClass,
  liveMidi,
  trail,
  keyLabel,
  isRecording,
}: NeuralHumPitchScopeProps) {
  const dial = 168;
  const labelPad = 16;
  const size = dial + labelPad * 2;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 72;
  const innerR = 44;
  const labelR = outerR + 16;
  const scaleSet = new Set(scalePitchClasses);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={dial} height={dial} viewBox={`0 0 ${size} ${size}`} aria-label="Pitch scope">
        <circle cx={cx} cy={cy} r={outerR + 6} fill="#050505" stroke="#1a1a1a" strokeWidth={1} />
        {NOTE_LABELS.map((name, pc) => {
          const angle = (pc / 12) * Math.PI * 2 - Math.PI / 2;
          const x1 = cx + Math.cos(angle) * innerR;
          const y1 = cy + Math.sin(angle) * innerR;
          const x2 = cx + Math.cos(angle) * outerR;
          const y2 = cy + Math.sin(angle) * outerR;
          const inScale = scaleSet.size === 0 || scaleSet.has(pc);
          const lx = cx + Math.cos(angle) * labelR;
          const ly = cy + Math.sin(angle) * labelR;
          const trailCount = trail.filter((t) => t === pc).length;
          const isLive = livePitchClass === pc;
          const lit = trailCount > 0 || isLive;
          const markerR = inScale ? MARKER_IN : MARKER_OUT;
          const wedgePath = scopeNoteWedgePath(cx, cy, angle, outerR, markerR);

          return (
            <g key={name}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={inScale ? NH_SCALE.scopeInScale : '#222'}
                strokeWidth={inScale ? 2.5 : 1}
              />
              {lit && (
                <circle
                  cx={x2}
                  cy={y2}
                  r={4 + Math.min(4, trailCount) + (isLive ? 2 : 0)}
                  fill={
                    isLive
                      ? 'rgba(0,255,136,0.55)'
                      : `rgba(0,255,136,${Math.min(0.55, 0.12 + trailCount * 0.06)})`
                  }
                  style={isLive ? { filter: 'drop-shadow(0 0 6px #00ff88)' } : undefined}
                />
              )}
              <path
                d={wedgePath}
                fill={
                  lit
                    ? isLive
                      ? '#00ff88'
                      : inScale
                        ? NH_SCALE.scopeWedgeLit
                        : '#00ff8844'
                    : inScale
                      ? NH_SCALE.scopeWedge
                      : '#151515'
                }
                stroke={lit ? '#00ff88' : inScale ? NH_SCALE.accent : '#333'}
                strokeWidth={lit ? 1.5 : inScale ? 1 : 0.75}
                strokeLinejoin="round"
                style={lit ? { filter: 'drop-shadow(0 0 4px #00ff88)' } : undefined}
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fontWeight={inScale ? 700 : 600}
                fill={inScale ? '#ffffff' : '#888888'}
                fontFamily="system-ui, sans-serif"
                style={{
                  paintOrder: 'stroke fill',
                  stroke: inScale ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)',
                  strokeWidth: 2.5,
                }}
              >
                {name}
              </text>
            </g>
          );
        })}
        {livePitchClass != null && (
          (() => {
            const angle = (livePitchClass / 12) * Math.PI * 2 - Math.PI / 2;
            const dotR = (innerR + outerR) / 2;
            const dx = cx + Math.cos(angle) * dotR;
            const dy = cy + Math.sin(angle) * dotR;
            return (
              <>
                <circle cx={dx} cy={dy} r={12} fill="#00ff8822" stroke="#00ff8866" strokeWidth={1} />
                <circle cx={dx} cy={dy} r={6} fill="#00ff88" style={{ filter: 'drop-shadow(0 0 6px #00ff88)' }} />
              </>
            );
          })()
        )}
        <circle cx={cx} cy={cy} r={innerR - 8} fill="#0a0a0a" stroke="#222" strokeWidth={1} />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={9} fill="#666" fontFamily="system-ui">
          {isRecording ? 'LISTEN' : 'SCOPE'}
        </text>
        {liveMidi != null && (
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize={11} fill="#00ff88" fontWeight="bold">
            {NOTE_LABELS[livePitchClass ?? 0]} {Math.floor(liveMidi / 12) - 1}
          </text>
        )}
      </svg>
      {keyLabel && (
        <span
          className="text-xs font-semibold mt-2"
          style={{ color: NH_SCALE.primary }}
        >
          Key lock: {keyLabel}
        </span>
      )}
    </div>
  );
}
