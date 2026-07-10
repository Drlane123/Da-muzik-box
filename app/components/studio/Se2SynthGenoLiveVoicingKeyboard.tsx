'use client';

import { useMemo } from 'react';
import { cbPianoMidiToNoteName } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import {
  GENO_CHORD_MIDI_MAX,
  GENO_CHORD_MIDI_MIN,
} from '@/app/lib/studio/se2SynthGenoRanges';

export type Se2SynthGenoLiveVoicingKeyboardProps = {
  activeMidis: readonly number[];
  accentHex?: string;
  label?: string;
};

const WHITE_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);

/** Comp-register piano — lights every tone in the voiced chord stack (C4–G5). */
export function Se2SynthGenoLiveVoicingKeyboard({
  activeMidis,
  accentHex = '#00E5CC',
  label = 'Voiced chord — comp register',
}: Se2SynthGenoLiveVoicingKeyboardProps) {
  const activeSet = useMemo(() => new Set(activeMidis.map((m) => Math.round(m))), [activeMidis]);
  const keys = useMemo(
    () => Array.from({ length: GENO_CHORD_MIDI_MAX - GENO_CHORD_MIDI_MIN + 1 }, (_, i) => GENO_CHORD_MIDI_MIN + i),
    [],
  );

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[7px] font-bold uppercase tracking-widest opacity-55">{label}</span>
        <span className="text-[7px] font-mono opacity-40">
          {activeMidis.length > 0 ? `${activeMidis.length} notes` : 'hit a live key'}
        </span>
      </div>
      <div
        className="relative w-full rounded-md border overflow-hidden"
        style={{ borderColor: '#2a2a38', background: '#0a0a10', height: 72 }}
      >
        <div className="absolute inset-0 flex">
          {keys.map((midi) => {
            const pc = midi % 12;
            const isWhite = WHITE_PCS.has(pc);
            const lit = activeSet.has(midi);
            const noteName = cbPianoMidiToNoteName(midi).replace(/\d+$/, '');
            return (
              <div
                key={midi}
                className="relative flex-1 min-w-0 flex items-end justify-center"
                style={{
                  background: lit
                    ? `linear-gradient(180deg, ${accentHex}cc 0%, ${accentHex}44 100%)`
                    : isWhite
                      ? 'linear-gradient(180deg, #ececf4 0%, #b8bcc8 100%)'
                      : 'linear-gradient(180deg, #1a1c24 0%, #08090e 100%)',
                  borderRight: isWhite ? '1px solid #9aa0ae' : 'none',
                  opacity: lit ? 1 : isWhite ? 0.92 : 0.55,
                  height: isWhite ? '100%' : '58%',
                  alignSelf: 'flex-end',
                  zIndex: isWhite ? 1 : 2,
                  marginLeft: isWhite ? 0 : -1,
                  marginRight: isWhite ? 0 : -1,
                }}
                title={cbPianoMidiToNoteName(midi)}
              >
                {lit ? (
                  <span
                    className="mb-1 text-[6px] font-black font-mono"
                    style={{ color: '#0c0c14' }}
                  >
                    {noteName}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
