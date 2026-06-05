import { GROOVE_LAB_LAYER_LEGEND } from '@/app/lib/creationStation/grooveLabLayers';

export interface GrooveLabLayerLegendProps {
  splitChannels: boolean;
  chordChannelLabel?: string;
}

export function GrooveLabLayerLegend({
  splitChannels,
  chordChannelLabel,
}: GrooveLabLayerLegendProps) {
  const chord = GROOVE_LAB_LAYER_LEGEND.chord;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '6px 10px',
        background: '#070b12',
        borderBottom: '1px solid #1a2438',
      }}
    >
      <span style={{ fontSize: 8, fontWeight: 900, color: '#6b7280', letterSpacing: 0.5 }}>
        LAYERS
      </span>
      <LayerChip
        short={chord.short}
        label="Groove piano / strings"
        color={chord.color}
        title={chord.title}
        channel={chordChannelLabel ?? '—'}
      />
      <span
        style={{
          fontSize: 7,
          color: '#4b5563',
          lineHeight: 1.35,
          maxWidth: 420,
        }}
      >
        {splitChannels
          ? 'Import / export on the piano roll header — one roll per selected channel.'
          : 'Green chords on CH 34 · production bass in Beat Lab NEW SYNTH.'}
      </span>
    </div>
  );
}

function LayerChip({
  short,
  label,
  color,
  title,
  channel,
}: {
  short: string;
  label: string;
  color: string;
  title: string;
  channel: string;
}) {
  return (
    <div
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        borderRadius: 6,
        background: '#0c1018',
        border: `1px solid ${color}44`,
      }}
    >
      <span
        style={{
          fontSize: 8,
          fontWeight: 900,
          color: '#0f172a',
          background: color,
          borderRadius: 3,
          padding: '1px 4px',
          minWidth: 14,
          textAlign: 'center',
        }}
      >
        {short === 'SUB' || short === 'BASS' ? 'B' : short === 'LEAD' ? 'M' : 'C'}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 8, fontWeight: 900, color }}>{label}</span>
        <span style={{ fontSize: 7, color: '#6b7280', fontWeight: 700 }}>{channel}</span>
      </div>
    </div>
  );
}
