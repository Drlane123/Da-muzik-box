import type { CSSProperties } from 'react';

import { chordBassSeqChannelLabel } from '@/app/lib/creationStation/chordBassSequencerSession';

import { GrooveLabLayerChannelStrip } from '@/app/components/creation/GrooveLabLayerChannelMap';



export type GrooveLabLayerId = 'chord' | 'melody';



const LAYER_ROWS: ReadonlyArray<{

  id: GrooveLabLayerId;

  label: string;

  color: string;

}> = [

  { id: 'chord', label: 'CHORD', color: '#86efac' },

  { id: 'melody', label: 'GROOVE LEAD', color: '#fbbf24' },

];



const selectStyle: CSSProperties = {

  background: '#0a0e16',

  color: '#e5e7eb',

  border: '1px solid #1e293b',

  borderRadius: 4,

  padding: '2px 6px',

  fontSize: 9,

  fontWeight: 800,

  minWidth: 56,

};



export interface GrooveLabLayerChannelsProps {

  channels: readonly number[];

  chordChannel: number;

  melodyChannel: number;

  onChordChannelChange: (ch: number) => void;

  onMelodyChannelChange: (ch: number) => void;

  chordNoteCount?: number;

  melodyNoteCount?: number;

  /** Tight panel for chord-strip corner (no full-width bar). */

  compact?: boolean;

}



export function GrooveLabLayerChannels({

  channels,

  chordChannel,

  melodyChannel,

  onChordChannelChange,

  onMelodyChannelChange,

  chordNoteCount = 0,

  melodyNoteCount = 0,

  compact = false,

}: GrooveLabLayerChannelsProps) {

  const channelForLayer = (id: GrooveLabLayerId) => {

    if (id === 'chord') return chordChannel;

    return melodyChannel;

  };



  const onChangeForLayer = (id: GrooveLabLayerId) => {

    if (id === 'chord') return onChordChannelChange;

    return onMelodyChannelChange;

  };



  const noteCountForLayer = (id: GrooveLabLayerId) => {

    if (id === 'chord') return chordNoteCount;

    return melodyNoteCount;

  };



  const usedByOther = (ch: number, self: GrooveLabLayerId) => {

    if (self !== 'chord' && ch === chordChannel) return true;

    if (self !== 'melody' && ch === melodyChannel) return true;

    return false;

  };



  if (compact) {

    return (

      <div

        style={{

          display: 'flex',

          flexDirection: 'column',

          gap: 3,

          padding: '3px 5px',

          background: 'transparent',

          minWidth: 300,

        }}

      >

        <span

          style={{

            fontSize: 7,

            fontWeight: 900,

            color: '#a7f3d0',

            letterSpacing: 0.35,

          }}

        >

          WORK CH

        </span>

        {LAYER_ROWS.map((row) => (

          <div

            key={row.id}

            style={{

              display: 'flex',

              alignItems: 'center',

              gap: 4,

              minHeight: 13,

            }}

            title={`${row.label} channel map — lit = active mixer row`}

          >

            <span

              style={{

                fontSize: 7,

                fontWeight: 900,

                color: row.color,

                flexShrink: 0,

                minWidth: 52,

              }}

            >

              {row.label}

            </span>

            <select

              value={channelForLayer(row.id)}

              onChange={(e) => onChangeForLayer(row.id)(Number(e.target.value))}

              style={{

                ...selectStyle,

                color: row.color,

                borderColor: `${row.color}44`,

                fontSize: 8,

                minWidth: 44,

                width: 44,

                flexShrink: 0,

                padding: '1px 4px',

              }}

              title={`${row.label} notes play on this mixer channel`}

            >

              {channels.map((ch) => (

                <option key={`${row.id}-${ch}`} value={ch} disabled={usedByOther(ch, row.id)}>

                  {chordBassSeqChannelLabel(ch)}

                </option>

              ))}

            </select>

            <GrooveLabLayerChannelStrip

              channels={channels}

              assignedChannel={channelForLayer(row.id)}

              color={row.color}

            />

          </div>

        ))}

      </div>

    );

  }



  return (

    <div

      style={{

        display: 'flex',

        flexDirection: 'column',

        gap: 4,

        padding: '4px 8px',

        borderBottom: '1px solid #1a2438',

        background: '#050608',

      }}

    >

      <span

        style={{

          fontSize: 8,

          fontWeight: 900,

          color: '#a7f3d0',

          letterSpacing: 0.35,

        }}

      >

        WORK CHANNELS

      </span>

      <div

        style={{

          display: 'grid',

          gridTemplateColumns: 'auto 1fr auto',

          gap: '4px 8px',

          alignItems: 'center',

          maxWidth: 280,

        }}

      >

        {LAYER_ROWS.map((row) => {

          const count = noteCountForLayer(row.id);

          return (

            <div key={row.id} style={{ display: 'contents' }}>

              <span

                style={{

                  fontSize: 8,

                  fontWeight: 900,

                  color: row.color,

                }}

              >

                {row.label}

              </span>

              <select

                value={channelForLayer(row.id)}

                onChange={(e) => onChangeForLayer(row.id)(Number(e.target.value))}

                style={{

                  ...selectStyle,

                  color: row.color,

                  borderColor: `${row.color}44`,

                }}

                title={`${row.label} notes play on this mixer channel`}

              >

                {channels.map((ch) => (

                  <option key={`${row.id}-${ch}`} value={ch} disabled={usedByOther(ch, row.id)}>

                    {chordBassSeqChannelLabel(ch)}

                  </option>

                ))}

              </select>

              <span style={{ fontSize: 7, color: '#4b5563', fontWeight: 700, minWidth: 28 }}>

                {count > 0 ? `${count} n` : '—'}

              </span>

            </div>

          );

        })}

      </div>

    </div>

  );

}

