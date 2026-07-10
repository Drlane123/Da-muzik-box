'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { useGenoLoopRollPreview } from '@/app/hooks/useGenoLoopRollPreview';
import {
  SE2_AI_MIDI_GENRE_OPTIONS,
  SE2_AI_MIDI_KEY_NAMES,
  SE2_AI_MIDI_LENGTH_OPTIONS,
  SE2_AI_MIDI_MODEL_OPTIONS,
  SE2_AI_MIDI_NOTE_GRID_OPTIONS,
  SE2_AI_MIDI_PROVIDER_OPTIONS,
  SE2_AI_MIDI_SCALE_OPTIONS,
  SE2_AI_MIDI_TYPE_OPTIONS,
  SE2_MIDI_COMPOSER_LABEL,
  SE2_MIDI_COMPOSER_PROVIDER_HELP,
  se2AiMidiKeyNameFromRoot,
  se2AiMidiScaleFromChordMode,
  type Se2ChordGenieAiMidiChatMessage,
  type Se2ChordGenieAiMidiProvider,
} from '@/app/lib/studio/se2ChordGenieAiMidi';
import {
  se2MidiComposerGenerate,
  se2MidiComposerResolveRollNotes,
  type Se2MidiComposerGenerateResult,
} from '@/app/lib/studio/se2MidiComposerGenerate';
import {
  readSe2MidiComposerApiKey,
  readSe2MidiComposerCustomEndpoint,
  writeSe2MidiComposerApiKey,
  writeSe2MidiComposerCustomEndpoint,
} from '@/app/lib/studio/se2MidiComposerSettings';
import { genoLoopPianoRollNotesFromDraft } from '@/app/lib/studio/se2SynthGenoLoopPianoRoll';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';

const ACCENT = '#c4b5fd';
const APPLY_MINT = '#7cf4c6';
const AI_BUBBLE = '#2f6fbf';
const USER_BUBBLE = '#2e2e38';
const PANEL_BG = '#12121a';
const INPUT_BG = '#1a1a24';
const BTN_BG = '#2a2a34';
const BTN_BORDER = 'rgba(255,255,255,0.12)';
/** Prompt + action column — compact, sits beside param grid on the right. */
const MC_WORK_COL_W = 148;
/** Compact param dropdown width (click-to-pick, not stretched). */
const MC_PARAM_W = 72;

type StagedDraft = {
  result: Se2MidiComposerGenerateResult;
  prompt: string;
};

let chatIdSeq = 0;
function nextChatId(): string {
  chatIdSeq += 1;
  return `se2-mc-${chatIdSeq}`;
}

function ChatBubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-1.5`}>
      <div
        data-se2-mc-chat
        className="rounded-lg px-2 py-1.5 max-w-[94%] whitespace-pre-wrap"
        style={{
          background: isUser ? USER_BUBBLE : AI_BUBBLE,
          color: '#f0f0f8',
          border: isUser ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(90,150,230,0.35)',
        }}
      >
        {text}
      </div>
    </div>
  );
}

function ParamSelect({
  label,
  value,
  options,
  disabled,
  onChange,
  compact,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <label
      className="flex flex-col gap-0.5 min-w-0"
      style={compact ? { width: MC_PARAM_W, maxWidth: MC_PARAM_W } : undefined}
    >
      <span data-se2-mc-label className="text-[#8a8a9a] truncate">
        {label}
      </span>
      <select
        data-se2-mc-select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 rounded border px-1 py-0.5 outline-none disabled:opacity-45 uppercase truncate"
        style={{
          height: 22,
          borderColor: 'rgba(196, 181, 253, 0.22)',
          background: INPUT_BG,
          color: '#e8e8f0',
          maxWidth: compact ? MC_PARAM_W : undefined,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionBtn({
  children,
  disabled,
  onClick,
  title,
  accent,
  accentColor,
  fullWidth,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  accent?: boolean;
  accentColor?: string;
  fullWidth?: boolean;
}) {
  const color = accentColor ?? ACCENT;
  return (
    <button
      type="button"
      data-se2-mc-btn
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`rounded px-1.5 py-1 uppercase disabled:opacity-40 min-w-0 overflow-hidden text-ellipsis ${fullWidth ? 'w-full' : ''}`}
      style={{
        background: accent ? `${color}2e` : BTN_BG,
        border: `1px solid ${accent ? `${color}73` : BTN_BORDER}`,
        color: accent ? color : '#d0d0dc',
        fontSize: 11,
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </button>
  );
}

export type Se2MidiComposerGeneratedPayload = Se2MidiComposerGenerateResult & {
  steps?: GrooveProgressionStep[];
  notes?: StudioEditor2GenNote[];
};

export type Se2ChordGenieAiMidiPanelProps = {
  disabled?: boolean;
  keyRoot?: number;
  keyMode?: ChordMode;
  bpm: number;
  beatsPerBar: number;
  audioOn?: boolean;
  transportPlaying?: boolean;
  genreId?: string;
  fallbackGenreId: string;
  getAudioContext?: () => AudioContext | null;
  onApplyToRoll: (result: Se2MidiComposerGeneratedPayload) => void;
  onKeyChange?: (root: number, mode: ChordMode) => void;
};

export function Se2ChordGenieAiMidiPanel({
  disabled = false,
  keyRoot = 0,
  keyMode = 'major',
  bpm,
  beatsPerBar,
  audioOn = true,
  transportPlaying = false,
  genreId,
  fallbackGenreId,
  getAudioContext,
  onApplyToRoll,
  onKeyChange,
}: Se2ChordGenieAiMidiPanelProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const seedRef = useRef(Date.now());
  const [messages, setMessages] = useState<Se2ChordGenieAiMidiChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [staged, setStaged] = useState<StagedDraft | null>(null);
  const [previousStaged, setPreviousStaged] = useState<StagedDraft | null>(null);
  const [provider, setProvider] = useState<Se2ChordGenieAiMidiProvider>('damusicbox');
  const [model, setModel] = useState(SE2_AI_MIDI_MODEL_OPTIONS.damusicbox[0]!.value);
  const [keyName, setKeyName] = useState(() => se2AiMidiKeyNameFromRoot(keyRoot));
  const [scale, setScale] = useState(() =>
    se2AiMidiScaleFromChordMode(keyMode === 'minor' ? 'minor' : 'major'),
  );
  const [midiType, setMidiType] = useState('chords');
  const [noteGrid, setNoteGrid] = useState('any');
  const [lengthBars, setLengthBars] = useState('8');
  const [genre, setGenre] = useState('true_rnb');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [providerHelpOpen, setProviderHelpOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [customEndpointDraft, setCustomEndpointDraft] = useState('');

  const previewBarCount = staged?.result.loopBars ?? 8;

  const { playing: previewPlaying, play: playPreview, stop: stopPreview } = useGenoLoopRollPreview({
    getAudioContext,
    bpm,
    beatsPerBar,
    barCount: previewBarCount,
    genreId: genreId ?? genre,
    loop: true,
  });

  useEffect(() => {
    setKeyName(se2AiMidiKeyNameFromRoot(keyRoot));
  }, [keyRoot]);

  useEffect(() => {
    setScale(se2AiMidiScaleFromChordMode(keyMode === 'minor' ? 'minor' : 'major'));
  }, [keyMode]);

  useEffect(() => {
    setApiKeyDraft(readSe2MidiComposerApiKey(provider));
    setCustomEndpointDraft(readSe2MidiComposerCustomEndpoint());
  }, [provider]);

  useEffect(() => {
    if (transportPlaying) stopPreview();
  }, [transportPlaying, stopPreview]);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const modelOptions = useMemo(() => SE2_AI_MIDI_MODEL_OPTIONS[provider], [provider]);

  useEffect(() => {
    if (!modelOptions.some((m) => m.value === model)) {
      setModel(modelOptions[0]?.value ?? 'dmb/v1');
    }
  }, [model, modelOptions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, generating]);

  const persistSettings = useCallback(() => {
    writeSe2MidiComposerApiKey(provider, apiKeyDraft);
    writeSe2MidiComposerCustomEndpoint(customEndpointDraft);
  }, [apiKeyDraft, customEndpointDraft, provider]);

  const previewNotes = useMemo(() => {
    if (!staged) return [];
    const roll = se2MidiComposerResolveRollNotes(staged.result, beatsPerBar);
    return genoLoopPianoRollNotesFromDraft(roll);
  }, [beatsPerBar, staged]);

  const runGenerate = useCallback(
    async (opts: { text: string; isRegenerate: boolean }) => {
      const text = opts.text.trim();
      if (!text || disabled || generating) return;

      if (!opts.isRegenerate) {
        setMessages((prev) => [...prev, { id: nextChatId(), role: 'user', text }]);
        setPrompt('');
        setLastPrompt(text);
      }

      setGenerating(true);
      persistSettings();
      stopPreview();

      const keyRootPick = SE2_AI_MIDI_KEY_NAMES.indexOf(
        keyName as (typeof SE2_AI_MIDI_KEY_NAMES)[number],
      );
      const resolvedRoot = keyRootPick >= 0 ? keyRootPick : keyRoot;
      const resolvedMode: ChordMode =
        scale === 'major' || scale === 'mixolydian' ? 'major' : 'minor';
      onKeyChange?.(resolvedRoot, resolvedMode);

      seedRef.current = Date.now();

      try {
        const result = await se2MidiComposerGenerate({
          prompt: text,
          provider,
          model,
          apiKey: apiKeyDraft,
          customEndpoint: customEndpointDraft,
          keyName,
          scale,
          midiType,
          noteGrid,
          lengthBars,
          genre,
          beatsPerBar,
          fallbackGenreId,
          seed: seedRef.current,
        });

        if ('error' in result) {
          setMessages((prev) => [
            ...prev,
            { id: nextChatId(), role: 'assistant', text: result.error },
          ]);
          return;
        }

        setStaged((current) => {
          if (opts.isRegenerate && current) setPreviousStaged(current);
          return { result, prompt: text };
        });

        const detail =
          result.steps?.length && result.notes?.length
            ? `${result.steps.length} chord cards + ${result.notes.length} notes ready`
            : result.steps?.length
              ? `${result.steps.length} chord cards ready`
              : result.notes?.length
                ? `${result.notes.length} notes ready`
                : 'draft ready';
        setMessages((prev) => [
          ...prev,
          {
            id: nextChatId(),
            role: 'assistant',
            text: `${result.summary}\n\n${detail} — Preview, Regenerate, or Apply to roll.`,
          },
        ]);
      } finally {
        setGenerating(false);
      }
    },
    [
      apiKeyDraft,
      beatsPerBar,
      customEndpointDraft,
      disabled,
      fallbackGenreId,
      genre,
      generating,
      keyName,
      keyRoot,
      lengthBars,
      midiType,
      model,
      noteGrid,
      onKeyChange,
      persistSettings,
      provider,
      scale,
      stopPreview,
    ],
  );

  const handleGenerate = useCallback(() => {
    void runGenerate({ text: prompt, isRegenerate: false });
  }, [prompt, runGenerate]);

  const handleRegenerate = useCallback(() => {
    const text = lastPrompt || staged?.prompt || '';
    if (!text) return;
    void runGenerate({ text, isRegenerate: true });
  }, [lastPrompt, runGenerate, staged?.prompt]);

  const handleGoBack = useCallback(() => {
    if (!previousStaged) return;
    stopPreview();
    setStaged(previousStaged);
    setPreviousStaged(null);
    setMessages((prev) => [
      ...prev,
      {
        id: nextChatId(),
        role: 'assistant',
        text: 'Restored the previous draft — preview or apply when ready.',
      },
    ]);
  }, [previousStaged, stopPreview]);

  const handlePreview = useCallback(() => {
    if (!staged || previewNotes.length === 0 || !audioOn || !getAudioContext) return;
    if (previewPlaying) {
      stopPreview();
      return;
    }
    playPreview(previewNotes, 0);
  }, [audioOn, getAudioContext, playPreview, previewNotes, previewPlaying, staged, stopPreview]);

  const handleApplyToRoll = useCallback(() => {
    if (!staged || disabled) return;
    stopPreview();
    onApplyToRoll(staged.result);
    setMessages((prev) => [
      ...prev,
      {
        id: nextChatId(),
        role: 'assistant',
        text: 'Applied to the SE2 Chord Generator roll.',
      },
    ]);
  }, [disabled, onApplyToRoll, staged, stopPreview]);

  const handleClearChat = useCallback(() => {
    stopPreview();
    setMessages([]);
    setStaged(null);
    setPreviousStaged(null);
    setLastPrompt('');
  }, [stopPreview]);

  const handleSaveChat = useCallback(() => {
    const body = messages
      .map((m) => `${m.role === 'user' ? 'You' : 'AI'}: ${m.text}`)
      .join('\n\n');
    const blob = new Blob([body], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'se2-midi-composer-chat.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  const keyOptions = useMemo(
    () => SE2_AI_MIDI_KEY_NAMES.map((k) => ({ value: k, label: k })),
    [],
  );

  const busy = disabled || generating;
  const canPreview = Boolean(staged && previewNotes.length > 0 && audioOn && getAudioContext);
  const canRegenerate = Boolean((lastPrompt || staged?.prompt) && !generating);
  const canGoBack = Boolean(previousStaged && !generating);
  const canApply = Boolean(staged && !generating);

  return (
    <div
      className="rounded-lg border overflow-hidden flex flex-col w-fit max-w-full shrink-0"
      data-se2-midi-composer-panel
      style={{
        borderColor: 'rgba(196, 181, 253, 0.32)',
        background: PANEL_BG,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 20px rgba(0,0,0,0.35)',
      }}
      data-se2-chord-genie-ai-midi-panel
    >
      <div
        className="px-2 py-1 overflow-y-auto shrink-0"
        style={{
          maxHeight: providerHelpOpen ? 220 : 52,
          background: '#0c0c12',
        }}
        aria-label={`${SE2_MIDI_COMPOSER_LABEL} chat`}
      >
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {messages.length === 0 && !generating ? (
            <p data-se2-mc-body className="text-[#6a6a78] m-0 min-w-0">
              Generate → Preview → Apply to roll.
            </p>
          ) : null}
          <button
            type="button"
            data-se2-mc-btn
            disabled={busy}
            onClick={() => {
              setProviderHelpOpen((o) => {
                const next = !o;
                if (next) setSettingsOpen(false);
                return next;
              });
            }}
            className="shrink-0 rounded border px-1.5 py-0.5 uppercase disabled:opacity-40"
            style={{
              fontSize: 10,
              letterSpacing: '0.05em',
              borderColor: providerHelpOpen ? 'rgba(196, 181, 253, 0.55)' : BTN_BORDER,
              background: providerHelpOpen ? 'rgba(196, 181, 253, 0.14)' : BTN_BG,
              color: providerHelpOpen ? ACCENT : '#9a9aaa',
            }}
            title="Gemini, Grok, OpenAI & custom API keys — how to add yours"
          >
            API Provider
          </button>
        </div>
        {providerHelpOpen ? (
          <div
            className="rounded border px-2 py-1.5 flex flex-col gap-1 mt-1 mb-0.5"
            style={{ borderColor: 'rgba(196, 181, 253, 0.28)', background: '#101018' }}
            data-se2-mc-body
          >
            <span data-se2-mc-label className="text-[#c4b5fd]">
              {SE2_MIDI_COMPOSER_PROVIDER_HELP.title}
            </span>
            <p className="text-[#b8b8c8] m-0" style={{ lineHeight: 1.4, fontSize: 10 }}>
              {SE2_MIDI_COMPOSER_PROVIDER_HELP.intro}
            </p>
            <ol
              className="m-0 pl-3.5 flex flex-col gap-0.5 text-[#9898a8]"
              style={{ lineHeight: 1.4, fontSize: 10 }}
            >
              {SE2_MIDI_COMPOSER_PROVIDER_HELP.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <button
              type="button"
              data-se2-mc-btn
              disabled={busy}
              onClick={() => {
                setSettingsOpen(true);
                setProviderHelpOpen(false);
              }}
              className="rounded border px-1.5 py-0.5 uppercase disabled:opacity-40 w-full mt-0.5"
              style={{
                fontSize: 10,
                borderColor: 'rgba(196, 181, 253, 0.45)',
                background: 'rgba(196, 181, 253, 0.12)',
                color: ACCENT,
              }}
              title="Open API key field"
            >
              Open Set — paste your key
            </button>
          </div>
        ) : null}
        {messages.map((m) => (
          <ChatBubble key={m.id} role={m.role} text={m.text} />
        ))}
        {generating ? (
          <ChatBubble role="assistant" text="Composing draft… preview when ready." />
        ) : null}
        <div ref={chatEndRef} />
      </div>

      <div className="px-2 py-1.5 border-t flex flex-col gap-1.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-stretch justify-end gap-2 w-fit shrink-0">
          <div
            className="flex flex-col gap-1 shrink-0"
            style={{ width: MC_WORK_COL_W, maxWidth: MC_WORK_COL_W }}
          >
            <textarea
              data-se2-mc-input
              value={prompt}
              disabled={busy}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              rows={2}
              placeholder="Enter prompt here…"
              className="w-full resize-none rounded border px-2 py-1 outline-none disabled:opacity-50"
              style={{
                borderColor: 'rgba(196, 181, 253, 0.22)',
                background: INPUT_BG,
                color: '#ececf4',
                minHeight: 44,
              }}
              aria-label={`${SE2_MIDI_COMPOSER_LABEL} prompt`}
            />

            <ActionBtn
              disabled={busy || !prompt.trim()}
              onClick={handleGenerate}
              accent
              fullWidth
              title="Generate a draft (does not load the roll yet)"
            >
              {generating ? 'Working…' : 'Generate'}
            </ActionBtn>

            <div className="grid grid-cols-2 gap-1">
              <ActionBtn
                disabled={busy || !canPreview}
                onClick={handlePreview}
                accent={previewPlaying}
                title={
                  !audioOn
                    ? 'Turn chord audio On to preview'
                    : previewPlaying
                      ? 'Stop preview'
                      : 'Hear the draft before applying'
                }
              >
                {previewPlaying ? 'Stop' : 'Preview'}
              </ActionBtn>
              <ActionBtn
                disabled={busy || !canRegenerate}
                onClick={handleRegenerate}
                title="New take with the same prompt"
              >
                Regenerate
              </ActionBtn>
              <ActionBtn
                disabled={busy || !canGoBack}
                onClick={handleGoBack}
                title="Restore the draft before the last Regenerate"
              >
                Go Back
              </ActionBtn>
              <ActionBtn
                disabled={busy || !canApply}
                onClick={handleApplyToRoll}
                accent
                accentColor={APPLY_MINT}
                title="Load this draft onto the SE2 Chord Generator roll"
              >
                Apply
              </ActionBtn>
            </div>

            <div className="grid grid-cols-3 gap-1">
              <ActionBtn disabled={busy} onClick={handleSaveChat} title="Save chat">
                Save
              </ActionBtn>
              <ActionBtn disabled={busy} onClick={handleClearChat} title="Clear chat and drafts">
                Clear
              </ActionBtn>
              <ActionBtn
                disabled={busy}
                onClick={() => {
                  setSettingsOpen((o) => {
                    const next = !o;
                    if (next) setProviderHelpOpen(false);
                    return next;
                  });
                }}
                title="Paste your provider API key"
                accent={settingsOpen}
              >
                Set
              </ActionBtn>
            </div>
          </div>

          <div
            className="shrink-0 grid gap-x-1 gap-y-1 content-start justify-items-start"
            style={{ gridTemplateColumns: `repeat(4, ${MC_PARAM_W}px)` }}
          >
            <ParamSelect
              compact
              label="Provider"
              value={provider}
              options={SE2_AI_MIDI_PROVIDER_OPTIONS}
              disabled={busy}
              onChange={(v) => setProvider(v as Se2ChordGenieAiMidiProvider)}
            />
            <ParamSelect
              compact
              label="Model"
              value={model}
              options={modelOptions}
              disabled={busy}
              onChange={setModel}
            />
            <ParamSelect
              compact
              label="Key"
              value={keyName}
              options={keyOptions}
              disabled={busy}
              onChange={setKeyName}
            />
            <ParamSelect
              compact
              label="Scale"
              value={scale}
              options={SE2_AI_MIDI_SCALE_OPTIONS}
              disabled={busy}
              onChange={setScale}
            />
            <ParamSelect
              compact
              label="Type"
              value={midiType}
              options={SE2_AI_MIDI_TYPE_OPTIONS}
              disabled={busy}
              onChange={setMidiType}
            />
            <ParamSelect
              compact
              label="Notes"
              value={noteGrid}
              options={SE2_AI_MIDI_NOTE_GRID_OPTIONS}
              disabled={busy}
              onChange={setNoteGrid}
            />
            <ParamSelect
              compact
              label="Length"
              value={lengthBars}
              options={SE2_AI_MIDI_LENGTH_OPTIONS}
              disabled={busy}
              onChange={setLengthBars}
            />
            <ParamSelect
              compact
              label="Genre"
              value={genre}
              options={SE2_AI_MIDI_GENRE_OPTIONS}
              disabled={busy}
              onChange={setGenre}
            />
          </div>
        </div>

        {settingsOpen ? (
          <div
            className="rounded border px-2 py-1.5 flex flex-col gap-1"
            style={{ borderColor: 'rgba(196, 181, 253, 0.2)', background: '#0a0a10' }}
          >
            <span data-se2-mc-label className="text-[#8a8a9a]">
              API key (saved on this device)
            </span>
            <input
              data-se2-mc-input
              type="password"
              value={apiKeyDraft}
              disabled={busy}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              onBlur={persistSettings}
              placeholder={
                provider === 'damusicbox' ? 'Not needed — local engine' : 'Paste provider key…'
              }
              className="w-full rounded border px-2 py-1 outline-none disabled:opacity-50"
              style={{
                borderColor: 'rgba(196, 181, 253, 0.22)',
                background: INPUT_BG,
                color: '#e8e8f0',
              }}
            />
            {provider === 'custom' ? (
              <>
                <span data-se2-mc-label className="text-[#8a8a9a] mt-0.5">
                  Custom endpoint (OpenAI-compatible)
                </span>
                <input
                  data-se2-mc-input
                  type="url"
                  value={customEndpointDraft}
                  disabled={busy}
                  onChange={(e) => setCustomEndpointDraft(e.target.value)}
                  onBlur={persistSettings}
                  placeholder="https://your-api/v1/chat/completions"
                  className="w-full rounded border px-2 py-1 outline-none disabled:opacity-50"
                  style={{
                    borderColor: 'rgba(196, 181, 253, 0.22)',
                    background: INPUT_BG,
                    color: '#e8e8f0',
                  }}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
