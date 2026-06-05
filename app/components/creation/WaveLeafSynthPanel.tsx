/**
 * Groove Lead — synth face for the lead lane (right column; pairs with Groove chord).
 * Notes are placed on the bottom Groove Lab piano roll — not here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SynthRoundKnob } from '@/app/components/creation/BeatLabSynthV2Knob';
import { WaveLeafMelodyGenPanel } from '@/app/components/creation/WaveLeafMelodyGenPanel';
import { WaveLeafPresetBackdrop } from '@/app/components/creation/WaveLeafPresetBackdrop';
import { WaveLeafPreviewKeys } from '@/app/components/creation/WaveLeafPreviewKeys';
import {
  GROOVE_LAB_QUANTIZE_OPTIONS,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { chordBassSeqChannelLabel } from '@/app/lib/creationStation/chordBassSequencerSession';
import { resolveGrooveLabChannelDest, runWithGrooveLabAudio } from '@/app/lib/creationStation/grooveLabAudio';
import {
  GROOVE_LEAD_DISPLAY_NAME,
  GROOVE_LEAD_GRID_BAND_PX,
  WAVE_LEAF_UI,
} from '@/app/lib/creationStation/waveLeafBranding';
import { haltWaveLeafVoices, playWaveLeafNote } from '@/app/lib/creationStation/waveLeafEngine';
import {
  WAVE_LEAF_PRESET_GROUPS,
  waveLeafPreset,
  waveLeafPresetBackdropHighlight,
  waveLeafPresetBankIndex,
  waveLeafPresetPreviewHoldBeats,
  type WaveLeafPresetId,
} from '@/app/lib/creationStation/waveLeafPresets';
import { writeWaveLeafRuntimeSettings } from '@/app/lib/creationStation/waveLeafRuntimeSettings';
import {
  scheduleWaveLeafPhraseBars,
  startWaveLeafPhrasePreviewOnCtx,
  type WaveLeafPhraseMode,
} from '@/app/lib/creationStation/waveLeafPreviewPhrase';
import {
  readWaveLeafPresetId,
  readWaveLeafPreviewQuantize,
  WAVE_LEAF_SETTINGS_KEYS,
} from '@/app/lib/creationStation/waveLeafSettings';

function readStoredFloat(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = Number.parseFloat(window.localStorage.getItem(key) ?? '');
    if (Number.isFinite(v)) return Math.max(min, Math.min(max, v));
  } catch {
    /* */
  }
  return fallback;
}

export type WaveLeafSynthPanelProps = {
  channel: number;
  noteCount?: number;
  bpm: number;
  getAudioContext: () => AudioContext;
  channelVolumes?: Record<number, number>;
  onPreviewRoll?: () => void;
  onClearHits?: () => void;
  chordColumnCount?: number;
  chordHits?: readonly GrooveRollHit[];
  barCount?: number;
  quantize?: GrooveLabQuantize;
  keyRoot?: number;
  mode?: ChordMode;
  bassRootMidi?: number;
  onMelodyGenerated?: (hits: GrooveRollHit[], loopBars: number) => void;
  canUndoMelody?: boolean;
  onUndoMelody?: () => void;
};

