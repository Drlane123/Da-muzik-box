'use client';

import { NEURAL_HUM_KEY_NAMES } from '@/app/lib/vocalLab/neuralHumKeyLock';
import type { StudioPitchTuneMonitorSnapshot } from '@/app/hooks/useStudioPitchTuneMonitor';

const TUNE_ACCENT = '#ff9f43';
const DETECT_COLOR = '#67e8f9';
const TARGET_COLOR = '#ff9f43';
const SCALE_IN = '#3a3028';
const SCALE_OUT = '#1a1a22';

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11] as const;
const BLACK_OFFSETS: { afterWhite: number; pc: number }[] = [
  { afterWhite: 0, pc: 1 },
  { afterWhite: 1, pc: 3 },
  { afterWhite: 3, pc: 6 },
  { afterWhite: 4, pc: 8 },
  { afterWhite: 5, pc: 10 },
];

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
  return `M ${tipX.toFixed(2)} ${tipY.toFixed(2)} L ${(cx + Math.cos(a1) * baseR).toFixed(2)} ${(cy + Math.sin(a1) * baseR).toFixed(2)} L ${(cx + Math.cos(a2) * baseR).toFixed(2)} ${(cy + Math.sin(a2) * baseR).toFixed(2)} Z`;
}

function PitchTuneScopeDial({
  scalePitchClasses,
  snap,
  keyLabel,
}: {
  scalePitchClasses: readonly number[];
  snap: StudioPitchTuneMonitorSnapshot;
  keyLabel: string;
}) {
  const dial = 132;
  const pad = 14;
  const size = dial + pad * 2;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 56;
  const innerR = 34;
  const labelR = outerR + 12;
  const scaleSet = new Set(scalePitchClasses);
  const cents = snap.centsOffset;
  const centsClamped = Math.max(-50, Math.min(50, cents));
  const centsArc = (Math.abs(centsClamped) / 50) * 0.85;
  const centsStart = centsClamped >= 0 ? -Math.PI / 2 : -Math.PI / 2 - centsArc;
  const centsEnd = centsClamped >= 0 ? -Math.PI / 2 + centsArc : -Math.PI / 2;

  return (
    <svg width={dial} height={dial} viewBox={`0 0 ${size} ${size}`} aria-label="Pitch Tune scope">
      <circle cx={cx} cy={cy} r={outerR + 5} fill="#06060c" stroke="#262632" strokeWidth={1} />
      {/* Cents ring — orange = sharp (pulling down), cyan = flat */}
      {snap.listening && Math.abs(cents) > 1 ? (
        <path
          d={`M ${cx + Math.cos(centsStart) * (innerR - 4)} ${cy + Math.sin(centsStart) * (innerR - 4)} A ${innerR - 4} ${innerR - 4} 0 0 ${centsClamped >= 0 ? 1 : 0} ${cx + Math.cos(centsEnd) * (innerR - 4)} ${cy + Math.sin(centsEnd) * (innerR - 4)}`}
          fill="none"
          stroke={centsClamped >= 0 ? TUNE_ACCENT : DETECT_COLOR}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.85}
        />
      ) : null}
      {NEURAL_HUM_KEY_NAMES.map((name, pc) => {
        const angle = (pc / 12) * Math.PI * 2 - Math.PI / 2;
        const x1 = cx + Math.cos(angle) * innerR;
        const y1 = cy + Math.sin(angle) * innerR;
        const x2 = cx + Math.cos(angle) * outerR;
        const y2 = cy + Math.sin(angle) * outerR;
        const inScale = scaleSet.has(pc);
        const isDetected = snap.pitchClass === pc && snap.listening;
        const isTarget = snap.targetPitchClass === pc && snap.listening;
        const trailCount = snap.trail.filter((t) => t === pc).length;
        const lit = trailCount > 0 || isDetected || isTarget;
        return (
          <g key={name}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={inScale ? SCALE_IN : SCALE_OUT}
              strokeWidth={inScale ? 2 : 1}
            />
            <path
              d={scopeNoteWedgePath(cx, cy, angle, outerR, inScale ? 5 : 3)}
              fill={
                isTarget
                  ? TARGET_COLOR
                  : isDetected
                    ? DETECT_COLOR
                    : lit
                      ? `${TUNE_ACCENT}55`
                      : inScale
                        ? '#1e1810'
                        : '#121218'
              }
              stroke={isDetected ? DETECT_COLOR : isTarget ? TARGET_COLOR : inScale ? '#4a4030' : '#2a2a34'}
              strokeWidth={lit ? 1.2 : 0.75}
              opacity={lit ? 1 : inScale ? 0.9 : 0.55}
            />
            <text
              x={cx + Math.cos(angle) * labelR}
              y={cy + Math.sin(angle) * labelR}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fontWeight={inScale ? 700 : 500}
              fill={inScale ? '#d8d8e8' : '#5a5a68'}
              fontFamily="system-ui, sans-serif"
            >
              {name}
            </text>
          </g>
        );
      })}
      {snap.pitchClass != null && snap.listening ? (
        (() => {
          const frac = snap.detectedMidi != null ? snap.detectedMidi - Math.floor(snap.detectedMidi) : 0;
          const angle = ((snap.pitchClass + frac) / 12) * Math.PI * 2 - Math.PI / 2;
          const dotR = (innerR + outerR) / 2;
          const dx = cx + Math.cos(angle) * dotR;
          const dy = cy + Math.sin(angle) * dotR;
          return (
            <>
              <circle cx={dx} cy={dy} r={10} fill={`${DETECT_COLOR}22`} stroke={`${DETECT_COLOR}88`} strokeWidth={1} />
              <circle cx={dx} cy={dy} r={5} fill={DETECT_COLOR} style={{ filter: `drop-shadow(0 0 5px ${DETECT_COLOR})` }} />
            </>
          );
        })()
      ) : null}
      <circle cx={cx} cy={cy} r={innerR - 10} fill="#08080e" stroke="#222230" strokeWidth={1} />
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize={8} fill="#6a6a78" fontFamily="system-ui">
        {snap.listening ? 'LOCK' : 'SCOPE'}
      </text>
      {snap.detectedMidi != null && snap.listening ? (
        <text x={cx} y={cy + 9} textAnchor="middle" fontSize={10} fill={DETECT_COLOR} fontWeight="bold" fontFamily="system-ui">
          {NEURAL_HUM_KEY_NAMES[snap.pitchClass ?? 0]} {Math.floor(snap.detectedMidi / 12) - 1}
        </text>
      ) : (
        <text x={cx} y={cy + 9} textAnchor="middle" fontSize={7} fill="#5a5a68" fontFamily="system-ui">
          {keyLabel}
        </text>
      )}
      {snap.listening && Math.abs(cents) > 0.5 ? (
        <text x={cx} y={cy + 20} textAnchor="middle" fontSize={7} fill={Math.abs(cents) < 8 ? '#9ae6b4' : TUNE_ACCENT} fontFamily="system-ui">
          {cents > 0 ? '+' : ''}{Math.round(cents)} ct
        </text>
      ) : null}
    </svg>
  );
}

