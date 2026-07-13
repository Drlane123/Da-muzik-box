import { useState, type CSSProperties } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Lab808PadBank } from '@/app/components/creation/Lab808PadBank';
import { Lab808TonePadBank } from '@/app/components/creation/Lab808TonePadBank';
import { lab808BtnGhost, lab808BtnMini } from '@/app/lib/creationStation/lab808UiTheme';
import {
  LAB808_BPM_SYNC_TARGET_LABELS,
  type Lab808BpmSyncTarget,
  type Lab808TransportMirrorTarget,
} from '@/app/lib/creationStation/lab808Sync';
import type { Lab808ProgressionRoot } from '@/app/lib/creationStation/lab808ChordRoots';
import type { Lab808ChordLockSource } from '@/app/lib/creationStation/lab808ChordLockSources';
import type { Lab808SoundLane } from '@/app/lib/creationStation/eightZeroEightVoice';
import type { LabMpcKitId } from '@/app/lib/creationStation/labMpcKits';
import { Lab808HelpTip } from '@/app/components/creation/Lab808HelpHub';

export type Lab808PadDeckBank = 'drums' | 'tone';

export interface Lab808DualPadDeckProps {
  getAudioContext: () => AudioContext | null;
  prefetchActive?: boolean;
  soundLane: Lab808SoundLane;
  onSoundLaneChange: (lane: Lab808SoundLane) => void;
  tonePresetLabel: string;
  onPlayToneMidi: (midi: number, velocity01: number, holdBeats?: number) => void;
  embedded?: boolean;
  onBack?: () => void;
  padDeckBank?: Lab808PadDeckBank;
  onPadDeckBankChange?: (bank: Lab808PadDeckBank) => void;
  mpcKitId?: LabMpcKitId;
  onMpcKitIdChange?: (id: LabMpcKitId) => void;
  chordRootLock: boolean;
  onChordRootLockChange: (on: boolean) => void;
  chordLockSource: Lab808ChordLockSource;
  onChordLockSourceChange: (source: Lab808ChordLockSource) => void;
  canGenerateChordRoots?: boolean;
  onGenerateChordRoots?: () => void;
  progressionRoots: readonly Lab808ProgressionRoot[];
  progressionConnected: boolean;
  progressionLabel: string | null;
  activeRootHighlight: number | null;
  toneMasterLevel?: number;
  onToneMasterLevelChange?: (level: number) => void;
  drumMasterLevel?: number;
  onDrumMasterLevelChange?: (level: number) => void;
  toneMuted?: boolean;
  toneSolo?: boolean;
  onToneMutedToggle?: () => void;
  onToneSoloToggle?: () => void;
  toneAudible?: boolean;
  drumMuted?: boolean;
  drumSolo?: boolean;
  onDrumMutedToggle?: () => void;
  onDrumSoloToggle?: () => void;
  drumAudible?: boolean;
  internal808Link?: boolean;
  onInternal808LinkChange?: (linked: boolean) => void;
  bpmSyncTarget?: Lab808BpmSyncTarget;
  onBpmSyncTargetChange?: (target: Lab808BpmSyncTarget) => void;
  transportMirror?: Lab808TransportMirrorTarget;
  onTransportMirrorChange?: (target: Lab808TransportMirrorTarget) => void;
  onApply808Sync?: () => void;
  chordPlayThrough?: boolean;
  onChordPlayThroughChange?: (on: boolean) => void;
}

const SYNC_CHIP = (active: boolean): CSSProperties => ({
  ...lab808BtnMini,
  padding: '2px 6px',
  minHeight: 22,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.04em',
  borderColor: active ? '#7cf4c6' : '#3f3f46',
  background: active ? 'rgba(124, 244, 198, 0.12)' : 'transparent',
  color: active ? '#7cf4c6' : '#71717a',
});
const BANK_BTN = (active: boolean, accent: string): CSSProperties => ({
  ...lab808BtnMini,
  padding: '4px 10px',
  minHeight: 28,
  fontSize: 11,
  borderColor: active ? accent : '#3f3f46',
  background: active ? `color-mix(in srgb, ${accent} 22%, #12121a)` : 'transparent',
  color: active ? accent : '#71717a',
});

