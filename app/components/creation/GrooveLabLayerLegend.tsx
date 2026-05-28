import { useRef } from 'react';
import {
  GROOVE_LAB_LAYER_LEGEND,
} from '@/app/lib/creationStation/grooveLabLayers';
import { GROOVE_LAB_REGISTER_LABELS } from '@/app/lib/creationStation/grooveLabPitch';
import { GrooveLabExportStrip } from '@/app/components/creation/GrooveLabExportStrip';

export interface GrooveLabLayerLegendProps {
  splitChannels: boolean;
  bassChannelLabel: string;
  chordChannelLabel?: string;
  melodyChannelLabel?: string;
  onImportMidi?: (file: File) => void;
  midiImportStatus?: string | null;
  exportBusy?: boolean;
  exportStatus?: string | null;
  rollHasChords?: boolean;
  rollHasNotes?: boolean;
  onExportRollMidi?: () => void;
  onExportRollWav?: () => void | Promise<void>;
  onExportRollWavToPad?: () => void | Promise<void>;
  onSendRollToNewSynth?: () => void;
  padExportEnabled?: boolean;
}

export function GrooveLabLayerLegend({
  splitChannels,
  bassChannelLabel,
  chordChannelLabel,
  melodyChannelLabel,
  onImportMidi,
  midiImportStatus,
  exportBusy,
  exportStatus,
  rollHasChords = false,
  rollHasNotes = false,
  onExportRollMidi,
  onExportRollWav,
  onExportRollWavToPad,
  onSendRollToNewSynth,
  padExportEnabled = true,
}: GrooveLabLayerLegendProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bass = GROOVE_LAB_LAYER_LEGEND.bass;
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
      <LayerChip short={bass.short} label="optional sub" color={bass.color} title={bass.title} channel={bassChannelLabel} />
      <LayerChip
        short={GROOVE_LAB_LAYER_LEGEND.melody.short}
        label="melody / riff / arp"
        color={GROOVE_LAB_LAYER_LEGEND.melody.color}
        title={GROOVE_LAB_LAYER_LEGEND.melody.title}
        channel={melodyChannelLabel ?? GROOVE_LAB_REGISTER_LABELS.melody}
      />
      <span style={{ fontSize: 10, color: '#374151', fontWeight: 700 }}>+</span>
      <LayerChip
        short={chord.short}
        label="Groove piano / strings"
        color={chord.color}
        title={chord.title}
        channel={chordChannelLabel ?? '—'}
      />
      {onImportMidi ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mid,.midi,audio/midi"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportMidi(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Import .mid — reads tempo (BPM) and splits bass (≤B3) vs chords (C4+)"
            style={{
              background: '#0c1520',
              color: '#93c5fd',
              border: '1px solid #1e3a5f',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 8,
              fontWeight: 900,
              cursor: 'pointer',
              letterSpacing: 0.3,
            }}
          >
            IMPORT .MID
          </button>
        </>
      ) : null}
      {(onExportRollMidi || onExportRollWav || onExportRollWavToPad || onSendRollToNewSynth) ? (
        <GrooveLabExportStrip
          busy={exportBusy}
          status={exportStatus}
          hasChords={rollHasChords}
          hasRollNotes={rollHasNotes}
          onExportMidi={onExportRollMidi}
          onExportWav={onExportRollWav}
          onExportToPad={onExportRollWavToPad}
          onSendToNewSynth={onSendRollToNewSynth}
          padExportEnabled={padExportEnabled}
        />
      ) : null}
      <span
        style={{
          fontSize: 7,
          color: '#4b5563',
          lineHeight: 1.35,
          maxWidth: 420,
        }}
      >
        {exportStatus && !exportStatus.startsWith('✓')
          ? exportStatus
          : midiImportStatus
            ? midiImportStatus
            : onImportMidi
              ? 'Drop a .mid on the grid — tempo + bass/chord layers (like Song Engine).'
              : splitChannels
                ? 'Play = blue bass on bass channel, green chords on chord channel — no clash.'
                : 'Tip: turn on SPLIT CHANNELS so bass and chords use separate CH rows.'}
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
