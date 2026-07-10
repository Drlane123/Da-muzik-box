'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  se2SynthGenoGenerateFromPrompt,
  se2SynthGenoRandomPrompt,
} from '@/app/lib/studio/se2SynthGenoGenerator';
import {
  se2SynthGenoAccompanyNotes,
  se2SynthGenoComposeFromPrompt,
  se2SynthGenoExtendNotes,
  type Se2SynthGenoComposeNote,
  type Se2SynthGenoStackPart,
  type Se2SynthGenoApplyStackMeta,
} from '@/app/lib/studio/se2SynthGenoCompose';
import { se2SynthGenoResolveComposeKey } from '@/app/lib/studio/se2SynthGenoKeyLock';
import { Se2SynthGenoChordPluginPanel } from '@/app/components/studio/Se2SynthGenoChordPluginPanel';
import { Se2SynthGenoFusionPanel } from '@/app/components/studio/Se2SynthGenoFusionPanel';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import { studioGeneratePartLabel } from '@/app/lib/studio/studioEditor2PartGenerator';
import type { Se2SynthGenoVoiceParams } from '@/app/lib/studio/se2SynthGenoTypes';
import {
  readSe2SynthGenoFusionSession,
  SE2_SYNTH_GENO_BUILD_TAB_LABEL,
  SE2_SYNTH_GENO_BUILD_1_LABEL,
  SE2_SYNTH_GENO_BUILD_2_LABEL,
  SE2_SYNTH_GENO_FUSION_NOTE_FLEX_LABEL,
  type Se2SynthGenoFusionParams,
} from '@/app/lib/studio/se2SynthGenoFusionEngine';
import {
  FUSION_ROLL_BAR_COUNT,
  readSe2SynthGenoFusionRollSession,
  se2SynthGenoFusionRollHasNotes,
  se2SynthGenoFusionRollSanitizedSounds,
  se2SynthGenoFusionRollToApplyStack,
  se2SynthGenoFusionRollToPreviewDraft,
} from '@/app/lib/studio/se2SynthGenoFusionRoll';
import { StudioEditor2HelpTip } from '@/app/components/studio/StudioEditor2HelpHub';
import type { Se2SynthGenoGrooveLeadLockInput } from '@/app/lib/studio/se2SynthGenoGrooveLeadLock';

export type Se2SynthGenoPanelProps = {
  trackIndex: number;
  trackName: string;
  accentHex?: string;
  prompt: string;
  composePrompt: string;
  voice: Se2SynthGenoVoiceParams;
  notes: readonly Se2SynthGenoComposeNote[];
  bpm: number;
  beatsPerBar: number;
  loopBars?: number;
  songKeyRoot: number;
  songKeyMode: StudioDetectedKeyMode;
  trackKeyRoot?: number;
  trackKeyMode?: StudioDetectedKeyMode;
  disabled?: boolean;
  onPromptChange: (prompt: string) => void;
  onComposePromptChange: (prompt: string) => void;
  onVoiceChange: (voice: Se2SynthGenoVoiceParams, promptUsed: string) => void;
  onApplyNotes: (
    notes: Se2SynthGenoComposeNote[],
    key: { keyRoot: number; keyMode: StudioDetectedKeyMode },
  ) => void;
  onApplyStack?: (
    stack: Se2SynthGenoStackPart[],
    bars: number,
    meta: Se2SynthGenoApplyStackMeta,
  ) => void;
  onApplyPluginAudio?: (
    draft: import('@/app/lib/studio/se2SynthGenoChordPlugin').Se2SynthGenoPluginDraft,
    sounds: import('@/app/lib/studio/se2SynthGenoChordPlugin').Se2SynthGenoPluginSoundSelection,
    previewOpts?: import('@/app/lib/studio/se2SynthGenoPluginPreview').Se2SynthGenoPluginPreviewOpts,
  ) => void | Promise<void>;
  onPreview?: () => void;
  onPreviewPluginDraft?: (
    draft: import('@/app/lib/studio/se2SynthGenoChordPlugin').Se2SynthGenoPluginDraft,
    sounds: import('@/app/lib/studio/se2SynthGenoChordPlugin').Se2SynthGenoPluginSoundSelection,
    previewOpts?: import('@/app/lib/studio/se2SynthGenoPluginPreview').Se2SynthGenoPluginPreviewOpts,
  ) => void;
  onStopPluginPreview?: () => void;
  onPlayLiveChord?: (tones: readonly number[], accordBankId: string) => void;
  onBuildFullscreenChange?: (active: boolean) => void;
  onLockGrooveLead?: (input: Se2SynthGenoGrooveLeadLockInput) => number | null;
  getAudioContext?: () => AudioContext;
  getGrooveLeadPreviewDestination?: (ctx: AudioContext) => AudioNode;
};

type GenoTab = 'chords' | 'fusion';