export function WaveLeafSynthPanel({
  channel,
  noteCount = 0,
  bpm,
  getAudioContext,
  channelVolumes,
  onPreviewRoll,
  onClearHits,
  chordColumnCount = 0,
  chordHits = [],
  barCount = 16,
  quantize = '1/16',
  keyRoot = 0,
  mode = 'major',
  bassRootMidi,
  onMelodyGenerated,
  canUndoMelody = false,
  onUndoMelody,
}: WaveLeafSynthPanelProps) {
  const [presetId, setPresetId] = useState<WaveLeafPresetId>(readWaveLeafPresetId);
  const [categoryIdx, setCategoryIdx] = useState(() =>
    waveLeafPresetBankIndex(readWaveLeafPresetId()),
  );
  const [glideMs, setGlideMs] = useState(() =>
    readStoredFloat(WAVE_LEAF_SETTINGS_KEYS.glide, waveLeafPreset(readWaveLeafPresetId()).glideMs, 0, 480),
  );
  const [brightness, setBrightness] = useState(() =>
    readStoredFloat(WAVE_LEAF_SETTINGS_KEYS.bright, 1, 0.35, 1.6),
  );
  const [warmth, setWarmth] = useState(() =>
    readStoredFloat(WAVE_LEAF_SETTINGS_KEYS.warm, 1, 0.5, 1.4),
  );
  const [drive, setDrive] = useState(() =>
    readStoredFloat(WAVE_LEAF_SETTINGS_KEYS.drive, 0.12, 0, 1),
  );
  const [output, setOutput] = useState(() => readStoredFloat('wave-leaf-output', 0.82, 0.2, 1));
  const [vibratoDepthCents, setVibratoDepthCents] = useState(() =>
    readStoredFloat(WAVE_LEAF_SETTINGS_KEYS.vibrato, 0, 0, 80),
  );
  /** null = off — preview keys / roll unchanged (short single note). */
  const [phraseMode, setPhraseMode] = useState<WaveLeafPhraseMode | null>(null);
  const [phraseQuantize, setPhraseQuantize] = useState<GrooveLabQuantize>(() =>
    readWaveLeafPreviewQuantize(quantize),
  );
  const cancelPhraseRef = useRef<(() => void) | null>(null);
  const heldPreviewMidiRef = useRef<number | null>(null);

  const preset = useMemo(() => waveLeafPreset(presetId), [presetId]);
  const activeGroup = WAVE_LEAF_PRESET_GROUPS[categoryIdx] ?? WAVE_LEAF_PRESET_GROUPS[0]!;
  const presetBackdrop = useMemo(
    () => waveLeafPresetBackdropHighlight(activeGroup.label),
    [activeGroup.label],
  );
  const padPreviewHold = useMemo(() => waveLeafPresetPreviewHoldBeats(preset), [preset]);

  useEffect(() => {
    writeWaveLeafRuntimeSettings(
      { preset, glideMs, brightness, warmth, drive, vibratoDepthCents },
      { outputGain: output },
    );
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(WAVE_LEAF_SETTINGS_KEYS.preset, presetId);
      window.localStorage.setItem(WAVE_LEAF_SETTINGS_KEYS.glide, String(glideMs));
      window.localStorage.setItem(WAVE_LEAF_SETTINGS_KEYS.bright, String(brightness));
      window.localStorage.setItem(WAVE_LEAF_SETTINGS_KEYS.warm, String(warmth));
      window.localStorage.setItem(WAVE_LEAF_SETTINGS_KEYS.drive, String(drive));
      window.localStorage.setItem(WAVE_LEAF_SETTINGS_KEYS.vibrato, String(vibratoDepthCents));
      window.localStorage.setItem(WAVE_LEAF_SETTINGS_KEYS.previewQuantize, phraseQuantize);
      window.localStorage.setItem('wave-leaf-output', String(output));
    } catch {
      /* */
    }
  }, [preset, presetId, glideMs, brightness, warmth, drive, vibratoDepthCents, output, phraseQuantize]);

  const stopPhrasePreview = useCallback(() => {
    cancelPhraseRef.current?.();
    cancelPhraseRef.current = null;
    heldPreviewMidiRef.current = null;
    haltWaveLeafVoices();
  }, []);

  useEffect(() => () => stopPhrasePreview(), [stopPhrasePreview]);

  const playDefaultPreview = useCallback(
    (midi: number, holdBeats: number) => {
      runWithGrooveLabAudio(getAudioContext, (ctx, when) => {
        const dest = resolveGrooveLabChannelDest(ctx, channel, channelVolumes);
        playWaveLeafNote(ctx, midi, when, {
          preset,
          glideMs,
          brightness,
          warmth,
          drive,
          vibratoDepthCents,
          bpm,
          holdBeats,
          velocity: 0.88 * output,
          outputGain: output,
          destination: dest,
          monophonic: true,
        });
      });
    },
    [
      getAudioContext,
      channel,
      channelVolumes,
      preset,
      glideMs,
      brightness,
      warmth,
      drive,
      vibratoDepthCents,
      bpm,
      output,
    ],
  );

  const primePreviewAudio = useCallback(() => {
    runWithGrooveLabAudio(getAudioContext, () => {});
  }, [getAudioContext]);

  const runPhrasePreview = useCallback(
    (midi: number, loopWhileHeld: boolean) => {
      if (!phraseMode) return;
      cancelPhraseRef.current?.();

      runWithGrooveLabAudio(getAudioContext, (ctx, t0) => {
        const dest = resolveGrooveLabChannelDest(ctx, channel, channelVolumes);
        const playScheduled = (noteMidi: number, whenSec: number, hold: number) => {
          playWaveLeafNote(ctx, noteMidi, whenSec, {
            preset,
            glideMs,
            brightness,
            warmth,
            drive,
            vibratoDepthCents,
            bpm,
            holdBeats: Math.max(0.2, hold),
            velocity: 0.92 * output,
            outputGain: output,
            destination: dest,
            monophonic: true,
          });
        };

        if (loopWhileHeld) {
          const stopLoop = startWaveLeafPhrasePreviewOnCtx(
            ctx,
            t0,
            bpm,
            phraseQuantize,
            phraseMode,
            midi,
            playScheduled,
            true,
          );
          cancelPhraseRef.current = () => {
            stopLoop();
            haltWaveLeafVoices();
          };
          return;
        }

        scheduleWaveLeafPhraseBars(ctx, t0, bpm, phraseQuantize, phraseMode, midi, 0, playScheduled, 2);
        cancelPhraseRef.current = () => haltWaveLeafVoices();
      });
    },
    [
      getAudioContext,
      bpm,
      phraseQuantize,
      phraseMode,
      channel,
      channelVolumes,
      preset,
      glideMs,
      brightness,
      warmth,
      drive,
      vibratoDepthCents,
      output,
    ],
  );

  const previewNote = useCallback(
    (midi: number, holdBeats = 0.45, loopWhileHeld = false) => {
      cancelPhraseRef.current?.();
      cancelPhraseRef.current = null;
      if (!phraseMode) {
        heldPreviewMidiRef.current = null;
        playDefaultPreview(midi, holdBeats);
        return;
      }
      primePreviewAudio();
      if (loopWhileHeld) heldPreviewMidiRef.current = midi;
      runPhrasePreview(midi, loopWhileHeld);
    },
    [phraseMode, playDefaultPreview, runPhrasePreview],
  );

  useEffect(() => {
    const midi = heldPreviewMidiRef.current;
    if (!phraseMode || midi == null) return;
    runPhrasePreview(midi, true);
  }, [phraseQuantize, phraseMode, bpm, runPhrasePreview]);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: `2px solid ${WAVE_LEAF_UI.border}`,
        background: `linear-gradient(165deg, ${WAVE_LEAF_UI.bgDeep} 0%, ${WAVE_LEAF_UI.bgPanel} 45%, #060e18 100%)`,
        boxShadow: `inset 0 0 32px ${WAVE_LEAF_UI.accent}14`,
        overflow: 'hidden',
      }}
    >
      {/* Plugin header */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 10px',
          borderBottom: `1px solid ${WAVE_LEAF_UI.borderHi}`,
          background: `linear-gradient(90deg, ${WAVE_LEAF_UI.bgInset}, ${WAVE_LEAF_UI.bgModule}, ${WAVE_LEAF_UI.bgInset})`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <WaveLeafLogoMark />
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
            <div style={{ flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  letterSpacing: 1.8,
                  color: WAVE_LEAF_UI.accentHi,
                  lineHeight: 1.1,
                }}
              >
                {GROOVE_LEAD_DISPLAY_NAME}
              </div>
              <div style={{ fontSize: 7, color: WAVE_LEAF_UI.textDim, fontWeight: 700 }}>
                {chordBassSeqChannelLabel(channel)} · pairs with Groove chord
              </div>
            </div>
            <WaveLeafPhraseChips
              phraseMode={phraseMode}
              phraseQuantize={phraseQuantize}
              gridActive={phraseMode != null}
              onArp={() => {
                primePreviewAudio();
                setPhraseMode((m) => (m === 'arp' ? null : 'arp'));
              }}
              onRiff={() => {
                primePreviewAudio();
                setPhraseMode((m) => (m === 'riff' ? null : 'riff'));
              }}
              onQuantizeChange={setPhraseQuantize}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {onPreviewRoll ? (
            <PluginBtn label="▶ AUDITION" accent={WAVE_LEAF_UI.accentHi} onClick={onPreviewRoll} />
          ) : null}
          {onClearHits ? (
            <PluginBtn
              label="CLEAR"
              accent="#f0a060"
              border="#a06030"
              disabled={noteCount === 0}
              onClick={() => {
                stopPhrasePreview();
                onClearHits();
              }}
            />
          ) : null}
        </div>
      </div>

      {/* Banks | presets | macros — fills gap above scope/keys; panel shell height unchanged */}
      <div
        style={{
          flex: `1 1 ${GROOVE_LEAD_GRID_BAND_PX}px`,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(72px, 88px) minmax(0, 1fr) minmax(96px, 108px)',
          gridTemplateRows: 'minmax(0, 1fr)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            minHeight: 0,
            borderRight: `1px solid ${WAVE_LEAF_UI.border}`,
            background: WAVE_LEAF_UI.bgInset,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              flexShrink: 0,
              fontSize: 7,
              fontWeight: 900,
              color: WAVE_LEAF_UI.textDim,
              padding: '4px 4px 6px',
              letterSpacing: 0.6,
            }}
          >
            BANKS
          </div>
          <div
            className="groove-lead-preset-scroll"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '0 3px 4px',
            }}
          >
          {WAVE_LEAF_PRESET_GROUPS.map((g, i) => (
            <button
              key={g.label}
              type="button"
              className="groove-lead-type-label"
              onClick={() => setCategoryIdx(i)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                marginBottom: 3,
                padding: '4px 5px',
                fontSize: 9,
                fontWeight: 700,
                lineHeight: 1.25,
                borderRadius: 4,
                cursor: 'pointer',
                border: `1px solid ${i === categoryIdx ? WAVE_LEAF_UI.presetBorderOn : 'transparent'}`,
                background: i === categoryIdx ? WAVE_LEAF_UI.presetOn : 'transparent',
                color: i === categoryIdx ? WAVE_LEAF_UI.accentHi : WAVE_LEAF_UI.text,
              }}
            >
              {g.label}
            </button>
          ))}
          </div>
        </div>

        <div
          className="groove-lead-preset-stage"
          style={{
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '6px 6px 0',
            background: `radial-gradient(ellipse 70% 50% at 50% 0%, ${WAVE_LEAF_UI.accentDim}33, transparent 70%), ${WAVE_LEAF_UI.bgPanel}`,
          }}
        >
          <WaveLeafPresetBackdrop highlight={presetBackdrop} />
          <div className="groove-lead-preset-stage__content">
          <div
            className="groove-lead-type-label"
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: WAVE_LEAF_UI.accentHi,
              marginBottom: 4,
              flexShrink: 0,
              lineHeight: 1.2,
            }}
          >
            {activeGroup.label}
          </div>
          <div
            className="groove-lead-preset-scroll"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingBottom: 6,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))',
                gap: 4,
              }}
            >
            {activeGroup.ids.map((id) => {
              const p = waveLeafPreset(id);
              const on = id === presetId;
              return (
                <button
                  key={id}
                  type="button"
                  className={`groove-lead-type-label${on ? '' : ' groove-lead-preset-pad-idle'}`}
                  onClick={() => {
                    setPresetId(id);
                    previewNote(72, waveLeafPresetPreviewHoldBeats(p));
                  }}
                  style={{
                    padding: '5px 5px',
                    borderRadius: 5,
                    cursor: 'pointer',
                    textAlign: 'left',
                    border: `1px solid ${on ? WAVE_LEAF_UI.presetBorderOn : WAVE_LEAF_UI.border}`,
                    background: on
                      ? `linear-gradient(145deg, ${WAVE_LEAF_UI.presetOn}, ${WAVE_LEAF_UI.bgModule})`
                      : WAVE_LEAF_UI.presetIdle,
                    boxShadow: on ? `0 0 10px ${WAVE_LEAF_UI.accent}44` : 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: on ? '#e8f8ff' : WAVE_LEAF_UI.text,
                      lineHeight: 1.2,
                    }}
                  >
                    {p.label}
                  </div>
                  <div
                    style={{
                      fontSize: 7,
                      fontWeight: 600,
                      color: p.voiceTag
                        ? on
                          ? WAVE_LEAF_UI.accentHi
                          : WAVE_LEAF_UI.accent
                        : on
                          ? WAVE_LEAF_UI.accent
                          : WAVE_LEAF_UI.textDim,
                      marginTop: 2,
                      lineHeight: 1.15,
                      opacity: 0.95,
                    }}
                  >
                    {p.voiceTag ?? `${p.osc1} · ${p.osc2}`}
                  </div>
                </button>
              );
            })}
            </div>
          </div>
          </div>
        </div>

        <div
          style={{
            borderLeft: `1px solid ${WAVE_LEAF_UI.border}`,
            background: WAVE_LEAF_UI.bgInset,
            padding: '4px 2px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            minHeight: 0,
            maxHeight: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <span style={{ fontSize: 6, fontWeight: 900, color: WAVE_LEAF_UI.textDim, letterSpacing: 0.6 }}>
            MACROS
          </span>
          <SynthRoundKnob label="GLIDE" value={glideMs} min={0} max={480} decimals={0} unit="ms" onChange={setGlideMs} size={32} accent={WAVE_LEAF_UI.accent} />
          <SynthRoundKnob label="FILTER" value={brightness} min={0.35} max={1.6} onChange={setBrightness} size={32} accent={WAVE_LEAF_UI.accentHi} />
          <SynthRoundKnob label="BODY" value={warmth} min={0.5} max={1.4} onChange={setWarmth} size={32} accent="#7ee8ff" />
          <SynthRoundKnob label="DRIVE" value={drive} min={0} max={1} onChange={setDrive} size={32} accent={WAVE_LEAF_UI.gold} />
          <SynthRoundKnob
            label="VIBRATO"
            value={vibratoDepthCents}
            min={0}
            max={80}
            decimals={0}
            unit="¢"
            onChange={setVibratoDepthCents}
            size={32}
            accent="#b8a0ff"
          />
          <SynthRoundKnob label="OUT" value={output} min={0.2} max={1} onChange={setOutput} size={32} accent={WAVE_LEAF_UI.accent} />
        </div>
      </div>

      {/* Scope + preview keys — flush under banks / presets / macros */}
      <div
        style={{
          flexShrink: 0,
          padding: '4px 8px 8px',
          borderTop: `1px solid ${WAVE_LEAF_UI.border}`,
        }}
      >
        {onMelodyGenerated ? (
          <WaveLeafMelodyGenPanel
            chordColumnCount={chordColumnCount}
            leadNoteCount={noteCount}
            barCount={barCount}
            quantize={quantize}
            keyRoot={keyRoot}
            mode={mode}
            bpm={bpm}
            bassRootMidi={bassRootMidi}
            chordHits={chordHits}
            onGenerated={onMelodyGenerated}
            canUndo={canUndoMelody}
            onUndo={onUndoMelody}
          />
        ) : null}
        <div style={{ marginTop: 6 }}>
          <WaveLeafPreviewKeys
            onPlayMidi={(midi) => previewNote(midi, padPreviewHold, true)}
            onReleaseMidi={stopPhrasePreview}
          />
        </div>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 6,
            color: WAVE_LEAF_UI.textDim,
            lineHeight: 1.4,
            textAlign: 'center',
          }}
        >
          Draw <strong style={{ color: WAVE_LEAF_UI.accent }}>Groove Lead</strong> on the bottom piano roll when{' '}
          {chordBassSeqChannelLabel(channel)} is selected — complements Groove chord on CH 34.
        </p>
      </div>
    </div>
  );
}

