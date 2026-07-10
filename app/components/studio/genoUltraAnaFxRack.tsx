'use client';

import { useCallback, useMemo, useState } from 'react';
import type { GenoUltraOscWave, GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import { sanitizeGenoUltraFxParams } from '@/app/lib/studio/genoUltraSynthTypes';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { GenoUltraArpSe2RollNote } from '@/app/lib/studio/genoUltraArpExport';
import type {
  GenoBuildTrackRef,
  GenoUltraGenoBuildChordSource,
} from '@/app/lib/studio/genoUltraArpChordImport';
import { SekBigTabs, SEKTOR } from '@/app/components/studio/genoUltraSektorUi';
import {
  AnaModernDelayDisplay,
  AnaReverbDiffuseDisplay,
  AnaTapeWaveDisplay,
  anaFxSlotButtonStyle,
} from '@/app/components/studio/genoUltraFxVisuals';
import {
  ANA,
  AnaArpSequencerPanel,
  AnaBtn,
  AnaKnob,
  AnaKnobRow,
  AnaLcdBar,
  AnaLcdField,
  AnaLcdRow,
  AnaEqPanel,
  AnaPanel,
  AnaScopeFrame,
  AnaTabs,
  oscWavePath,
} from '@/app/components/studio/genoUltraAnaUi';

export type AnaFxSlotId =
  | 'dualDelay'
  | 'insert2'
  | 'tape'
  | 'insert4'
  | 'insert5'
  | 'pingPong'
  | 'hall';

export const ANA_FX_SLOTS: { id: AnaFxSlotId; label: string }[] = [
  { id: 'dualDelay', label: '1 DUAL DELAY' },
  { id: 'insert2', label: '2 INSERT 2' },
  { id: 'tape', label: '3 TAPEVI' },
  { id: 'insert4', label: '4 INSERT 4' },
  { id: 'insert5', label: '5 INSERT 5' },
  { id: 'pingPong', label: 'PING-PONG' },
  { id: 'hall', label: 'HALL' },
];

export type AnaCenterTab = 'arp' | 'cmd' | 'eq' | 'oscmix' | 'mod' | 'settings';

function FxSlotStrip({
  active,
  disabled,
  onChange,
}: {
  active: AnaFxSlotId;
  disabled?: boolean;
  onChange: (id: AnaFxSlotId) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'nowrap',
        gap: 4,
        padding: '6px 8px',
        borderTop: `1px solid ${ANA.borderHi}44`,
        background: 'linear-gradient(180deg, #0a0c10 0%, #060708 100%)',
        overflowX: 'auto',
      }}
    >
      {ANA_FX_SLOTS.map((s) => (
        <button
          key={s.id}
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onChange(s.id);
          }}
          style={anaFxSlotButtonStyle(active === s.id, disabled)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function DualDelayModule({
  voice,
  disabled,
  pingPong,
  onPatchFx,
  onPatchVoice,
}: {
  voice: GenoUltraSynthVoiceParams;
  disabled?: boolean;
  pingPong?: boolean;
  onPatchFx: (fx: Partial<GenoUltraSynthVoiceParams['fx']>) => void;
  onPatchVoice: (p: Partial<GenoUltraSynthVoiceParams>) => void;
}) {
  const fx = voice.fx;
  const [syncOn, setSyncOn] = useState(false);
  const delayR = Math.round(fx.delayTimeMs * 1.08);

  const patchDelay = useCallback(
    (partial: Partial<GenoUltraSynthVoiceParams['fx']>) => {
      const next = { ...partial };
      if (partial.delayMix !== undefined && partial.delayMix > 0.02) {
        next.delayEnabled = true;
      }
      onPatchFx(next);
    },
    [onPatchFx],
  );

  const toggleDelay = useCallback(() => {
    const nextOn = fx.delayEnabled === false;
    if (nextOn && fx.delayMix < 0.05) {
      onPatchFx({ delayEnabled: true, delayMix: 0.38 });
      return;
    }
    onPatchFx({ delayEnabled: nextOn });
  }, [fx.delayEnabled, fx.delayMix, onPatchFx]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnaModernDelayDisplay
        delayTimeMs={fx.delayTimeMs}
        delayTimeMsR={delayR}
        feedback={fx.delayFeedback}
        mix={fx.delayMix}
        enabled={fx.delayEnabled}
        pingPong={pingPong}
        disabled={disabled}
        syncOn={syncOn}
        onPatch={patchDelay}
        onToggleEnabled={toggleDelay}
        onToggleSync={() => setSyncOn((v) => !v)}
      />
      <AnaKnobRow>
        <AnaKnob label="INPUT" value={fx.delayMix * 0.85} min={0} max={1} disabled={disabled} onChange={(v) => patchDelay({ delayMix: v })} />
        <AnaKnob label="DRY/WET" value={fx.delayMix} min={0} max={1} disabled={disabled} onChange={(v) => patchDelay({ delayMix: v })} />
        <AnaKnob label="OUTPUT" value={voice.outputLevel} min={0} max={1} disabled={disabled} onChange={(v) => onPatchVoice({ outputLevel: v })} />
        <AnaKnob label="FEEDBACK" value={fx.delayFeedback} min={0} max={0.95} disabled={disabled} onChange={(v) => onPatchFx({ delayFeedback: v })} />
        <AnaKnob label="HI PASS" value={220} min={40} max={2000} decimals={0} unit="Hz" disabled onChange={() => {}} />
        <AnaKnob label="LO PASS" value={8200} min={1000} max={16000} decimals={0} unit="Hz" disabled onChange={() => {}} />
      </AnaKnobRow>
    </div>
  );
}

function HallModule({
  voice,
  disabled,
  onPatchFx,
  onPatchVoice,
}: {
  voice: GenoUltraSynthVoiceParams;
  disabled?: boolean;
  onPatchFx: (fx: Partial<GenoUltraSynthVoiceParams['fx']>) => void;
  onPatchVoice: (p: Partial<GenoUltraSynthVoiceParams>) => void;
}) {
  const fx = voice.fx;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <AnaLcdBar size="md" width={120}>
        HALL REVERB
      </AnaLcdBar>
      <AnaReverbDiffuseDisplay decay={fx.reverbDecay} mix={fx.reverbMix} height={68} />
      <AnaKnobRow>
        <AnaKnob label="INPUT" value={fx.reverbMix * 0.9} min={0} max={1} disabled={disabled} onChange={(v) => onPatchFx({ reverbMix: v })} />
        <AnaKnob label="DRY/WET" value={fx.reverbMix} min={0} max={1} disabled={disabled} onChange={(v) => onPatchFx({ reverbMix: v })} />
        <AnaKnob label="OUTPUT" value={voice.outputLevel} min={0} max={1} disabled={disabled} onChange={(v) => onPatchVoice({ outputLevel: v })} />
        <AnaKnob label="DECAY" value={fx.reverbDecay} min={0.1} max={0.95} disabled={disabled} onChange={(v) => onPatchFx({ reverbDecay: v })} />
        <AnaKnob label="SIZE" value={0.62} min={0} max={1} disabled onChange={() => {}} />
        <AnaKnob label="DAMP" value={0.4} min={0} max={1} disabled onChange={() => {}} />
        <AnaKnob label="WIDTH" value={0.7} min={0} max={1} disabled onChange={() => {}} />
        <AnaKnob label="PRE-DLY" value={12} min={0} max={80} decimals={0} unit="ms" disabled onChange={() => {}} />
      </AnaKnobRow>
    </div>
  );
}

function TapeModule({
  voice,
  disabled,
  onPatchFx,
  onPatchVoice,
}: {
  voice: GenoUltraSynthVoiceParams;
  disabled?: boolean;
  onPatchFx: (fx: Partial<GenoUltraSynthVoiceParams['fx']>) => void;
  onPatchVoice: (p: Partial<GenoUltraSynthVoiceParams>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <AnaLcdBar size="md" width={100}>
        TAPEVI
      </AnaLcdBar>
      <AnaTapeWaveDisplay mix={voice.fx.chorusMix} height={68} />
      <AnaKnobRow>
        <AnaKnob label="DRIVE" value={0.35} min={0} max={1} disabled onChange={() => {}} />
        <AnaKnob label="WOW" value={0.18} min={0} max={1} disabled onChange={() => {}} />
        <AnaKnob label="FLUTTER" value={0.12} min={0} max={1} disabled onChange={() => {}} />
        <AnaKnob label="MIX" value={voice.fx.chorusMix} min={0} max={1} disabled={disabled} onChange={(v) => onPatchFx({ chorusMix: v })} />
        <AnaKnob label="OUTPUT" value={voice.outputLevel} min={0} max={1} disabled={disabled} onChange={(v) => onPatchVoice({ outputLevel: v })} />
      </AnaKnobRow>
    </div>
  );
}

function InsertModule({ slot, disabled }: { slot: string; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
      <AnaLcdBar size="lg" width={260}>
        {slot} — EMPTY
      </AnaLcdBar>
      <span style={{ fontSize: 8, color: ANA.textDim }}>Drag FX or select from browser</span>
      <AnaBtn disabled={disabled}>Load Insert</AnaBtn>
    </div>
  );
}

export type GenoUltraArpSoundPresetOption = {
  id: string;
  label: string;
  category: string;
};

function ArpMiniPanel({
  disabled,
  bpm,
  arpTrackId,
  arpBpm,
  onArpBpmChange,
  basePitch,
  songKeyRoot,
  songKeyMode,
  getArpVoice,
  patchLabel,
  activePresetId,
  onLoadPreset,
  onApplyVoice,
  soundPresets,
  registerArpMelodyApplier,
  registerArpUserPatternApplier,
  melodyTag,
  activeMelodyLabel,
  onPatternSaved,
  getStripOutput,
  ensureAudioContext,
  onArpStep,
  onApplyToPianoRoll,
  genoBuildSources,
  genoBuildImportTracks,
  beatsPerBar,
  monophonic,
  polyphony,
  onMonophonicChange,
  se2SyncLocked,
  se2TransportPlaying,
  onSe2SyncToggle,
  getSe2PlayheadBeat,
  getSe2TransportOriginBeat,
  keySourceTracks,
  keySourceTrackIndex,
  onKeySourceTrackIndexChange,
  onDetectKeyFromSourceTrack,
  followSe2SongKey,
  onFollowSe2SongKeyChange,
  getSe2TrackChordImport,
  followSourceTrackChords,
  arpPerformanceGetters,
  hidden,
}: {
  disabled?: boolean;
  bpm?: number;
  arpTrackId?: string;
  arpBpm?: number;
  onArpBpmChange?: (bpm: number) => void;
  beatsPerBar?: number;
  basePitch?: number;
  songKeyRoot?: number;
  songKeyMode?: StudioDetectedKeyMode;
  getArpVoice: () => GenoUltraSynthVoiceParams;
  patchLabel?: string;
  activePresetId?: string;
  onLoadPreset?: (presetId: string, voicePatch?: Partial<GenoUltraSynthVoiceParams>) => void;
  onApplyVoice?: (voice: GenoUltraSynthVoiceParams) => void;
  soundPresets?: readonly GenoUltraArpSoundPresetOption[];
  registerArpMelodyApplier?: (fn: (melodyId: string) => void) => void;
  registerArpUserPatternApplier?: (fn: (patternId: string) => void) => void;
  melodyTag?: import('@/app/lib/studio/genoUltraArpMelodyPresets').GenoUltraArpMelodyTag;
  activeMelodyLabel?: string;
  onPatternSaved?: (entry: import('@/app/lib/studio/genoUltraArpUserSaves').GenoUltraArpSavedPattern) => void;
  getStripOutput?: (ctx: AudioContext) => AudioNode;
  ensureAudioContext?: () => Promise<AudioContext>;
  onArpStep?: (step: number, pitch: number | null, gateSec: number) => void;
  onApplyToPianoRoll?: (notes: readonly GenoUltraArpSe2RollNote[]) => void;
  genoBuildSources?: readonly GenoUltraGenoBuildChordSource[];
  genoBuildImportTracks?: readonly GenoBuildTrackRef[];
  monophonic?: boolean;
  polyphony?: number;
  onMonophonicChange?: (mono: boolean) => void;
  se2SyncLocked?: boolean;
  se2TransportPlaying?: boolean;
  onSe2SyncToggle?: () => void;
  getSe2PlayheadBeat?: () => number;
  getSe2TransportOriginBeat?: () => number;
  keySourceTracks?: readonly import('@/app/lib/studio/genoUltraArpKeySource').GenoUltraArpKeySourceTrack[];
  keySourceTrackIndex?: number;
  onKeySourceTrackIndexChange?: (trackIndex: number) => void;
  onDetectKeyFromSourceTrack?: (trackIndex: number) => boolean | void;
  followSe2SongKey?: boolean;
  onFollowSe2SongKeyChange?: (linked: boolean) => void;
  getSe2TrackChordImport?: (
    trackIndex: number,
    barLength: import('@/app/lib/studio/genoUltraArpPattern').GenoArpBarLength,
  ) =>
    | import('@/app/lib/studio/genoUltraArpChordImport').GenoUltraArpChordImportResult
    | import('@/app/lib/studio/genoUltraArpChordImport').GenoUltraArpChordImportError;
  followSourceTrackChords?: boolean;
  arpPerformanceGetters?: import('@/app/lib/studio/genoUltraArpPerformance').GenoUltraArpPerformanceGetters;
  hidden?: boolean;
}) {
  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: hidden ? 'none' : 'flex',
        flexDirection: 'column',
      }}
    >
      <AnaArpSequencerPanel
        disabled={disabled}
        bpm={bpm}
        arpTrackId={arpTrackId}
        arpBpm={arpBpm}
        onArpBpmChange={onArpBpmChange}
        basePitch={basePitch}
        songKeyRoot={songKeyRoot}
        songKeyMode={songKeyMode}
        getArpVoice={getArpVoice}
        patchLabel={patchLabel}
        activePresetId={activePresetId}
        onLoadPreset={onLoadPreset}
        onApplyVoice={onApplyVoice}
        soundPresets={soundPresets}
        registerArpMelodyApplier={registerArpMelodyApplier}
        registerArpUserPatternApplier={registerArpUserPatternApplier}
        melodyTag={melodyTag}
        activeMelodyLabel={activeMelodyLabel}
        onPatternSaved={onPatternSaved}
        getStripOutput={getStripOutput}
        ensureAudioContext={ensureAudioContext}
        onArpStep={onArpStep}
        onApplyToPianoRoll={onApplyToPianoRoll}
        genoBuildSources={genoBuildSources}
        genoBuildImportTracks={genoBuildImportTracks}
        beatsPerBar={beatsPerBar}
        monophonic={monophonic}
        polyphony={polyphony}
        onMonophonicChange={onMonophonicChange}
        se2SyncLocked={se2SyncLocked}
        se2TransportPlaying={se2TransportPlaying}
        onSe2SyncToggle={onSe2SyncToggle}
        getSe2PlayheadBeat={getSe2PlayheadBeat}
        getSe2TransportOriginBeat={getSe2TransportOriginBeat}
        keySourceTracks={keySourceTracks}
        keySourceTrackIndex={keySourceTrackIndex}
        onKeySourceTrackIndexChange={onKeySourceTrackIndexChange}
        onDetectKeyFromSourceTrack={onDetectKeyFromSourceTrack}
        followSe2SongKey={followSe2SongKey}
        onFollowSe2SongKeyChange={onFollowSe2SongKeyChange}
        getSe2TrackChordImport={getSe2TrackChordImport}
        followSourceTrackChords={followSourceTrackChords}
        arpPerformanceGetters={arpPerformanceGetters}
      />
    </div>
  );
}