export function Se2SynthGenoPanel({
  trackIndex,
  trackName,
  accentHex = '#00E5CC',
  prompt,
  composePrompt,
  voice,
  notes,
  bpm,
  beatsPerBar,
  loopBars = 8,
  songKeyRoot,
  songKeyMode,
  trackKeyRoot,
  trackKeyMode,
  disabled = false,
  onPromptChange,
  onComposePromptChange,
  onVoiceChange,
  onApplyNotes,
  onApplyStack,
  onApplyPluginAudio,
  onPreview,
  onPreviewPluginDraft,
  onStopPluginPreview,
  onPlayLiveChord,
  onBuildFullscreenChange,
  onLockGrooveLead,
  getAudioContext,
  getGrooveLeadPreviewDestination,
}: Se2SynthGenoPanelProps) {
  const [tab, setTab] = useState<GenoTab>('chords');
  const [matchedTags, setMatchedTags] = useState<string[]>([]);
  const [composeTags, setComposeTags] = useState<string[]>([]);
  const [composeSummary, setComposeSummary] = useState('');
  const [seed, setSeed] = useState(1);
  const [fusionParams, setFusionParams] = useState<Se2SynthGenoFusionParams>(() =>
    readSe2SynthGenoFusionSession(trackIndex),
  );

  useEffect(() => {
    setTab('chords');
  }, [trackIndex]);

  const runGenerate = useCallback(
    (reroll = false) => {
      const result = se2SynthGenoGenerateFromPrompt(prompt, {
        seed: seed + (reroll ? 1 : 0),
        reroll,
      });
      setMatchedTags(result.matchedTags);
      setSeed((s) => s + 1);
      onPromptChange(result.promptUsed);
      onVoiceChange(result.voice, result.promptUsed);
    },
    [prompt, seed, onPromptChange, onVoiceChange],
  );

  const onRandom = useCallback(() => {
    const rnd = se2SynthGenoRandomPrompt(Date.now() + seed);
    onPromptChange(rnd);
    const result = se2SynthGenoGenerateFromPrompt(rnd, { seed: seed + 99 });
    setMatchedTags(result.matchedTags);
    setSeed((s) => s + 1);
    onVoiceChange(result.voice, rnd);
  }, [seed, onPromptChange, onVoiceChange]);

  const activeKey = se2SynthGenoResolveComposeKey({
    prompt: composePrompt,
    songKeyRoot,
    songKeyMode,
    trackKeyRoot,
    trackKeyMode,
  });

  const runComposeWithPrompt = useCallback(
    (
      promptText: string,
      mode: 'create' | 'extend' | 'accompany' | 'duo' | 'chords',
    ) => {
      const base = {
        prompt: promptText,
        songKeyRoot,
        songKeyMode,
        trackKeyRoot,
        trackKeyMode,
        beatsPerBar,
        voiceRole: voice.role,
        projectLoopBars: loopBars,
        seed:
          seed +
          (mode === 'extend' ? 2 : mode === 'accompany' ? 3 : mode === 'duo' ? 5 : mode === 'chords' ? 7 : 0),
      };
      const result =
        mode === 'extend' && notes.length > 0
          ? se2SynthGenoExtendNotes({ ...base, existingNotes: notes })
          : mode === 'accompany'
            ? se2SynthGenoAccompanyNotes({ ...base, existingNotes: notes })
            : se2SynthGenoComposeFromPrompt({
                ...base,
                forceDuo: mode === 'duo',
                forceChords: mode === 'chords',
              });
      setComposeTags(result.matchedTags);
      const stackLabel =
        result.stack && result.stack.length > 1
          ? ` · ${result.stack.map((p) => p.label).join(' + ')}`
          : '';
      setComposeSummary(
        `${studioGeneratePartLabel(result.kind)} · ${result.bars} bars · ${result.notes.length} notes @ ${bpm} BPM · ${result.keyLabel}${stackLabel}`,
      );
      setSeed((s) => s + 1);
      const keyMeta = {
        keyRoot: result.resolvedKey.keyRoot,
        keyMode: result.resolvedKey.keyMode,
      };
      if (result.stack && result.stack.length > 1 && onApplyStack) {
        onApplyStack(result.stack, result.bars, keyMeta);
      } else {
        onApplyNotes(result.notes, keyMeta);
      }
    },
    [
      songKeyRoot,
      songKeyMode,
      trackKeyRoot,
      trackKeyMode,
      beatsPerBar,
      voice.role,
      seed,
      notes,
      loopBars,
      bpm,
      onApplyNotes,
      onApplyStack,
    ],
  );

  const fusionPanelProps = {
    trackIndex,
    trackName,
    accentHex,
    soundPrompt: prompt,
    composePrompt,
    voice,
    resolvedKey: activeKey,
    loopBars,
    beatsPerBar,
    bpm,
    seed,
    matchedSoundTags: matchedTags,
    disabled,
    onSoundPromptChange: onPromptChange,
    onComposePromptChange,
    onGenerateSound: runGenerate,
    onRandomSound: onRandom,
    onPreviewSound: onPreview,
    onSeedBump: () => setSeed((s) => s + 1),
    onFusionParamsChange: setFusionParams,
    onStopPreview: () => onStopPluginPreview?.(),
    onPreviewRoll: () => {
      const roll = readSe2SynthGenoFusionRollSession(trackIndex);
      const draft = se2SynthGenoFusionRollToPreviewDraft(roll, beatsPerBar);
      if (!draft || !onPreviewPluginDraft) return;
      if (
        draft.chordNotes.length === 0
        && draft.melodyNotes.length === 0
        && draft.bassNotes.length === 0
      ) {
        return;
      }
      onStopPluginPreview?.();
      return onPreviewPluginDraft(draft, se2SynthGenoFusionRollSanitizedSounds(roll), {
        bassGlide: fusionParams.pitchGlide,
        bpm,
        fusionLaneVoices: roll.laneCustomVoices,
      });
    },
    onExportRollMidi: () => {
      const roll = readSe2SynthGenoFusionRollSession(trackIndex);
      if (!se2SynthGenoFusionRollHasNotes(roll)) return;
      onStopPluginPreview?.();
      const keyMeta = { keyRoot: activeKey.keyRoot, keyMode: activeKey.keyMode };
      const stack = se2SynthGenoFusionRollToApplyStack({
        roll,
        resolvedKey: activeKey,
        beatsPerBar,
      });
      if (stack.length > 1 && onApplyStack) {
        onApplyStack(stack, FUSION_ROLL_BAR_COUNT, keyMeta);
      } else if (stack[0]) {
        onApplyNotes(stack[0].notes, keyMeta);
      }
      setSeed((s) => s + 1);
    },
    onExportRollAudio: async () => {
      const roll = readSe2SynthGenoFusionRollSession(trackIndex);
      const draft = se2SynthGenoFusionRollToPreviewDraft(roll, beatsPerBar);
      if (!draft || !onApplyPluginAudio) return;
      onStopPluginPreview?.();
      await onApplyPluginAudio(draft, se2SynthGenoFusionRollSanitizedSounds(roll), {
        bassGlide: fusionParams.pitchGlide,
        bpm,
        fusionLaneVoices: roll.laneCustomVoices,
      });
    },
  };

  const tabBtn = (id: GenoTab, label: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setTab(id)}
      className="rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40"
      style={{
        borderColor: tab === id ? `${accentHex}aa` : '#3a3a48',
        background: tab === id ? `${accentHex}22` : '#14141c',
        color: tab === id ? accentHex : '#9a9ab0',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-2 text-[10px]" style={{ color: '#b8b8c8' }}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1"
          style={{ color: accentHex }}
        >
          Synth Geno
          <StudioEditor2HelpTip
            tab="synthGeno"
            title={`Synth Geno lane — ${SE2_SYNTH_GENO_BUILD_1_LABEL} + ${SE2_SYNTH_GENO_BUILD_2_LABEL} + ${SE2_SYNTH_GENO_FUSION_NOTE_FLEX_LABEL}`}
          />
        </span>
        <span className="text-[8px] opacity-70 truncate" title={trackName}>
          {trackName}
        </span>
        <span className="ml-auto flex gap-1">
          {tabBtn('chords', SE2_SYNTH_GENO_BUILD_TAB_LABEL)}
          {tabBtn('fusion', SE2_SYNTH_GENO_FUSION_NOTE_FLEX_LABEL)}
        </span>
      </div>

      {tab === 'fusion' ? (
        <Se2SynthGenoFusionPanel {...fusionPanelProps} />
      ) : (
        <Se2SynthGenoChordPluginPanel
          key={trackIndex}
          trackIndex={trackIndex}
          accentHex={accentHex}
          resolvedKey={activeKey}
          beatsPerBar={beatsPerBar}
          bpm={bpm}
          disabled={disabled}
          seed={seed}
          voice={voice}
          fusionParams={fusionParams}
          onSeedBump={() => setSeed((s) => s + 1)}
          onPreviewDraft={(d, sounds, previewOpts) => onPreviewPluginDraft?.(d, sounds, previewOpts)}
          onStopPreview={() => onStopPluginPreview?.()}
          onPlayLiveChord={onPlayLiveChord}
          onApplyNotes={onApplyNotes}
          onApplyStack={onApplyStack}
          onApplyAudio={onApplyPluginAudio}
          onBuildFullscreenChange={onBuildFullscreenChange}
          onLockGrooveLead={onLockGrooveLead}
          getAudioContext={getAudioContext}
          getGrooveLeadPreviewDestination={getGrooveLeadPreviewDestination}
        />
      )}
    </div>
  );
}
