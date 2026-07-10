'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Se2GuitarInlineArt } from '@/app/components/studio/Se2GuitarInlineArt';
import { Se2GuitarFretGrid } from '@/app/components/studio/Se2GuitarFretGrid';
import { Se2GuitarNeckOverlay } from '@/app/components/studio/Se2GuitarNeckOverlay';
import {
  SE2_GUITAR_STRING_COUNT,
  se2GuitarMidisToFretDots,
  type Se2GuitarFretDot,
} from '@/app/lib/studio/se2GuitarFretboard';
import { SE2_GUITAR_CHORDS, type Se2GuitarChordId } from '@/app/lib/studio/se2GuitarChords';

const ACCENT = '#E8A040';

const GUITAR_W_OVER_H = 350.19852 / 886.81561;
const GUITAR_H_OVER_W = 886.81561 / 350.19852;

export const SE2_GUITAR_WOOD_OVERLAP_PX = 20;

function computeGuitarStageLayout(stageWidth: number, compact: boolean) {
  const padX = 8;
  const padY = compact ? 8 : 10;
  const maxSpan = Math.max(300, stageWidth - padX * 2);

  let span = maxSpan;
  let thick = span * GUITAR_W_OVER_H;

  if (compact) {
    const maxThick = 88;
    if (thick > maxThick) {
      thick = maxThick;
      span = thick * GUITAR_H_OVER_W;
    }
  }

  const fullThick = Math.max(72, Math.round(thick));

  return {
    guitarW: Math.round(span),
    guitarThickness: fullThick,
    stageHeight: fullThick + padY * 2,
    padY,
  };
}

export type Se2GuitarVisualProps = {
  capo?: number;
  compact?: boolean;
  disabled?: boolean;
  highlightDots?: readonly Se2GuitarFretDot[];
  playingMidis?: readonly number[];
  activeString?: number | null;
  onFretPlay?: (midi: number, velocity?: number, placement?: Se2GuitarFretDot) => void;
  onFretInsert?: (midi: number) => void;
  onPrimeAudio?: () => void;
};

function useStageWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(400);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(280, el.getBoundingClientRect().width || 280));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [ref]);
  return width;
}

export function Se2GuitarVisual({
  capo = 0,
  compact = false,
  disabled = false,
  highlightDots,
  playingMidis = [],
  activeString = null,
  onFretPlay,
  onFretInsert,
  onPrimeAudio,
}: Se2GuitarVisualProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const stageWidth = useStageWidth(stageRef);
  const [artFailed, setArtFailed] = useState(false);

  const { guitarW, guitarThickness, stageHeight, padY } = useMemo(
    () => computeGuitarStageLayout(stageWidth, compact),
    [compact, stageWidth],
  );

  const litDots = useMemo(() => {
    if (highlightDots?.length) return [...highlightDots];
    return se2GuitarMidisToFretDots(playingMidis, capo);
  }, [capo, highlightDots, playingMidis]);

  const interactive = Boolean(onFretPlay) && !disabled;

  return (
    <div className="flex w-full min-w-[280px] flex-col gap-0" data-se2-guitar-visual>
      <div
        ref={stageRef}
        className="relative flex w-full items-center justify-center"
        style={{
          height: stageHeight,
          minHeight: stageHeight,
          marginBottom: compact ? 0 : -SE2_GUITAR_WOOD_OVERLAP_PX,
          padding: `${padY}px 8px`,
          background: `
            radial-gradient(ellipse 90% 80% at 50% 45%, #4a4858 0%, #2e2c38 40%, #141218 100%)
          `,
          borderBottom: '1px solid #1e1c24',
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          className="relative shrink-0"
          style={{ width: guitarW, height: guitarThickness }}
          data-se2-guitar-box
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="relative shrink-0 pointer-events-none"
              data-se2-guitar-rot-host
              style={{
                width: guitarThickness,
                height: guitarW,
                transform: 'rotate(-90deg)',
                transformOrigin: 'center center',
              }}
            >
              {!artFailed ? (
                <Se2GuitarInlineArt onLoadError={() => setArtFailed(true)} />
              ) : (
                <div
                  className="absolute inset-0 z-[1] rounded border border-[#4a4030]"
                  style={{
                    background:
                      'linear-gradient(180deg, #3a3020 0%, #5a4830 45%, #8a6840 70%, #6a5030 100%)',
                  }}
                  aria-hidden
                />
              )}
              <Se2GuitarNeckOverlay
                capo={capo}
                highlightDots={litDots}
                activeString={activeString}
              />
            </div>
          </div>
          <Se2GuitarFretGrid
            capo={capo}
            disabled={disabled}
            highlightDots={litDots}
            activeString={activeString}
            onFretPlay={onFretPlay}
            onFretInsert={onFretInsert}
            onPrimeAudio={onPrimeAudio}
          />
        </div>

        {interactive ? (
          <p className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-[6px] font-semibold uppercase tracking-wider text-[#8a8880]">
            Tap a string on the neck only · keys below (Z–M, Q–P)
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function Se2GuitarChordDiagram({
  chordId,
  accentHex = ACCENT,
}: {
  chordId: Se2GuitarChordId;
  accentHex?: string;
}) {
  const chord = SE2_GUITAR_CHORDS.find((c) => c.id === chordId) ?? SE2_GUITAR_CHORDS[0]!;
  const dots = useMemo(() => {
    const openMidi = [40, 45, 50, 55, 59, 64];
    const out: { string: number; fret: number }[] = [];
    for (const pitch of chord.pitches) {
      for (let s = 0; s < SE2_GUITAR_STRING_COUNT; s += 1) {
        const fret = pitch - openMidi[s]!;
        if (fret >= 0 && fret <= 5) {
          out.push({ string: s, fret });
          break;
        }
      }
    }
    return out;
  }, [chord.pitches]);

  return (
    <div
      className="relative rounded border"
      style={{
        width: 52,
        height: 64,
        borderColor: '#4a4030',
        background: 'linear-gradient(180deg, #3a3020 0%, #1a1408 100%)',
      }}
    >
      {[0, 1, 2, 3, 4, 5].map((s) => (
        <div
          key={s}
          className="absolute left-2 right-2 h-px bg-[#8a7860]/50"
          style={{ top: `${14 + s * 8}px` }}
        />
      ))}
      {[1, 2, 3, 4].map((f) => (
        <div
          key={f}
          className="absolute bottom-2 top-3 w-px bg-[#6a5840]/40"
          style={{ left: `${10 + f * 8}px` }}
        />
      ))}
      {dots.map((d) => (
        <span
          key={`${d.string}-${d.fret}`}
          className="absolute h-2 w-2 rounded-full"
          style={{
            left: `${6 + d.fret * 8}px`,
            top: `${11 + (5 - d.string) * 8}px`,
            background: accentHex,
            boxShadow: `0 0 4px ${accentHex}88`,
          }}
        />
      ))}
      <span
        className="absolute -top-3 left-0 text-[6px] font-black uppercase"
        style={{ color: accentHex }}
      >
        {chord.label}
      </span>
    </div>
  );
}