/** Compact — default ghost back is 44px tall and overlaps the kick/bass header. */
const BACK_BTN: CSSProperties = {
  ...lab808BtnGhost,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '2px 7px',
  minHeight: 0,
  height: 'auto',
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1.1,
  borderRadius: 6,
};

export function Lab808DualPadDeck({
  getAudioContext,
  prefetchActive = true,
  soundLane,
  onSoundLaneChange,
  tonePresetLabel,
  onPlayToneMidi,
  embedded,
  onBack,
  padDeckBank: padDeckBankProp,
  onPadDeckBankChange,
  mpcKitId,
  onMpcKitIdChange,
  chordRootLock,
  onChordRootLockChange,
  chordLockSource,
  onChordLockSourceChange,
  canGenerateChordRoots = false,
  onGenerateChordRoots,
  progressionRoots,
  progressionConnected,
  progressionLabel,
  activeRootHighlight,
  toneMasterLevel,
  onToneMasterLevelChange,
  drumMasterLevel,
  onDrumMasterLevelChange,
  toneMuted = false,
  toneSolo = false,
  onToneMutedToggle,
  onToneSoloToggle,
  toneAudible = true,
  drumMuted = false,
  drumSolo = false,
  onDrumMutedToggle,
  onDrumSoloToggle,
  drumAudible = true,
  internal808Link = true,
  onInternal808LinkChange,
  bpmSyncTarget = '808-internal',
  onBpmSyncTargetChange,
  transportMirror = 'none',
  onTransportMirrorChange,
  onApply808Sync,
  chordPlayThrough = false,
  onChordPlayThroughChange,
}: Lab808DualPadDeckProps) {
  const [bankInner, setBankInner] = useState<Lab808PadDeckBank>('tone');
  const bank = padDeckBankProp ?? bankInner;
  const setBank = onPadDeckBankChange ?? setBankInner;
  const toneAccent = soundLane === 'kick' ? '#ca8a04' : '#22c55e';

  return (
    <div
      style={{
        flex: '0 0 auto',
        minHeight: 0,
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderBottom: bank === 'drums' ? 'none' : '1px solid rgba(124, 244, 198, 0.18)',
        background: 'linear-gradient(180deg, #14141c 0%, #1e1e24 100%)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 8,
          padding: '4px 10px 2px',
          paddingLeft: embedded && onBack ? 62 : 10,
          minHeight: 30,
          flexShrink: 0,
        }}
      >
        {embedded && onBack ? (
          <button
            type="button"
            onClick={onBack}
            style={{
              ...BACK_BTN,
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 2,
            }}
            aria-label="Back to Beat Lab"
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
            Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setBank('tone')}
          style={BANK_BTN(bank === 'tone', toneAccent)}
          title="16 chromatic pads — your 808 kick & bass sounds"
        >
          808 Kick / Bass
        </button>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            padding: '0 8px',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 900, letterSpacing: '-0.02em', color: '#f0f0f0', lineHeight: 1.1 }}>
            808 LAB
            <Lab808HelpTip tab="overview" title="808 Lab quick start" />
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: '0.1em' }}>PADS + PIANO ROLL</span>
        </div>
        <button
          type="button"
          onClick={() => setBank('drums')}
          style={BANK_BTN(bank === 'drums', '#7cf4c6')}
          title="16 drum-kit one-shots (MPC kits)"
        >
          Drum kits
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '2px 10px 6px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
        aria-label="808 Lab sync"
      >
        <Lab808HelpTip tab="sync" title="808 LINK · BPM · PLAY mirror" />
        <button
          type="button"
          onClick={() => onInternal808LinkChange?.(!internal808Link)}
          style={SYNC_CHIP(internal808Link)}
          title="Link Kick/Bass + Drum Kits tempo (same page). Transport already shared."
        >
          808 LINK
        </button>
        <span style={{ fontSize: 8, fontWeight: 800, color: '#52525b', letterSpacing: '0.08em' }}>BPM →</span>
        {(['808-internal', 'beat-lab', 'groove-lab', 'chord-builder'] as Lab808BpmSyncTarget[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onBpmSyncTargetChange?.(t)}
            style={SYNC_CHIP(bpmSyncTarget === t)}
            title={
              t === 'groove-lab'
                ? 'Link tempo + mirror Play both ways (808 or Groove transport)'
                : `Follow ${LAB808_BPM_SYNC_TARGET_LABELS[t]} tempo`
            }
          >
            {LAB808_BPM_SYNC_TARGET_LABELS[t]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onApply808Sync?.()}
          style={{ ...SYNC_CHIP(false), borderColor: '#7cf4c6', color: '#7cf4c6' }}
          title="Apply BPM from selected target now (Kick/Bass + Drum Kits when 808 LINK is on)"
        >
          SYNC
        </button>
        <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} aria-hidden />
        <span style={{ fontSize: 8, fontWeight: 800, color: '#52525b', letterSpacing: '0.08em' }}>PLAY →</span>
        {(['none', 'beat-lab', 'groove-lab'] as Lab808TransportMirrorTarget[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTransportMirrorChange?.(t)}
            style={SYNC_CHIP(transportMirror === t)}
            title={
              t === 'none'
                ? '808 transport only'
                : t === 'beat-lab'
                  ? 'Mirror Play/Pause/Stop to Beat Lab'
                  : 'Mirror Play both ways with Groove Lab (808 or Groove transport)'
            }
          >
            {t === 'none' ? '808 only' : t === 'beat-lab' ? 'Beat Lab' : 'Groove Lab'}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChordPlayThroughChange?.(!chordPlayThrough)}
          style={SYNC_CHIP(chordPlayThrough)}
          title="Optional: layer Chord Builder / Groove Lab / New Synth chords under 808 (off = kick/bass only)"
        >
          + CHORDS
        </button>
      </div>

      <div style={{ position: 'relative', flex: '0 0 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: bank === 'drums' ? 'block' : 'none',
          }}
          aria-hidden={bank !== 'drums'}
        >
          <Lab808PadBank
            getAudioContext={getAudioContext}
            prefetchActive={prefetchActive}
            kitId={mpcKitId}
            onKitIdChange={onMpcKitIdChange}
            masterLevel={drumMasterLevel}
            onMasterLevelChange={onDrumMasterLevelChange}
            muted={drumMuted}
            solo={drumSolo}
            onMutedToggle={onDrumMutedToggle}
            onSoloToggle={onDrumSoloToggle}
            audible={drumAudible}
          />
        </div>
        <div
          style={{
            display: bank === 'tone' ? 'flex' : 'none',
            flexDirection: 'column',
            flex: '0 0 auto',
            minHeight: 0,
          }}
          aria-hidden={bank !== 'tone'}
        >
          <Lab808TonePadBank
            soundLane={soundLane}
            onSoundLaneChange={onSoundLaneChange}
            presetLabel={tonePresetLabel}
            onPlayMidi={onPlayToneMidi}
            chordRootLock={chordRootLock}
            onChordRootLockChange={onChordRootLockChange}
            chordLockSource={chordLockSource}
            onChordLockSourceChange={onChordLockSourceChange}
            canGenerateChordRoots={canGenerateChordRoots}
            onGenerateChordRoots={onGenerateChordRoots}
            progressionRoots={progressionRoots}
            progressionConnected={progressionConnected}
            progressionLabel={progressionLabel}
            activeRootHighlight={activeRootHighlight}
            masterLevel={toneMasterLevel}
            onMasterLevelChange={onToneMasterLevelChange}
            muted={toneMuted}
            solo={toneSolo}
            onMutedToggle={onToneMutedToggle}
            onSoloToggle={onToneSoloToggle}
            audible={toneAudible}
          />
        </div>
      </div>
    </div>
  );
}
