/**
 * Groove Lab — CH 33–48 mixer rail (Studio One / Beat Lab style).
 * Click a channel to select it and open its piano roll; assign CHORD / GUITAR / LEAD bank.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { GrooveLabChannelFxButton } from '@/app/components/creation/GrooveLabChannelFxButton';
import { GrooveLabChannelMuteSoloRow } from '@/app/components/creation/GrooveLabChannelMuteSoloRow';
import {
  GrooveLabChannelStereoVu,
  useGrooveLabChannelMeterPaint,
} from '@/app/components/creation/GrooveLabChannelStereoVu';
import { GROOVE_LAB_CHANNEL_MS_CHANGED } from '@/app/lib/creationStation/grooveLabChannelMuteSolo';
import {
  CHORD_BASS_SEQ_CHANNEL_BASE,
  CHORD_BASS_SEQ_CHANNEL_COUNT,
} from '@/app/lib/creationStation/chordBassSequencerSession';
import {
  grooveLabLayerRoleForChannel,
  type GrooveLabLayerRole,
} from '@/app/lib/creationStation/grooveLabChannelConfig';
import {
  grooveLabChannelRoleLabel,
  grooveLabLayerScopeForChannel,
  GROOVE_LAB_LAYER_SCOPE_META,
} from '@/app/lib/creationStation/grooveLabPianoRollLayers';
import { GrooveLabHelpTip } from '@/app/components/creation/GrooveLabHelpHub';

/** First bank — CH 33–40 (8 lanes). */
export const GROOVE_LAB_CHANNELS_33_40: readonly number[] = Array.from(
  { length: 8 },
  (_, i) => CHORD_BASS_SEQ_CHANNEL_BASE + i,
);

/** Second bank — CH 41–48. */
export const GROOVE_LAB_CHANNELS_41_48: readonly number[] = Array.from(
  { length: 8 },
  (_, i) => CHORD_BASS_SEQ_CHANNEL_BASE + 8 + i,
);

const EMBED_STRIP_W_PX = 78;

const miniSelectStyle: CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  background: '#0a0e16',
  color: '#c8d0dc',
  border: '1px solid #1e293b',
  borderRadius: 3,
  padding: '1px 2px',
  fontSize: 6,
  fontWeight: 800,
  lineHeight: 1.2,
  cursor: 'pointer',
};

/** Layer role dropdown (CHORD / GUITAR / LEAD) — larger type only, same strip width. */
const embedLayerSelectStyle: CSSProperties = {
  ...miniSelectStyle,
  padding: '2px 1px',
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 0.2,
};

export type GrooveLabChannelRailProps = {
  selectedChannel: number;
  onSelectChannel: (ch: number) => void;
  chordChannel: number;
  melodyChannel: number;
  guitarChannel?: number;
  sampleChannel?: number;
  onAssignLayerRole: (ch: number, role: GrooveLabLayerRole) => void;
  noteCountByChannel?: Record<number, number>;
  /** Subset of lanes; default = all CH 33–48. */
  channels?: readonly number[];
  /** Compact row under chord-strip PLAY — no rail chrome (does not resize panels). */
  embed?: boolean;
};

function stripAccent(
  ch: number,
  chordChannel: number,
  melodyChannel: number,
  guitarChannel?: number,
  sampleChannel?: number,
): string {
  const scope = grooveLabLayerScopeForChannel(
    ch,
    chordChannel,
    melodyChannel,
    guitarChannel,
    sampleChannel,
  );
  if (scope) return GROOVE_LAB_LAYER_SCOPE_META[scope].color;
  return '#86efac';
}