function PitchTuneMiniKeyboard({
  octave,
  scalePitchClasses,
  snap,
}: {
  octave: number;
  scalePitchClasses: readonly number[];
  snap: StudioPitchTuneMonitorSnapshot;
}) {
  const base = 12 * (octave + 1);
  const scaleSet = new Set(scalePitchClasses);
  const whiteKeys = WHITE_PCS.map((pc) => base + pc);
  const blackKeys = BLACK_OFFSETS.map(({ pc }) => base + pc);
  const whiteW = 100 / 7;

  const styleFor = (midi: number, black: boolean) => {
    const pc = ((midi % 12) + 12) % 12;
    const inScale = scaleSet.has(pc);
    const isDetected = snap.detectedMidi != null && Math.round(snap.detectedMidi) === midi && snap.listening;
    const isTarget =
      snap.targetMidi != null && Math.round(snap.targetMidi) === midi && snap.listening;
    let bg = black ? '#14141c' : '#ececf2';
    let border = black ? '#2a2a36' : '#c8c8d4';
    let color = black ? '#6a6a78' : '#3a3a48';
    if (!inScale) {
      bg = black ? '#0a0a10' : '#1a1a22';
      border = '#222230';
      color = '#4a4a58';
    }
    if (isTarget) {
      bg = TARGET_COLOR;
      border = '#ffb84d';
      color = '#1a1008';
    }
    if (isDetected) {
      bg = DETECT_COLOR;
      border = '#38bdf8';
      color = '#041018';
    }
    return { bg, border, color, inScale, showLabel: !black && inScale };
  };

  return (
    <div className="relative w-full" style={{ height: 52 }}>
      <div className="absolute inset-0 flex">
        {whiteKeys.map((midi, i) => {
          const st = styleFor(midi, false);
          return (
            <div
              key={midi}
              className="relative border rounded-sm"
              style={{
                width: `${whiteW}%`,
                marginLeft: i === 0 ? 0 : 1,
                background: st.bg,
                borderColor: st.border,
                opacity: st.inScale ? 1 : 0.45,
              }}
            >
              {st.showLabel ? (
                <span
                  className="absolute bottom-0.5 left-0 right-0 text-center suite-type-micro text-[5px]"
                  style={{ color: st.color, textTransform: 'none' }}
                >
                  {NEURAL_HUM_KEY_NAMES[((midi % 12) + 12) % 12]}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="absolute inset-0 pointer-events-none">
        {blackKeys.map((midi, i) => {
          const { afterWhite, pc } = BLACK_OFFSETS[i]!;
          const st = styleFor(midi, true);
          const left = (afterWhite + 1) * whiteW - whiteW * 0.32;
          return (
            <div
              key={midi}
              className="absolute border rounded-sm"
              style={{
                left: `${left}%`,
                width: `${whiteW * 0.64}%`,
                height: '62%',
                background: st.bg,
                borderColor: st.border,
                opacity: st.inScale ? 1 : 0.35,
                zIndex: 2,
              }}
              title={NEURAL_HUM_KEY_NAMES[pc]}
            />
          );
        })}
      </div>
    </div>
  );
}

export function StudioPitchTuneMonitor({
  scalePitchClasses,
  snap,
  keyLabel,
  variant = 'pitchTune',
}: {
  scalePitchClasses: readonly number[];
  snap: StudioPitchTuneMonitorSnapshot;
  keyLabel: string;
  /** Same scope + keyboard UI; footer copy differs for vocoder modulator view. */
  variant?: 'pitchTune' | 'vocoder';
}) {
  const octave =
    snap.detectedMidi != null
      ? Math.max(2, Math.min(5, Math.floor(snap.detectedMidi / 12) - 1))
      : 3;

  return (
    <div
      className="rounded-lg border p-2"
      style={{ borderColor: '#262632', background: 'linear-gradient(180deg, #1e1e26 0%, #06060c 100%)' }}
    >
      <div className="suite-type-label text-[6px] mb-1.5 tracking-widest" style={{ color: '#6a6a78' }}>
        Pitch scope · keyboard
      </div>
      <div className="flex gap-3 items-start">
        <div className="shrink-0 flex flex-col items-center">
          <PitchTuneScopeDial scalePitchClasses={scalePitchClasses} snap={snap} keyLabel={keyLabel} />
          <div className="flex gap-2 mt-1 suite-type-micro text-[4px]" style={{ color: '#5a5a68', textTransform: 'none' }}>
            <span style={{ color: DETECT_COLOR }}>● {variant === 'vocoder' ? 'Voice' : 'Input'}</span>
            {variant === 'pitchTune' ? (
              <span style={{ color: TARGET_COLOR }}>● Target</span>
            ) : (
              <span style={{ color: '#a78bfa' }}>● Modulator</span>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1 flex flex-col gap-1.5 pt-1">
          <PitchTuneMiniKeyboard octave={octave} scalePitchClasses={scalePitchClasses} snap={snap} />
          <div className="suite-type-micro text-[4px] leading-snug" style={{ color: '#5a5a68', textTransform: 'none', letterSpacing: '0.03em' }}>
            {variant === 'vocoder'
              ? snap.listening
                ? 'Cyan = vocal modulator · Carrier MIDI drives synth pitch separately'
                : 'Record-arm this lane and sing — scope tracks live mic while Vocoder is on'
              : snap.listening
                ? 'Cyan = vocal pitch · Orange = scale target · Dial shows cents to scale'
                : 'Turn Pitch Tune on — mic routes through FX live (no record-arm needed)'}
          </div>
        </div>
      </div>
    </div>
  );
}