function EqTabPanel({
  voice,
  disabled,
  onPatchFx,
}: {
  voice: GenoUltraSynthVoiceParams;
  disabled?: boolean;
  onPatchFx: (fx: Partial<GenoUltraSynthVoiceParams['fx']>) => void;
}) {
  return <AnaEqPanel fx={voice.fx} disabled={disabled} onPatchFx={onPatchFx} />;
}

function OscMixPanel({
  voice,
  disabled,
  onPatch,
}: {
  voice: GenoUltraSynthVoiceParams;
  disabled?: boolean;
  onPatch: (p: Partial<GenoUltraSynthVoiceParams>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <AnaLcdRow>
        <AnaLcdField label="OSC1" value={Math.round(voice.osc1.level * 100)} unit="%" disabled={disabled} onChange={(v) => onPatch({ osc1: { ...voice.osc1, level: v / 100 } })} min={0} max={100} />
        <AnaLcdField label="OSC2" value={Math.round(voice.osc2.level * 100)} unit="%" disabled={disabled} onChange={(v) => onPatch({ osc2: { ...voice.osc2, level: v / 100 } })} min={0} max={100} />
        <AnaLcdField label="OSC3" value={Math.round(voice.osc3.level * 100)} unit="%" disabled={disabled} onChange={(v) => onPatch({ osc3: { ...voice.osc3, level: v / 100 } })} min={0} max={100} />
        <AnaLcdField label="SUB" value={Math.round(voice.subLevel * 100)} unit="%" disabled={disabled} onChange={(v) => onPatch({ subLevel: v / 100 })} min={0} max={100} />
        <AnaLcdField label="NOISE" value={Math.round(voice.noiseLevel * 200)} unit="%" disabled={disabled} onChange={(v) => onPatch({ noiseLevel: v / 200 })} min={0} max={100} />
      </AnaLcdRow>
      <AnaKnobRow>
        <AnaKnob label="OSC 1" value={voice.osc1.level} min={0} max={1} disabled={disabled} onChange={(v) => onPatch({ osc1: { ...voice.osc1, level: v } })} />
        <AnaKnob label="OSC 2" value={voice.osc2.level} min={0} max={1} disabled={disabled} onChange={(v) => onPatch({ osc2: { ...voice.osc2, level: v } })} />
        <AnaKnob label="OSC 3" value={voice.osc3.level} min={0} max={1} disabled={disabled} onChange={(v) => onPatch({ osc3: { ...voice.osc3, level: v } })} />
        <AnaKnob label="SUB" value={voice.subLevel} min={0} max={1} disabled={disabled} onChange={(v) => onPatch({ subLevel: v })} />
        <AnaKnob label="NOISE" value={voice.noiseLevel} min={0} max={0.5} disabled={disabled} onChange={(v) => onPatch({ noiseLevel: v })} />
      </AnaKnobRow>
    </div>
  );
}

export type AnaCenterRackProps = {
  voice: GenoUltraSynthVoiceParams;
  disabled?: boolean;
  bpm?: number;
  arpTrackId?: string;
  arpBpm?: number;
  onArpBpmChange?: (bpm: number) => void;
  basePitch?: number;
  songKeyRoot?: number;
  songKeyMode?: StudioDetectedKeyMode;
  getArpVoice: () => GenoUltraSynthVoiceParams;
  patchLabel?: string;
  activePresetId?: string;
  onLoadPreset?: (presetId: string, voicePatch?: Partial<GenoUltraSynthVoiceParams>) => void;
  onApplyVoice?: (voice: GenoUltraSynthVoiceParams) => void;
  soundPresets?: readonly GenoUltraArpSoundPresetOption[];
  registerArpMelodyApplier?: (fn: (melodyId: string) => void) => void;
  registerArpUserPatternApplier?: (fn: (patternId: string) => void) => void;
  melodyTag?: import('@/app/lib/studio/genoUltraArpMelodyPresets').GenoUltraArpMelodyTag;
  activeMelodyLabel?: string;
  onPatternSaved?: (entry: import('@/app/lib/studio/genoUltraArpUserSaves').GenoUltraArpSavedPattern) => void;
  getStripOutput?: (ctx: AudioContext) => AudioNode;
  ensureAudioContext?: () => Promise<AudioContext>;
  onArpStep?: (step: number, pitch: number | null, gateSec: number) => void;
  onApplyToPianoRoll?: (notes: readonly GenoUltraArpSe2RollNote[]) => void;
  genoBuildSources?: readonly GenoUltraGenoBuildChordSource[];
  genoBuildImportTracks?: readonly GenoBuildTrackRef[];
  beatsPerBar?: number;
  monophonic?: boolean;
  polyphony?: number;
  onMonophonicChange?: (mono: boolean) => void;
  se2SyncLocked?: boolean;
  se2TransportPlaying?: boolean;
  onSe2SyncToggle?: () => void;
  getSe2PlayheadBeat?: () => number;
  getSe2TransportOriginBeat?: () => number;
  keySourceTracks?: readonly import('@/app/lib/studio/genoUltraArpKeySource').GenoUltraArpKeySourceTrack[];
  keySourceTrackIndex?: number;
  onKeySourceTrackIndexChange?: (trackIndex: number) => void;
  onDetectKeyFromSourceTrack?: (trackIndex: number) => boolean | void;
  followSe2SongKey?: boolean;
  onFollowSe2SongKeyChange?: (linked: boolean) => void;
  getSe2TrackChordImport?: (
    trackIndex: number,
    barLength: import('@/app/lib/studio/genoUltraArpPattern').GenoArpBarLength,
  ) =>
    | import('@/app/lib/studio/genoUltraArpChordImport').GenoUltraArpChordImportResult
    | import('@/app/lib/studio/genoUltraArpChordImport').GenoUltraArpChordImportError;
  followSourceTrackChords?: boolean;
  arpPerformanceGetters?: import('@/app/lib/studio/genoUltraArpPerformance').GenoUltraArpPerformanceGetters;
  centerTab: AnaCenterTab;
  onCenterTabChange: (t: AnaCenterTab) => void;
  fxSlot: AnaFxSlotId;
  onFxSlotChange: (id: AnaFxSlotId) => void;
  onPatchVoice: (p: Partial<GenoUltraSynthVoiceParams>) => void;
  modMatrix?: React.ReactNode;
  presetsPanel?: React.ReactNode;
  oscPlusExtra?: React.ReactNode;
  navStyle?: 'ana' | 'sektor';
};

export function AnaCenterRack({
  voice,
  disabled,
  bpm = 120,
  arpTrackId,
  arpBpm,
  onArpBpmChange,
  basePitch = 60,
  songKeyRoot = 0,
  songKeyMode = 'major',
  getArpVoice,
  patchLabel,
  activePresetId,
  onLoadPreset,
  onApplyVoice,
  soundPresets,
  registerArpMelodyApplier,
  registerArpUserPatternApplier,
  melodyTag,
  activeMelodyLabel,
  onPatternSaved,
  getStripOutput,
  ensureAudioContext,
  onArpStep,
  onApplyToPianoRoll,
  genoBuildSources,
  genoBuildImportTracks,
  beatsPerBar,
  monophonic,
  polyphony,
  onMonophonicChange,
  se2SyncLocked,
  se2TransportPlaying,
  onSe2SyncToggle,
  getSe2PlayheadBeat,
  getSe2TransportOriginBeat,
  keySourceTracks,
  keySourceTrackIndex,
  onKeySourceTrackIndexChange,
  onDetectKeyFromSourceTrack,
  followSe2SongKey,
  onFollowSe2SongKeyChange,
  getSe2TrackChordImport,
  followSourceTrackChords,
  arpPerformanceGetters,
  centerTab,
  onCenterTabChange,
  fxSlot,
  onFxSlotChange,
  onPatchVoice,
  modMatrix,
  presetsPanel,
  oscPlusExtra,
  navStyle = 'ana',
}: AnaCenterRackProps) {
  const patchFx = useCallback(
    (partial: Partial<GenoUltraSynthVoiceParams['fx']>) => {
      onPatchVoice({ fx: sanitizeGenoUltraFxParams({ ...voice.fx, ...partial }) });
    },
    [onPatchVoice, voice.fx],
  );

  const fxModule = useMemo(() => {
    const common = { voice, disabled, onPatchFx: patchFx, onPatchVoice };
    switch (fxSlot) {
      case 'dualDelay':
        return <DualDelayModule {...common} />;
      case 'pingPong':
        return <DualDelayModule {...common} pingPong />;
      case 'hall':
        return <HallModule {...common} />;
      case 'tape':
        return <TapeModule {...common} />;
      case 'insert2':
        return <InsertModule slot="INSERT 2" disabled={disabled} />;
      case 'insert4':
        return <InsertModule slot="INSERT 4" disabled={disabled} />;
      case 'insert5':
        return <InsertModule slot="INSERT 5" disabled={disabled} />;
      default:
        return <DualDelayModule {...common} />;
    }
  }, [fxSlot, voice, disabled, patchFx, onPatchVoice]);

  const showFxRack = centerTab !== 'settings' && centerTab !== 'mod' && centerTab !== 'arp';

  const sektorTabs = [
    { id: 'oscmix', label: 'OSC+' },
    { id: 'arp', label: 'Sequencer' },
    { id: 'settings', label: 'Browser' },
    { id: 'eq', label: 'Effects' },
    { id: 'mod', label: 'Settings' },
  ] as const;

  const anaTabs = [
    { id: 'arp', label: 'ARP' },
    { id: 'cmd', label: 'CMD' },
    { id: 'eq', label: 'EQ' },
    { id: 'oscmix', label: 'OSC MIX' },
    { id: 'mod', label: 'MOD' },
    { id: 'settings', label: 'SETTINGS' },
  ] as const;

  const chrome = navStyle === 'sektor' ? SEKTOR : ANA;

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: centerTab === 'arp' ? 480 : centerTab === 'settings' ? 400 : 248 }}>
      {navStyle === 'sektor' ? (
        <SekBigTabs
          tabs={sektorTabs}
          active={centerTab === 'cmd' ? 'settings' : centerTab}
          onChange={(id) => onCenterTabChange(id as AnaCenterTab)}
        />
      ) : (
        <AnaTabs
          tabs={anaTabs}
          active={centerTab}
          onChange={(id) => onCenterTabChange(id as AnaCenterTab)}
        />
      )}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: navStyle === 'sektor' ? SEKTOR.bgInset : ANA.bgInset,
          border: `1px solid ${chrome.border}`,
          borderTop: 'none',
          minHeight: 200,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: 1,
            padding: centerTab === 'arp' ? '6px 8px 4px' : 8,
            overflow: centerTab === 'arp' ? 'hidden' : 'auto',
            display: centerTab === 'arp' ? 'flex' : 'block',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <ArpMiniPanel
            disabled={disabled}
            bpm={bpm}
            arpTrackId={arpTrackId}
            arpBpm={arpBpm}
            onArpBpmChange={onArpBpmChange}
            basePitch={basePitch}
            songKeyRoot={songKeyRoot}
            songKeyMode={songKeyMode}
            getArpVoice={getArpVoice}
            patchLabel={patchLabel}
            activePresetId={activePresetId}
            onLoadPreset={onLoadPreset}
            onApplyVoice={onApplyVoice}
            soundPresets={soundPresets}
            registerArpMelodyApplier={registerArpMelodyApplier}
            registerArpUserPatternApplier={registerArpUserPatternApplier}
            melodyTag={melodyTag}
            activeMelodyLabel={activeMelodyLabel}
            onPatternSaved={onPatternSaved}
            getStripOutput={getStripOutput}
            ensureAudioContext={ensureAudioContext}
            onArpStep={onArpStep}
            onApplyToPianoRoll={onApplyToPianoRoll}
            genoBuildSources={genoBuildSources}
            genoBuildImportTracks={genoBuildImportTracks}
            beatsPerBar={beatsPerBar}
            monophonic={monophonic}
            polyphony={polyphony}
            onMonophonicChange={onMonophonicChange}
            se2SyncLocked={se2SyncLocked}
            se2TransportPlaying={se2TransportPlaying}
            onSe2SyncToggle={onSe2SyncToggle}
            getSe2PlayheadBeat={getSe2PlayheadBeat}
            getSe2TransportOriginBeat={getSe2TransportOriginBeat}
            keySourceTracks={keySourceTracks}
            keySourceTrackIndex={keySourceTrackIndex}
            onKeySourceTrackIndexChange={onKeySourceTrackIndexChange}
            onDetectKeyFromSourceTrack={onDetectKeyFromSourceTrack}
            followSe2SongKey={followSe2SongKey}
            onFollowSe2SongKeyChange={onFollowSe2SongKeyChange}
            getSe2TrackChordImport={getSe2TrackChordImport}
            followSourceTrackChords={followSourceTrackChords}
            arpPerformanceGetters={arpPerformanceGetters}
            hidden={centerTab !== 'arp'}
          />
          {centerTab === 'cmd' && (
            <div style={{ fontSize: 8, color: ANA.cyan }}>
              <AnaLcdBar size="sm">CMD — CHORD MEMORY</AnaLcdBar>
              <div style={{ marginTop: 6, color: ANA.textDim }}>Use footer CMD panel for chord triggers.</div>
            </div>
          )}
          {centerTab === 'eq' && <EqTabPanel voice={voice} disabled={disabled} onPatchFx={patchFx} />}
          {centerTab === 'oscmix' && (
            <>
              {oscPlusExtra}
              <OscMixPanel voice={voice} disabled={disabled} onPatch={onPatchVoice} />
            </>
          )}
          {centerTab === 'mod' && modMatrix}
          {centerTab === 'settings' && presetsPanel}

          {showFxRack && <div style={{ marginTop: 10, borderTop: `1px solid ${chrome.borderHi}44`, paddingTop: 8 }}>{fxModule}</div>}
        </div>
        {showFxRack && <FxSlotStrip active={fxSlot} disabled={disabled} onChange={onFxSlotChange} />}
      </div>
    </div>
  );
}