function WaveLeafPhraseChips({
  phraseMode,
  phraseQuantize,
  gridActive,
  onArp,
  onRiff,
  onQuantizeChange,
}: {
  phraseMode: WaveLeafPhraseMode | null;
  phraseQuantize: GrooveLabQuantize;
  gridActive: boolean;
  onArp: () => void;
  onRiff: () => void;
  onQuantizeChange: (q: GrooveLabQuantize) => void;
}) {
  return (
    <div
      className="groove-lead-type-label"
      style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}
    >
      <PhraseChip label="ARP" on={phraseMode === 'arp'} onClick={onArp} title="Arpeggio preview — click again for off" />
      <PhraseChip label="RIFF" on={phraseMode === 'riff'} onClick={onRiff} title="Riff chop preview — click again for off" />
      <span style={{ fontSize: 6, color: WAVE_LEAF_UI.textDim, margin: '0 1px' }}>|</span>
      <div style={{ display: 'flex', gap: 2, opacity: gridActive ? 1 : 0.4 }}>
        {GROOVE_LAB_QUANTIZE_OPTIONS.map((q) => (
          <PhraseChip
            key={q}
            label={q}
            on={phraseQuantize === q}
            compact
            onClick={() => onQuantizeChange(q)}
            title={gridActive ? `Grid ${q}` : 'Enable ARP or RIFF'}
          />
        ))}
      </div>
    </div>
  );
}

