/**
 * Groove Lab — three independent piano rolls (SUB / CHORD / MELODY work lanes).
 * One roll per mixer channel, register-scoped rows (Beat Lab–style), shared horizontal scroll + playhead.
 */
import { useCallback, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { chordBassSeqChannelLabel } from '@/app/lib/creationStation/chordBassSequencerSession';
import {
  GrooveLabPianoRoll,
  type GrooveLabPianoRollProps,
} from '@/app/components/creation/GrooveLabPianoRoll';
import { GROOVE_LAB_LAYER_SCOPE_META } from '@/app/lib/creationStation/grooveLabPianoRollLayers';

export type GrooveLabLayeredPianoRollsProps = Omit<
  GrooveLabPianoRollProps,
  | 'channel'
  | 'hits'
  | 'onHitsChange'
  | 'splitChannels'
  | 'bassHits'
  | 'chordHits'
  | 'melodyHits'
  | 'onBassHitsChange'
  | 'onChordHitsChange'
  | 'onMelodyHitsChange'
  | 'layerScope'
  | 'rollChrome'
  | 'playheadElRef'
  | 'rollScrollRef'
  | 'syncScrollLeft'
  | 'onScrollSync'
> & {
  bassChannel: number;
  chordChannel: number;
  melodyChannel: number;
  bassHits: GrooveLabPianoRollProps['hits'];
  chordHits: GrooveLabPianoRollProps['hits'];
  melodyHits: GrooveLabPianoRollProps['hits'];
  onBassHitsChange: GrooveLabPianoRollProps['onHitsChange'];
  onChordHitsChange: GrooveLabPianoRollProps['onHitsChange'];
  onMelodyHitsChange: GrooveLabPianoRollProps['onHitsChange'];
  playheadElRef?: RefObject<HTMLDivElement | null>;
  rollScrollRef?: RefObject<HTMLDivElement | null>;
};

const LAYER_SHELL: CSSProperties = {
  flex: 1,
  minHeight: 72,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  borderBottom: '1px solid #1a1f2e',
};

export function GrooveLabLayeredPianoRolls({
  bassChannel,
  chordChannel,
  melodyChannel,
  bassHits,
  chordHits,
  melodyHits,
  onBassHitsChange,
  onChordHitsChange,
  onMelodyHitsChange,
  playheadElRef,
  rollScrollRef,
  onSubOctaveDown,
  onSubOctaveUp,
  onChordOctaveDown,
  onChordOctaveUp,
  onMelodyOctaveDown,
  onMelodyOctaveUp,
  subRootNoteCount = 0,
  chordStackNoteCount = 0,
  melodyLayerNoteCount = 0,
  onClearAllSubRoots,
  ...shared
}: GrooveLabLayeredPianoRollsProps) {
  const subScrollRef = useRef<HTMLDivElement | null>(null);
  const melodyScrollRef = useRef<HTMLDivElement | null>(null);
  const [syncScrollLeft, setSyncScrollLeft] = useState(0);

  const onScrollSync = useCallback((left: number) => {
    setSyncScrollLeft(left);
    for (const ref of [subScrollRef, rollScrollRef, melodyScrollRef]) {
      const el = ref?.current;
      if (el && Math.abs(el.scrollLeft - left) > 0.5) el.scrollLeft = left;
    }
  }, [rollScrollRef]);

  const subMeta = GROOVE_LAB_LAYER_SCOPE_META.sub;
  const chordMeta = GROOVE_LAB_LAYER_SCOPE_META.chord;
  const melodyMeta = GROOVE_LAB_LAYER_SCOPE_META.melody;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#030508',
      }}
    >
      <div style={{ ...LAYER_SHELL, flex: '0 1 26%', maxHeight: '32%' }}>
        <GrooveLabPianoRoll
          {...shared}
          layerScope="sub"
          rollChrome="strip"
          channel={bassChannel}
          hits={bassHits}
          onHitsChange={onBassHitsChange}
          rollScrollRef={subScrollRef}
          syncScrollLeft={syncScrollLeft}
          onScrollSync={onScrollSync}
          onSubOctaveDown={onSubOctaveDown}
          onSubOctaveUp={onSubOctaveUp}
          subRootNoteCount={subRootNoteCount}
          onClearAllSubRoots={onClearAllSubRoots}
          layerStripTitle={`${subMeta.label} · ${chordBassSeqChannelLabel(bassChannel)} · ${subMeta.register}`}
          layerStripColor={subMeta.color}
        />
      </div>

      <div style={{ ...LAYER_SHELL, flex: '1 1 44%', minHeight: 140, borderColor: '#22c55e33' }}>
        <GrooveLabPianoRoll
          {...shared}
          layerScope="chord"
          rollChrome="full"
          channel={chordChannel}
          hits={chordHits}
          onHitsChange={onChordHitsChange}
          playheadElRef={playheadElRef}
          rollScrollRef={rollScrollRef}
          syncScrollLeft={syncScrollLeft}
          onScrollSync={onScrollSync}
          onChordOctaveDown={onChordOctaveDown}
          onChordOctaveUp={onChordOctaveUp}
          chordStackNoteCount={chordStackNoteCount}
          onSpreadChord={shared.onSpreadChord}
          onDeleteChordAtSlot={shared.onDeleteChordAtSlot}
          layerStripTitle={`${chordMeta.label} · ${chordBassSeqChannelLabel(chordChannel)} · ${chordMeta.register}`}
          layerStripColor={chordMeta.color}
        />
      </div>

      <div style={{ ...LAYER_SHELL, flex: '0 1 24%', maxHeight: '30%', borderBottom: 'none' }}>
        <GrooveLabPianoRoll
          {...shared}
          layerScope="melody"
          rollChrome="strip"
          channel={melodyChannel}
          hits={melodyHits}
          onHitsChange={onMelodyHitsChange}
          rollScrollRef={melodyScrollRef}
          syncScrollLeft={syncScrollLeft}
          onScrollSync={onScrollSync}
          onMelodyOctaveDown={onMelodyOctaveDown}
          onMelodyOctaveUp={onMelodyOctaveUp}
          melodyLayerNoteCount={melodyLayerNoteCount}
          layerStripTitle={`${melodyMeta.label} · ${chordBassSeqChannelLabel(melodyChannel)} · ${melodyMeta.register}`}
          layerStripColor={melodyMeta.color}
        />
      </div>
    </div>
  );
}