export function sampleWavePath(seed: number, dense = false): string {
  const pts: string[] = [];
  const step = dense ? 2 : 4;
  for (let x = 0; x <= 200; x += step) {
    const y = 40 + Math.sin(x * 0.06 + seed) * 18 + Math.sin(x * 0.17 + seed * 2) * 8 + Math.sin(x * 0.31 + seed * 0.5) * 4;
    pts.push(`${x === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  return pts.join(' ');
}

const SAMPLER_OSC_WAVES: GenoUltraOscWave[] = ['saw', 'square', 'triangle', 'sine'];

const SAMPLER_SLOT_META: Record<4 | 5 | 6, { label: string; accent: string; glow: string }> = {
  4: { label: 'SUB', accent: ANA.cyanHi, glow: ANA.cyan },
  5: { label: 'NOISE', accent: '#fbbf24', glow: '#f59e0b' },
  6: { label: 'OSC 3', accent: ANA.greenHi, glow: ANA.green },
};

function noiseWavePath(dense = true): string {
  const pts: string[] = [];
  const step = dense ? 2 : 4;
  let seed = 17;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff) * 2 - 1;
  };
  for (let x = 0; x <= 200; x += step) {
    const y = 40 + rnd() * 26 + rnd() * 10;
    pts.push(`${x === 0 ? 'M' : 'L'} ${x} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

export function AnaOscSamplerPanel({
  voice,
  disabled,
  samplerTab,
  onSamplerTabChange,
  onPatch,
  scopeActive = false,
}: {
  voice: GenoUltraSynthVoiceParams;
  disabled?: boolean;
  samplerTab: 4 | 5 | 6;
  onSamplerTabChange: (t: 4 | 5 | 6) => void;
  onPatch: (p: Partial<GenoUltraSynthVoiceParams>) => void;
  scopeActive?: boolean;
}) {
  const slot = SAMPLER_SLOT_META[samplerTab];
  const osc3 = voice.osc3;
  const oct3 = Math.floor(osc3.semitone / 12);
  const semi3 = ((osc3.semitone % 12) + 12) % 12;

  const wavePath = useMemo(() => {
    if (samplerTab === 4) return oscWavePath('sine');
    if (samplerTab === 5) return noiseWavePath(true);
    return oscWavePath(osc3.wave);
  }, [samplerTab, osc3.wave]);

  const level = samplerTab === 4 ? voice.subLevel : samplerTab === 5 ? voice.noiseLevel * 2 : osc3.level;
  const slotOn =
    samplerTab === 4 ? voice.subLevel > 0.01 : samplerTab === 5 ? voice.noiseLevel > 0.004 : osc3.level > 0.01;
  const scopeLit = scopeActive && slotOn && level > 0.01;

  const toggleSlot = () => {
    if (samplerTab === 4) onPatch({ subLevel: slotOn ? 0 : 0.38 });
    else if (samplerTab === 5) onPatch({ noiseLevel: slotOn ? 0 : 0.14 });
    else onPatch({ osc3: { ...osc3, level: slotOn ? 0 : Math.max(0.28, osc3.level || 0.28) } });
  };

  const patchOsc3 = (partial: Partial<typeof osc3>) => onPatch({ osc3: { ...osc3, ...partial } });

  return (
    <AnaPanel title="SAMPLER" sub={slot.label} style={{ borderLeft: 'none', width: '100%', maxWidth: '100%' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {([4, 5, 6] as const).map((n) => (
            <AnaBtn key={n} small active={samplerTab === n} disabled={disabled} onClick={() => onSamplerTabChange(n)}>
              {SAMPLER_SLOT_META[n].label}
            </AnaBtn>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <AnaBtn small active={slotOn} disabled={disabled} onClick={toggleSlot}>
            {slotOn ? 'ON' : 'OFF'}
          </AnaBtn>
          <AnaLcdBar size="sm">SLOT {samplerTab}</AnaLcdBar>
        </div>
      </div>

      <AnaScopeFrame height={76}>
        <svg viewBox="0 0 200 80" width="100%" height="100%" preserveAspectRatio="none">
          <line x1={0} x2={200} y1={40} y2={40} stroke={ANA.screenGrid} strokeWidth={0.6} />
          <path d={`${wavePath} L200,80 L0,80 Z`} fill={`${slot.accent}${scopeLit ? '33' : '18'}`} stroke="none" />
          <path
            d={wavePath}
            stroke={slot.accent}
            strokeWidth={scopeLit ? 2 : 1.5}
            fill="none"
            style={{ filter: scopeLit ? `drop-shadow(0 0 6px ${slot.glow})` : undefined }}
          />
        </svg>
      </AnaScopeFrame>

      {samplerTab === 6 ? (
        <div style={{ display: 'flex', gap: 3, margin: '6px 0 4px', flexWrap: 'wrap' }}>
          {SAMPLER_OSC_WAVES.map((w) => (
            <AnaBtn key={w} small active={osc3.wave === w} disabled={disabled} onClick={() => patchOsc3({ wave: w })}>
              {w.slice(0, 3)}
            </AnaBtn>
          ))}
        </div>
      ) : null}

      <AnaLcdRow>
        <AnaLcdField
          label="OCT"
          value={samplerTab === 4 ? -1 : samplerTab === 6 ? oct3 : 0}
          disabled={disabled || samplerTab !== 6}
          min={-2}
          max={2}
          onChange={(v) => patchOsc3({ semitone: v * 12 + semi3 })}
        />
        <AnaLcdField
          label="SEMI"
          value={samplerTab === 6 ? semi3 : 0}
          disabled={disabled || samplerTab !== 6}
          min={0}
          max={11}
          onChange={(v) => patchOsc3({ semitone: oct3 * 12 + v })}
        />
        <AnaLcdField
          label="FINE"
          value={samplerTab === 6 ? Math.round(osc3.fineCents) : 0}
          unit="¢"
          disabled={disabled || samplerTab !== 6}
          min={-50}
          max={50}
          onChange={(v) => patchOsc3({ fineCents: v })}
        />
        <AnaLcdField label="VEL" value={100} disabled />
        <AnaLcdField label="LVL" value={Math.round(level * 100)} unit="%" disabled />
      </AnaLcdRow>

      {samplerTab === 6 ? (
        <AnaKnobRow>
          <AnaKnob label="OCT" value={oct3} min={-2} max={2} decimals={0} disabled={disabled} onChange={(v) => patchOsc3({ semitone: v * 12 + semi3 })} />
          <AnaKnob label="SEMI" value={semi3} min={0} max={11} decimals={0} disabled={disabled} onChange={(v) => patchOsc3({ semitone: oct3 * 12 + v })} />
          <AnaKnob label="FINE" value={osc3.fineCents} min={-50} max={50} decimals={0} unit="¢" disabled={disabled} onChange={(v) => patchOsc3({ fineCents: v })} />
          <AnaKnob label="LEVEL" value={osc3.level} min={0} max={1} disabled={disabled} onChange={(v) => patchOsc3({ level: v })} />
          <AnaKnob label="PHASE" value={osc3.pwm} min={0} max={1} disabled={disabled} onChange={(v) => patchOsc3({ pwm: v })} />
        </AnaKnobRow>
      ) : (
        <AnaKnobRow>
          <AnaKnob
            label="LEVEL"
            value={samplerTab === 4 ? voice.subLevel : voice.noiseLevel * 2}
            min={0}
            max={1}
            disabled={disabled}
            onChange={(v) => {
              if (samplerTab === 4) onPatch({ subLevel: v });
              else onPatch({ noiseLevel: v / 2 });
            }}
          />
          <AnaKnob label="PAN" value={0.5} min={0} max={1} disabled onChange={() => {}} />
          <AnaKnob label="FLT MIX" value={voice.filterDrive} min={0} max={1} disabled={disabled} onChange={(v) => onPatch({ filterDrive: v })} />
        </AnaKnobRow>
      )}
    </AnaPanel>
  );
}