export function GrooveLabChannelRail({
  selectedChannel,
  onSelectChannel,
  chordChannel,
  melodyChannel,
  guitarChannel,
  sampleChannel,
  onAssignLayerRole,
  noteCountByChannel = {},
  channels: channelsProp,
  embed = false,
}: GrooveLabChannelRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const embedMeterRootRef = useRef<HTMLDivElement>(null);
  const [msTick, setMsTick] = useState(0);
  const channelIds =
    channelsProp ??
    Array.from(
      { length: CHORD_BASS_SEQ_CHANNEL_COUNT },
      (_, i) => CHORD_BASS_SEQ_CHANNEL_BASE + i,
    );

  useEffect(() => {
    const bump = () => setMsTick((n) => n + 1);
    window.addEventListener(GROOVE_LAB_CHANNEL_MS_CHANGED, bump);
    return () => window.removeEventListener(GROOVE_LAB_CHANNEL_MS_CHANGED, bump);
  }, []);

  useEffect(() => {
    if (!embed) return;
    const el = scrollRef.current;
    if (!el) return;
    const lane = el.querySelector<HTMLElement>(`[data-groove-ch="${selectedChannel}"]`);
    lane?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [embed, selectedChannel]);

  useGrooveLabChannelMeterPaint(embedMeterRootRef, embed);

  const buttons = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: embed ? 4 : 6,
        flexWrap: 'nowrap',
        alignItems: embed ? 'stretch' : 'flex-start',
        height: embed ? '100%' : undefined,
        width: embed ? 'max-content' : undefined,
        minHeight: embed ? '100%' : undefined,
      }}
    >
      {channelIds.map((ch) => {
        const selected = ch === selectedChannel;
        const accent = stripAccent(ch, chordChannel, melodyChannel, guitarChannel, sampleChannel);
        const role = grooveLabChannelRoleLabel(
          ch,
          chordChannel,
          melodyChannel,
          guitarChannel,
          sampleChannel,
        );
        const layerRole = grooveLabLayerRoleForChannel(
          ch,
          chordChannel,
          melodyChannel,
          guitarChannel,
          sampleChannel,
        );
        const noteCount = noteCountByChannel[ch] ?? 0;
        const scope = grooveLabLayerScopeForChannel(
          ch,
          chordChannel,
          melodyChannel,
          guitarChannel,
          sampleChannel,
        );
        const register = scope ? GROOVE_LAB_LAYER_SCOPE_META[scope].register : 'C1–C6';

        return (
          <button
            key={ch}
            type="button"
            data-groove-ch={ch}
            title={
              noteCount > 0
                ? `CH ${ch} · ${role} · ${register} · ${noteCount} notes — open piano roll`
                : `CH ${ch} · ${role} · ${register} — open piano roll`
            }
            onClick={() => onSelectChannel(ch)}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              const target = e.target as HTMLElement;
              if (target.closest('button, select, option, [data-groove-no-select]')) return;
              onSelectChannel(ch);
            }}
            style={{
              width: embed ? EMBED_STRIP_W_PX : 72,
              flex: embed ? `0 0 ${EMBED_STRIP_W_PX}px` : '0 0 auto',
              height: embed ? '100%' : undefined,
              scrollSnapAlign: embed ? 'start' : undefined,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: embed ? 'flex-start' : undefined,
              gap: embed ? 0 : 1,
              padding: embed ? '4px 4px 4px' : '5px 4px 6px',
              borderRadius: 5,
              border: selected
                ? `2px solid ${accent}`
                : scope
                  ? `1px solid ${accent}44`
                  : '1px solid rgba(134, 239, 172, 0.2)',
              background: selected
                ? `linear-gradient(180deg, ${accent}38 0%, ${accent}16 45%, #060806 100%)`
                : scope
                  ? `linear-gradient(180deg, ${accent}0c 0%, #060806 100%)`
                  : 'linear-gradient(180deg, #0a120c 0%, #060806 100%)',
              cursor: 'pointer',
              boxShadow: selected
                ? `0 0 16px ${accent}66, inset 0 0 14px ${accent}22`
                : scope
                  ? `0 0 4px ${accent}18`
                  : 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.08s, box-shadow 0.08s, background 0.08s',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
                width: '100%',
                lineHeight: 1.1,
                paddingBottom: embed ? 2 : 0,
              }}
            >
              <GrooveLabChannelMuteSoloRow
                ch={ch}
                accent={selected ? accent : scope ? accent : '#8a9aa4'}
                chFontSize={embed ? 11 : 13}
                msTick={msTick}
                onPointerDown={(e) => e.stopPropagation()}
              />
              <span
                style={{
                  fontSize: embed ? 8 : 7,
                  fontWeight: 800,
                  color: selected ? accent : scope ? `${accent}cc` : '#8a9aa4',
                  letterSpacing: 0.15,
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  textShadow: selected ? `0 0 8px ${accent}55` : undefined,
                }}
              >
                {role}
              </span>
              {embed ? (
                <select
                  data-groove-no-select=""
                  aria-label={`CH ${ch} layer`}
                  value={layerRole}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    onAssignLayerRole(ch, e.target.value as GrooveLabLayerRole);
                    onSelectChannel(ch);
                  }}
                  style={{
                    ...embedLayerSelectStyle,
                    marginTop: 2,
                    color: accent,
                    borderColor: `${accent}55`,
                  }}
                  title="Assign CHORD, GUITAR, Groove Lead, ORCH HITS, or work lane"
                >
                  <option value="work">—</option>
                  <option value="chord">CHORD</option>
                  <option value="guitar">GUITAR</option>
                  <option value="waveleaf">LEAD</option>
                  <option value="sample">ORCH</option>
                </select>
              ) : null}
            </div>
            {embed ? (
              <div
                style={{
                  flex: 1,
                  minHeight: 24,
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'flex-end',
                  gap: 2,
                  marginTop: 1,
                  marginBottom: 0,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minHeight: 18,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <GrooveLabChannelStereoVu ch={ch} accent={accent} size="embed" />
                </div>
                <div data-groove-no-select="">
                  <GrooveLabChannelFxButton
                    ch={ch}
                    channelLabel={`CH ${ch} · ${role}`}
                    accent={accent}
                    variant="embed"
                  />
                </div>
              </div>
            ) : null}
            {!embed && noteCount > 0 ? (
              <span
                style={{
                  fontSize: 6,
                  fontWeight: 800,
                  color: '#6b7280',
                  fontFamily: 'monospace',
                  flexShrink: 0,
                }}
              >
                {noteCount}n
              </span>
            ) : !embed ? (
              <span style={{ fontSize: 6, height: 8 }} aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );

  if (embed) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 48,
          minWidth: 0,
          marginTop: 4,
          marginBottom: 0,
        }}
      >
        <div
          ref={embedMeterRootRef}
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 14,
              zIndex: 2,
              pointerEvents: 'none',
              background: 'linear-gradient(90deg, #050805 0%, transparent 100%)',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 14,
              zIndex: 2,
              pointerEvents: 'none',
              background: 'linear-gradient(270deg, #050805 0%, transparent 100%)',
            }}
          />
          <div
            ref={scrollRef}
            style={{
              height: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'x proximity',
              scrollbarWidth: 'thin',
            }}
          >
            {buttons}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderBottom: '1px solid rgba(134, 239, 172, 0.22)',
        background: 'linear-gradient(180deg, #060a08 0%, #040604 100%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px 2px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 8, fontWeight: 900, color: '#6b7280', letterSpacing: 0.4 }}>
          CHANNELS
          <GrooveLabHelpTip tab="channels" title="CH 33–48 channel strips" />
        </span>
        <span style={{ fontSize: 8, color: '#4b5563', fontWeight: 700 }}>
          CH 33–48 · click to edit piano roll
        </span>
      </div>
      <div
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          padding: '4px 8px 8px',
        }}
      >
        {buttons}
      </div>
    </div>
  );
}
