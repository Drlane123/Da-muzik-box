/**
 * Groove Lab — CH 33–48 mixer rail (Studio One / Beat Lab style).
 * Click a channel to select it and open its piano roll; assign CHORD / GUITAR / LEAD bank.
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import {
  CHORD_BASS_SEQ_CHANNEL_BASE,
  CHORD_BASS_SEQ_CHANNEL_COUNT,
} from '@/app/lib/creationStation/chordBassSequencerSession';
import {
  grooveLabLayerRoleForChannel,
  type GrooveLabLayerRole,
} from '@/app/lib/creationStation/grooveLabChannelConfig';
import { getGrooveLabChannelMeterLevel } from '@/app/lib/creationStation/grooveLabChannelMeters';
import {
  grooveLabChannelRoleLabel,
  grooveLabLayerScopeForChannel,
  GROOVE_LAB_LAYER_SCOPE_META,
} from '@/app/lib/creationStation/grooveLabPianoRollLayers';
import {
  GrooveStyleTCapVolumeFader,
  GrooveStyleTCapVolumeFaderStyles,
} from '@/app/components/creation/GrooveStyleTCapVolumeFader';

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
  channelVolumes?: Record<number, number>;
  setChannelVolume?: (chId: number, volume: number) => void;
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

function vuBarHeightPct(linear: number): number {
  const v = Math.max(0, Math.min(1, linear));
  if (v <= 1e-7) return 0;
  return Math.min(100, Math.round(Math.pow(v, 0.42) * 100));
}

function meterFillGradient(levelLinear: number): string {
  const lv = Math.max(1e-6, levelLinear);
  const db = 20 * Math.log10(lv);
  if (db < 0) {
    return 'linear-gradient(to top, #00c853 0%, #00c853 100%)';
  }
  if (db < 3) {
    return 'linear-gradient(to top, #00c853 0%, #00c853 90%, #ffb020 100%)';
  }
  return 'linear-gradient(to top, #00c853 0%, #00c853 84%, #ff9f1a 94%, #ff3b3b 100%)';
}

/** Stereo VU bars — heights painted from {@link getGrooveLabChannelMeterLevel} each frame. */
function GrooveLabEmbedStereoVu({ ch, accent }: { ch: number; accent: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 3,
        height: '100%',
        flexShrink: 0,
      }}
      aria-label={`Channel ${ch} stereo meter`}
    >
      {(['L', 'R'] as const).map((side) => (
        <div
          key={side}
          style={{
            position: 'relative',
            width: 4,
            height: '100%',
            minHeight: 26,
            overflow: 'hidden',
            borderRadius: 2,
            background: 'linear-gradient(180deg, #0d0d14 0%, #07070f 100%)',
            boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 6px rgba(0,0,0,0.85)`,
          }}
        >
          <div
            data-groove-embed-meter=""
            data-ch={String(ch)}
            data-side={side}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '0%',
              background: meterFillGradient(0.5),
              boxShadow: `0 0 4px ${accent}44`,
            }}
          />
        </div>
      ))}
    </div>
  );
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
  channelVolumes,
  setChannelVolume,
  channels: channelsProp,
  embed = false,
}: GrooveLabChannelRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const embedMeterRootRef = useRef<HTMLDivElement>(null);
  const channelIds =
    channelsProp ??
    Array.from(
      { length: CHORD_BASS_SEQ_CHANNEL_COUNT },
      (_, i) => CHORD_BASS_SEQ_CHANNEL_BASE + i,
    );

  useEffect(() => {
    if (!embed) return;
    const el = scrollRef.current;
    if (!el) return;
    const lane = el.querySelector<HTMLElement>(`[data-groove-ch="${selectedChannel}"]`);
    lane?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [embed, selectedChannel]);

  useEffect(() => {
    if (!embed) return;
    let raf = 0;
    const paintMeters = () => {
      const root = embedMeterRootRef.current;
      if (root) {
        root.querySelectorAll<HTMLElement>('[data-groove-embed-meter]').forEach((el) => {
          const ch = Number(el.dataset.ch);
          const side = el.dataset.side;
          if (!Number.isFinite(ch)) return;
          const row = getGrooveLabChannelMeterLevel(ch);
          const linear = side === 'L' ? row.l : row.r;
          const pct = vuBarHeightPct(linear);
          el.style.height = `${pct}%`;
          el.style.background = meterFillGradient(Math.max(1e-6, linear));
        });
      }
      raf = requestAnimationFrame(paintMeters);
    };
    raf = requestAnimationFrame(paintMeters);
    return () => cancelAnimationFrame(raf);
  }, [embed]);

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
        const role = grooveLabChannelRoleLabel(ch, chordChannel, melodyChannel, guitarChannel);
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
                : '1px solid rgba(134, 239, 172, 0.2)',
              background: selected
                ? `linear-gradient(180deg, ${accent}18 0%, #060806 100%)`
                : 'linear-gradient(180deg, #0a120c 0%, #060806 100%)',
              cursor: 'pointer',
              boxShadow: selected ? `0 0 8px ${accent}33` : 'none',
              boxSizing: 'border-box',
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
              <span
                style={{
                  fontSize: embed ? 11 : 13,
                  fontWeight: 900,
                  color: selected ? accent : '#c8d0dc',
                  fontFamily: 'monospace',
                  lineHeight: 1.1,
                }}
              >
                {ch}
              </span>
              <span
                style={{
                  fontSize: embed ? 8 : 7,
                  fontWeight: 800,
                  color: selected ? accent : '#8a9aa4',
                  letterSpacing: 0.15,
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                {role}
              </span>
              {embed ? (
                <select
                  aria-label={`CH ${ch} layer`}
                  value={layerRole}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => onAssignLayerRole(ch, e.target.value as GrooveLabLayerRole)}
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
                  minHeight: 26,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: 6,
                  marginTop: 1,
                  marginBottom: 1,
                }}
              >
                <GrooveLabEmbedStereoVu ch={ch} accent={accent} />
                {setChannelVolume ? (
                  <GrooveStyleTCapVolumeFader
                    channelId={ch}
                    volume={channelVolumes?.[ch] ?? 80}
                    accent={accent}
                    onVolumeChange={(v) => setChannelVolume(ch, v)}
                  />
                ) : null}
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
        <GrooveStyleTCapVolumeFaderStyles />
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
        <span style={{ fontSize: 8, fontWeight: 900, color: '#6b7280', letterSpacing: 0.4 }}>
          CHANNELS
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
