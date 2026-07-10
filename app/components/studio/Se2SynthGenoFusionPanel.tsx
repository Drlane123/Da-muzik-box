'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { Se2FusionDigitalKnob } from '@/app/components/studio/Se2FusionDigitalKnob';
import {
  SE2_SYNTH_GENO_COMPOSE_EXAMPLES,
  buildGenoComposePromptProfile,
} from '@/app/lib/studio/se2SynthGenoCompose';
import {
  se2SynthGenoRandomPrompt,
  se2SynthGenoVoiceSummary,
} from '@/app/lib/studio/se2SynthGenoGenerator';
import type { Se2ComposeResolvedKey } from '@/app/lib/studio/se2SynthGenoKeyLock';
import type { Se2SynthGenoVoiceParams } from '@/app/lib/studio/se2SynthGenoTypes';
import {
  SE2_SYNTH_GENO_FUSION_CHARACTERS,
  SE2_SYNTH_GENO_FUSION_DEFAULTS,
  readSe2SynthGenoFusionSession,
  SE2_SYNTH_GENO_FUSION_NOTE_FLEX_LABEL,
  se2SynthGenoFusionCharacterParams,
  se2SynthGenoFusionMergedComposePrompt,
  se2SynthGenoFusionPatchParams,
  writeSe2SynthGenoFusionSession,
  type Se2SynthGenoFusionCharacterId,
  type Se2SynthGenoFusionParams,
} from '@/app/lib/studio/se2SynthGenoFusionEngine';
import {
  readSe2SynthGenoFusionRollSession,
  se2SynthGenoFusionGenerateRoll,
  se2SynthGenoFusionLaneCustomVoiceLabel,
  se2SynthGenoFusionLaneUsesCustomVoice,
  se2SynthGenoFusionRollHasNotes,
  se2SynthGenoFusionSetLaneCustomVoice,
  writeSe2SynthGenoFusionRollSession,
  type Se2SynthGenoFusionLaneId,
  type Se2SynthGenoFusionRollState,
} from '@/app/lib/studio/se2SynthGenoFusionRoll';
import { Se2SynthGenoFusionPianoRoll } from '@/app/components/studio/Se2SynthGenoFusionPianoRoll';
import { StudioEditor2HelpTip } from '@/app/components/studio/StudioEditor2HelpHub';

export type Se2SynthGenoFusionPanelProps = {
  trackIndex: number;
  trackName?: string;
  accentHex?: string;
  soundPrompt: string;
  composePrompt: string;
  voice: Se2SynthGenoVoiceParams;
  resolvedKey: Se2ComposeResolvedKey;
  loopBars: number;
  beatsPerBar: number;
  bpm: number;
  seed: number;
  matchedSoundTags: string[];
  disabled?: boolean;
  compact?: boolean;
  onSoundPromptChange: (prompt: string) => void;
  onComposePromptChange: (prompt: string) => void;
  onGenerateSound: (reroll?: boolean) => void;
  onRandomSound: () => void;
  onPreviewSound?: () => void;
  onSeedBump?: () => void;
  onFusionParamsChange?: (params: Se2SynthGenoFusionParams) => void;
  onPreviewRoll?: () => void | Promise<void>;
  onStopPreview?: () => void;
  onExportRollMidi?: () => void;
  onExportRollAudio?: () => void | Promise<void>;
};

const FUSION_KNOB_SIZE = 42;
const FUSION_KNOB_SIZE_COMPACT = 38;
const FUSION_KNOB_SIZE_DOCK = 34;

const FUSION_CHAR_ACCENT: Record<Exclude<Se2SynthGenoFusionCharacterId, 'custom'>, string> = {
  gentle: '#6ee7b8',
  luminous: '#00E5CC',
  drift: '#a78bfa',
  cinematic: '#f87171',
  shimmer: '#fbbf24',
  void: '#94a3b8',
};

