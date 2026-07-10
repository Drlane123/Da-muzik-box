'use client';

import { useCallback, useMemo } from 'react';
import { NEURAL_HUM_KEY_NAMES } from '@/app/lib/vocalLab/neuralHumKeyLock';
import type { Lab808ProgressionRoot } from '@/app/lib/creationStation/lab808ChordRoots';
import {
  se2Lab808RootIndexForPitchClass,
  se2Lab808ScalePitchClasses,
} from '@/app/lib/studio/se2Lab808RootGridGenerate';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';

const SCOPE_ACCENT = '#7cf4c6';
const SELECTED = '#fde68a';
const ROOT_FILL = 'rgba(124, 244, 198, 0.42)';

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

export type Se2Lab808RootScopeProps = {
  keyRoot: number;
  keyMode: ChordMode;
  keyLabel: string;
  progressionRoots: readonly Lab808ProgressionRoot[];
  livePitchClass: number | null;
  selectedRootIndex: number | null;
  disabled?: boolean;
  /** SVG dial diameter in px (default 136). */
  dialSize?: number;
  onSelectRoot: (rootIndex: number) => void;
  onPreviewMidi: (midi: number) => void;
};

export function Se2Lab808RootScope({
  keyRoot,
  keyMode,
  keyLabel,
  progressionRoots,
  livePitchClass,
  selectedRootIndex,
  disabled = false,
  dialSize = 136,
  onSelectRoot,
  onPreviewMidi,
}: Se2Lab808RootScopeProps) {
  const scale = dialSize / 136;
  const dial = dialSize;
  const labelPad = 14 * scale;
  const size = dial + labelPad * 2;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 58 * scale;
  const innerR = 34 * scale;
  const labelR = outerR + 13 * scale;

  const scaleSet = useMemo(
    () => new Set(se2Lab808ScalePitchClasses(keyRoot, keyMode === 'minor' ? 'minor' : 'major')),
    [keyMode, keyRoot],
  );

  const rootPitchClasses = useMemo(() => {
    const map = new Map<number, number[]>();
    progressionRoots.forEach((r, i) => {
      const pc = ((r.midi % 12) + 12) % 12;
      const list = map.get(pc) ?? [];
      list.push(i);
      map.set(pc, list);
    });
    return map;
  }, [progressionRoots]);

  const selectedPc =
    selectedRootIndex != null && progressionRoots[selectedRootIndex]
      ? ((progressionRoots[selectedRootIndex]!.midi % 12) + 12) % 12
      : null;

  const onPitchClassPointer = useCallback(
    (pc: number) => {
      if (disabled) return;
      const idx = se2Lab808RootIndexForPitchClass(progressionRoots, pc);
      if (idx != null) {
        onSelectRoot(idx);
        onPreviewMidi(progressionRoots[idx]!.midi);
        return;
      }
      const octave = 2;
      const midi = Math.max(0, Math.min(127, (octave + 1) * 12 + pc));
      onPreviewMidi(midi);
    },
    [disabled, onPreviewMidi, onSelectRoot, progressionRoots],
  );

  return (
    <div className="flex flex-col items-center gap-1 min-w-0 w-full">
      <span className="text-[7px] font-extrabold uppercase tracking-wide w-full text-center" style={{ color: '#8a8a98' }}>
        Root scope
      </span>
      <svg width={dial} height={dial} viewBox={`0 0 ${size} ${size}`} aria-label="808 root note scope">
        <circle cx={cx} cy={cy} r={outerR + 5} fill="#050508" stroke="#2a2a36" strokeWidth={1} />
        {NEURAL_HUM_KEY_NAMES.map((name, pc) => {
          const angle = (pc / 12) * Math.PI * 2 - Math.PI / 2;
          const x1 = cx + Math.cos(angle) * innerR;
          const y1 = cy + Math.sin(angle) * innerR;
          const x2 = cx + Math.cos(angle) * outerR;
          const y2 = cy + Math.sin(angle) * outerR;
          const lx = cx + Math.cos(angle) * labelR;
          const ly = cy + Math.sin(angle) * labelR;
          const inKey = scaleSet.has(pc);
          const hasRoot = rootPitchClasses.has(pc);
          const isLive = livePitchClass === pc;
          const isSelected = selectedPc === pc;
          const lit = hasRoot || isLive || isSelected;
          const wedgePath = scopeNoteWedgePath(cx, cy, angle, outerR, inKey ? 5 : 3);

          return (
            <g key={name}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={inKey ? '#4a5568' : '#222'}
                strokeWidth={inKey ? 2 : 1}
              />
              <path
                d={wedgePath}
                fill={
                  isLive
                    ? SCOPE_ACCENT
                    : isSelected
                      ? SELECTED
                      : hasRoot
                        ? ROOT_FILL
                        : inKey
                          ? 'rgba(124,244,198,0.08)'
                          : 'transparent'
                }
                stroke={isSelected ? SELECTED : hasRoot ? SCOPE_ACCENT : 'transparent'}
                strokeWidth={isSelected ? 1.2 : 0}
                style={{
                  cursor: disabled ? 'default' : 'pointer',
                  filter: isLive ? 'drop-shadow(0 0 5px rgba(124,244,198,0.55))' : undefined,
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onPitchClassPointer(pc);
                }}
              />
              {hasRoot ? (
                <circle
                  cx={x2}
                  cy={y2}
                  r={(isLive ? 5 : isSelected ? 4.5 : 3.5) * scale}
                  fill={isLive ? SCOPE_ACCENT : isSelected ? SELECTED : 'rgba(124,244,198,0.55)'}
                  pointerEvents="none"
                />
              ) : null}
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={(inKey || hasRoot ? 8 : 7) * scale}
                fontWeight={hasRoot || isSelected ? 800 : 600}
                fill={isSelected ? SELECTED : hasRoot ? SCOPE_ACCENT : inKey ? '#c8c8d8' : '#555'}
                pointerEvents="none"
              >
                {name}
              </text>
            </g>
          );
        })}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={7 * scale} fontWeight={800} fill="#9a9aac">
          {keyLabel.split(' ')[0] ?? 'Key'}
        </text>
      </svg>
      <span className="text-[7px] font-semibold text-center leading-tight px-1" style={{ color: '#8a8a98' }}>
        {progressionRoots.length > 0
          ? `${progressionRoots.length} roots · tap scope or pads`
          : 'Pick key / chord lane'}
      </span>
    </div>
  );
}