function PhraseChip({
  label,
  on,
  onClick,
  compact,
  title,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  compact?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="groove-lead-type-label"
      title={title}
      onClick={onClick}
      style={{
        fontSize: compact ? 7 : 8,
        fontWeight: 700,
        padding: compact ? '2px 4px' : '2px 6px',
        borderRadius: 3,
        cursor: 'pointer',
        lineHeight: 1.1,
        border: `1px solid ${on ? WAVE_LEAF_UI.presetBorderOn : WAVE_LEAF_UI.border}`,
        background: on ? WAVE_LEAF_UI.presetOn : 'rgba(0,0,0,0.25)',
        color: on ? WAVE_LEAF_UI.accentHi : WAVE_LEAF_UI.textDim,
      }}
    >
      {label}
    </button>
  );
}

function WaveLeafLogoMark() {
  return (
    <svg width={32} height={24} viewBox="0 0 36 28" aria-hidden>
      <defs>
        <linearGradient id="wlWave" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={WAVE_LEAF_UI.accent} />
          <stop offset="100%" stopColor={WAVE_LEAF_UI.accentHi} />
        </linearGradient>
      </defs>
      <path d="M2 14 Q9 4 18 14 T34 14" fill="none" stroke="url(#wlWave)" strokeWidth={2.5} strokeLinecap="round" />
      <path
        d="M2 18 Q11 8 20 18 T34 18"
        fill="none"
        stroke={WAVE_LEAF_UI.accent}
        strokeWidth={1.5}
        strokeOpacity={0.45}
        strokeLinecap="round"
      />
    </svg>
  );
}

function PluginBtn({
  label,
  accent,
  border,
  onClick,
  disabled,
}: {
  label: string;
  accent: string;
  border?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        fontSize: 7,
        fontWeight: 900,
        padding: '3px 8px',
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        color: accent,
        border: `1px solid ${border ?? accent}`,
        background: 'rgba(0,0,0,0.35)',
      }}
    >
      {label}
    </button>
  );
}

/** @deprecated Use WaveLeafSynthPanel */
export { WaveLeafSynthPanel as WaveLeafWorkspace };
export type { WaveLeafSynthPanelProps as WaveLeafWorkspaceProps };