function FusionFold({
  label,
  hint,
  accentHex,
  defaultOpen = false,
  children,
}: {
  label: string;
  hint?: string;
  accentHex: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b" style={{ borderColor: '#252530' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-white/[0.02]"
      >
        <ChevronDown
          size={12}
          className="shrink-0 transition-transform duration-150"
          style={{
            color: accentHex,
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        />
        <span
          className="text-[7px] font-black uppercase tracking-[0.14em] shrink-0"
          style={{ color: accentHex }}
        >
          {label}
        </span>
        {!open && hint ? (
          <span className="text-[7px] opacity-45 truncate min-w-0 normal-case tracking-normal">{hint}</span>
        ) : null}
      </button>
      {open ? <div className="px-2.5 pb-2 pt-0">{children}</div> : null}
    </div>
  );
}

export function Se2SynthGenoFusionPanel({
  trackIndex,
  trackName,
  accentHex = '#00E5CC',
  soundPrompt,
  composePrompt,
  voice,
  resolvedKey,
  loopBars,
  beatsPerBar,
  bpm,
  seed,
  matchedSoundTags,
  disabled = false,
  compact = false,
  onSoundPromptChange,
  onComposePromptChange,
  onGenerateSound,
  onRandomSound,
  onPreviewSound,
  onSeedBump,
  onFusionParamsChange,
  onPreviewRoll,
  onStopPreview,
  onExportRollMidi,
  onExportRollAudio,
}: Se2SynthGenoFusionPanelProps) {
  const [fusion, setFusion] = useState<Se2SynthGenoFusionParams>(() =>
    readSe2SynthGenoFusionSession(trackIndex),
  );
  const [roll, setRoll] = useState<Se2SynthGenoFusionRollState>(() =>
    readSe2SynthGenoFusionRollSession(trackIndex),
  );
  const [exportingAudio, setExportingAudio] = useState(false);
  const [composeSeed, setComposeSeed] = useState(seed);
  const [composeSummary, setComposeSummary] = useState('');
  const [composeTags, setComposeTags] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [rollExpanded, setRollExpanded] = useState(false);

  const knobSize = compact ? FUSION_KNOB_SIZE_COMPACT : FUSION_KNOB_SIZE;
  const dockKnobSize = FUSION_KNOB_SIZE_DOCK;

  const fusionNoteCount =
    roll.lanes.chords.length + roll.lanes.melody.length + roll.lanes.bass.length;

  const activeCharacter = useMemo(
    () => SE2_SYNTH_GENO_FUSION_CHARACTERS.find((c) => c.id === fusion.characterId),
    [fusion.characterId],
  );

  const persistRoll = useCallback(
    (next: Se2SynthGenoFusionRollState) => {
      onStopPreview?.();
      setPreviewing(false);
      setRoll(next);
      writeSe2SynthGenoFusionRollSession(trackIndex, next);
    },
    [trackIndex, onStopPreview],
  );

  const toggleFusionPreview = useCallback(() => {
    if (previewing) {
      onStopPreview?.();
      setPreviewing(false);
      return;
    }
    if (!onPreviewRoll) return;
    void Promise.resolve(onPreviewRoll())
      .then(() => setPreviewing(true))
      .catch((err) => {
        console.warn('[Fusion] preview failed:', err);
        setPreviewing(false);
      });
  }, [previewing, onPreviewRoll, onStopPreview]);

  useEffect(() => () => onStopPreview?.(), [onStopPreview]);

  const patchFusion = useCallback(
    (partial: Partial<Se2SynthGenoFusionParams>) => {
      setFusion((prev) => {
        const next = se2SynthGenoFusionPatchParams(prev, partial);
        writeSe2SynthGenoFusionSession(trackIndex, next);
        onFusionParamsChange?.(next);
        return next;
      });
    },
    [trackIndex, onFusionParamsChange],
  );

  useEffect(() => {
    setFusion(readSe2SynthGenoFusionSession(trackIndex));
    setRoll(readSe2SynthGenoFusionRollSession(trackIndex));
  }, [trackIndex]);

  useEffect(() => {
    setComposeSeed(seed);
  }, [seed]);

  const applyGeneratedVoiceToLane = useCallback(
    (lane: Se2SynthGenoFusionLaneId) => {
      persistRoll(se2SynthGenoFusionSetLaneCustomVoice(roll, lane, voice));
    },
    [persistRoll, roll, voice],
  );

  const runFusionMidi = useCallback(
    (mode: 'create' | 'chords') => {
      onStopPreview?.();
      setPreviewing(false);
      const merged = se2SynthGenoFusionMergedComposePrompt(soundPrompt, composePrompt, fusion);
      const nextSeed = composeSeed + 1;
      setComposeSeed(nextSeed);
      const generated = se2SynthGenoFusionGenerateRoll({
        roll: readSe2SynthGenoFusionRollSession(trackIndex),
        fusion,
        mergedPrompt: merged,
        resolvedKey,
        beatsPerBar,
        bpm,
        seed: nextSeed,
        mode,
      });
      persistRoll(generated.roll);
      setComposeSummary(generated.summary);
      setComposeTags(generated.tags);
      onSeedBump?.();
    },
    [
      trackIndex,
      soundPrompt,
      composePrompt,
      fusion,
      composeSeed,
      onSeedBump,
      onStopPreview,
      resolvedKey,
      beatsPerBar,
      bpm,
      persistRoll,
    ],
  );

  const mergedPrompt = se2SynthGenoFusionMergedComposePrompt(soundPrompt, composePrompt, fusion);
  const activeProfile = buildGenoComposePromptProfile(mergedPrompt);

  const pickCharacter = useCallback(
    (id: Exclude<Se2SynthGenoFusionCharacterId, 'custom'>) => {
      patchFusion(se2SynthGenoFusionCharacterParams(id));
    },
    [patchFusion],
  );

  const chip = (
    active: boolean,
    onClick: () => void,
    label: string,
    color?: string,
    title?: string,
  ) => (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="rounded-md border px-2 py-0.5 text-[7px] font-bold uppercase tracking-wide disabled:opacity-40 whitespace-nowrap"
      style={{
        borderColor: active ? `${color ?? accentHex}aa` : '#3a3a48',
        background: active ? `${color ?? accentHex}22` : 'rgba(0,0,0,0.25)',
        color: active ? (color ?? accentHex) : '#b8b8c8',
        boxShadow: active ? `0 0 10px ${color ?? accentHex}22` : undefined,
      }}
    >
      {label}
    </button>
  );

  const actionBtn = (
    label: string,
    onClick: () => void,
    style: { border: string; bg: string; color: string },
    opts?: { bold?: boolean; title?: string },
  ) => (
    <button
      type="button"
      disabled={disabled}
      title={opts?.title}
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[8px] ${opts?.bold ? 'font-black' : 'font-bold'} uppercase tracking-wide disabled:opacity-40`}
      style={{ borderColor: style.border, background: style.bg, color: style.color }}
    >
      {label}
    </button>
  );

  const characterChips = (
    <div className="flex flex-wrap gap-1">
      {SE2_SYNTH_GENO_FUSION_CHARACTERS.map((c) =>
        chip(
          fusion.characterId === c.id,
          () => pickCharacter(c.id),
          c.label,
          FUSION_CHAR_ACCENT[c.id],
          c.hint,
        ),
      )}
      {fusion.characterId === 'custom'
        ? chip(true, () => undefined, 'Custom', accentHex, 'Manual macro blend')
        : null}
    </div>
  );

  const noteFlexChips = (
    <>
      {chip(fusion.keyLock, () => patchFusion({ keyLock: !fusion.keyLock }), 'Key lock', accentHex)}
      {chip(
        fusion.pitchGlide,
        () => patchFusion({ pitchGlide: !fusion.pitchGlide }),
        'Pitch glide',
        '#a78bfa',
      )}
      {chip(
        fusion.chordStamp,
        () => patchFusion({ chordStamp: !fusion.chordStamp }),
        'Chord stamp',
        '#fbbf24',
      )}
    </>
  );

  const spaceWalkKnobs = (size: number, cols: 2 | 3 = 3) => (
    <div className={`grid ${cols === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-x-1 gap-y-0.5 justify-items-center`}>
      <Se2FusionDigitalKnob
        label="Richness"
        min={0}
        max={100}
        value={fusion.richness}
        defaultValue={SE2_SYNTH_GENO_FUSION_DEFAULTS.richness}
        accent={accentHex}
        size={size}
        disabled={disabled}
        onChange={(v) => patchFusion({ richness: v, characterId: 'custom' })}
      />
      <Se2FusionDigitalKnob
        label="Flow"
        min={0}
        max={100}
        value={fusion.flow}
        defaultValue={SE2_SYNTH_GENO_FUSION_DEFAULTS.flow}
        accent={accentHex}
        size={size}
        disabled={disabled}
        onChange={(v) => patchFusion({ flow: v, characterId: 'custom' })}
      />
      <Se2FusionDigitalKnob
        label="Smooth"
        min={-50}
        max={50}
        value={fusion.smoothness}
        defaultValue={SE2_SYNTH_GENO_FUSION_DEFAULTS.smoothness}
        accent={accentHex}
        size={size}
        disabled={disabled}
        onChange={(v) => patchFusion({ smoothness: v, characterId: 'custom' })}
      />
      <Se2FusionDigitalKnob
        label="Suspension"
        min={0}
        max={100}
        value={fusion.suspension}
        defaultValue={SE2_SYNTH_GENO_FUSION_DEFAULTS.suspension}
        accent="#a78bfa"
        size={size}
        disabled={disabled}
        onChange={(v) => patchFusion({ suspension: v, characterId: 'custom' })}
      />
      <Se2FusionDigitalKnob
        label="Sparse"
        min={0}
        max={100}
        value={fusion.sparseness}
        defaultValue={SE2_SYNTH_GENO_FUSION_DEFAULTS.sparseness}
        accent="#fbbf24"
        size={size}
        disabled={disabled}
        onChange={(v) => patchFusion({ sparseness: v, characterId: 'custom' })}
      />
      <Se2FusionDigitalKnob
        label="Deviation"
        min={0}
        max={100}
        value={fusion.deviation}
        defaultValue={SE2_SYNTH_GENO_FUSION_DEFAULTS.deviation}
        accent="#f87171"
        size={size}
        disabled={disabled}
        onChange={(v) => patchFusion({ deviation: v, characterId: 'custom' })}
      />
    </div>
  );

  const primaryActions = (
    <div className="flex flex-wrap gap-1.5 items-center">
      {actionBtn('Generate sound', () => onGenerateSound(false), {
        border: '#a78bfa88',
        bg: '#a78bfa18',
        color: '#d8b4fe',
      })}
      {actionBtn('Create MIDI', () => runFusionMidi('create'), {
        border: '#fbbf2488',
        bg: '#fbbf2418',
        color: '#fde68a',
      })}
      {actionBtn('Chords', () => runFusionMidi('chords'), {
        border: `${accentHex}88`,
        bg: `${accentHex}18`,
        color: accentHex,
      })}
      {actionBtn(
        'Fusion',
        () => {
          onGenerateSound(false);
          runFusionMidi('create');
        },
        {
          border: `${accentHex}cc`,
          bg: `linear-gradient(135deg, ${accentHex}33 0%, #a78bfa22 50%, #fbbf2418 100%)`,
          color: accentHex,
        },
        { bold: true, title: 'Generate patch from Sound + 8-bar progression from Prompt with Fusion macros' },
      )}
    </div>
  );

  const hasRollNotes = se2SynthGenoFusionRollHasNotes(roll);

  const spaceWalkHint =
    activeCharacter?.label ??
    (fusion.characterId === 'custom' ? 'Custom blend' : 'Harmony morph');

  const promptsFold = (
    <FusionFold
      label="Prompts & Generate"
      hint={`${soundPrompt.slice(0, 28) || 'Sound'} · ${composePrompt.slice(0, 28) || 'Prompt'}`}
      accentHex="#a78bfa"
      defaultOpen
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2">
        <label className="flex flex-col gap-0.5 min-w-0">
          <span className="flex items-center gap-1 text-[7px] font-bold uppercase tracking-wide text-[#a78bfa]">
            Sound
            <StudioEditor2HelpTip tab="fusionSound" title="Fusion — how to use the Sound field" />
          </span>
          <textarea
            value={soundPrompt}
            disabled={disabled}
            rows={1}
            placeholder="warm pad, pluck bell…"
            onChange={(e) => onSoundPromptChange(e.target.value)}
            className="w-full resize-none rounded border px-2 py-1 font-mono text-[9px] outline-none disabled:opacity-50"
            style={{ borderColor: '#a78bfa44', background: '#0a0a12', color: '#e8e8f4' }}
          />
        </label>
        <label className="flex flex-col gap-0.5 min-w-0">
          <span className="flex items-center gap-1 text-[7px] font-bold uppercase tracking-wide text-[#fbbf24]">
            Prompt
            <StudioEditor2HelpTip tab="fusionPrompt" title="Fusion — how to use the Prompt field" />
          </span>
          <textarea
            value={composePrompt}
            disabled={disabled}
            rows={1}
            placeholder="ambient 8 bars, cinematic pads…"
            onChange={(e) => onComposePromptChange(e.target.value)}
            className="w-full resize-none rounded border px-2 py-1 font-mono text-[9px] outline-none disabled:opacity-50"
            style={{ borderColor: '#fbbf2444', background: '#0a0a12', color: '#e8e8f4' }}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-1 items-center">
        {primaryActions}
        {!compact ? (
          <details className="relative">
            <summary
              className="list-none cursor-pointer rounded-md border px-2 py-1 text-[7px] font-bold uppercase tracking-wide select-none"
              style={{ borderColor: '#3a3a48', background: '#14141c', color: '#c8c8d8' }}
            >
              More ▾
            </summary>
            <div
              className="absolute z-20 mt-1 flex flex-wrap gap-1 p-1.5 rounded-md border shadow-lg"
              style={{ borderColor: '#3a3a48', background: '#0c0c14' }}
            >
              {actionBtn('Re-roll', () => onGenerateSound(true), {
                border: '#3a3a48',
                bg: '#14141c',
                color: '#c8c8d8',
              })}
              {actionBtn('Random', onRandomSound, {
                border: '#3a3a48',
                bg: '#14141c',
                color: '#c8c8d8',
              })}
              {onPreviewSound
                ? actionBtn('Preview patch', onPreviewSound, {
                    border: '#4a4a58',
                    bg: '#1a1a24',
                    color: '#ececf4',
                  })
                : null}
            </div>
          </details>
        ) : null}
      </div>
    </FusionFold>
  );

  const expandedControlStrip = (
    <>
      <div
        className="px-2.5 py-1.5 flex flex-wrap items-center gap-2 border-b"
        style={{ borderColor: '#252530' }}
      >
        <span className="text-[7px] font-black uppercase tracking-widest opacity-55">SpaceWalk</span>
        {characterChips}
      </div>
      <div className="px-2.5 py-1.5 flex flex-wrap items-center gap-2">
        <span className="text-[7px] font-black uppercase tracking-widest opacity-55">Note Flex</span>
        {noteFlexChips}
        <div className="ml-auto flex flex-wrap gap-1">{primaryActions}</div>
      </div>
    </>
  );

  const synthControlStrip = compact ? (
    <div className="flex flex-col">
      {promptsFold}
      <FusionFold label="SpaceWalk" hint={spaceWalkHint} accentHex={accentHex} defaultOpen>
        <div className="flex flex-col gap-2 items-start">
          {spaceWalkKnobs(knobSize, 3)}
          <div className="w-full">
            <div className="text-[6px] font-bold uppercase tracking-widest opacity-40 mb-1">Character</div>
            {characterChips}
          </div>
        </div>
      </FusionFold>
      <FusionFold
        label="Note Flex"
        hint={`${fusion.keyLock ? 'Key lock' : 'No lock'} · ${fusion.pitchGlide ? 'Glide' : 'No glide'}`}
        accentHex="#fbbf24"
        defaultOpen
      >
        <div className="flex flex-wrap items-center gap-1">
          {noteFlexChips}
          <button
            type="button"
            disabled={disabled}
            onClick={() => patchFusion({ ...SE2_SYNTH_GENO_FUSION_DEFAULTS })}
            className="text-[7px] font-bold uppercase tracking-wide opacity-45 hover:opacity-80 disabled:opacity-30 ml-auto"
          >
            Reset macros
          </button>
        </div>
      </FusionFold>
    </div>
  ) : (
    <div className="flex flex-col">{expandedControlStrip}</div>
  );

  const spaceWalkSidebar = (
    <aside
      className="shrink-0 w-full sm:w-[148px] lg:w-[156px] border-b sm:border-b-0 sm:border-r flex flex-col gap-2 p-2 min-h-0"
      style={{ borderColor: '#252530', background: 'rgba(0,0,0,0.18)' }}
    >
      <div className="min-w-0">
        <span
          className="text-[7px] font-black uppercase tracking-[0.14em]"
          style={{ color: accentHex }}
        >
          SpaceWalk
        </span>
        <span className="block text-[6px] opacity-45 truncate mt-0.5">{spaceWalkHint}</span>
      </div>
      {spaceWalkKnobs(dockKnobSize, 2)}
      <div className="min-w-0">
        <div className="text-[6px] font-bold uppercase tracking-widest opacity-40 mb-1">Character</div>
        {characterChips}
      </div>
      <div className="pt-1.5 border-t min-w-0" style={{ borderColor: '#2a2a38' }}>
        <div className="text-[6px] font-bold uppercase tracking-widest opacity-40 mb-1">Note Flex</div>
        <div className="flex flex-wrap gap-1">{noteFlexChips}</div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => patchFusion({ ...SE2_SYNTH_GENO_FUSION_DEFAULTS })}
          className="mt-1 text-[6px] font-bold uppercase tracking-wide opacity-45 hover:opacity-80 disabled:opacity-30"
        >
          Reset macros
        </button>
      </div>
    </aside>
  );

  const fusionPianoRoll = (
    <Se2SynthGenoFusionPianoRoll
      accentHex={accentHex}
      beatsPerBar={beatsPerBar}
      bpm={bpm}
      resolvedKey={resolvedKey}
      roll={roll}
      disabled={disabled}
      trackName={trackName}
      exportingAudio={exportingAudio}
      embedded
      hideTransportHeader
      inlineDock={!rollExpanded}
      expanded={rollExpanded}
      onExpandedChange={setRollExpanded}
      controlStrip={rollExpanded ? synthControlStrip : undefined}
      onRollChange={persistRoll}
      previewing={previewing}
      onTogglePreview={onPreviewRoll ? toggleFusionPreview : undefined}
      onExportMidi={
        onExportRollMidi
          ? () => {
              onStopPreview?.();
              setPreviewing(false);
              onExportRollMidi();
            }
          : undefined
      }
      onExportAudio={
        onExportRollAudio
          ? () => {
              onStopPreview?.();
              setPreviewing(false);
              setExportingAudio(true);
              void Promise.resolve(onExportRollAudio()).finally(() => setExportingAudio(false));
            }
          : undefined
      }
    />
  );

  const mergedWorkspace = (
    <div className="border-b min-h-0 flex flex-col" style={{ borderColor: '#252530' }}>
      <div className="flex flex-col sm:flex-row min-h-0 items-stretch flex-1">
        {spaceWalkSidebar}
        <div className="flex-1 min-w-0 min-h-[220px] flex flex-col">{fusionPianoRoll}</div>
      </div>
    </div>
  );

  const patchSessionFooter = !compact ? (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-t shrink-0"
      style={{ borderColor: '#252530', background: 'rgba(0,0,0,0.28)' }}
    >
      <div className="px-2.5 py-2 border-b lg:border-b-0 lg:border-r" style={{ borderColor: '#252530' }}>
        <div className="text-[6px] font-bold uppercase tracking-widest opacity-45 mb-1">Patch</div>
        <div className="text-[9px] font-bold" style={{ color: accentHex }}>
          {voice.label}
        </div>
        <div className="text-[7px] font-mono tabular-nums mt-0.5 opacity-60">{se2SynthGenoVoiceSummary(voice)}</div>
        {matchedSoundTags.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {matchedSoundTags.map((tag) => (
              <span
                key={tag}
                className="rounded px-1 py-0.5 text-[6px] uppercase tracking-wide"
                style={{ background: `${accentHex}18`, color: accentHex }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-1.5 pt-1.5 border-t flex flex-wrap gap-1 items-center" style={{ borderColor: '#2a2a38' }}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => applyGeneratedVoiceToLane('chords')}
            className="rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide disabled:opacity-40"
            style={{
              borderColor: se2SynthGenoFusionLaneUsesCustomVoice(roll, 'chords') ? `${accentHex}aa` : '#3a3a48',
              background: se2SynthGenoFusionLaneUsesCustomVoice(roll, 'chords') ? `${accentHex}22` : '#14141c',
              color: se2SynthGenoFusionLaneUsesCustomVoice(roll, 'chords') ? accentHex : '#c8c8d8',
            }}
          >
            {se2SynthGenoFusionLaneUsesCustomVoice(roll, 'chords') ? 'Chords ✓' : '→ Chords'}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => applyGeneratedVoiceToLane('melody')}
            className="rounded border px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide disabled:opacity-40"
            style={{
              borderColor: se2SynthGenoFusionLaneUsesCustomVoice(roll, 'melody') ? '#a78bfa88' : '#3a3a48',
              background: se2SynthGenoFusionLaneUsesCustomVoice(roll, 'melody') ? '#a78bfa22' : '#14141c',
              color: se2SynthGenoFusionLaneUsesCustomVoice(roll, 'melody') ? '#d8b4fe' : '#c8c8d8',
            }}
          >
            {se2SynthGenoFusionLaneUsesCustomVoice(roll, 'melody') ? 'Melody ✓' : '→ Melody'}
          </button>
        </div>
      </div>
      <div className="px-2.5 py-2">
        <div className="text-[6px] font-bold uppercase tracking-widest opacity-45 mb-1">Session</div>
        <div className="text-[7px] font-mono tabular-nums opacity-65">
          {fusionNoteCount} notes · <span style={{ color: accentHex }}>{activeProfile.pair.label}</span>
        </div>
        {composeSummary ? (
          <div className="text-[8px] font-bold mt-0.5" style={{ color: accentHex }}>
            {composeSummary}
          </div>
        ) : null}
        {composeTags.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {composeTags.map((tag) => (
              <span
                key={tag}
                className="rounded px-1 py-0.5 text-[6px] uppercase tracking-wide"
                style={{ background: `${accentHex}18`, color: accentHex }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-0.5 mt-1.5 pt-1.5 border-t" style={{ borderColor: '#2a2a38' }}>
          {SE2_SYNTH_GENO_COMPOSE_EXAMPLES.slice(0, 4).map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={disabled}
              onClick={() => onComposePromptChange(ex)}
              className="rounded border px-1 py-0.5 text-[6px] disabled:opacity-40 truncate max-w-[140px]"
              style={{ borderColor: '#2a2a38', color: '#9a9ab8' }}
              title={ex}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div
      data-studio-synth-geno-fusion
      className="flex flex-col w-full min-w-0"
      style={{ color: '#b8b8c8' }}
    >
      {compact ? (
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            borderColor: `${accentHex}55`,
            background: 'linear-gradient(180deg, #101820 0%, #06080c 100%)',
          }}
        >
          <div
            className="flex flex-wrap items-center gap-2 px-2.5 py-1.5 border-b"
            style={{ borderColor: '#252530', background: `${accentHex}0e` }}
          >
            <span className="text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: accentHex }}>
              {SE2_SYNTH_GENO_FUSION_NOTE_FLEX_LABEL}
            </span>
          </div>
          {synthControlStrip}
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden flex flex-col min-h-0"
          style={{
            borderColor: `${accentHex}55`,
            background: 'linear-gradient(180deg, #101820 0%, #06080c 100%)',
            boxShadow: `inset 0 1px 0 ${accentHex}22, 0 6px 24px rgba(0,0,0,0.35)`,
          }}
        >
          <div
            className="flex flex-wrap items-center gap-2 px-2.5 py-2 border-b shrink-0"
            style={{ borderColor: '#252530', background: `${accentHex}0e` }}
          >
            <span
              className="text-[9px] font-black uppercase tracking-[0.16em]"
              style={{ color: accentHex }}
            >
              {SE2_SYNTH_GENO_FUSION_NOTE_FLEX_LABEL}
            </span>
            <span className="text-[6px] font-bold uppercase tracking-widest opacity-40 hidden sm:inline">
              Fusion Synth
            </span>
            <div className="flex flex-wrap gap-1 ml-auto items-center">
              <span
                className="rounded px-1.5 py-0.5 text-[6px] font-mono tabular-nums"
                style={{ background: `${accentHex}14`, color: accentHex }}
              >
                {resolvedKey.label}
              </span>
              <span
                className="rounded px-1.5 py-0.5 text-[6px] font-mono tabular-nums opacity-70"
                style={{ background: '#ffffff08', color: '#c8c8d8' }}
              >
                {bpm} BPM
              </span>
              {onPreviewRoll ? (
                <button
                  type="button"
                  disabled={disabled || (!previewing && !hasRollNotes)}
                  onClick={toggleFusionPreview}
                  className="rounded border px-2 py-0.5 text-[7px] font-bold uppercase tracking-wide disabled:opacity-40"
                  style={{
                    borderColor: previewing ? '#ef444488' : '#4a4a58',
                    background: previewing ? '#ef444422' : '#1a1a24',
                    color: previewing ? '#fca5a5' : '#ececf4',
                  }}
                >
                  {previewing ? 'Stop' : 'Preview'}
                </button>
              ) : null}
              {onExportRollMidi ? (
                <button
                  type="button"
                  disabled={disabled || !hasRollNotes || exportingAudio}
                  onClick={() => {
                    onStopPreview?.();
                    setPreviewing(false);
                    onExportRollMidi();
                  }}
                  className="rounded border px-2 py-0.5 text-[7px] font-bold uppercase tracking-wide disabled:opacity-40"
                  style={{ borderColor: '#a78bfa88', background: '#a78bfa18', color: '#d8b4fe' }}
                >
                  MIDI
                </button>
              ) : null}
              {onExportRollAudio ? (
                <button
                  type="button"
                  disabled={disabled || !hasRollNotes || exportingAudio}
                  onClick={() => {
                    onStopPreview?.();
                    setPreviewing(false);
                    setExportingAudio(true);
                    void Promise.resolve(onExportRollAudio()).finally(() => setExportingAudio(false));
                  }}
                  className="rounded border px-2 py-0.5 text-[7px] font-bold uppercase tracking-wide disabled:opacity-40"
                  style={{ borderColor: '#22c55e88', background: '#22c55e18', color: '#86efac' }}
                >
                  {exportingAudio ? '…' : 'Audio'}
                </button>
              ) : null}
              <button
                type="button"
                disabled={disabled}
                onClick={() => setRollExpanded((v) => !v)}
                className="rounded border px-2 py-0.5 text-[7px] font-bold uppercase tracking-wide disabled:opacity-40 inline-flex items-center gap-1"
                style={{
                  borderColor: rollExpanded ? `${accentHex}88` : '#4a4a58',
                  background: rollExpanded ? `${accentHex}22` : '#1a1a24',
                  color: rollExpanded ? accentHex : '#ececf4',
                }}
              >
                {rollExpanded ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
                {rollExpanded ? 'Min' : 'Expand'}
              </button>
            </div>
          </div>

          {!rollExpanded ? promptsFold : null}

          {rollExpanded ? (
            <div
              className="px-2.5 py-1.5 text-[7px] border-b shrink-0"
              style={{ borderColor: '#252530', background: `${accentHex}10`, color: accentHex }}
            >
              Piano roll expanded — Minimize or Esc
            </div>
          ) : null}

          {rollExpanded ? fusionPianoRoll : mergedWorkspace}

          {!rollExpanded ? patchSessionFooter : null}
        </div>
      )}
    </div>
  );
}

/** Compact Fusion header — sound + prompt only (Generator tab embed). */
export function Se2SynthGenoFusionLoopHeader(props: Se2SynthGenoFusionPanelProps) {
  return <Se2SynthGenoFusionPanel {...props} compact />;
}

export function se2SynthGenoFusionRandomSoundPrompt(seed: number): string {
  return se2SynthGenoRandomPrompt(seed);
}
