'use client';

/**
 * Studio Editor 2 â€” transport + timeline patterned on **Musio Create** (open source):
 * Â· `DAWCore/Transport/TransportState.swift` ([3827cd5](https://github.com/mpatti/musio-create/commit/3827cd5c74213336d09435c28f04129c0d16d6db)) â€”
 *   Audio clock â†’ `playheadBeats` (target); `CVDisplayLink` eases `smoothPlayheadBeats` for the UI. Web: target =
 *   `beatAtTime(audioNow,â€¦)`; **display** playhead/readouts ease toward target (`DISPLAY_PLAYHEAD_LERP`) while
 *   metronome stays on `sessionStart` grid ([musio-create](https://github.com/mpatti/musio-create.git)).
 *   Web analogue: **`AudioContext.currentTime`** is the single master clock for `beatAtTime`, `sessionStart`,
 *   and metronome `start()` times (same graph as [18d423b](https://github.com/mpatti/musio-create/commit/18d423bda51a55d428d64bd08052205c72662ea1) â€œsample-accurateâ€ binding). Do **not** mix in
 *   `getOutputTimestamp`-extrapolated time for beats â€” it desyncs scheduled clicks from the playhead.
 * Â· `DAWCore/Audio/Metronome.swift` â€” click 1 kHz / 20 ms, accent 1.5 kHz / 30 ms, `exp(-t*50)` decay.
 * Â· `DAWUI/Views/Transport/TransportView.swift` â€” control strip layout (RTZ, play/pause, record, BARS,
 *   TIME, BPM Â±, SIG, loop, metronome).
 * Â· `DAWUI/Views/Timeline/TimelineView.swift` â€” `clipX = beats * pixelsPerBeat`; grid + MIDI + **playhead line**
 *   share `beatColumnLeftPx` ([18d423b](https://github.com/mpatti/musio-create/commit/18d423bda51a55d428d64bd08052205c72662ea1) timing model). Centering a wide hit box on raw `beat*ppb` then
 *   clamping at x=0 shifts beat 0 visually into the first beat â€” avoid that.
 * Â· `DAWUI/Views/PianoRoll/TrackPianoRollView.swift` â€” 60px key strip, bar ruler + grid horizontal scroll,
 *   shared vertical scroll keys+notes, velocity lane (`Vel`) synced to horizontal offset.
 * Â· `MainWindowView.swift` â€” `PlayheadView` from eased `displayBeatRef` (Musio `smoothPlayheadBeats`); audio target stays `beatAtTime`.
 * Â· [Repo](https://github.com/mpatti/musio-create) Â· [Walkthrough](https://youtu.be/qW4rIXft0Bg?si=x7uoMOWxiuT1eJln)
 *
 * Web Audio: one `ctx.currentTime` for `sessionStart`, `beatAtTime`, and scheduled clicks; lookahead
 * refills `nextMetroK` so scheduling does not depend on rAF alone.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useSettings } from '@/app/context/SettingsContext';
import { enumerateAudioDevices, type MediaDeviceOption } from '@/app/lib/audioRouting';
import { studioPreviewKeyBlipToDestination } from '@/app/lib/studioMidiBackend';
import {
  buildStudioSessionFromEditor2Tracks,
  type Editor2ArrangerTrack,
} from '@/app/lib/studio/editor2SessionAdapter';
import { audioBufferToMonophonicMidiNotes } from '@/app/lib/studio/audioToMidiNotes';
import {
  ChannelStripFxButton,
  emptyMixerFxSlots,
  type MixerEffectId,
} from '@/app/screens/components/ChannelStripFxDropdowns';
import { TimelineContextMenu } from '@/app/screens/components/TimelineContextMenu';
import {
  ChevronDown,
  Copy,
  Eraser,
  FastForward,
  Github,
  GripHorizontal,
  Mic,
  Minus,
  MousePointer2,
  Pause,
  Pencil,
  Piano,
  Play,
  Plus,
  Maximize2,
  Minimize2,
  Repeat,
  Rewind,
  SkipBack,
  SlidersHorizontal,
  Square,
  Youtube,
} from 'lucide-react';

import { PPQ } from '@/app/context/MasterClockContext';
import {
  normalizePianoSnapSubdiv,
  readPianoSnapSubdivFromStorage,
  snapLabelFromPianoSnapSubdiv,
  ticksPerPianoSnapCell,
} from '@/app/lib/sharedPianoSnapSubdiv';

const REF_MUSIO_CREATE_REPO = 'https://github.com/mpatti/musio-create';
const REF_MUSIO_CREATE_VIDEO = 'https://youtu.be/qW4rIXft0Bg?si=x7uoMOWxiuT1eJln';

const BARS = 32;
const BAR_WIDTH_PX = 60;
const TOTAL_WIDTH_PX = BAR_WIDTH_PX * BARS;
const PLAYHEAD_W_PX = 2;

/** One barâ€™s width in pixels is fixed; beats per bar sets horizontal scale (`TimelineView` / piano roll). */
function pixelsPerBeat(beatsPerBar: number): number {
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  return BAR_WIDTH_PX / bpb;
}

function totalBeatsForSig(beatsPerBar: number): number {
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  return BARS * bpb;
}

function ppbAtZoom(zoom: number, beatsPerBar: number): number {
  return pixelsPerBeat(beatsPerBar) * zoom;
}

const RULER_BAR_H_PX = 24;
const RULER_MEAS_H_PX = 28;
const RULER_TOTAL_H_PX = RULER_BAR_H_PX + RULER_MEAS_H_PX;
/** Default arrange-lane row height; user-adjustable via drag handles (see {@link MIN_TRACK_LANE_H_PX}). */
const DEFAULT_TRACK_LANE_H_PX = 80;
const MIN_TRACK_LANE_H_PX = 48;
const MAX_TRACK_LANE_H_PX = 140;
/** Cap visible / editable arrangement lanes (DAW-style; avoids unbounded canvas height). */
const MAX_STUDIO_TRACKS = 24;

/** Track names in timeline + piano toolbar (readable list). */
const TRACK_NAME_UI_CLASS =
  'text-[5px] font-semibold tracking-wide leading-tight';

/** Narrow mixer strip only — smaller than timeline so **FX** can dominate the header row. */
const TRACK_NAME_MIXER_CLASS =
  'text-[4px] font-medium tracking-tight leading-none';

/** Channel strip — room for dB column + rail corridor so arrow doesn’t sit on digits. */
const MIXER_STRIP_W_PX = 108;
/**
 * Fader rail / knob centre — far enough **right** that capsule + left arrow clear the scale band.
 * (VU meters stay a fixed sibling column — unchanged.)
 */
const MIXER_FADER_RAIL_LEFT = '78%';
/**
 * Printed scale band: pinned from the left edge and from the right so tick **hashes** end before the rail.
 * Arrow lines up with those hashes vertically; digits stay left of the corridor.
 */
const MIXER_DB_SCALE_EDGE_LEFT_PX = 6;
/** Distance from fader cell’s right edge to the scale row’s right edge — clears ~half knob + gap past rail centre. */
const MIXER_DB_SCALE_EDGE_RIGHT = 'calc(22% + 20px)';

/** Top / bottom inset inside the fader cell (rail + travel). Larger bottom = clearer −60 vs bottom mark + no knob bleed into FX row. */
const MIXER_FADER_INSET_TOP_PX = 10;
const MIXER_FADER_INSET_BOTTOM_PX = 16;
/** Sum — travel math (same role as former 2× single inset). */
const MIXER_FADER_INSET_SUM_PX = MIXER_FADER_INSET_TOP_PX + MIXER_FADER_INSET_BOTTOM_PX;
/** Capsule height — arrow triangle sits near the top; knob position aligns **arrow** to the scale line. */
const MIXER_FADER_KNOB_H_PX = 18;
/**
 * Distance from knob **bottom** up to the arrow centroid (`top:2` + half of 6px-tall triangle ≈ 5px from knob top).
 * So at unity (vol 100) the arrow sits on the printed “0” tick, not the grip mid-line.
 */
const MIXER_FADER_ARROW_REF_FROM_BOTTOM_PX = 13;

/**
 * Linear mapping vol 0…127 → `bottom` distance from fader cell base (same line as tick marks).
 * Do not round vol — rounded % was shifting unity off the “0” tick.
 */
function mixerFaderTravelBottom(vol127: number): string {
  const t = Math.max(0, Math.min(1, vol127 / 127));
  const pct = t * 100;
  return `calc(${MIXER_FADER_INSET_BOTTOM_PX}px + ${pct.toFixed(5)}% - ${(t * MIXER_FADER_INSET_SUM_PX).toFixed(5)}px)`;
}

/** Bottom edge of knob so the **arrow** sits on `mixerFaderTravelBottom` (same line as printed ticks). */
function mixerFaderKnobBottom(vol127: number): string {
  const t = Math.max(0, Math.min(1, vol127 / 127));
  const pct = t * 100;
  const ref = MIXER_FADER_ARROW_REF_FROM_BOTTOM_PX;
  return `calc(${MIXER_FADER_INSET_BOTTOM_PX - ref}px + ${pct.toFixed(5)}% - ${(t * MIXER_FADER_INSET_SUM_PX).toFixed(5)}px)`;
}

/** Level fill: from bottom inset up to the travel line (stops at rail base at vol 0). */
function mixerFaderFillHeight(vol127: number): string {
  const t = Math.max(0, Math.min(1, vol127 / 127));
  const pct = t * 100;
  return `calc(${pct.toFixed(5)}% - ${(t * MIXER_FADER_INSET_SUM_PX).toFixed(5)}px)`;
}

/** MIDI-style fader value for unity / 0 dB on the printed scale. */
const MIXER_UNITY_VOL = 100;

/**
 * Industry-style channel fader (Logic / common DAW pattern): max **+6 dB** above unity,
 * unlimited cut with **~−60 dB** at the last step before silence, **−∞** at the bottom stop.
 * `vol` 1…99 maps attenuation linearly in that display range; audio gain uses the same dB law.
 */
const MIXER_FADER_MAX_BOOST_DB = 6;
/** At `vol === 1` the readout shows **−** this many dB (typical last “numbered” step before −∞). */
const MIXER_FADER_CUT_END_DB = 60;

/**
 * Same dB curve as {@link formatMixerFaderDb}, as a number (−∞ → use for gain only via linearizer).
 */
function mixerVolToDb(vol127: number): number {
  if (vol127 <= 0) return -Infinity;
  if (vol127 < 100) {
    return -MIXER_FADER_CUT_END_DB + ((vol127 - 1) / 99) * MIXER_FADER_CUT_END_DB;
  }
  if (vol127 === 100) return 0;
  return ((vol127 - 100) / 27) * MIXER_FADER_MAX_BOOST_DB;
}

/** WebAudio gain factor — matches printed dB and master/track buses. */
function mixerVolToLinearGain(vol127: number): number {
  const db = mixerVolToDb(vol127);
  if (!Number.isFinite(db)) return 0;
  return Math.pow(10, db / 20);
}

/** DAW-style meter colors: stay green below 0 dBFS, warn only above 0 dBFS. */
function meterFillGradient(levelLinear: number, muted: boolean): string {
  if (muted) return '#1c1c28';
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

/**
 * Sparse printed ladder: +6 … −60 (lowest printed step). **No** “−∞ / -INF” tick — it sat on top of −60;
 * use the numeric readout under the strip for **−∞** at vol 0.
 */
const MIXER_FADER_DB_TICKS: { label: string; vol: number }[] = [
  { label: '+6', vol: 127 },
  { label: '+3', vol: 114 },
  { label: '0', vol: 100 },
  { label: '-6', vol: 90 },
  { label: '-12', vol: 80 },
  { label: '-18', vol: 70 },
  { label: '-24', vol: 60 },
  { label: '-36', vol: 41 },
  { label: '-48', vol: 21 },
  { label: '-60', vol: 1 },
];

/** Readout next to the fader — same law as {@link mixerVolToLinearGain} / pro channel strip. */
function formatMixerFaderDb(vol127: number): string {
  if (vol127 <= 0) return '-∞';
  if (vol127 < 100) {
    const db = -MIXER_FADER_CUT_END_DB + ((vol127 - 1) / 99) * MIXER_FADER_CUT_END_DB;
    return `${Math.round(db)}`;
  }
  if (vol127 === 100) return '0';
  const plusDb = ((vol127 - 100) / 27) * MIXER_FADER_MAX_BOOST_DB;
  const dec = Math.round(plusDb * 10) / 10;
  return `+${String(dec).replace(/\.0$/, '')}`;
}

/** Row count for timeline lane backgrounds (at least one row when project is empty). */
function timelineLaneRowCount(trackCount: number): number {
  return Math.max(1, Math.min(trackCount, MAX_STUDIO_TRACKS));
}

function arrangementHeightPx(trackCount: number, laneH: number): number {
  return RULER_TOTAL_H_PX + timelineLaneRowCount(trackCount) * laneH;
}

/** Same clamp as {@link syncTimelineGridLayer} — DOM lane rows must match canvas `laneHClamped`. */
function clampArrangeLaneHeightPx(h: number): number {
  return Math.max(MIN_TRACK_LANE_H_PX, Math.min(MAX_TRACK_LANE_H_PX, Math.round(h)));
}
/** Track list / lane name column — kept relatively thin so the mixer can use horizontal space. */
const TRACK_HEADER_W_PX = 184;
const GRID_CACHE_VERSION = 12;
/** Playhead grab width â€” Studio-style drag target (`PlayheadView` is 2px; hit area wider). */
const PLAYHEAD_GRIP_W_PX = 16;

/** `TrackPianoRollView` / `AdvancedPianoRollView` â€” piano column, ruler, velocity lane. */
/** Key strip only (not the note grid); a bit wider reads clearer next to the ruler. */
const PIANO_KEY_W_PX = 64;
const PIANO_RULER_H_PX = 24;
const PIANO_VELOCITY_LANE_H_PX = 46;
/** `AdvancedPianoRollView` default-ish row height. */
/** One horizontal band = one MIDI pitch (semitone); vertical zoom is separate from horizontal snap. */
const PIANO_NOTE_ROW_H_PX = 14;
/** `visibleOctaveRange` 2â€¦7 â†’ 72 rows; `pitchOffset` = 7*12+11 (see `AdvancedNoteView` in Musio). */
const PIANO_PITCH_HI = 95;
const PIANO_PITCH_LO = 24;
const PIANO_ROW_COUNT = PIANO_PITCH_HI - PIANO_PITCH_LO + 1;
const PIANO_GRID_H_PX = PIANO_ROW_COUNT * PIANO_NOTE_ROW_H_PX;
const PIANO_PANEL_H_MIN = 200;
const PIANO_PANEL_H_MAX = 560;
const PIANO_GRID_CACHE_VER = 6;

type MockMidiNote = { pitch: number; startBeat: number; durationBeats: number; velocity: number };

type StudioTrackKind = 'midi' | 'audio';

/** Timeline audio region — `sourceId` keys runtime `AudioBuffer` map in the editor (playlist-style clip). */
type StudioAudioClip = {
  id: string;
  sourceId: string;
  startBeat: number;
  durationBeats: number;
  name?: string;
};

type MockMusioTrack = {
  id: string;
  name: string;
  colorHex: string;
  kind: StudioTrackKind;
  notes: MockMidiNote[];
  audioClips: StudioAudioClip[];
  /**
   * Hardware mic/line input for this audio track only (`''` = follow Settings → Audio Input).
   * Wired into `getUserMedia` when the track is record-armed (same pattern as Studio One / Pro Tools input list).
   */
  audioInputDeviceId?: string;
};

const NEW_TRACK_COLOR_HEX: string[] = ['#5B8CFF', '#D4A84B', '#E85D75', '#7CF4C6', '#FFB84D', '#C77DFF', '#6EE7F9', '#F472B6'];

function newTrackId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `t-${crypto.randomUUID()}`;
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Demo MIDI lanes â€” same visual language as `MIDINotePreview` in Musio (`TimelineView.swift`). */
const MOCK_MUSIO_TRACKS: MockMusioTrack[] = [
  {
    id: 't-mock-0',
    name: 'Instrument',
    colorHex: '#5B8CFF',
    kind: 'midi',
    audioClips: [],
    notes: [
      { pitch: 60, startBeat: 4, durationBeats: 0.5, velocity: 100 },
      { pitch: 64, startBeat: 4.5, durationBeats: 0.5, velocity: 92 },
      { pitch: 67, startBeat: 5, durationBeats: 0.5, velocity: 108 },
      { pitch: 72, startBeat: 5.5, durationBeats: 1, velocity: 118 },
      { pitch: 64, startBeat: 8, durationBeats: 0.25, velocity: 80 },
      { pitch: 67, startBeat: 8.25, durationBeats: 0.25, velocity: 84 },
      { pitch: 71, startBeat: 8.5, durationBeats: 0.5, velocity: 96 },
    ],
  },
  {
    id: 't-mock-1',
    name: 'Bass',
    colorHex: '#D4A84B',
    kind: 'midi',
    audioClips: [],
    notes: [
      { pitch: 36, startBeat: 4, durationBeats: 2, velocity: 110 },
      { pitch: 40, startBeat: 8, durationBeats: 2, velocity: 105 },
      { pitch: 38, startBeat: 12, durationBeats: 2, velocity: 100 },
    ],
  },
  {
    id: 't-mock-2',
    name: 'Drums',
    colorHex: '#E85D75',
    kind: 'midi',
    audioClips: [],
    notes: [
      { pitch: 42, startBeat: 4, durationBeats: 0.25, velocity: 90 },
      { pitch: 42, startBeat: 4.5, durationBeats: 0.25, velocity: 88 },
      { pitch: 38, startBeat: 4, durationBeats: 0.25, velocity: 120 },
      { pitch: 36, startBeat: 4.25, durationBeats: 0.25, velocity: 127 },
      { pitch: 42, startBeat: 5, durationBeats: 0.25, velocity: 85 },
      { pitch: 38, startBeat: 5.25, durationBeats: 0.25, velocity: 115 },
    ],
  },
  {
    id: 't-mock-3',
    name: 'Audio 1',
    colorHex: '#C77DFF',
    kind: 'audio',
    notes: [],
    audioClips: [],
    audioInputDeviceId: '',
  },
];

function cloneMockTracks(): MockMusioTrack[] {
  return MOCK_MUSIO_TRACKS.map((t) => ({
    ...t,
    notes: t.notes.map((n) => ({ ...n })),
    audioClips: t.audioClips.map((c) => ({ ...c })),
  }));
}

/** Deep snapshot for undo / clipboard (tracks after user edits — not just mock seed). */
function snapshotStudioTracks(tracks: MockMusioTrack[]): MockMusioTrack[] {
  return tracks.map((t) => ({
    ...t,
    notes: t.notes.map((n) => ({ ...n })),
    audioClips: t.audioClips.map((c) => ({ ...c })),
  }));
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

/** Seconds of audio the metronome tries to keep scheduled ahead of `currentTime`. */
const METRO_SCHEDULE_AHEAD_SEC = 3.0;
/**
 * Minimum lead for `OscillatorNode.start` vs `currentTime`.
 * Kept at 8 ms — small enough that metronome clicks fire almost simultaneously with the
 * visual playhead crossing each beat line (Pro Tools / Logic behaviour), yet large enough
 * to survive a Windows audio render-quantum without clipping the very first beat.
 */
const AUDIO_START_FLOOR_SEC = 0.008;
/**
 * Cold start keeps using {@link AUDIO_START_FLOOR_SEC}; loop *continuations* tighten this slightly.
 * Scheduling the first wrap click at ctSnap + 8 ms on top of cancelling all nodes reads as audible dead-air.
 */
const LOOP_METRO_CHAIN_FLOOR_SEC = 0.002;
/** Tiny spacing when batching many `start()` calls in one turn (must not pull beats off the grid). */
const METRO_NODE_EPS_SEC = 1e-5;
const MAX_METRO_SCHEDULE_PER_CALL = 256;
/** `TransportState.togglePlayPause` debounce (ms). */
const TOGGLE_DEBOUNCE_MS = 180;
/** `MetronomeSettings` / `TransportState` default metronome level. */
const METRO_VOLUME = 0.7;
/** Default loop region `[start, end)` â€” configurable number of bars at current time signature. */
const LOOP_REGION_START_BEAT = 0;
function loopRegionEndBeat(beatsPerBar: number, loopBars: number): number {
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  return Math.min(totalBeatsForSig(bpb), bpb * Math.max(1, loopBars));
}
/** Keep playhead visible inside horizontal scroll (`MainWindowView` horizontal `ScrollView`). */
const TIMELINE_SCROLL_MARGIN_PX = 96;

/** Pixel-aligned beat column (same as `clipX = beats * pixelsPerBeat` in Musio `TimelineView`). */
function beatColumnLeftPx(beat: number, ppb: number): number {
  return Math.round(beat * ppb);
}

function tracksSignature(tracks: MockMusioTrack[]): string {
  try {
    return `${tracks.length}|${JSON.stringify(
      tracks.map((t) => ({
        id: t.id,
        n: t.name,
        k: t.kind,
        notes: t.notes,
        clips: t.audioClips,
        in: t.kind === 'audio' ? (t.audioInputDeviceId ?? '') : '',
      })),
    )}`;
  } catch {
    return String(tracks.length);
  }
}

/** Resolved MediaDevices `deviceId` for record / monitor (per-track override or project default). */
function effectiveAudioInputDeviceId(track: MockMusioTrack, projectDefaultDeviceId: string): string {
  if (track.kind !== 'audio') return projectDefaultDeviceId || 'default';
  const per = track.audioInputDeviceId?.trim();
  if (!per) return projectDefaultDeviceId || 'default';
  return per;
}

/** Clip length in quarter-note beats from file duration (FL / Studio One–style wall clock at project BPM). */
function audioDurationBeatsFromSeconds(durationSec: number, bpm: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 1 / 4;
  const spb = spbFromBpm(bpm);
  return Math.max(1 / 16, durationSec / spb);
}

function isDroppedAudioFile(f: File): boolean {
  const t = f.type ?? '';
  if (t.startsWith('audio/')) return true;
  return /\.(wav|mp3|ogg|aac|m4a|flac|opus|webm)$/i.test(f.name);
}

/** `subdivisionsPerBeat` — cells per quarter (1/4 … 1/128 straight + triplet 3 / 6); see `sharedPianoSnapSubdiv`. */
function snapBeatToSubdivision(b: number, subdivisionsPerBeat: number, totalBeats: number): number {
  const s = Math.max(1, Math.min(64, Math.round(subdivisionsPerBeat)));
  return Math.max(0, Math.min(totalBeats, Math.round(b * s) / s));
}

/** Duration in beats for one cell at the given snap value (same unit as startBeat). */
function oneCellDurationBeats(subdivisionsPerBeat: number): number {
  return 1 / Math.max(1, subdivisionsPerBeat);
}

/** DAW-style stepped control: button opens a fixed menu (portal) so it works inside `overflow: hidden` layouts. */
type DawMiniMenuOption = { value: number; label: string };

type DawMiniMenuProps = {
  label: string;
  displayText: string;
  value: number;
  options: DawMiniMenuOption[];
  onChange: (value: number) => void;
  disabled?: boolean;
  title?: string;
  /** Tighter padding for piano toolbar vs footer. */
  compact?: boolean;
};

function DawMiniMenu({ label, displayText, value, options, onChange, disabled, title, compact }: DawMiniMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Close on outside mousedown */
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (!open && btnRef.current && typeof window !== 'undefined') {
      /* Calculate popup position before the state update so it renders correctly on first paint */
      const r = btnRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const minW = Math.max(r.width, compact ? 80 : 96);
      let left = r.left;
      if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
      const spaceAbove = r.top - 8;
      const spaceBelow = vh - r.bottom - 8;
      const maxH = Math.min(320, Math.max(80, spaceAbove >= spaceBelow ? spaceAbove : spaceBelow));
      const style: React.CSSProperties =
        spaceAbove >= spaceBelow
          ? { position: 'fixed', bottom: vh - r.top + 2, left, minWidth: minW, maxHeight: maxH, zIndex: 30000 }
          : { position: 'fixed', top: r.bottom + 2, left, minWidth: minW, maxHeight: maxH, zIndex: 30000 };
      setMenuStyle(style);
    }
    setOpen((o) => !o);
  };

  const menuEl = open ? (
    <div
      ref={menuRef}
      role="listbox"
      aria-label={title ?? label}
      className="rounded border py-1 shadow-2xl overflow-y-auto"
      style={{
        ...menuStyle,
        borderColor: '#4a4a58',
        background: '#1e1e2a',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      {options.map((opt) => {
        const sel = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={sel}
            onClick={() => { onChange(opt.value); setOpen(false); }}
            className="block w-full text-left font-mono font-semibold transition-none"
            style={{
              padding: compact ? '6px 12px' : '8px 14px',
              fontSize: compact ? 11 : 13,
              color: sel ? '#7cf4c6' : '#d0d0de',
              background: sel ? 'rgba(124,244,198,0.14)' : 'transparent',
              borderLeft: sel ? '2px solid #7cf4c6' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div className={`flex items-center gap-1 shrink-0 select-none ${compact ? 'text-[9px]' : 'text-[10px]'}`}
         style={{ color: '#8a8a98' }}>
      <span className="font-semibold uppercase shrink-0" style={{ color: '#6a6a78' }}>{label}</span>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        title={title}
        aria-label={title ?? `${label} menu`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={openMenu}
        className={`flex items-center justify-between gap-0.5 rounded border font-mono font-bold outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-xs'
        }`}
        style={{
          borderColor: open ? '#5a5a6a' : '#3a3a46',
          background: open ? '#252530' : '#1c1c24',
          color: '#b0b0be',
          minWidth: compact ? '3.75rem' : '3.5rem',
        }}
      >
        <span className="tabular-nums">{displayText}</span>
        <ChevronDown size={compact ? 10 : 12} strokeWidth={2} className="shrink-0 opacity-70" aria-hidden
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.12s ease' }} />
      </button>
      {menuEl && typeof document !== 'undefined' ? createPortal(menuEl, document.body) : null}
    </div>
  );
}

function gridLineXCss(idx: number, zoom: number, beatsPerBar: number): number {
  return Math.round(idx * ppbAtZoom(zoom, beatsPerBar));
}

/** Exact sub-pixel horizontal position of the playhead (no rounding â€” avoids 0/1px alternating skip). */
function beatToPlayheadX(beat: number, zoom: number, beatsPerBar: number): number {
  const tb = totalBeatsForSig(beatsPerBar);
  const b = Math.max(0, Math.min(beat, tb));
  return b * ppbAtZoom(zoom, beatsPerBar);
}

function scrollTimelineToPlayhead(
  scrollEl: HTMLElement | null,
  beat: number,
  zoom: number,
  beatsPerBar: number,
): void {
  if (!scrollEl) return;
  const x = beatToPlayheadX(beat, zoom, beatsPerBar);
  const pad = TIMELINE_SCROLL_MARGIN_PX;
  const w = scrollEl.clientWidth;
  const sl = scrollEl.scrollLeft;
  if (x < sl + pad) {
    const next = Math.max(0, x - pad);
    if (Math.abs(next - sl) >= 1) scrollEl.scrollLeft = next;
  } else if (x > sl + w - pad) {
    const next = Math.max(0, x - w + pad);
    if (Math.abs(next - sl) >= 1) scrollEl.scrollLeft = next;
  }
}

function quarterIndexFromBeat(b: number, totalBeats: number): number {
  return Math.max(0, Math.min(Math.floor(b + 1e-9), totalBeats));
}

function snapBeatToQuarterGrid(b: number, totalBeats: number): number {
  return Math.max(0, Math.min(quarterIndexFromBeat(b, totalBeats), totalBeats));
}

function spbFromBpm(bpm: number): number {
  return 60 / Math.max(1, bpm);
}

function midiNoteToFreqHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** L/R metering weights from MIDI-style pan (0=left, 64=centre, 127=right); mono ⇒ equal. */
function mixerPanMeterWeights(pan127: number, mono: boolean): { wl: number; wr: number } {
  if (mono) return { wl: 1, wr: 1 };
  const p = Math.max(-1, Math.min(1, ((pan127 - 64) / 63))); // StereoPannerNode law
  const theta = ((p + 1) / 2) * (Math.PI / 2);
  return { wl: Math.cos(theta), wr: Math.sin(theta) };
}

/** Short triangle preview (Musio-style track audition) â€” same clock as transport `sessionStart` + beats. */
function playScheduledMidiNote(
  ctx: AudioContext,
  bus: GainNode,
  t0: number,
  t1: number,
  pitch: number,
  velocity01: number,
  pan127: number,
  monoTrack: boolean,
  faderVol127: number,
): void {
  const dur = Math.max(0.04, t1 - t0);
  const vGain = mixerVolToLinearGain(faderVol127);
  const peak = Math.min(0.2, (0.035 + Math.max(0, Math.min(1, velocity01)) * 0.16) * vGain);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(midiNoteToFreqHz(pitch), t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.006);
  g.gain.linearRampToValueAtTime(peak * 0.55, t0 + dur * 0.35);
  g.gain.linearRampToValueAtTime(0.0001, t1);
  osc.connect(g);
  let panner: StereoPannerNode | null = null;
  if (monoTrack) {
    /* Mono collapse: mono path to stereo bus â†’ equal L/R in the browser mixer. */
    g.connect(bus);
  } else {
    panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, (pan127 - 64) / 63)), t0);
    g.connect(panner);
    panner.connect(bus);
  }
  osc.start(t0);
  osc.stop(t1 + 0.02);
  osc.onended = () => {
    try {
      osc.disconnect();
      g.disconnect();
      panner?.disconnect();
    } catch {
      /* */
    }
  };
}

function stopScheduledPreviewBufferSources(sources: AudioBufferSourceNode[]): void {
  for (const src of sources) {
    try {
      src.stop(0);
    } catch {
      /* */
    }
    try {
      src.disconnect();
    } catch {
      /* */
    }
  }
  sources.length = 0;
}

/**
 * Schedule one segment of an arranger audio clip on the same preview bus / pan law as
 * {@link playScheduledMidiNote} (Studio One–style track → mixer path).
 */
function scheduleAudioClipOnPreviewBus(params: {
  ctx: AudioContext;
  bus: GainNode;
  buffer: AudioBuffer;
  tClipStart: number;
  tClipEnd: number;
  tScheduleFrom: number;
  pan127: number;
  monoTrack: boolean;
  faderVol127: number;
  tracking: AudioBufferSourceNode[];
}): void {
  const { ctx, bus, buffer, tClipStart, tClipEnd, tScheduleFrom, pan127, monoTrack, faderVol127, tracking } = params;
  const tPlay = Math.max(tClipStart, tScheduleFrom);
  if (tPlay >= tClipEnd - 1e-4) return;
  const offsetSec = Math.max(0, tPlay - tClipStart);
  const wallRemain = tClipEnd - tPlay;
  const bufRemain = Math.max(0, buffer.duration - offsetSec);
  const playSec = Math.max(0.02, Math.min(wallRemain, bufRemain));
  const vGain = mixerVolToLinearGain(faderVol127) * 0.42;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, tPlay);
  g.gain.linearRampToValueAtTime(vGain, tPlay + 0.004);
  g.gain.setValueAtTime(vGain, tPlay + Math.max(0.01, playSec - 0.008));
  g.gain.linearRampToValueAtTime(0.0001, tPlay + playSec);
  src.connect(g);
  let panner: StereoPannerNode | null = null;
  if (monoTrack) {
    g.connect(bus);
  } else {
    panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, (pan127 - 64) / 63)), tPlay);
    g.connect(panner);
    panner.connect(bus);
  }
  src.start(tPlay, offsetSec, playSec);
  tracking.push(src);
  src.onended = () => {
    try {
      src.disconnect();
      g.disconnect();
      panner?.disconnect();
    } catch {
      /* */
    }
    const ix = tracking.indexOf(src);
    if (ix !== -1) tracking.splice(ix, 1);
  };
}

/** Piano-strip one-shot audition through preview bus — respects pan + mono like scheduled notes. */
function previewMidiKeyThroughBus(
  ctx: AudioContext,
  outputBus: GainNode,
  pitch: number,
  velocity01: number,
  durationSec: number,
  pan127: number,
  monoTrack: boolean,
  faderLinearGain = 1,
): void {
  const now = ctx.currentTime + 0.004;
  const end = now + durationSec;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  const gn = ctx.createGain();
  const peak = Math.min(0.2, (0.05 + Math.max(0, Math.min(1, velocity01)) * 0.16) * faderLinearGain);
  osc.frequency.setValueAtTime(midiNoteToFreqHz(pitch), now);
  gn.gain.setValueAtTime(peak, now);
  gn.gain.exponentialRampToValueAtTime(0.02, end);
  osc.connect(gn);
  let panner: StereoPannerNode | null = null;
  if (!monoTrack) {
    panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, (pan127 - 64) / 63));
    gn.connect(panner);
    panner.connect(outputBus);
  } else {
    gn.connect(outputBus);
  }
  osc.start(now);
  osc.stop(end + 0.02);
  osc.onended = () => {
    try {
      osc.disconnect();
      gn.disconnect();
      panner?.disconnect();
    } catch {
      /* */
    }
  };
}

function nextMidiTrackName(tracks: MockMusioTrack[]): string {
  let maxN = 0;
  for (const t of tracks) {
    const m = /^MIDI\s+(\d+)\s*$/i.exec(t.name.trim());
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `MIDI ${maxN + 1}`;
}

function nextAudioTrackName(tracks: MockMusioTrack[]): string {
  let maxN = 0;
  for (const t of tracks) {
    const m = /^Audio\s+(\d+)\s*$/i.exec(t.name.trim());
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `Audio ${maxN + 1}`;
}

function beatAtTime(t: number, sessionStart: number, originBeat: number, bpm: number, totalBeats: number): number {
  const spb = spbFromBpm(bpm);
  const b = originBeat + Math.max(0, t - sessionStart) / spb;
  return Math.max(0, Math.min(totalBeats, b));
}

function audioNow(ctx: AudioContext): number {
  return Math.max(0, ctx.currentTime);
}

/**
 * Sub-millisecond scheduling-domain clock.
 *
 * Problem: AudioContext.currentTime advances in ~2.9 ms render quanta.
 * Reading it each 16 ms RAF frame gives the same value 5â€“6 frames â†’ visible jump.
 *
 * Solution (scheduling-domain anchor tracking):
 *   Every time ctx.currentTime advances (a new render quantum arrives), we record BOTH
 *   the new ctx.currentTime AND the performance.now() at that exact moment.
 *   Between advances, we extrapolate forward using performance.now() (sub-ms precision).
 *
 * This stays entirely in the SCHEDULING domain â€” the same domain used by sessionStartRef,
 *   originBeatRef, and all audio node scheduling calls â€” so there is no clock mismatch.
 *
 * IMPORTANT: call updateSchedAnchor(ctx, anchorTime, anchorPerf) every RAF frame BEFORE
 *   calling smoothSchedNow(anchorTime, anchorPerf).
 */
function updateSchedAnchor(
  ctx: AudioContext,
  anchorTimeRef: React.MutableRefObject<number>,
  anchorPerfRef: React.MutableRefObject<number>,
): void {
  const t = ctx.currentTime;
  if (t > anchorTimeRef.current) {
    /* ctx.currentTime just advanced â€” lock in a fresh high-res anchor. */
    anchorTimeRef.current = t;
    anchorPerfRef.current = performance.now();
  }
}

function smoothSchedNow(
  anchorTimeRef: React.MutableRefObject<number>,
  anchorPerfRef: React.MutableRefObject<number>,
  ctx: AudioContext,
): number {
  if (anchorTimeRef.current > 0) {
    return anchorTimeRef.current + (performance.now() - anchorPerfRef.current) / 1000;
  }
  return Math.max(0, ctx.currentTime);
}

type ElementWithVfc = HTMLElement & {
  requestVideoFrameCallback: (callback: VideoFrameRequestCallback) => number;
  cancelVideoFrameCallback: (handle: number) => void;
};

/** `Metronome.generateClickBuffer` â€” sine Ã— exponential decay. */
function createMusioClickBuffer(
  ctx: AudioContext,
  frequencyHz: number,
  durationSec: number,
  peakLevel: number,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.max(1, Math.floor(sr * durationSec));
  const buf = ctx.createBuffer(1, n, sr);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const envelope = Math.exp(-t * 50);
    ch[i] = Math.sin(2 * Math.PI * frequencyHz * t) * envelope * peakLevel;
  }
  return buf;
}

function formatBarsBeatsTicks(displayBeats: number, beatsPerBar: number): string {
  const bar = Math.floor(displayBeats / beatsPerBar) + 1;
  const beatInBar = Math.floor(displayBeats % beatsPerBar) + 1;
  const tick = Math.floor((displayBeats % 1) * 100);
  return `${bar}.${beatInBar}.${String(tick).padStart(2, '0')}`;
}

/** `TransportView` timeDisplay â€” MM:SS:centiseconds */
function formatTimeMmSsFf(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const f = Math.floor((totalSeconds % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

/** `Color(hex:)` + `velocityAdjustedColor` in `TimelineView.swift` / `MIDINotePreview`. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbaNoteFill(colorHex: string, velocity: number): string {
  const rgb = hexToRgb(colorHex);
  const intensity = Math.max(0, Math.min(1, velocity / 127));
  const a = 0.6 + intensity * 0.4;
  if (!rgb) return `rgba(91, 140, 255, ${a})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

function paddedPitchRange(notes: MockMidiNote[]): { min: number; max: number } {
  if (notes.length === 0) return { min: 60, max: 72 };
  let minP = 127;
  let maxP = 0;
  for (const n of notes) {
    minP = Math.min(minP, n.pitch);
    maxP = Math.max(maxP, n.pitch);
  }
  const pad = 2;
  return {
    min: Math.max(0, minP - pad),
    max: Math.min(127, maxP + pad),
  };
}

function drawAudioLaneClips(
  og: CanvasRenderingContext2D,
  track: MockMusioTrack,
  laneTop: number,
  laneH: number,
  ppb: number,
): void {
  if (track.kind !== 'audio') return;
  const clips = track.audioClips;
  if (clips.length === 0) {
    const yMid = laneTop + laneH * 0.5;
    og.fillStyle = 'rgba(255,255,255,0.06)';
    og.font = '600 9px ui-sans-serif, system-ui, sans-serif';
    og.textAlign = 'left';
    og.textBaseline = 'middle';
    og.fillText('Drop audio here → clip + MIDI track (mono pitch)', 8, yMid);
    return;
  }
  const innerTop = laneTop + 3;
  const innerH = Math.max(4, laneH - 6);
  const rgb = hexToRgb(track.colorHex);
  const baseR = rgb?.r ?? 199;
  const baseG = rgb?.g ?? 125;
  const baseB = rgb?.b ?? 255;
  for (const c of clips) {
    const x0 = beatColumnLeftPx(c.startBeat, ppb);
    const x1 = beatColumnLeftPx(c.startBeat + c.durationBeats, ppb);
    const wClip = Math.max(3, x1 - x0);
    const x = x0;
    og.fillStyle = `rgba(${baseR},${baseG},${baseB},0.38)`;
    const r = 2;
    if (typeof og.roundRect === 'function') {
      og.beginPath();
      og.roundRect(x, innerTop, wClip, innerH, r);
      og.fill();
    } else {
      og.fillRect(x, innerTop, wClip, innerH);
    }
    og.strokeStyle = `rgba(${baseR},${baseG},${baseB},0.72)`;
    og.lineWidth = 1;
    if (typeof og.roundRect === 'function') {
      og.beginPath();
      og.roundRect(x + 0.5, innerTop + 0.5, Math.max(0, wClip - 1), Math.max(0, innerH - 1), r);
      og.stroke();
    } else {
      og.strokeRect(x + 0.5, innerTop + 0.5, wClip - 1, innerH - 1);
    }
    const label = (c.name ?? 'Audio').slice(0, 24);
    if (wClip > 36) {
      og.fillStyle = 'rgba(255,255,255,0.85)';
      og.font = '600 8px ui-sans-serif, system-ui, sans-serif';
      og.textAlign = 'left';
      og.textBaseline = 'middle';
      og.fillText(label, x + 4, innerTop + innerH * 0.5);
    }
  }
}

function drawMusioMidiLane(
  og: CanvasRenderingContext2D,
  track: MockMusioTrack,
  laneTop: number,
  laneH: number,
  ppb: number,
): void {
  if (track.kind !== 'midi') return;
  const notes = track.notes;
  if (notes.length === 0) return;
  const { min: lo, max: hi } = paddedPitchRange(notes);
  const rangeSpan = Math.max(1, hi - lo + 1);
  const innerH = laneH - 4;
  const noteH = Math.max(2, innerH / rangeSpan - 1);

  for (const ev of notes) {
    const x0 = beatColumnLeftPx(ev.startBeat, ppb);
    const x1 = beatColumnLeftPx(ev.startBeat + ev.durationBeats, ppb);
    const wNote = Math.max(2, x1 - x0);
    const x = x0;
    const yn = ((hi - ev.pitch) / rangeSpan) * innerH;
    const y = laneTop + 2 + yn;
    og.fillStyle = rgbaNoteFill(track.colorHex, ev.velocity);
    const r = 1;
    if (typeof og.roundRect === 'function') {
      og.beginPath();
      og.roundRect(x, y, wNote, noteH, r);
      og.fill();
    } else {
      og.fillRect(x, y, wNote, noteH);
    }
  }
}

/** Folded lane geometry must match {@link drawMusioMidiLane} / hit-testing. */
function timelineLaneNoteRectPx(
  track: MockMusioTrack,
  ev: MockMidiNote,
  laneTop: number,
  laneH: number,
  ppb: number,
): { x: number; y: number; w: number; h: number; r: number } {
  if (track.kind !== 'midi') return { x: 0, y: 0, w: 0, h: 0, r: 0 };
  const notes = track.notes;
  const { min: lo, max: hi } = paddedPitchRange(notes);
  const rangeSpan = Math.max(1, hi - lo + 1);
  const innerH = laneH - 4;
  const noteH = Math.max(2, innerH / rangeSpan - 1);
  const x0 = beatColumnLeftPx(ev.startBeat, ppb);
  const x1 = beatColumnLeftPx(ev.startBeat + ev.durationBeats, ppb);
  const wNote = Math.max(2, x1 - x0);
  const yn = ((hi - ev.pitch) / rangeSpan) * innerH;
  const x = x0;
  const y = laneTop + 2 + yn;
  return { x, y, w: wNote, h: noteH, r: 1 };
}

function strokeTimelineLaneSelectedNote(
  g: CanvasRenderingContext2D,
  track: MockMusioTrack,
  noteIndex: number,
  laneTop: number,
  laneH: number,
  ppb: number,
): void {
  if (track.kind !== 'midi') return;
  const ev = track.notes[noteIndex];
  if (!ev) return;
  const { x, y, w, h, r } = timelineLaneNoteRectPx(track, ev, laneTop, laneH, ppb);
  g.save();
  g.shadowColor = 'rgba(124,244,198,0.55)';
  g.shadowBlur = 6;
  g.strokeStyle = '#7cf4c6';
  g.lineWidth = 2;
  if (typeof g.roundRect === 'function') {
    g.beginPath();
    g.roundRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), r);
    g.stroke();
  } else {
    g.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  }
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 1;
  g.shadowBlur = 0;
  if (typeof g.roundRect === 'function') {
    g.beginPath();
    g.roundRect(x + 1, y + 1, Math.max(0, w - 3), Math.max(0, h - 3), Math.max(0, r - 0.5));
    g.stroke();
  }
  g.restore();
}

function syncTimelineGridLayer(
  canvas: HTMLCanvasElement | null,
  gridCacheRef: { current: HTMLCanvasElement | null },
  zoom: number,
  tracks: MockMusioTrack[],
  beatsPerBar: number,
  laneH: number,
  selectedTrackIndex: number,
  selectedNoteIndex: number | null,
): void {
  if (!canvas) return;
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const w = TOTAL_WIDTH_PX * zoom;
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const totalBeats = totalBeatsForSig(bpb);
  const ppb = ppbAtZoom(zoom, bpb);
  const barW = BAR_WIDTH_PX * zoom;
  const laneRows = timelineLaneRowCount(tracks.length);
  const laneHClamped = Math.max(MIN_TRACK_LANE_H_PX, Math.min(MAX_TRACK_LANE_H_PX, Math.round(laneH)));
  const h = RULER_TOTAL_H_PX + laneRows * laneHClamped;
  const bw = Math.max(1, Math.round(w * dpr));
  const bh = Math.max(1, Math.round(h * dpr));

  const tracksSig = `${tracksSignature(tracks)}|bpb:${bpb}`;
  let off = gridCacheRef.current;
  const offVer = off && '__gridVer' in off ? (off as HTMLCanvasElement & { __gridVer: number }).__gridVer : -1;
  const offZoom = off && '__zoom' in off ? (off as HTMLCanvasElement & { __zoom: number }).__zoom : -1;
  const prevSig = off && '__tracksSig' in off ? (off as HTMLCanvasElement & { __tracksSig: string }).__tracksSig : '';
  let didRebuild = false;
  if (
    !off ||
    off.width !== bw ||
    off.height !== bh ||
    offVer !== GRID_CACHE_VERSION ||
    offZoom !== zoom ||
    prevSig !== tracksSig
  ) {
    didRebuild = true;
    off = document.createElement('canvas');
    (off as HTMLCanvasElement & { __gridVer: number }).__gridVer = GRID_CACHE_VERSION;
    (off as HTMLCanvasElement & { __zoom: number }).__zoom = zoom;
    (off as HTMLCanvasElement & { __tracksSig: string }).__tracksSig = tracksSig;
    off.width = bw;
    off.height = bh;
    gridCacheRef.current = off;
    const og = off.getContext('2d');
    if (!og) return;
    og.imageSmoothingEnabled = false;
    og.setTransform(dpr, 0, 0, dpr, 0, 0);
    og.fillStyle = '#0a0a10';
    og.fillRect(0, 0, w, h);

    for (let t = 0; t < laneRows; t++) {
      const y0 = RULER_TOTAL_H_PX + t * laneHClamped;
      og.fillStyle = t % 2 === 0 ? '#0e0e16' : '#0a0a12';
      og.fillRect(0, y0, w, laneHClamped);
    }

    /*
     * Pixel-snapped separators aligned to DOM row *bottom* edges.
     * Left track boxes use an inset bottom hairline, which lands on the previous row's last pixel.
     * So each boundary after lane 0 must be drawn at (boundaryY - 1) in the canvas.
     */
    og.fillStyle = 'rgba(255,255,255,0.14)';
    for (let i = 1; i <= laneRows; i++) {
      const y = Math.round(RULER_TOTAL_H_PX + i * laneHClamped - 1);
      og.fillRect(0, y, w, 1);
    }

    for (let beat = 0; beat <= totalBeats; beat++) {
      const gx = beatColumnLeftPx(beat, ppb);
      const isBar = beat % bpb === 0;
      og.fillStyle = isBar ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)';
      og.fillRect(gx, RULER_TOTAL_H_PX, 1, h - RULER_TOTAL_H_PX);
    }

    if (zoom >= 2) {
      for (let q = 0; q < totalBeats; q++) {
        for (let s = 1; s <= 3; s++) {
          const gx = beatColumnLeftPx(q + s / 4, ppb);
          if (gx <= 0 || gx >= w) continue;
          og.fillStyle = 'rgba(255,255,255,0.05)';
          og.fillRect(gx, RULER_TOTAL_H_PX, 1, h - RULER_TOTAL_H_PX);
        }
      }
    }

    const rulerGrad = og.createLinearGradient(0, 0, 0, RULER_TOTAL_H_PX);
    rulerGrad.addColorStop(0, '#1c1c26');
    rulerGrad.addColorStop(1, '#12121a');
    og.fillStyle = rulerGrad;
    og.fillRect(0, 0, w, RULER_TOTAL_H_PX);
    og.textAlign = 'left';
    og.textBaseline = 'middle';
    og.fillStyle = '#c4c4d0';
    og.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    for (let barIdx = 0; barIdx < BARS; barIdx++) {
      og.fillText(String(barIdx + 1), beatColumnLeftPx(barIdx * bpb, ppb) + 4, RULER_BAR_H_PX / 2);
    }
    og.textAlign = 'center';
    og.font = 'bold 8px ui-monospace, SFMono-Regular, Menlo, monospace';
    og.fillStyle = '#8e8e9e';
    for (let q = 0; q < totalBeats; q++) {
      const label = String((q % bpb) + 1);
      /* Keep beat numbers directly over the corresponding beat grid lines. */
      og.fillText(label, beatColumnLeftPx(q, ppb), RULER_BAR_H_PX + RULER_MEAS_H_PX / 2);
    }
    og.fillStyle = 'rgba(255,255,255,0.12)';
    og.fillRect(0, Math.round(RULER_BAR_H_PX), w, 1);

    const nLanes = Math.min(tracks.length, laneRows);
    for (let ti = 0; ti < nLanes; ti++) {
      const laneTop = RULER_TOTAL_H_PX + ti * laneHClamped;
      const tr = tracks[ti]!;
      if (tr.kind === 'audio') drawAudioLaneClips(og, tr, laneTop, laneHClamped, ppb);
      else drawMusioMidiLane(og, tr, laneTop, laneHClamped, ppb);
    }
  }

  const g = canvas.getContext('2d');
  if (!g) return;
  g.imageSmoothingEnabled = false;
  const hadResize = canvas.width !== bw || canvas.height !== bh;
  if (hadResize) {
    canvas.width = bw;
    canvas.height = bh;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  off = gridCacheRef.current;
  if (!off) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.drawImage(off, 0, 0, w, h);
  if (
    selectedNoteIndex !== null &&
    tracks.length > 0 &&
    selectedTrackIndex >= 0 &&
    selectedTrackIndex < tracks.length
  ) {
    const trSel = tracks[selectedTrackIndex]!;
    if (
      trSel.kind === 'midi' &&
      selectedNoteIndex >= 0 &&
      selectedNoteIndex < trSel.notes.length
    ) {
      const laneTop = RULER_TOTAL_H_PX + selectedTrackIndex * laneHClamped;
      strokeTimelineLaneSelectedNote(g, trSel, selectedNoteIndex, laneTop, laneHClamped, ppb);
    }
  }
}

function positionTimelinePlayheadGroup(
  el: HTMLElement | null,
  innerEl: HTMLElement | null,
  beat: number,
  zoom: number,
  beatsPerBar: number,
): void {
  if (!el) return;
  const stripW = TOTAL_WIDTH_PX * zoom;
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const tb = totalBeatsForSig(bpb);
  const ppb = ppbAtZoom(zoom, bpb);
  const bClamped = Math.max(0, Math.min(beat, tb));
  /* Exact sub-pixel â€” no Math.round. translate3d is composited by GPU without layout. */
  const lineCenter = bClamped * ppb;
  const gw = PLAYHEAD_GRIP_W_PX;
  const pw = PLAYHEAD_W_PX;
  /*
   * Use the UNCLAMPED position so CSS matches the WAAPI from-keyframe exactly.
   * Clamping to 0 at the left edge created an 8-px gap between the CSS-set position
   * and the WAAPI "from" keyframe (-gw/2), causing a visible jump when Play is pressed.
   */
  el.style.transform = `translate3d(${lineCenter - gw / 2}px,0,0)`;
  /* Only update inner position when clamped at edge â€” avoids layout on every frame. */
  if (innerEl) innerEl.style.transform = 'translateX(0px)';
}

function positionPianoPlayhead(el: HTMLElement | null, beat: number, zoom: number, beatsPerBar: number): void {
  if (!el) return;
  const stripW = TOTAL_WIDTH_PX * zoom;
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const tb = totalBeatsForSig(bpb);
  const ppb = ppbAtZoom(zoom, bpb);
  const bClamped = Math.max(0, Math.min(beat, tb));
  /* Sub-pixel exact â€” same fix as timeline playhead. */
  const lineCenter = bClamped * ppb;
  const pw = PLAYHEAD_W_PX;
  // Unclamped: matches WAAPI from-keyframe (x0 = -pw/2) so no jump at Play
  el.style.transform = `translate3d(${bClamped * ppb - pw / 2}px,0,0)`;
}

function isBlackKeyPitch(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes(pitch % 12);
}

const WHITE_KEY_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

function whiteKeyLabel(pitch: number): string {
  const pc = pitch % 12;
  const idx = WHITE_SEMITONES.indexOf(pc);
  if (idx < 0) return '';
  const octave = Math.floor(pitch / 12) - 1;
  return `${WHITE_KEY_NAMES[idx]}${octave}`;
}

/** Hit-test Y in window coords against the key column top â†’ MIDI pitch (continuous strip, no per-row gaps). */
function pitchFromKeyStripClientY(stripTopClient: number, clientY: number): number | null {
  const y = clientY - stripTopClient;
  if (!Number.isFinite(y) || y < 0 || y >= PIANO_GRID_H_PX) return null;
  const row = Math.floor(y / PIANO_NOTE_ROW_H_PX);
  if (row < 0 || row >= PIANO_ROW_COUNT) return null;
  return PIANO_PITCH_HI - row;
}

/**
 * Vertical position in logical key-strip pixels `[0 … PIANO_GRID_H)`. Scales DOM height → grid so fractional
 * layout / DPI never drops whole keys at top or bottom (common cause of „sound but no key press”).
 */
function keyStripLogicalYFromClient(el: HTMLElement, clientY: number): number | null {
  const r = el.getBoundingClientRect();
  const h = r.height;
  const rawY = clientY - r.top;
  if (!Number.isFinite(rawY) || !Number.isFinite(h) || h < 4) return null;
  if (rawY < -10 || rawY > h + 10) return null;
  const t = rawY <= 0 ? 0 : rawY >= h ? 1 : rawY / h;
  return t * (PIANO_GRID_H_PX - 1e-6);
}

/** Row index → pitch (top of strip = HI). Always clamped to visible range. */
function pitchFromLogicalKeyStripY(yLogical: number): number {
  let row = Math.floor(yLogical / PIANO_NOTE_ROW_H_PX);
  row = Math.max(0, Math.min(PIANO_ROW_COUNT - 1, row));
  return Math.max(PIANO_PITCH_LO, Math.min(PIANO_PITCH_HI, PIANO_PITCH_HI - row));
}

function pitchFromKeyStripElement(el: HTMLElement | null, clientY: number): number | null {
  if (!el) return null;
  const yLogical = keyStripLogicalYFromClient(el, clientY);
  if (yLogical === null) return null;
  return pitchFromLogicalKeyStripY(yLogical);
}

/** Where within the activated key-row the strike landed (bottom = harder). */
function velocity01FromKeyStripStrike(el: HTMLElement, clientY: number, pitch: number): number {
  const yLogical = keyStripLogicalYFromClient(el, clientY);
  if (yLogical === null) return 0.78;
  const rowTop = (PIANO_PITCH_HI - pitch) * PIANO_NOTE_ROW_H_PX;
  const towardFront = (yLogical - rowTop) / PIANO_NOTE_ROW_H_PX;
  const t = Math.max(0, Math.min(1, towardFront));
  return Math.max(0.28, Math.min(1, 0.54 + t * 0.43));
}

function pitchRowY0(pitch: number): number {
  return (PIANO_PITCH_HI - pitch) * PIANO_NOTE_ROW_H_PX + 1;
}

function hitPianoNoteIndex(notes: MockMidiNote[], xCss: number, yCss: number, ppb: number): number {
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i];
    const x0 = beatColumnLeftPx(n.startBeat, ppb);
    const x1 = Math.max(x0 + 3, beatColumnLeftPx(n.startBeat + n.durationBeats, ppb));
    const y0 = pitchRowY0(n.pitch);
    const nh = PIANO_NOTE_ROW_H_PX - 2;
    if (xCss >= x0 && xCss < x1 && yCss >= y0 && yCss < y0 + nh) return i;
  }
  return -1;
}

/** Timeline lane MIDI rectangles use the same folded pitch-range layout as {@link drawMusioMidiLane}. */
function hitTimelineMidiNoteIndex(
  track: MockMusioTrack,
  xCss: number,
  yLaneLocal: number,
  ppb: number,
  laneH: number,
): number {
  if (track.kind !== 'midi') return -1;
  const notes = track.notes;
  if (notes.length === 0) return -1;
  const { min: lo, max: hi } = paddedPitchRange(notes);
  const rangeSpan = Math.max(1, hi - lo + 1);
  const innerH = laneH - 4;
  const noteH = Math.max(2, innerH / rangeSpan - 1);
  for (let i = notes.length - 1; i >= 0; i--) {
    const ev = notes[i]!;
    const x0 = beatColumnLeftPx(ev.startBeat, ppb);
    const x1 = beatColumnLeftPx(ev.startBeat + ev.durationBeats, ppb);
    const wNote = Math.max(2, x1 - x0);
    const yn = ((hi - ev.pitch) / rangeSpan) * innerH;
    const yNote = 2 + yn;
    if (xCss >= x0 && xCss < x0 + wNote && yLaneLocal >= yNote && yLaneLocal < yNote + noteH) return i;
  }
  return -1;
}

/** Inverse of folded-lane Y mapping in {@link drawMusioMidiLane}. */
function pitchFromTimelineLaneY(track: MockMusioTrack, yLaneLocal: number, laneH: number): number {
  if (track.kind !== 'midi') return 60;
  const { min: lo, max: hi } = paddedPitchRange(track.notes);
  const rangeSpan = Math.max(1, hi - lo + 1);
  const innerH = laneH - 4;
  const t = (yLaneLocal - 2) / innerH;
  const clampedT = Math.max(0, Math.min(1, t));
  const pFloat = hi - clampedT * rangeSpan;
  return Math.max(PIANO_PITCH_LO, Math.min(PIANO_PITCH_HI, Math.round(pFloat)));
}

function timelineLanePointFromStripClient(
  strip: HTMLDivElement,
  clientX: number,
  clientY: number,
  trackCount: number,
  laneH: number,
): { ti: number; yLaneLocal: number; xCss: number } | null {
  const rect = strip.getBoundingClientRect();
  const yRel = clientY - rect.top - RULER_TOTAL_H_PX;
  if (!Number.isFinite(yRel) || yRel < 0) return null;
  const ti = Math.floor(yRel / laneH);
  if (ti < 0 || ti >= trackCount) return null;
  return {
    ti,
    yLaneLocal: yRel - ti * laneH,
    xCss: clientX - rect.left,
  };
}

function hitTimelineMidiNoteDragMode(
  track: MockMusioTrack,
  xCss: number,
  yLaneLocal: number,
  ppb: number,
  laneH: number,
): { index: number; mode: 'move' | 'resize-left' | 'resize-right' } | null {
  const ix = hitTimelineMidiNoteIndex(track, xCss, yLaneLocal, ppb, laneH);
  if (ix < 0) return null;
  const n = track.notes[ix];
  if (!n) return null;
  const x0 = beatColumnLeftPx(n.startBeat, ppb);
  const x1 = beatColumnLeftPx(n.startBeat + n.durationBeats, ppb);
  const xR = Math.max(x0 + 3, x1);
  const edge = PIANO_NOTE_RESIZE_EDGE_PX;
  const ld = xCss - x0;
  const rd = xR - xCss;
  if (ld <= edge && rd <= edge) {
    return ld < rd ? { index: ix, mode: 'resize-left' } : { index: ix, mode: 'resize-right' };
  }
  if (ld <= edge) return { index: ix, mode: 'resize-left' };
  if (rd <= edge) return { index: ix, mode: 'resize-right' };
  return { index: ix, mode: 'move' };
}

/** X in strip coordinates (matches `beatColumnLeftPx` / canvas); use **horizontal scroll host** rect + scrollLeft. */
function pianoGridStripXFromClient(clientX: number, hScrollEl: HTMLElement | null): number {
  if (!hScrollEl) return 0;
  const r = hScrollEl.getBoundingClientRect();
  return clientX - r.left + hScrollEl.scrollLeft;
}

function pianoGridYFromClient(clientY: number, gridEl: HTMLElement): number {
  return clientY - gridEl.getBoundingClientRect().top;
}

/** Matches `syncPianoVelocityCanvas` lane geometry — bars grow up from the lane floor under the divider. */
function pianoVelocityLaneMetrics(laneH: number): { velBottom: number; velSpan: number } {
  const PAD_TOP = 4;
  /* Bottom-aligned to lane floor (removed old 4px float so bars aren’t visibly lifted). */
  const velBottom = laneH;
  const velSpan = Math.max(10, laneH - PAD_TOP);
  return { velBottom, velSpan };
}

function hitVelocityNoteIndex(notes: MockMidiNote[], xCss: number, yCss: number, ppb: number, laneH: number): number {
  const { velBottom, velSpan } = pianoVelocityLaneMetrics(laneH);
  for (let i = notes.length - 1; i >= 0; i--) {
    const ev = notes[i];
    const x0 = beatColumnLeftPx(ev.startBeat, ppb);
    const x1 = beatColumnLeftPx(ev.startBeat + ev.durationBeats, ppb);
    const barW = Math.max(2, x1 - x0);
    if (xCss < x0 || xCss >= x0 + barW) continue;
    const vh = (ev.velocity / 127) * velSpan;
    const y0 = velBottom - vh;
    if (yCss >= y0 - 2 && yCss <= velBottom + 2) return i;
  }
  return -1;
}

function velocityFromLaneY(yCss: number, laneH: number): number {
  const { velBottom, velSpan } = pianoVelocityLaneMetrics(laneH);
  const fromBottom = velBottom - yCss;
  const v = Math.round((fromBottom / velSpan) * 127);
  return Math.max(1, Math.min(127, v));
}

const PIANO_NOTE_RESIZE_EDGE_PX = 6;
const PIANO_MIN_NOTE_DURATION_BEATS = 1 / 16;

type PianoRollTool = 'select' | 'pencil' | 'erase';

function syncPianoRollCanvas(
  canvas: HTMLCanvasElement | null,
  cacheRef: { current: HTMLCanvasElement | null },
  track: MockMusioTrack,
  zoom: number,
  selectedNoteIndex: number | null,
  beatsPerBar: number,
  snapSubdivisions: number,
  selectedNoteIndexes?: ReadonlySet<number>,
  ghostNotes?: MockMidiNote[],
  showScaleGuides = false,
  scaleRootPitch = 0,
): void {
  if (!canvas) return;
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const w = TOTAL_WIDTH_PX * zoom;
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const totalBeats = totalBeatsForSig(bpb);
  const ppb = ppbAtZoom(zoom, bpb);
  const h = PIANO_GRID_H_PX;
  const bw = Math.max(1, Math.round(w * dpr));
  const bh = Math.max(1, Math.round(h * dpr));
  const snapDiv = Math.max(1, Math.min(64, Math.round(snapSubdivisions)));

  let off = cacheRef.current;
  const ver = off && '__pVer' in off ? (off as HTMLCanvasElement & { __pVer: number }).__pVer : -1;
  const selSig = selectedNoteIndexes ? [...selectedNoteIndexes].sort((a, b) => a - b).join(',') : '';
  const ghostSig = ghostNotes?.length ?? 0;
  const key = `${zoom}|${bpb}|${snapDiv}|${track.id}|${track.name}|${track.colorHex}|${tracksSignature([track])}|s:${selectedNoteIndex ?? 'n'}|ss:${selSig}|g:${ghostSig}|sg:${showScaleGuides ? 1 : 0}|r:${scaleRootPitch}`;
  const prevKey = off && '__pKey' in off ? (off as HTMLCanvasElement & { __pKey: string }).__pKey : '';
  let didRebuild = false;
  if (!off || off.width !== bw || off.height !== bh || ver !== PIANO_GRID_CACHE_VER || prevKey !== key) {
    didRebuild = true;
    off = document.createElement('canvas');
    (off as HTMLCanvasElement & { __pVer: number }).__pVer = PIANO_GRID_CACHE_VER;
    (off as HTMLCanvasElement & { __pKey: string }).__pKey = key;
    off.width = bw;
    off.height = bh;
    cacheRef.current = off;
    const og = off.getContext('2d');
    if (!og) return;
    og.imageSmoothingEnabled = false;
    og.setTransform(dpr, 0, 0, dpr, 0, 0);
    og.fillStyle = '#0a0a0f';
    og.fillRect(0, 0, w, h);

    for (let p = PIANO_PITCH_HI; p >= PIANO_PITCH_LO; p--) {
      const y = pitchRowY0(p) - 1;
      const isB = isBlackKeyPitch(p);
      og.fillStyle = isB ? '#0c0c14' : '#101018';
      og.fillRect(0, y, w, PIANO_NOTE_ROW_H_PX);
      if (showScaleGuides) {
        const pc = ((p % 12) + 12) % 12;
        const rootPc = ((scaleRootPitch % 12) + 12) % 12;
        if (pc === rootPc) {
          og.fillStyle = 'rgba(124,244,198,0.08)';
          og.fillRect(0, y, w, PIANO_NOTE_ROW_H_PX);
        } else if ([0, 2, 4, 5, 7, 9, 11].includes((pc - rootPc + 12) % 12)) {
          og.fillStyle = 'rgba(124,244,198,0.035)';
          og.fillRect(0, y, w, PIANO_NOTE_ROW_H_PX);
        }
      }
      og.strokeStyle = 'rgba(255,255,255,0.12)';
      og.lineWidth = 1;
      og.beginPath();
      og.moveTo(0, y + PIANO_NOTE_ROW_H_PX - 0.5);
      og.lineTo(w, y + PIANO_NOTE_ROW_H_PX - 0.5);
      og.stroke();
    }

    // Draw snap-subdivision grid lines so every quantize position is visible.
    // Bar lines (brightest) â†’ beat lines â†’ snap sub-beat lines â†’ finer lines (dimmer).
    if (snapDiv > 1) {
      // Draw snap subdivision lines first (faintest), behind beat lines.
      const cellBeats = 1 / snapDiv;
      const totalCells = Math.ceil(totalBeats * snapDiv);
      for (let ci = 0; ci <= totalCells; ci++) {
        const beatPos = ci * cellBeats;
        if (beatPos % 1 < 1e-9 || Math.abs(beatPos % 1 - 1) < 1e-9) continue; // skip exact beats
        const gx = beatColumnLeftPx(beatPos, ppb);
        if (gx <= 0 || gx >= w) continue;
        og.fillStyle = 'rgba(255,255,255,0.07)';
        og.fillRect(gx, 0, 1, h);
      }
    }

    // Beat lines (quarter-note columns)
    for (let beat = 0; beat <= totalBeats; beat++) {
      const gx = beatColumnLeftPx(beat, ppb);
      const isBar = beat % bpb === 0;
      og.fillStyle = isBar ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.12)';
      og.fillRect(gx, 0, 1, h);
    }

    (ghostNotes ?? []).forEach((ev) => {
      const x0 = beatColumnLeftPx(ev.startBeat, ppb);
      const x1 = beatColumnLeftPx(ev.startBeat + ev.durationBeats, ppb);
      const wNote = Math.max(2, x1 - x0);
      const y = pitchRowY0(ev.pitch);
      const nh = Math.max(2, PIANO_NOTE_ROW_H_PX - 2);
      og.fillStyle = 'rgba(135,135,165,0.2)';
      if (typeof og.roundRect === 'function') {
        og.beginPath();
        og.roundRect(x0, y, wNote, nh, 1.5);
        og.fill();
      } else {
        og.fillRect(x0, y, wNote, nh);
      }
    });

    track.notes.forEach((ev, ni) => {
      const x0 = beatColumnLeftPx(ev.startBeat, ppb);
      const x1 = beatColumnLeftPx(ev.startBeat + ev.durationBeats, ppb);
      const wNote = Math.max(3, x1 - x0);
      const x = x0;
      const y = pitchRowY0(ev.pitch);
      const nh = Math.max(2, PIANO_NOTE_ROW_H_PX - 2);
      og.fillStyle = rgbaNoteFill(track.colorHex, ev.velocity);
      const r = 2;
      if (typeof og.roundRect === 'function') {
        og.beginPath();
        og.roundRect(x, y, wNote, nh, r);
        og.fill();
      } else {
        og.fillRect(x, y, wNote, nh);
      }
      og.fillStyle = '#ffffff';
      og.globalAlpha = 0.08 + (ev.velocity / 127) * 0.22;
      if (typeof og.roundRect === 'function') {
        og.beginPath();
        og.roundRect(x, y, wNote, nh, r);
        og.fill();
      } else {
        og.fillRect(x, y, wNote, nh);
      }
      og.globalAlpha = 1;
      if ((selectedNoteIndexes?.has(ni) ?? false) || selectedNoteIndex === ni) {
        const selR = typeof og.roundRect === 'function' ? r + 0.5 : r;
        og.fillStyle = 'rgba(124,244,198,0.22)';
        if (typeof og.roundRect === 'function') {
          og.beginPath();
          og.roundRect(x - 0.5, y - 0.5, wNote + 1, nh + 1, selR);
          og.fill();
        } else {
          og.fillRect(x - 0.5, y - 0.5, wNote + 1, nh + 1);
        }
        og.shadowColor = 'rgba(124,244,198,0.45)';
        og.shadowBlur = 8;
        og.strokeStyle = '#7cf4c6';
        og.lineWidth = 2;
        if (typeof og.roundRect === 'function') {
          og.beginPath();
          og.roundRect(x + 0.5, y + 0.5, wNote - 1, nh - 1, r);
          og.stroke();
        } else {
          og.strokeRect(x + 0.5, y + 0.5, wNote - 1, nh - 1);
        }
        og.shadowBlur = 0;
        og.strokeStyle = 'rgba(255,255,255,0.9)';
        og.lineWidth = 1;
        if (typeof og.roundRect === 'function') {
          og.beginPath();
          og.roundRect(x + 1.5, y + 1.5, Math.max(0, wNote - 3), Math.max(0, nh - 3), Math.max(0.5, r - 0.5));
          og.stroke();
        }
      }
    });
  }

  const g = canvas.getContext('2d');
  if (!g) return;
  g.imageSmoothingEnabled = false;
  const hadResize = canvas.width !== bw || canvas.height !== bh;
  if (hadResize) {
    canvas.width = bw;
    canvas.height = bh;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  off = cacheRef.current;
  if (!off) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (hadResize || didRebuild) {
    g.drawImage(off, 0, 0, w, h);
  }
}

/**
 * Velocity lane grid â€” same beat columns as the note grid (`beatColumnLeftPx`), Studio-style:
 * snap-subdivision lines, beat lines, bar lines, then horizontal velocity guides.
 */
function drawPianoVelocityLaneGrid(
  og: CanvasRenderingContext2D,
  w: number,
  laneH: number,
  ppb: number,
  zoom: number,
  totalBeats: number,
  beatsPerBar: number,
  snapSubdivisions: number,
): void {
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const snapDiv = Math.max(1, Math.min(64, Math.round(snapSubdivisions)));
  if (snapDiv > 1) {
    const cellBeats = 1 / snapDiv;
    const totalCells = Math.ceil(totalBeats * snapDiv);
    for (let ci = 0; ci <= totalCells; ci++) {
      const beatPos = ci * cellBeats;
      if (beatPos % 1 < 1e-9 || Math.abs(beatPos % 1 - 1) < 1e-9) continue;
      const gx = beatColumnLeftPx(beatPos, ppb);
      if (gx <= 0 || gx >= w) continue;
      og.fillStyle = 'rgba(255,255,255,0.055)';
      og.fillRect(gx, 0, 1, laneH);
    }
  }
  for (let beat = 0; beat <= totalBeats; beat++) {
    const gx = beatColumnLeftPx(beat, ppb);
    const isBar = beat % bpb === 0;
    og.fillStyle = isBar ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)';
    og.fillRect(gx, 0, 1, laneH);
  }
  const innerTop = 4;
  const innerBot = laneH - 6;
  const span = Math.max(1, innerBot - innerTop);
  og.strokeStyle = 'rgba(255,255,255,0.07)';
  og.lineWidth = 1;
  for (const frac of [0.25, 0.5, 0.75]) {
    const yy = Math.round(innerTop + span * (1 - frac)) + 0.5;
    og.beginPath();
    og.moveTo(0, yy);
    og.lineTo(w, yy);
    og.stroke();
  }
}

function syncPianoVelocityCanvas(
  canvas: HTMLCanvasElement | null,
  cacheRef: { current: HTMLCanvasElement | null },
  track: MockMusioTrack,
  zoom: number,
  beatsPerBar: number,
  snapSubdivisions: number,
): void {
  if (!canvas) return;
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const w = TOTAL_WIDTH_PX * zoom;
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const totalBeats = totalBeatsForSig(bpb);
  const ppb = ppbAtZoom(zoom, bpb);
  const laneH = PIANO_VELOCITY_LANE_H_PX;
  const bw = Math.max(1, Math.round(w * dpr));
  const bh = Math.max(1, Math.round(laneH * dpr));
  const snapDiv = Math.max(1, Math.min(64, Math.round(snapSubdivisions)));

  let off = cacheRef.current;
  const ver = off && '__vVer' in off ? (off as HTMLCanvasElement & { __vVer: number }).__vVer : -1;
  const key = `${zoom}|${bpb}|${snapDiv}|${track.id}|${track.name}|${track.colorHex}|v|${tracksSignature([track])}`;
  const prevKey = off && '__vKey' in off ? (off as HTMLCanvasElement & { __vKey: string }).__vKey : '';
  let didRebuild = false;
  if (!off || off.width !== bw || off.height !== bh || ver !== PIANO_GRID_CACHE_VER || prevKey !== key) {
    didRebuild = true;
    off = document.createElement('canvas');
    (off as HTMLCanvasElement & { __vVer: number }).__vVer = PIANO_GRID_CACHE_VER;
    (off as HTMLCanvasElement & { __vKey: string }).__vKey = key;
    off.width = bw;
    off.height = bh;
    cacheRef.current = off;
    const og = off.getContext('2d');
    if (!og) return;
    og.imageSmoothingEnabled = false;
    og.setTransform(dpr, 0, 0, dpr, 0, 0);
    og.fillStyle = '#0c0c12';
    og.fillRect(0, 0, w, laneH);
    drawPianoVelocityLaneGrid(og, w, laneH, ppb, zoom, totalBeats, bpb, snapDiv);

    const rgb = hexToRgb(track.colorHex);
    const baseR = rgb?.r ?? 91;
    const baseG = rgb?.g ?? 140;
    const baseB = rgb?.b ?? 255;
    const { velBottom, velSpan } = pianoVelocityLaneMetrics(laneH);

    for (const ev of track.notes) {
      const x0 = beatColumnLeftPx(ev.startBeat, ppb);
      const x1 = beatColumnLeftPx(ev.startBeat + ev.durationBeats, ppb);
      const barW = Math.max(2, x1 - x0);
      const x = x0;
      const vh = (ev.velocity / 127) * velSpan;
      const y0 = velBottom - vh;
      og.fillStyle = `rgba(${baseR},${baseG},${baseB},${0.35 + (ev.velocity / 127) * 0.45})`;
      if (typeof og.roundRect === 'function') {
        og.beginPath();
        og.roundRect(x, y0, barW, vh, 1);
        og.fill();
      } else {
        og.fillRect(x, y0, barW, vh);
      }
    }

    og.strokeStyle = 'rgba(255,255,255,0.2)';
    og.lineWidth = 1;
    og.beginPath();
    og.moveTo(0, laneH - 0.5);
    og.lineTo(w, laneH - 0.5);
    og.stroke();
  }

  const g = canvas.getContext('2d');
  if (!g) return;
  g.imageSmoothingEnabled = false;
  const hadResize = canvas.width !== bw || canvas.height !== bh;
  if (hadResize) {
    canvas.width = bw;
    canvas.height = bh;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${laneH}px`;
  }
  off = cacheRef.current;
  if (!off) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (hadResize || didRebuild) {
    g.drawImage(off, 0, 0, w, laneH);
  }
}

type MusioPianoRollPanelProps = {
  visible: boolean;
  panelHeight: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onResizeStart: (e: MouseEvent<HTMLButtonElement>) => void;
  zoom: number;
  beatsPerBar: number;
  snapSubdivisions: number;
  onBeatsPerBarChange: (n: number) => void;
  onSnapSubdivisionsChange: (n: number) => void;
  tracks: MockMusioTrack[];
  selectedTrackIndex: number;
  onSelectTrackIndex: (i: number) => void;
  onUpdateTrackNotes: (trackIndex: number, notes: MockMidiNote[]) => void;
  tool: PianoRollTool;
  onToolChange: (t: PianoRollTool) => void;
  selectedNoteIndex: number | null;
  selectedNoteIndexes: ReadonlySet<number>;
  onSelectNoteIndex: (i: number | null) => void;
  onToggleNoteIndex: (i: number) => void;
  onSelectOnlyNoteIndex: (i: number | null) => void;
  onSetSelectedNoteIndexes: (indexes: Set<number>) => void;
  onClearSelectedNotes: () => void;
  playheadRef: RefObject<HTMLDivElement | null>;
  running: boolean;
  loopOn: boolean;
  onLoopOnChange: (v: boolean) => void;
  loopBars: number;
  onLoopBarsChange: (n: number) => void;
  /** Loop region in beats (same as timeline; piano roll repeats the tinted region visuals). */
  loopStartBeat: number;
  loopEndBeat: number;
  onPauseForEdit: () => void | Promise<void>;
  /** Bar ruler click / drag â€” horizontal beat seek (Musio piano ruler). */
  onSeekFromPianoRuler: (stripXCss: number) => void;
  /** Live MIDI audition â€” optional; use `@/app/lib/studioMidiBackend` from a parent callback when wiring. */
  onPreviewPitch?: (pitch: number, velocity01?: number) => void;
  /** Parent opens edit context menu (right-click piano grid / velocity). */
  onNotesContextMenu?: (info: { clientX: number; clientY: number; noteHitIndex: number | null }) => void;
  onQuantizeSelected: () => void;
  onDuplicateSelectedPhrase: () => void;
  onTransposeSelected: (semi: number) => void;
  onHumanizeSelected: () => void;
  onLegatoSelected: () => void;
  onArpeggiateSelected: () => void;
  onStrumSelected: () => void;
  onChopSelected: () => void;
  onRandomizeVelocitySelected: () => void;
  onQuantizeStrengthChange: (n: number) => void;
  quantizeStrength: number;
  onQuantizeSwingChange: (n: number) => void;
  quantizeSwing: number;
  showGhostNotes: boolean;
  onShowGhostNotesChange: (v: boolean) => void;
  showScaleGuides: boolean;
  onShowScaleGuidesChange: (v: boolean) => void;
};

function MusioPianoRollPanel({
  visible,
  panelHeight,
  expanded,
  onToggleExpanded,
  onResizeStart,
  zoom,
  beatsPerBar,
  snapSubdivisions,
  onBeatsPerBarChange,
  onSnapSubdivisionsChange,
  tracks,
  selectedTrackIndex,
  onSelectTrackIndex,
  onUpdateTrackNotes,
  tool,
  onToolChange,
  selectedNoteIndex,
  selectedNoteIndexes,
  onSelectNoteIndex,
  onToggleNoteIndex,
  onSelectOnlyNoteIndex,
  onSetSelectedNoteIndexes,
  onClearSelectedNotes,
  playheadRef,
  running,
  loopOn,
  onLoopOnChange,
  loopBars,
  onLoopBarsChange,
  loopStartBeat,
  loopEndBeat,
  onPauseForEdit,
  onSeekFromPianoRuler,
  onPreviewPitch,
  onNotesContextMenu,
  onQuantizeSelected,
  onDuplicateSelectedPhrase,
  onTransposeSelected,
  onHumanizeSelected,
  onLegatoSelected,
  onArpeggiateSelected,
  onStrumSelected,
  onChopSelected,
  onRandomizeVelocitySelected,
  onQuantizeStrengthChange,
  quantizeStrength,
  onQuantizeSwingChange,
  quantizeSwing,
  showGhostNotes,
  onShowGhostNotesChange,
  showScaleGuides,
  onShowScaleGuidesChange,
}: MusioPianoRollPanelProps) {
  const track = tracks[Math.max(0, Math.min(tracks.length - 1, selectedTrackIndex))];
  const isAudioTrack = track.kind === 'audio';
  const [hScroll, setHScroll] = useState(0);
  const [pressedPitches, setPressedPitches] = useState<Set<number>>(() => new Set());
  const keyStripShellRef = useRef<HTMLDivElement | null>(null);
  const keyStripPointerToPitchRef = useRef<Map<number, number>>(new Map());
  const pianoGridCacheRef = useRef<HTMLCanvasElement | null>(null);
  const pianoVelCacheRef = useRef<HTMLCanvasElement | null>(null);
  const pianoGridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pianoVelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hScrollRef = useRef<HTMLDivElement | null>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const totalBeats = totalBeatsForSig(bpb);
  const snapS = normalizePianoSnapSubdiv(snapSubdivisions);
  const stripW = TOTAL_WIDTH_PX * zoom;
  const ppb = ppbAtZoom(zoom, bpb);
  const ghostNotes = showGhostNotes
    ? tracks
        .filter((t, i) => i !== selectedTrackIndex && t.kind === 'midi')
        .flatMap((t) => t.notes.map((n) => ({ ...n })))
    : [];

  useLayoutEffect(() => {
    if (!visible || isAudioTrack) return;
    syncPianoRollCanvas(
      pianoGridCanvasRef.current,
      pianoGridCacheRef,
      track,
      zoom,
      selectedNoteIndex,
      bpb,
      snapS,
      selectedNoteIndexes,
      ghostNotes,
      showScaleGuides,
      track.notes[selectedNoteIndex ?? 0]?.pitch ?? 0,
    );
    syncPianoVelocityCanvas(pianoVelCanvasRef.current, pianoVelCacheRef, track, zoom, bpb, snapS);
  }, [visible, isAudioTrack, track, zoom, selectedNoteIndex, selectedNoteIndexes, ghostNotes, showScaleGuides, bpb, snapS]);

  useLayoutEffect(() => {
    if (!visible) return;
    const node = rulerCanvasRef.current;
    if (!node) return;
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const rw = Math.max(1, Math.round(stripW * dpr));
    const rh = Math.max(1, Math.round(PIANO_RULER_H_PX * dpr));
    node.width = rw;
    node.height = rh;
    node.style.width = `${stripW}px`;
    node.style.height = `${PIANO_RULER_H_PX}px`;
    const ctx = node.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0c0c12';
    ctx.fillRect(0, 0, stripW, PIANO_RULER_H_PX);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8a8a98';
    ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    for (let barIdx = 0; barIdx < BARS; barIdx++) {
      const lx = beatColumnLeftPx(barIdx * bpb, ppb) + 4;
      ctx.fillText(String(barIdx + 1), lx, PIANO_RULER_H_PX / 2);
    }
  }, [visible, stripW, ppb, bpb]);

  useEffect(() => {
    if (!visible) return;
    const el = hScrollRef.current;
    if (!el) return;
    const ro = () => setHScroll(el.scrollLeft);
    ro();
    el.addEventListener('scroll', ro, { passive: true });
    return () => el.removeEventListener('scroll', ro);
  }, [visible, stripW]);

  useEffect(() => {
    if (!visible) {
      setPressedPitches(new Set());
      keyStripPointerToPitchRef.current.clear();
    }
  }, [visible]);

  const pianoInteractRef = useRef({
    stripW,
    ppb,
    track,
    selectedTrackIndex,
    onUpdateTrackNotes,
    onSelectNoteIndex,
    onToggleNoteIndex,
    onSelectOnlyNoteIndex,
    onSetSelectedNoteIndexes,
    onClearSelectedNotes,
    snapSubdivisions: snapS,
    totalBeats,
    onPreviewPitch,
  });
  pianoInteractRef.current = {
    stripW,
    ppb,
    track,
    selectedTrackIndex,
    onUpdateTrackNotes,
    onSelectNoteIndex,
    onToggleNoteIndex,
    onSelectOnlyNoteIndex,
    onSetSelectedNoteIndexes,
    onClearSelectedNotes,
    snapSubdivisions: snapS,
    totalBeats,
    onPreviewPitch,
  };

  const syncKeyStripPressedVisual = useCallback((immediateVisual?: boolean) => {
    const next = () => setPressedPitches(new Set(keyStripPointerToPitchRef.current.values()));
    if (immediateVisual) flushSync(next);
    else next();
  }, []);

  const onKeyStripPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'pen' && e.button !== 0) return;
      if (e.pointerType === 'touch' && !e.isPrimary) return;
      e.stopPropagation();
      const shell = e.currentTarget as HTMLDivElement;
      const pitch = pitchFromKeyStripElement(shell, e.clientY);
      if (pitch === null) return;
      try {
        shell.setPointerCapture(e.pointerId);
      } catch {
        /* some browsers disallow capture on discarded streams */
      }
      keyStripPointerToPitchRef.current.set(e.pointerId, pitch);
      syncKeyStripPressedVisual(true);
      const vel = velocity01FromKeyStripStrike(shell, e.clientY, pitch);
      void pianoInteractRef.current.onPreviewPitch?.(pitch, vel);
    },
    [syncKeyStripPressedVisual],
  );

  const onKeyStripPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!keyStripPointerToPitchRef.current.has(e.pointerId)) return;
      const shell = e.currentTarget as HTMLDivElement;
      const pitch = pitchFromKeyStripElement(shell, e.clientY);
      if (pitch === null) {
        keyStripPointerToPitchRef.current.delete(e.pointerId);
        try {
          if (typeof shell.releasePointerCapture === 'function') shell.releasePointerCapture(e.pointerId);
        } catch {
          /**/
        }
        syncKeyStripPressedVisual();
        return;
      }
      const prev = keyStripPointerToPitchRef.current.get(e.pointerId);
      if (prev !== pitch) {
        keyStripPointerToPitchRef.current.set(e.pointerId, pitch);
        syncKeyStripPressedVisual(true);
        void pianoInteractRef.current.onPreviewPitch?.(pitch, velocity01FromKeyStripStrike(shell, e.clientY, pitch));
      }
    },
    [syncKeyStripPressedVisual],
  );

  const onKeyStripPointerUpOrCancel = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!keyStripPointerToPitchRef.current.has(e.pointerId)) return;
      try {
        if (typeof e.currentTarget.releasePointerCapture === 'function')
          e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /**/
      }
      keyStripPointerToPitchRef.current.delete(e.pointerId);
      syncKeyStripPressedVisual(true);
    },
    [syncKeyStripPressedVisual],
  );

  /** Do not wipe “down” while pointer is captured (leave events still fire crossing children). */
  const onKeyStripPointerLeave = useCallback((e: PointerEvent<HTMLDivElement>) => {
    try {
      if (
        typeof (e.currentTarget as HTMLDivElement).hasPointerCapture === 'function' &&
        (e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)
      ) {
        return;
      }
    } catch {
      /**/
    }
    if (!keyStripPointerToPitchRef.current.has(e.pointerId)) return;
    keyStripPointerToPitchRef.current.delete(e.pointerId);
    syncKeyStripPressedVisual(true);
  }, [syncKeyStripPressedVisual]);

  const onKeyStripLostPointerCapture = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      keyStripPointerToPitchRef.current.delete(e.pointerId);
      syncKeyStripPressedVisual(true);
    },
    [syncKeyStripPressedVisual],
  );

  const onKeyStripClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    /* Sound is triggered in onPointerDown — stop propagation only. */
    e.stopPropagation();
  }, []);
  const paintDragRef = useRef(false);
  const dragToolRef = useRef<PianoRollTool | null>(null);
  const paintLastClientRef = useRef<{ clientX: number; clientY: number } | null>(null);

  const noteDragRef = useRef<{
    active: boolean;
    mode: 'move' | 'resize';
    idx: number;
    beatPtrDown: number;
    rowPtrDown: number;
    anchorStart: number;
    anchorEnd: number;
    selectedSnapshot: { idx: number; startBeat: number; pitch: number; durationBeats: number }[];
    duplicatedViaAlt: boolean;
  }>({
    active: false,
    mode: 'move',
    idx: -1,
    beatPtrDown: 0,
    rowPtrDown: 0,
    anchorStart: 0,
    anchorEnd: 0,
    selectedSnapshot: [],
    duplicatedViaAlt: false,
  });

  const marqueeSelectRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    additive: boolean;
    baseSelection: Set<number>;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    curX: 0,
    curY: 0,
    additive: false,
    baseSelection: new Set<number>(),
  });
  const [marqueeBox, setMarqueeBox] = useState<null | { left: number; top: number; width: number; height: number }>(null);

  const velPaintDragRef = useRef(false);
  const velDragToolRef = useRef<PianoRollTool | null>(null);
  const lastVelPaintKeyRef = useRef('');

  /** Piano pencil / erase: interpolate between client coords so fast drags don’t skip snapped cells,
   *  and accumulate one `notes` snapshot per segment (avoid stale ref during gesture). */
  const paintGridBrushSegment = useCallback(
    (
      cx0: number,
      cy0: number,
      cx1: number,
      cy1: number,
      gridEl: HTMLDivElement,
      brush: PianoRollTool,
    ) => {
      if (brush !== 'pencil' && brush !== 'erase') return;
      const sh = pianoInteractRef.current;
      const hScrollEl = hScrollRef.current;

      const sampleStrip = (cx: number, cy: number) => {
        const x = pianoGridStripXFromClient(cx, hScrollEl);
        const y = pianoGridYFromClient(cy, gridEl);
        return { x, y, ok: x >= 0 && y >= 0 && x <= sh.stripW && y <= PIANO_GRID_H_PX };
      };

      const dx = cx1 - cx0;
      const dy = cy1 - cy0;
      const dist = Math.hypot(dx, dy);
      const stepCount = Math.min(384, Math.max(1, Math.ceil(dist / 3)));

      if (brush === 'pencil') {
        let working = [...sh.track.notes];
        const segDone = new Set<string>();
        let lastNu: MockMidiNote | null = null;
        let changed = false;
        const dur = oneCellDurationBeats(sh.snapSubdivisions);

        for (let s = 0; s <= stepCount; s++) {
          const tfrac = stepCount === 0 ? 0 : s / stepCount;
          const cx = cx0 + dx * tfrac;
          const cy = cy0 + dy * tfrac;
          const { x, y, ok } = sampleStrip(cx, cy);
          if (!ok) continue;
          const beat = snapBeatToSubdivision(x / sh.ppb, sh.snapSubdivisions, sh.totalBeats);
          const row = Math.floor(y / PIANO_NOTE_ROW_H_PX);
          let pitch = PIANO_PITCH_HI - row;
          pitch = Math.max(PIANO_PITCH_LO, Math.min(PIANO_PITCH_HI, pitch));
          const cellKey = `${pitch}|${beat.toFixed(4)}`;
          if (segDone.has(cellKey)) continue;
          segDone.add(cellKey);

          const dup = working.some((n) => n.pitch === pitch && Math.abs(n.startBeat - beat) < 1e-5);
          if (dup) continue;

          lastNu = { pitch, startBeat: beat, durationBeats: dur, velocity: 100 };
          working.push(lastNu);
          changed = true;
        }

        if (changed) {
          working.sort((a, b) => (a.startBeat !== b.startBeat ? a.startBeat - b.startBeat : a.pitch - b.pitch));
          sh.onUpdateTrackNotes(sh.selectedTrackIndex, working);
          if (lastNu) {
            const idx = working.findIndex(
              (n) => n.pitch === lastNu!.pitch && Math.abs(n.startBeat - lastNu!.startBeat) < 1e-6,
            );
            sh.onSelectNoteIndex(idx >= 0 ? idx : null);
            sh.onPreviewPitch?.(lastNu.pitch, lastNu.velocity / 127);
          }
        }
        return;
      }

      let working = [...sh.track.notes];
      let changed = false;
      for (let s = 0; s <= stepCount; s++) {
        const tfrac = stepCount === 0 ? 0 : s / stepCount;
        const cx = cx0 + dx * tfrac;
        const cy = cy0 + dy * tfrac;
        const { x, y, ok } = sampleStrip(cx, cy);
        if (!ok) continue;
        const hit = hitPianoNoteIndex(working, x, y, sh.ppb);
        if (hit >= 0) {
          working.splice(hit, 1);
          changed = true;
        }
      }
      if (changed) {
        sh.onUpdateTrackNotes(sh.selectedTrackIndex, working);
        sh.onSelectNoteIndex(null);
      }
    },
    [],
  );

  const applyPianoGridSelectAt = useCallback((
    clientX: number,
    clientY: number,
    gridEl: HTMLDivElement,
    multiMode: 'single' | 'toggle' = 'single',
  ) => {
    const sh = pianoInteractRef.current;
    const x = pianoGridStripXFromClient(clientX, hScrollRef.current);
    const y = pianoGridYFromClient(clientY, gridEl);
    if (x < 0 || y < 0 || x > sh.stripW || y > PIANO_GRID_H_PX) return;
    const hit = hitPianoNoteIndex(sh.track.notes, x, y, sh.ppb);
    if (multiMode === 'toggle') {
      if (hit >= 0) sh.onToggleNoteIndex(hit);
      return;
    }
    sh.onSelectOnlyNoteIndex(hit >= 0 ? hit : null);
  }, []);

  const applyVelocityStripAt = useCallback(
    (clientX: number, clientY: number, velEl: HTMLDivElement, t: PianoRollTool, brush: boolean) => {
      const sh = pianoInteractRef.current;
      const laneH = PIANO_VELOCITY_LANE_H_PX;
      const x = pianoGridStripXFromClient(clientX, hScrollRef.current);
      const y = clientY - velEl.getBoundingClientRect().top;
      if (x < 0 || y < 0 || x > sh.stripW || y > laneH) return;

      if (t === 'pencil') {
        const hit = hitVelocityNoteIndex(sh.track.notes, x, y, sh.ppb, laneH);
        if (hit < 0) return;
        const v = velocityFromLaneY(y, laneH);
        const key = `${hit}|${v}`;
        if (brush && lastVelPaintKeyRef.current === key) return;
        lastVelPaintKeyRef.current = key;
        const next = sh.track.notes.map((n, j) => (j === hit ? { ...n, velocity: v } : n));
        sh.onUpdateTrackNotes(sh.selectedTrackIndex, next);
        sh.onSelectNoteIndex(hit);
        const n = sh.track.notes[hit];
        if (n) sh.onPreviewPitch?.(n.pitch, v / 127);
        return;
      }

      const hit = hitVelocityNoteIndex(sh.track.notes, x, y, sh.ppb, laneH);
      if (t === 'erase') {
        if (hit < 0) return;
        sh.onUpdateTrackNotes(
          sh.selectedTrackIndex,
          sh.track.notes.filter((_, j) => j !== hit),
        );
        sh.onSelectNoteIndex(null);
        return;
      }
      sh.onSelectNoteIndex(hit >= 0 ? hit : null);
    },
    [],
  );

  const onGridPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!visible) return;
      if (e.button !== 0) return;
      if (running) void Promise.resolve(onPauseForEdit());
      const gridEl = e.currentTarget;
      const t = tool;
      noteDragRef.current = {
        active: false, mode: 'move', idx: -1, beatPtrDown: 0, rowPtrDown: 0, anchorStart: 0, anchorEnd: 0, selectedSnapshot: [], duplicatedViaAlt: false,
      };

      if (t === 'pencil' || t === 'erase') {
        paintLastClientRef.current = { clientX: e.clientX, clientY: e.clientY };
        paintGridBrushSegment(e.clientX, e.clientY, e.clientX, e.clientY, gridEl, t);
        dragToolRef.current = t;
        paintDragRef.current = true;
        try {
          gridEl.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
        return;
      }

      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      applyPianoGridSelectAt(e.clientX, e.clientY, gridEl, additive ? 'toggle' : 'single');

      const sh = pianoInteractRef.current;
      const x = pianoGridStripXFromClient(e.clientX, hScrollRef.current);
      const y = pianoGridYFromClient(e.clientY, gridEl);
      if (x < 0 || y < 0 || x > sh.stripW || y > PIANO_GRID_H_PX) return;

      const hit = hitPianoNoteIndex(sh.track.notes, x, y, sh.ppb);
      if (hit < 0) {
        marqueeSelectRef.current = {
          active: true,
          startX: x,
          startY: y,
          curX: x,
          curY: y,
          additive,
          baseSelection: new Set(selectedNoteIndexes),
        };
        if (!additive) sh.onClearSelectedNotes();
        setMarqueeBox({ left: x, top: y, width: 0, height: 0 });
        try {
          gridEl.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
        return;
      }

      const n = sh.track.notes[hit];
      if (!n) return;
      const beatPtr = x / sh.ppb;
      const x1 = beatColumnLeftPx(n.startBeat + n.durationBeats, sh.ppb);
      const resize = x >= x1 - PIANO_NOTE_RESIZE_EDGE_PX;
      let dragSnapshots =
        !resize && selectedNoteIndexes.has(hit)
          ? [...selectedNoteIndexes]
              .filter((i) => i >= 0 && i < sh.track.notes.length)
              .sort((a, b) => a - b)
              .map((i) => ({
                idx: i,
                startBeat: sh.track.notes[i]!.startBeat,
                pitch: sh.track.notes[i]!.pitch,
                durationBeats: sh.track.notes[i]!.durationBeats,
              }))
          : [
              {
                idx: hit,
                startBeat: n.startBeat,
                pitch: n.pitch,
                durationBeats: n.durationBeats,
              },
            ];

      let duplicatedViaAlt = false;
      if (!resize && e.altKey && dragSnapshots.length > 0) {
        const source = dragSnapshots.map((s) => sh.track.notes[s.idx]!).filter(Boolean);
        const clones = source.map((nn) => ({ ...nn }));
        const merged = [...sh.track.notes, ...clones].sort((a, b) =>
          a.startBeat !== b.startBeat ? a.startBeat - b.startBeat : a.pitch - b.pitch,
        );
        sh.onUpdateTrackNotes(sh.selectedTrackIndex, merged);
        const used = new Set<number>();
        const cloneIdxs: number[] = [];
        clones.forEach((c) => {
          for (let i = 0; i < merged.length; i++) {
            if (used.has(i)) continue;
            const m = merged[i]!;
            if (
              m.pitch === c.pitch &&
              Math.abs(m.startBeat - c.startBeat) < 1e-6 &&
              Math.abs(m.durationBeats - c.durationBeats) < 1e-6 &&
              m.velocity === c.velocity
            ) {
              used.add(i);
              cloneIdxs.push(i);
              break;
            }
          }
        });
        if (cloneIdxs.length) {
          const nextSel = new Set(cloneIdxs);
          sh.onSetSelectedNoteIndexes(nextSel);
          sh.onSelectNoteIndex(cloneIdxs[cloneIdxs.length - 1] ?? null);
          dragSnapshots = cloneIdxs
            .sort((a, b) => a - b)
            .map((i) => ({
              idx: i,
              startBeat: merged[i]!.startBeat,
              pitch: merged[i]!.pitch,
              durationBeats: merged[i]!.durationBeats,
            }));
          duplicatedViaAlt = true;
        }
      }

      noteDragRef.current = {
        active: true,
        mode: resize ? 'resize' : 'move',
        idx: hit,
        beatPtrDown: beatPtr,
        rowPtrDown: y / PIANO_NOTE_ROW_H_PX,
        anchorStart: n.startBeat,
        anchorEnd: n.startBeat + n.durationBeats,
        selectedSnapshot: resize ? [] : dragSnapshots,
        duplicatedViaAlt,
      };
      try {
        gridEl.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    [applyPianoGridSelectAt, paintGridBrushSegment, onPauseForEdit, running, tool, visible, selectedNoteIndexes],
  );

  const onGridPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const gridEl = e.currentTarget;
      const sh = pianoInteractRef.current;

      if (noteDragRef.current.active) {
        const nd = noteDragRef.current;
        const x = pianoGridStripXFromClient(e.clientX, hScrollRef.current);
        const y = pianoGridYFromClient(e.clientY, gridEl);
        const n = sh.track.notes[nd.idx];
        if (!n) {
          noteDragRef.current = {
            active: false, mode: 'move', idx: -1, beatPtrDown: 0, rowPtrDown: 0, anchorStart: 0, anchorEnd: 0, selectedSnapshot: [], duplicatedViaAlt: false,
          };
          return;
        }
        const beatPtr = x / sh.ppb;
        if (nd.mode === 'move') {
          if (nd.selectedSnapshot.length > 1) {
            const rawDelta = beatPtr - nd.beatPtrDown;
            const pitchDelta = Math.round(nd.rowPtrDown - y / PIANO_NOTE_ROW_H_PX);
            let minStart = Infinity;
            let maxEnd = -Infinity;
            nd.selectedSnapshot.forEach((s) => {
              minStart = Math.min(minStart, s.startBeat + rawDelta);
              maxEnd = Math.max(maxEnd, s.startBeat + s.durationBeats + rawDelta);
            });
            const boundedDelta =
              maxEnd > sh.totalBeats
                ? rawDelta - (maxEnd - sh.totalBeats)
                : minStart < 0
                  ? rawDelta - minStart
                  : rawDelta;
            const selMap = new Map(nd.selectedSnapshot.map((s) => [s.idx, s]));
            sh.onUpdateTrackNotes(
              sh.selectedTrackIndex,
              sh.track.notes.map((ev, j) => {
                const base = selMap.get(j);
                if (!base) return ev;
                const sb = snapBeatToSubdivision(base.startBeat + boundedDelta, sh.snapSubdivisions, sh.totalBeats);
                return {
                  ...ev,
                  startBeat: Math.max(0, Math.min(sh.totalBeats - base.durationBeats, sb)),
                  pitch: Math.max(PIANO_PITCH_LO, Math.min(PIANO_PITCH_HI, base.pitch + pitchDelta)),
                };
              }),
            );
            return;
          }
          const rawDelta = beatPtr - nd.beatPtrDown;
          let newStart = snapBeatToSubdivision(nd.anchorStart + rawDelta, sh.snapSubdivisions, sh.totalBeats);
          newStart = Math.max(0, Math.min(sh.totalBeats - n.durationBeats, newStart));
          const row = Math.floor(y / PIANO_NOTE_ROW_H_PX);
          let newPitch = PIANO_PITCH_HI - row;
          newPitch = Math.max(PIANO_PITCH_LO, Math.min(PIANO_PITCH_HI, newPitch));
          sh.onUpdateTrackNotes(
            sh.selectedTrackIndex,
            sh.track.notes.map((ev, j) =>
              j === nd.idx ? { ...ev, startBeat: newStart, pitch: newPitch } : ev,
            ),
          );
        } else {
          const rawDelta = beatPtr - nd.beatPtrDown;
          let newEnd = snapBeatToSubdivision(nd.anchorEnd + rawDelta, sh.snapSubdivisions, sh.totalBeats);
          newEnd = Math.max(
            n.startBeat + PIANO_MIN_NOTE_DURATION_BEATS,
            Math.min(sh.totalBeats, newEnd),
          );
          const newDur = newEnd - n.startBeat;
          sh.onUpdateTrackNotes(
            sh.selectedTrackIndex,
            sh.track.notes.map((ev, j) => (j === nd.idx ? { ...ev, durationBeats: newDur } : ev)),
          );
        }
        return;
      }

      if (marqueeSelectRef.current.active) {
        const m = marqueeSelectRef.current;
        const x = pianoGridStripXFromClient(e.clientX, hScrollRef.current);
        const y = pianoGridYFromClient(e.clientY, gridEl);
        m.curX = x;
        m.curY = y;
        const left = Math.max(0, Math.min(m.startX, m.curX));
        const right = Math.min(sh.stripW, Math.max(m.startX, m.curX));
        const top = Math.max(0, Math.min(m.startY, m.curY));
        const bottom = Math.min(PIANO_GRID_H_PX, Math.max(m.startY, m.curY));
        setMarqueeBox({ left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
        const hitSet = new Set<number>();
        sh.track.notes.forEach((n, i) => {
          const x0 = beatColumnLeftPx(n.startBeat, sh.ppb);
          const x1 = beatColumnLeftPx(n.startBeat + n.durationBeats, sh.ppb);
          const y0 = pitchRowY0(n.pitch);
          const y1 = y0 + Math.max(2, PIANO_NOTE_ROW_H_PX - 2);
          if (x1 >= left && x0 <= right && y1 >= top && y0 <= bottom) hitSet.add(i);
        });
        const next = m.additive ? new Set([...m.baseSelection, ...hitSet]) : hitSet;
        sh.onSetSelectedNoteIndexes(next);
        const arr = [...next].sort((a, b) => a - b);
        sh.onSelectNoteIndex(arr.length ? arr[arr.length - 1]! : null);
        return;
      }

      if (!paintDragRef.current) return;
      const dt = dragToolRef.current;
      if (dt !== 'pencil' && dt !== 'erase') return;
      const last = paintLastClientRef.current;
      paintGridBrushSegment(
        last?.clientX ?? e.clientX,
        last?.clientY ?? e.clientY,
        e.clientX,
        e.clientY,
        gridEl,
        dt,
      );
      paintLastClientRef.current = { clientX: e.clientX, clientY: e.clientY };
    },
    [paintGridBrushSegment],
  );

  const onGridPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    paintDragRef.current = false;
    dragToolRef.current = null;
    paintLastClientRef.current = null;
    noteDragRef.current = {
      active: false, mode: 'move', idx: -1, beatPtrDown: 0, rowPtrDown: 0, anchorStart: 0, anchorEnd: 0, selectedSnapshot: [], duplicatedViaAlt: false,
    };
    marqueeSelectRef.current.active = false;
    setMarqueeBox(null);
    const el = e.currentTarget;
    if (typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(e.pointerId)) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    }
  }, []);

  const onVelPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!visible) return;
      if (e.button !== 0) return;
      if (running) void Promise.resolve(onPauseForEdit());
      const velEl = e.currentTarget;
      const t = tool;
      lastVelPaintKeyRef.current = '';
      applyVelocityStripAt(e.clientX, e.clientY, velEl, t, false);

      if (t === 'pencil' || t === 'erase') {
        velDragToolRef.current = t;
        velPaintDragRef.current = true;
        try {
          velEl.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
      }
    },
    [applyVelocityStripAt, onPauseForEdit, running, tool, visible],
  );

  const onVelPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!velPaintDragRef.current) return;
      const dt = velDragToolRef.current;
      if (dt !== 'pencil' && dt !== 'erase') return;
      applyVelocityStripAt(e.clientX, e.clientY, e.currentTarget, dt, true);
    },
    [applyVelocityStripAt],
  );

  const onVelPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    velPaintDragRef.current = false;
    velDragToolRef.current = null;
    lastVelPaintKeyRef.current = '';
    const el = e.currentTarget;
    if (typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(e.pointerId)) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    }
  }, []);

  const onGridContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onNotesContextMenu) return;
      const x = pianoGridStripXFromClient(e.clientX, hScrollRef.current);
      const y = pianoGridYFromClient(e.clientY, e.currentTarget);
      const sh = pianoInteractRef.current;
      let hitIdx: number | null = null;
      if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= sh.stripW && y <= PIANO_GRID_H_PX) {
        const hix = hitPianoNoteIndex(sh.track.notes, x, y, sh.ppb);
        hitIdx = hix >= 0 ? hix : null;
      }
      onNotesContextMenu({ clientX: e.clientX, clientY: e.clientY, noteHitIndex: hitIdx });
    },
    [onNotesContextMenu],
  );

  const onVelContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onNotesContextMenu) return;
      const sh = pianoInteractRef.current;
      const laneH = PIANO_VELOCITY_LANE_H_PX;
      const x = pianoGridStripXFromClient(e.clientX, hScrollRef.current);
      const r = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - r.top;
      let hitIdx: number | null = null;
      if (x >= 0 && y >= 0 && x <= sh.stripW && y <= laneH) {
        const hix = hitVelocityNoteIndex(sh.track.notes, x, y, sh.ppb, laneH);
        hitIdx = hix >= 0 ? hix : null;
      }
      onNotesContextMenu({ clientX: e.clientX, clientY: e.clientY, noteHitIndex: hitIdx });
    },
    [onNotesContextMenu],
  );

  const onKeyStripContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onNotesContextMenu) return;
      onNotesContextMenu({ clientX: e.clientX, clientY: e.clientY, noteHitIndex: null });
    },
    [onNotesContextMenu],
  );

  const onPianoBarRulerContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onNotesContextMenu) return;
      onNotesContextMenu({ clientX: e.clientX, clientY: e.clientY, noteHitIndex: null });
    },
    [onNotesContextMenu],
  );

  if (!visible) return null;

  const loopLsX = beatColumnLeftPx(loopStartBeat, ppb);
  const loopLeX = beatColumnLeftPx(loopEndBeat, ppb);
  const loopSpan = Math.max(0, loopLeX - loopLsX);
  const showLoopShade = loopOn && loopSpan > 0;
  const onHScroll = () => {
    const el = hScrollRef.current;
    setHScroll(el?.scrollLeft ?? 0);
  };

  const toolBtn = (t: PianoRollTool, icon: ReactNode, title: string, label: string) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => onToolChange(t)}
      className="flex items-center gap-1 rounded px-1.5 py-1 transition-all active:scale-[0.98]"
      style={{
        background: tool === t ? 'rgba(124,244,198,0.14)' : 'rgba(255,255,255,0.02)',
        color: tool === t ? '#7cf4c6' : '#6a6a78',
        border: `1px solid ${tool === t ? 'rgba(124,244,198,0.38)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: tool === t ? '0 0 0 1px rgba(124,244,198,0.24), 0 0 10px rgba(124,244,198,0.18)' : 'inset 0 1px 0 rgba(255,255,255,0.05)',
        cursor: 'pointer',
      }}
    >
      {icon}
      <span className="text-[7px] font-medium whitespace-nowrap leading-none">{label}</span>
    </button>
  );

  return (
    <div
      className={expanded ? 'flex-1 min-h-0 flex flex-col border-t' : 'shrink-0 flex flex-col border-t min-h-0'}
      style={{
        height: expanded ? '100%' : panelHeight,
        borderColor: '#141418',
        background: '#08080c',
      }}
      data-studio-midi-context
    >
      {!expanded && (
        <button
          type="button"
          aria-label="Resize piano roll height"
          className="h-1.5 w-full cursor-row-resize shrink-0 border-b hover:bg-white/[0.06]"
          style={{ borderColor: '#1a1a22', background: '#101014' }}
          onMouseDown={onResizeStart}
        />
      )}
      <div
        className="flex flex-col gap-2 px-2.5 py-1.5 border-b shrink-0"
        style={{
          borderColor: '#1a1a22',
          background: 'linear-gradient(180deg, #0b0b10 0%, #09090d 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider shrink-0" style={{ color: '#5c5c68' }}>
            Piano roll
          </span>
          <button
            type="button"
            onClick={onToggleExpanded}
            title={expanded ? 'Minimize piano roll' : 'Expand piano roll'}
            className="shrink-0 flex items-center gap-1 rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide transition-colors"
            style={{
              borderColor: expanded ? '#2a4a3c' : '#2a2a32',
              color: expanded ? '#7cf4c6' : '#8a8a98',
              background: expanded ? '#14221c' : 'rgba(0,0,0,0.25)',
            }}
          >
            {expanded ? <Minimize2 size={10} strokeWidth={2.2} /> : <Maximize2 size={10} strokeWidth={2.2} />}
            <span>{expanded ? 'Min' : 'Expand'}</span>
          </button>
          <div className="flex items-center gap-1 px-1.5 py-1 select-none">
            {toolBtn(
              'select',
              <MousePointer2 size={11} strokeWidth={2} />,
              'Select â€” click note; drag to move pitch/time; drag right edge to resize length',
              'Select',
            )}
            {toolBtn(
              'pencil',
              <Pencil size={11} strokeWidth={2} />,
              `Pencil â€” add note on grid (${snapLabelFromPianoSnapSubdiv(snapS)}); on velocity lane paint bar height = velocity`,
              'Pencil',
            )}
            {toolBtn(
              'erase',
              <Eraser size={11} strokeWidth={2} />,
              'Eraser â€” remove note on grid or velocity bar',
              'Eraser',
            )}
          </div>
          <div className="flex items-center gap-2 px-1.5 py-1">
            <DawMiniMenu
              label="Snap"
              displayText={snapLabelFromPianoSnapSubdiv(snapS)}
              value={snapS}
              options={[
                { value: 1, label: snapLabelFromPianoSnapSubdiv(1) },
                { value: 2, label: snapLabelFromPianoSnapSubdiv(2) },
                { value: 3, label: snapLabelFromPianoSnapSubdiv(3) },
                { value: 4, label: snapLabelFromPianoSnapSubdiv(4) },
                { value: 6, label: snapLabelFromPianoSnapSubdiv(6) },
                { value: 8, label: snapLabelFromPianoSnapSubdiv(8) },
                { value: 16, label: snapLabelFromPianoSnapSubdiv(16) },
                { value: 32, label: snapLabelFromPianoSnapSubdiv(32) },
              ]}
              onChange={onSnapSubdivisionsChange}
              title={`Grid snap — ${PPQ} PPQ; one cell = ${Math.round(ticksPerPianoSnapCell(PPQ, snapS))} ticks; zoom = pixel width`}
              compact
            />
            <DawMiniMenu
              label="Sig"
              displayText={`${bpb}/4`}
              value={bpb}
              options={Array.from({ length: 15 }, (_, i) => ({ value: i + 2, label: `${i + 2}/4` }))}
              onChange={onBeatsPerBarChange}
              title="Time signature â€” beats per bar"
              compact
            />
          </div>
          {/* Loop + loop length menu + quantize (same ribbon row as Loop / “N bars”) */}
          <div className="flex min-w-0 flex-wrap items-center gap-2 px-1.5 py-1 select-none shrink-0">
            <button
              type="button"
              title={loopOn ? `Loop on — ${loopBars} bar${loopBars !== 1 ? 's' : ''} (drag top ruler bar to resize)` : 'Loop off — click to enable, drag top ruler to set region'}
              aria-pressed={loopOn}
              onClick={() => onLoopOnChange(!loopOn)}
              className="flex items-center gap-0.5 rounded border font-mono font-bold text-[9px] outline-none transition-colors px-1.5 py-0.5 shrink-0"
              style={{
                borderColor: loopOn ? '#2a4a3c' : '#3a3a46',
                background: loopOn ? '#14221c' : '#1c1c24',
                color: loopOn ? '#7cf4c6' : '#6a6a78',
              }}
            >
              <Repeat size={9} strokeWidth={2.5} />
              <span>Loop</span>
            </button>
            <div className="shrink-0">
              <DawMiniMenu
                label=""
                displayText={`${loopBars} bar${loopBars !== 1 ? 's' : ''}`}
                value={loopBars}
                options={[1, 2, 4, 8, 12, 16, 24, 32].map((n) => ({ value: n, label: `${n} bar${n !== 1 ? 's' : ''}` }))}
                onChange={onLoopBarsChange}
                title="Loop length — also draggable on the ruler bar above"
                compact
              />
            </div>
            <div
              className="flex min-w-0 shrink-0 flex-nowrap items-center gap-2 border-l pl-2"
              style={{ borderColor: '#252532' }}
            >
              <span className="shrink-0 text-[7px] font-semibold uppercase" style={{ color: '#6f6f7f' }}>
                Q
              </span>
              <div
                className="flex shrink-0 flex-nowrap items-center gap-1.5 select-none"
                title="Strength — how far note starts move toward the grid (Logic Q-Strength · Ableton Quantize Amount)"
              >
                <label htmlFor="piano-quantize-strength" className="sr-only">
                  Quantize strength
                </label>
                <span
                  className="hidden min-[520px]:inline shrink-0 whitespace-nowrap text-[7px] font-bold uppercase tracking-wide"
                  style={{ color: '#5c5c6a' }}
                  aria-hidden
                >
                  Strength
                </span>
                <input
                  id="piano-quantize-strength"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={quantizeStrength}
                  onChange={(e) => onQuantizeStrengthChange(Number(e.target.value))}
                  className="h-2 w-[78px] shrink-0 cursor-pointer align-middle accent-[#7cf4c6]"
                  style={{ touchAction: 'none' }}
                />
                <span
                  className="flex w-[2.0625rem] shrink-0 justify-end font-mono text-[8px] font-semibold tabular-nums leading-none tracking-tight"
                  style={{ color: '#a0a0b0' }}
                >
                  {quantizeStrength}%
                </span>
              </div>
              <div
                className="flex shrink-0 flex-nowrap items-center gap-1 select-none"
                title="Swing — off-beat push on odd subdivisions"
              >
                <span
                  className="hidden min-[580px]:inline shrink-0 whitespace-nowrap text-[7px] font-bold uppercase tracking-wide"
                  style={{ color: '#5c5c6a' }}
                  aria-hidden
                >
                  Swing
                </span>
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={quantizeSwing}
                  onChange={(e) => onQuantizeSwingChange(Number(e.target.value))}
                  className="h-2 w-[44px] shrink-0 cursor-pointer align-middle accent-[#7cf4c6]"
                  style={{ touchAction: 'none' }}
                />
              </div>
              <button
                type="button"
                onClick={onQuantizeSelected}
                className="shrink-0 rounded px-1 py-0.5 text-[7px] font-semibold transition-all active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(180deg, #254036 0%, #1b2f28 100%)',
                  border: '1px solid rgba(124,244,198,0.36)',
                  color: '#7cf4c6',
                  boxShadow: '0 0 8px rgba(124,244,198,0.18)',
                }}
                title="Quantize selected notes"
              >
                Quant
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 overflow-visible px-1.5 py-1">
            <div
              className="relative shrink-0 overflow-visible px-1"
              role="group"
              aria-label="Transpose semitones"
            >
              <div className="relative z-10 flex flex-wrap items-center justify-center gap-1">
                <button type="button" onClick={() => onTransposeSelected(-1)} className="text-[7px] px-2 py-0.5 rounded transition-all active:scale-[0.98]" style={{ background: '#1a1a24', color: '#b8b8ca', border: '1px solid rgba(255,255,255,0.08)' }} title="Transpose -1 semitone">-1</button>
                <button type="button" onClick={() => onTransposeSelected(1)} className="text-[7px] px-2 py-0.5 rounded transition-all active:scale-[0.98]" style={{ background: '#1a1a24', color: '#b8b8ca', border: '1px solid rgba(255,255,255,0.08)' }} title="Transpose +1 semitone">+1</button>
                <button type="button" onClick={() => onTransposeSelected(-12)} className="text-[7px] px-2 py-0.5 rounded transition-all active:scale-[0.98]" style={{ background: '#1a1a24', color: '#b8b8ca', border: '1px solid rgba(255,255,255,0.08)' }} title="Transpose -12 semitones">-12</button>
                <button type="button" onClick={() => onTransposeSelected(12)} className="text-[7px] px-2 py-0.5 rounded transition-all active:scale-[0.98]" style={{ background: '#1a1a24', color: '#b8b8ca', border: '1px solid rgba(255,255,255,0.08)' }} title="Transpose +12 semitones">+12</button>
              </div>
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-full z-0 -translate-x-1/2 select-none whitespace-nowrap font-bold leading-none"
                style={{
                  marginTop: 3,
                  fontSize: 14,
                  color: 'rgba(124,244,198,0.34)',
                  letterSpacing: '0.06em',
                  textShadow:
                    '0 0 5px rgba(124,244,198,0.5), 0 0 12px rgba(124,244,198,0.32), 0 0 22px rgba(124,244,198,0.16), 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                Transpose
              </span>
            </div>
            <button
              type="button"
              aria-label="Humanize timing and velocity"
              title="Humanize timing and velocity"
              onClick={onHumanizeSelected}
              className="rounded-md transition-all active:scale-[0.98] whitespace-nowrap"
              style={{
                background: '#1a1a24',
                color: '#b8b8ca',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.2,
                padding: '7px 14px',
              }}
            >
              Humanize
            </button>
            <button
              type="button"
              aria-label="Legato selected notes"
              title="Legato selected notes"
              onClick={onLegatoSelected}
              className="rounded-md transition-all active:scale-[0.98] whitespace-nowrap"
              style={{
                background: '#1a1a24',
                color: '#b8b8ca',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.2,
                padding: '7px 14px',
              }}
            >
              Legato
            </button>
            <button
              type="button"
              aria-label="Duplicate selected phrase"
              title="Duplicate selected phrase"
              onClick={onDuplicateSelectedPhrase}
              className="rounded-md transition-all active:scale-[0.98] whitespace-nowrap"
              style={{
                background: '#1a1a24',
                color: '#b8b8ca',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.2,
                padding: '7px 14px',
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              aria-label="Arpeggiate selected notes"
              title="Arpeggiate selected notes"
              onClick={onArpeggiateSelected}
              className="rounded-md transition-all active:scale-[0.98] whitespace-nowrap"
              style={{
                background: '#1a1a24',
                color: '#b8b8ca',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.2,
                padding: '7px 14px',
              }}
            >
              Arpeggiate
            </button>
            <button
              type="button"
              aria-label="Strum selected notes"
              title="Strum selected notes"
              onClick={onStrumSelected}
              className="rounded-md transition-all active:scale-[0.98] whitespace-nowrap"
              style={{
                background: '#1a1a24',
                color: '#b8b8ca',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.2,
                padding: '7px 14px',
              }}
            >
              Strum
            </button>
            <button type="button" onClick={onChopSelected} className="text-[7px] px-2 py-0.5 rounded transition-all active:scale-[0.98]" style={{ background: '#1a1a24', color: '#b8b8ca', border: '1px solid rgba(255,255,255,0.08)' }} title="Flam/chop selected notes">Chop</button>
            <button type="button" onClick={onRandomizeVelocitySelected} className="text-[7px] px-2 py-0.5 rounded transition-all active:scale-[0.98]" style={{ background: '#1a1a24', color: '#b8b8ca', border: '1px solid rgba(255,255,255,0.08)' }} title="Randomize selected velocity">VelRnd</button>
            <button type="button" onClick={() => onShowGhostNotesChange(!showGhostNotes)} className="text-[7px] px-2 py-0.5 rounded transition-all active:scale-[0.98]" style={{ background: showGhostNotes ? '#193025' : '#1a1a24', color: showGhostNotes ? '#7cf4c6' : '#b8b8ca', border: `1px solid ${showGhostNotes ? 'rgba(124,244,198,0.42)' : 'rgba(255,255,255,0.08)'}` }} title="Toggle ghost notes">Ghost</button>
            <button type="button" onClick={() => onShowScaleGuidesChange(!showScaleGuides)} className="text-[7px] px-2 py-0.5 rounded transition-all active:scale-[0.98]" style={{ background: showScaleGuides ? '#193025' : '#1a1a24', color: showScaleGuides ? '#7cf4c6' : '#b8b8ca', border: `1px solid ${showScaleGuides ? 'rgba(124,244,198,0.42)' : 'rgba(255,255,255,0.08)'}` }} title="Toggle scale guides">Scale</button>
        </div>
        <div className="flex-1 min-w-[0.5rem]" />
        <div className="flex items-center gap-3 shrink min-w-0 select-none overflow-x-auto max-w-full basis-full pt-0.5">
          {tracks.map((tr, i) => {
            const active = i === selectedTrackIndex;
            return (
              <button
                key={tr.id}
                type="button"
                title={`Edit ${tr.name}`}
                onClick={() => onSelectTrackIndex(i)}
                className={`flex items-center gap-0.5 px-1.5 py-0 rounded border shrink-0 max-w-[6rem] truncate transition-all active:scale-[0.98] ${TRACK_NAME_UI_CLASS}`}
                style={{
                  borderColor: active ? `${tr.colorHex}99` : '#2a2a32',
                  background: active ? `${tr.colorHex}22` : 'rgba(0,0,0,0.35)',
                  color: active ? '#eaeaf0' : '#7a7a88',
                  boxShadow: active ? `inset 0 0 0 1px ${tr.colorHex}44, 0 0 8px ${tr.colorHex}22` : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tr.colorHex }} aria-hidden />
                <span className="truncate">{tr.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isAudioTrack ? (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-2 px-6 min-h-0"
          style={{ background: '#0a0a0e' }}
        >
          <span className="text-[11px] font-semibold tracking-wide" style={{ color: '#9a9aac' }}>
            Audio track
          </span>
          <span className="text-[9px] leading-relaxed max-w-[22rem] text-center" style={{ color: '#5c5c68' }}>
            No piano roll — clips live on the timeline (playlist/studio editor arranger). Import from Vocal
            Lab or use the audio lane tools above.
          </span>
        </div>
      ) : (
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex shrink-0" style={{ height: PIANO_RULER_H_PX }}>
          <div
            className="shrink-0 flex items-end justify-center pb-0.5 border-r text-[8px] font-bold uppercase"
            style={{
              width: PIANO_KEY_W_PX,
              borderColor: '#1a1a22',
              background: '#0c0c12',
              color: '#5c5c68',
            }}
          />
          <div className="flex-1 min-w-0 overflow-hidden relative" style={{ background: '#0c0c12' }}>
            <div
              className="relative"
              style={{ transform: `translateX(-${hScroll}px)`, width: stripW, height: '100%' }}
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                if (running) void Promise.resolve(onPauseForEdit());
                const x = pianoGridStripXFromClient(e.clientX, hScrollRef.current);
                onSeekFromPianoRuler(x);
              }}
              onContextMenu={onPianoBarRulerContextMenu}
              title="Click ruler to seek playhead"
            >
              <canvas ref={rulerCanvasRef} aria-hidden className="block max-w-none pointer-events-none" style={{ verticalAlign: 'top' }} />
              {showLoopShade && (
                <>
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      left: loopLsX,
                      width: loopSpan,
                      zIndex: 2,
                      background: 'rgba(124,244,198,0.22)',
                      borderTop: '2px solid #7cf4c6',
                    }}
                    aria-hidden
                  />
                  {loopSpan > 40 && (
                    <div
                      className="absolute top-0 bottom-0 flex items-center pointer-events-none"
                      style={{
                        left: loopLsX + 9,
                        zIndex: 3,
                        fontSize: 8,
                        color: '#7cf4c6',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                      aria-hidden
                    >
                      {`${Math.round((loopEndBeat - loopStartBeat) / bpb)} bar loop`}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col overscroll-contain">
          <div className="relative flex shrink-0" style={{ height: PIANO_GRID_H_PX }}>
            <div
              ref={keyStripShellRef}
              data-studio-piano-roll-keys
              className="shrink-0 relative flex touch-none flex-col border-r select-none isolate z-[20]"
              role="application"
              aria-label="Piano keys — drag along keys to play; velocity follows strike height on each key row"
              style={{
                width: PIANO_KEY_W_PX,
                height: PIANO_GRID_H_PX,
                borderColor: '#2a2a34',
                background: '#e8e8f0',
                boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.18)',
                pointerEvents: 'auto',
                touchAction: 'none',
                overflow: 'hidden',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerDown={onKeyStripPointerDown}
              onPointerMove={onKeyStripPointerMove}
              onPointerUp={onKeyStripPointerUpOrCancel}
              onPointerCancel={onKeyStripPointerUpOrCancel}
              onPointerLeave={onKeyStripPointerLeave}
              onLostPointerCapture={onKeyStripLostPointerCapture}
              onClick={onKeyStripClick}
              onContextMenu={onKeyStripContextMenu}
            >
              {/* ── Piano keys: proper black/white key shape with notch separation ── */}
              <div
                className="flex h-full min-h-0 flex-col pointer-events-none [&_*]:pointer-events-none"
                aria-hidden="true"
              >
                {Array.from({ length: PIANO_ROW_COUNT }, (_, i) => {
                  const pitch = PIANO_PITCH_HI - i;
                  const bk    = isBlackKeyPitch(pitch);
                  const lab   = whiteKeyLabel(pitch);
                  const down  = pressedPitches.has(pitch);
                  /* Black keys occupy ~62% of the strip width; the remaining right portion
                   * stays white-key coloured so the white key appears to extend behind it. */
                  const BK_W_PCT = 62;

                  return (
                    <div
                      key={pitch}
                      style={{
                        height: PIANO_NOTE_ROW_H_PX,
                        boxSizing: 'border-box',
                        display: 'flex',
                        position: 'relative',
                        /* Thin separator between white keys only */
                        borderBottom: bk
                          ? 'none'
                          : i === PIANO_ROW_COUNT - 1
                            ? 'none'
                            : '1px solid rgba(0,0,0,0.09)',
                      }}
                    >
                      {bk ? (
                        /* ─── Black key row ─── */
                        <>
                          {/* The actual black key cap */}
                          <div
                            style={{
                              width: `${BK_W_PCT}%`,
                              height: '100%',
                              boxSizing: 'border-box',
                              transformOrigin: 'top center',
                              transform: down ? 'translateY(1px) scaleY(0.94)' : 'translateY(0) scaleY(1)',
                              transition: down
                                ? 'transform 0.035s cubic-bezier(.2,.85,.35,1), background 0.035s ease-out, box-shadow 0.035s ease-out'
                                : 'transform 0.1s cubic-bezier(.2,.9,.35,1), background 0.1s ease-out, box-shadow 0.1s ease-out',
                              background: down
                                ? 'linear-gradient(180deg, #3a4158 0%, #484860 52%, #2a2838 100%)'
                                : 'linear-gradient(180deg, #1c1c28 0%, #262636 40%, #141420 100%)',
                              boxShadow: down
                                ? 'inset 0 6px 10px rgba(0,0,0,0.92), inset 0 2px 0 rgba(124,244,198,0.18), inset -1px 0 0 rgba(255,255,255,0.06)'
                                : 'inset 0 1px 0 rgba(255,255,255,0.10), inset -1px 0 0 rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.6)',
                              borderRight: '1px solid rgba(0,0,0,0.5)',
                              borderBottom: '1px solid rgba(0,0,0,0.4)',
                              zIndex: 2,
                            }}
                          />
                          {/* Right portion — white key continuation; must depress too (same row / same pitch). */}
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              height: '100%',
                              boxSizing: 'border-box',
                              transformOrigin: 'top center',
                              transform: down ? 'translateY(3px) scaleY(0.94)' : 'translateY(0) scaleY(1)',
                              transition: down
                                ? 'transform 0.035s cubic-bezier(.2,.85,.35,1), background 0.035s ease-out, box-shadow 0.035s ease-out'
                                : 'transform 0.1s cubic-bezier(.2,.9,.35,1), background 0.1s ease-out, box-shadow 0.1s ease-out',
                              background: down
                                ? 'linear-gradient(90deg, #c8ebe0 0%, #a8dcc8 45%, #8ad4b8 100%)'
                                : '#e8e8f0',
                              boxShadow: down
                                ? 'inset 0 4px 8px rgba(0,0,0,0.2), inset 0 2px 0 rgba(124,244,198,0.22)'
                                : 'inset 0 1px 0 rgba(255,255,255,0.35)',
                              borderBottom: '1px solid rgba(0,0,0,0.07)',
                            }}
                          />
                        </>
                      ) : (
                        /* ─── White key row ─── */
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            boxSizing: 'border-box',
                            transformOrigin: 'top center',
                            transform: down ? 'translateY(4px) scaleY(0.94)' : 'translateY(0) scaleY(1)',
                            transition: down
                              ? 'transform 0.035s cubic-bezier(.2,.85,.35,1), background 0.035s ease-out, box-shadow 0.035s ease-out'
                              : 'transform 0.1s cubic-bezier(.2,.9,.35,1), background 0.1s ease-out, box-shadow 0.1s ease-out',
                            background: down
                              ? 'linear-gradient(180deg, #bff5e8 0%, #7cdbbc 42%, #5bc4a8 100%)'
                              : 'linear-gradient(90deg, #e8e8f0 0%, #fafafa 30%, #f2f2f8 70%, #e4e4ec 100%)',
                            boxShadow: down
                              ? 'inset 0 6px 10px rgba(0,0,0,0.28), inset 0 3px 0 rgba(124,244,198,0.35), inset 0 1px 0 rgba(255,255,255,0.5)'
                              : 'inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: 4,
                            fontSize: 8,
                            fontWeight: 700,
                            color: lab ? (down ? '#1a4038' : '#5a5a70') : 'transparent',
                            letterSpacing: '0.01em',
                          }}
                        >
                          {lab}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div ref={hScrollRef} className="relative z-10 min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden" onScroll={onHScroll}>
              <div
                className="relative inline-block touch-none select-none"
                style={{
                  width: stripW,
                  height: PIANO_GRID_H_PX,
                  verticalAlign: 'top',
                  cursor:
                    tool === 'pencil' ? 'crosshair' : tool === 'erase' ? 'cell' : tool === 'select' ? 'default' : 'default',
                }}
                onPointerDown={onGridPointerDown}
                onPointerMove={onGridPointerMove}
                onPointerUp={onGridPointerUp}
                onPointerCancel={onGridPointerUp}
                onContextMenu={onGridContextMenu}
                role="presentation"
              >
                <canvas ref={pianoGridCanvasRef} className="block max-w-none pointer-events-none" style={{ verticalAlign: 'top' }} />
                {marqueeBox && (
                  <div
                    className="absolute z-[8] pointer-events-none"
                    style={{
                      left: marqueeBox.left,
                      top: marqueeBox.top,
                      width: marqueeBox.width,
                      height: marqueeBox.height,
                      border: '1px solid rgba(124,244,198,0.85)',
                      background: 'rgba(124,244,198,0.14)',
                    }}
                    aria-hidden
                  />
                )}
                {showLoopShade && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none z-[5]"
                    style={{
                      left: loopLsX,
                      width: loopSpan,
                      background: 'rgba(124,244,198,0.05)',
                      boxShadow: 'inset 0 0 0 1px rgba(124,244,198,0.15)',
                    }}
                    aria-hidden
                  />
                )}
                <div
                  ref={playheadRef}
                  className="absolute left-0 top-0 bottom-0 pointer-events-none z-10"
                  style={{
                    width: PLAYHEAD_W_PX,
                    background: '#7cf4c6',
                    transform: 'translate3d(0,0,0)',
                    boxShadow: '0 0 6px rgba(124,244,198,0.35)',
                    willChange: 'transform',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 border-t" style={{ borderColor: '#1a1a22', height: PIANO_VELOCITY_LANE_H_PX }}>
          <div
            className="shrink-0 flex items-center justify-center text-[9px] font-bold uppercase border-r"
            style={{
              width: PIANO_KEY_W_PX,
              borderColor: '#1a1a22',
              background: '#0c0c12',
              color: '#6a6a78',
            }}
          >
            Vel
          </div>
          <div className="flex-1 min-w-0 overflow-hidden" style={{ background: '#0c0c12' }}>
            <div
              className="relative"
              style={{
                transform: `translateX(-${hScroll}px)`,
                width: stripW,
                height: PIANO_VELOCITY_LANE_H_PX,
              }}
            >
              <canvas ref={pianoVelCanvasRef} className="block max-w-none pointer-events-none" style={{ verticalAlign: 'top' }} />
              {showLoopShade && (
                <div
                  className="absolute top-0 pointer-events-none"
                  style={{
                    left: loopLsX,
                    width: loopSpan,
                    height: PIANO_VELOCITY_LANE_H_PX,
                    background: 'rgba(124,244,198,0.05)',
                    boxShadow: 'inset 0 0 0 1px rgba(124,244,198,0.15)',
                    zIndex: 1,
                  }}
                  aria-hidden
                />
              )}
              <div
                className="absolute left-0 top-0 touch-none"
                style={{
                  width: stripW,
                  height: PIANO_VELOCITY_LANE_H_PX,
                  cursor:
                    tool === 'pencil' ? 'ns-resize' : tool === 'erase' ? 'cell' : 'default',
                }}
                onPointerDown={onVelPointerDown}
                onPointerMove={onVelPointerMove}
                onPointerUp={onVelPointerUp}
                onPointerCancel={onVelPointerUp}
                onContextMenu={onVelContextMenu}
                role="presentation"
              />
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

type StudioEditor2ScreenProps = {
  isScreenActive: boolean;
  pendingStudioAudioBlob?: Blob | null;
  onPendingStudioAudioConsumed?: () => void;
};

export default function StudioEditor2Screen({
  isScreenActive,
  pendingStudioAudioBlob = null,
  onPendingStudioAudioConsumed,
}: StudioEditor2ScreenProps) {
  const { settings } = useSettings();
  const [bpm, setBpm] = useState(120);
  const [running, setRunning] = useState(false);
  const [metroOn, setMetroOn] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [loopOn, setLoopOn] = useState(false);
  const [loopBars, setLoopBars] = useState(4);
  /** Loop region in beats — draggable directly on the timeline ruler bar (FL Studio style). */
  const [loopStartBeat, setLoopStartBeat] = useState(0);
  const [loopEndBeat, setLoopEndBeat]     = useState(16); // 4 bars × 4 bpb default
  const [recording, setRecording] = useState(false);
  const [showPianoRoll, setShowPianoRoll] = useState(false);
  const [pianoRollExpanded, setPianoRollExpanded] = useState(false);
  const [pianoPanelH, setPianoPanelH] = useState(320);
  const [showMixer, setShowMixer] = useState(true);
  /** Populated when mixer is visible — browser mic/line inputs for audio-track strips. */
  const [micInputDeviceOptions, setMicInputDeviceOptions] = useState<MediaDeviceOption[]>([]);
  /** Mixer: audio-track input picker anchored to mic (no inline `<select`). */
  const [mixerAudioInputPopover, setMixerAudioInputPopover] = useState<null | { trackIndex: number; top: number; left: number }>(
    null,
  );
  const [mixerPanelH, setMixerPanelH] = useState(400);
  /* Per-track mixer state — indexed by track position (up to MAX_STUDIO_TRACKS). */
  const [trackVolumes, setTrackVolumes] = useState<number[]>(() => Array(MAX_STUDIO_TRACKS).fill(MIXER_UNITY_VOL));
  const [trackPans,   setTrackPans]   = useState<number[]>(() => Array(MAX_STUDIO_TRACKS).fill(64));
  const [trackMutes,  setTrackMutes]  = useState<boolean[]>(() => Array(MAX_STUDIO_TRACKS).fill(false));
  const [trackSolos,  setTrackSolos]  = useState<boolean[]>(() => Array(MAX_STUDIO_TRACKS).fill(false));
  /** When true: ignore pan knob (collapsed mono path). When false: stereo imaging via pan knob. */
  const [trackMonos,  setTrackMonos]  = useState<boolean[]>(() => Array(MAX_STUDIO_TRACKS).fill(false));
  /** Per-channel Record Enable — Pro Tools/Cubase-style red R (arms track for punch-in/overdub workflows). */
  const [trackRecordArmed, setTrackRecordArmed] = useState<boolean[]>(() => Array(MAX_STUDIO_TRACKS).fill(false));
  const [masterVolume, setMasterVolume] = useState(MIXER_UNITY_VOL);
  /** Tracks which fader cap is being dragged (arrow glow + readout emphasis). */
  const [mixerFaderActive, setMixerFaderActive] = useState<
    null | { kind: 'track'; index: number } | { kind: 'master' }
  >(null);
  /** Per-strip insert FX (UI only) — 3 slots × MAX_STUDIO_TRACKS; indexed like other mixer arrays. */
  const [trackFxSlots, setTrackFxSlots] = useState<[MixerEffectId, MixerEffectId, MixerEffectId][]>(() =>
    Array.from({ length: MAX_STUDIO_TRACKS }, () => emptyMixerFxSlots()),
  );
  const [masterFxSlots, setMasterFxSlots] = useState<[MixerEffectId, MixerEffectId, MixerEffectId]>(() =>
    emptyMixerFxSlots(),
  );

  /* Mixer meter refs — updated directly from animationTick (no React state for 60fps DOM writes). */
  const showMixerRef      = useRef(false);
  const mixerMeterLsRef   = useRef<(HTMLDivElement | null)[]>([]);
  const mixerMeterRsRef   = useRef<(HTMLDivElement | null)[]>([]);
  const mixerMasterLRef   = useRef<HTMLDivElement | null>(null);
  const mixerMasterRRef   = useRef<HTMLDivElement | null>(null);
  /** Smoothed peak level 0–1 per track, decays between hits. */
  const mixerLevelsRef    = useRef<number[]>(Array(MAX_STUDIO_TRACKS).fill(0));
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  const [studioTracks, setStudioTracks] = useState<MockMusioTrack[]>(cloneMockTracks);
  const [pianoTool, setPianoTool] = useState<PianoRollTool>('select');
  const [selectedPianoNoteIndex, setSelectedPianoNoteIndex] = useState<number | null>(null);
  const [selectedPianoNoteIndexes, setSelectedPianoNoteIndexes] = useState<Set<number>>(() => new Set());
  const [quantizeStrength, setQuantizeStrength] = useState(100);
  const [quantizeSwing, setQuantizeSwing] = useState(0);
  const [showGhostNotes, setShowGhostNotes] = useState(true);
  const [showScaleGuides, setShowScaleGuides] = useState(false);
  const [midiClipboardHeld, setMidiClipboardHeld] = useState(false);
  const [editorContextMenu, setEditorContextMenu] = useState<{ x: number; y: number } | null>(null);
  /**
   * Captured when the MIDI context menu opens (same tick as hit-testing).
   * Avoids actions reading stale `selectedPianoNoteIndex` before React flushes, and survives the
   * track/piano selection ref sync. Cleared when the menu closes.
   */
  const midiMenuTargetRef = useRef<{ trackIndex: number; noteIndex: number | null } | null>(null);
  /** While the context menu is open: does the open gesture target a note? Drives disabled rows (avoids stale React selection). */
  const [contextMenuHasNoteTarget, setContextMenuHasNoteTarget] = useState(false);
  /** Time signature numerator (denominator fixed 4 in UI â€” `n/4`). Drives timeline + piano ruler width. */
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  /** Piano edit snap: cells per quarter (`4` = 1/16 default, 960 PPQ → 240 ticks/cell). */
  const [pianoSnapSubdivisions, setPianoSnapSubdivisions] = useState(readPianoSnapSubdivFromStorage);

  useEffect(() => {
    try {
      localStorage.setItem('dmb_shared_piano_snap_subdiv', String(pianoSnapSubdivisions));
    } catch {
      /* ignore */
    }
  }, [pianoSnapSubdivisions]);

  useEffect(() => {
    if (selectedPianoNoteIndex === null) {
      setSelectedPianoNoteIndexes(new Set());
      return;
    }
    setSelectedPianoNoteIndexes((prev) => {
      if (prev.size > 1 && prev.has(selectedPianoNoteIndex)) return prev;
      return new Set([selectedPianoNoteIndex]);
    });
  }, [selectedPianoNoteIndex]);

  const beatsPerBarRef = useRef(4);
  const totalBeatsRef = useRef(totalBeatsForSig(4));
  beatsPerBarRef.current = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  totalBeatsRef.current = totalBeatsForSig(beatsPerBarRef.current);

  const ctxRef = useRef<AudioContext | null>(null);
  const metroBusRef = useRef<GainNode | null>(null);
  /** Track MIDI preview (poly) â€” separate gain from metronome bus. */
  const midiPreviewBusRef = useRef<GainNode | null>(null);
  const clickBufferRef = useRef<AudioBuffer | null>(null);
  const accentBufferRef = useRef<AudioBuffer | null>(null);
  /** Dedupe lookahead scheduling per note instance (`trackId:idx:start`). */
  const midiPreviewScheduledRef = useRef<Set<string>>(new Set());
  /** Dedupe arranger audio clip scheduling (`trackId:clipId:startBeat`). */
  const audioPreviewScheduledRef = useRef<Set<string>>(new Set());
  /** Runtime `AudioBuffer` by `StudioAudioClip.sourceId` (same role as FL playlist sample data). */
  const studioAudioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const scheduledPreviewBufferSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const cancelArrangerPreviewScheduling = useCallback(() => {
    midiPreviewScheduledRef.current.clear();
    audioPreviewScheduledRef.current.clear();
    stopScheduledPreviewBufferSources(scheduledPreviewBufferSourcesRef.current);
  }, []);

  const runningRef = useRef(false);
  const sessionStartRef = useRef(0);
  const originBeatRef = useRef(0);
  const cursorBeatRef = useRef(0);
  const displayBeatRef = useRef(0);
  /*
   * Two-clock sync â€” the same technique used by Core Audio / Pro Tools for smooth display:
   *
   *   Audio scheduler (every 25 ms): converts sessionStartRef (ctx.currentTime domain) into
   *   an equivalent performance.now() timestamp â†’ perfSessionStartMsRef.
   *   Formula: perfSessionStart = perf.now() + (sessionStart - ctx.currentTime) * 1000
   *
   *   RAF visual loop: uses rafTime (vsync-aligned DOMHighResTimeStamp) to interpolate
   *   beat position.  Formula: beat = origin + max(0, (rafTime - perfSessionStart) / 1000) * bpm/60
   *
   * rafTime is perfectly smooth (sub-ms, vsync-aligned). The 25 ms audio re-anchor keeps
   * it from drifting away from the audio clock.  No ctx.currentTime quantization in the
   * visual path whatsoever.
   */
  const schedAnchorTimeRef = useRef(0);
  const schedAnchorPerfRef = useRef(0);
  const perfSessionStartMsRef = useRef(0);

  /*
   * Web Animations API (WAAPI) playhead animations.
   * WAAPI animations on elements with will-change:transform run on the compositor thread,
   * meaning they advance smoothly even when the JS main thread is blocked by GC, audio
   * node creation, React re-renders, or OS scheduling â€” the root cause of all the skipping.
   *
   * wapiBpmRef / wapiPpbRef record the params used when the animation was created so the
   * RAF loop can accurately convert animation.currentTime â†’ beat without knowing the keyframes.
   *
   * Formula (in RAF): beat = (anim.currentTime ms / 1000) Ã— (bpm / 60)
   */
  const playheadWapiRef    = useRef<Animation | null>(null);
  const pianoPhWapiRef     = useRef<Animation | null>(null);
  const wapiBpmRef         = useRef(120);
  const wapiPpbRef         = useRef(100);
  const bpmRef = useRef(120);
  const metroOnRef = useRef(true);
  const recordingRef = useRef(false);
  const lastToggleMsRef = useRef(0);
  /** Next quarter index `k` to schedule (`t = sessionStart + (k - origin) * spb`). */
  const nextMetroKRef = useRef(0);
  /** All live metronome BufferSourceNodes — stopped en-masse on loop reset to prevent doubling. */
  const scheduledMetroNodesRef = useRef<AudioBufferSourceNode[]>([]);

  const barsReadoutRef = useRef<HTMLSpanElement | null>(null);
  const timeReadoutRef = useRef<HTMLSpanElement | null>(null);
  const timelineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const playheadGroupRef = useRef<HTMLDivElement | null>(null);
  /** Cached reference to the inner line element â€” avoids querySelector on every RAF frame. */
  const playheadLineRef = useRef<HTMLDivElement | null>(null);
  const timelineStripRef = useRef<HTMLDivElement | null>(null);
  /**
   * Arrange-view lane row height (timeline canvas + track name column).
   * Ref mirrors state for transport / RAF paths that cannot depend on render closure.
   */
  const [trackLaneHeightPx, setTrackLaneHeightPx] = useState(DEFAULT_TRACK_LANE_H_PX);
  const trackLaneHRef = useRef(DEFAULT_TRACK_LANE_H_PX);
  trackLaneHRef.current = clampArrangeLaneHeightPx(trackLaneHeightPx);
  /** Whole Studio 2 shell â€” arrange headers, mixer, transport share MIDI edit focus (like Live/Cubase project focus). */
  const studioUiRootRef = useRef<HTMLDivElement | null>(null);
  /** Ruler strip only â€” Musio-style scrub lives here so lane clicks select tracks, not the playhead. */
  const timelineRulerScrubRef = useRef<HTMLDivElement | null>(null);
  const timelineHScrollRef = useRef<HTMLDivElement | null>(null);
  const transportPaintHostRef = useRef<HTMLDivElement | null>(null);
  const pianoPlayheadRef = useRef<HTMLDivElement | null>(null);
  const gridCacheRef = useRef<HTMLCanvasElement | null>(null);
  /** MIDI edit snapshots for menu shortcuts (does not snapshot every piano-drag frame). */
  const undoStacksRef = useRef<MockMusioTrack[][]>([]);
  const redoStacksRef = useRef<MockMusioTrack[][]>([]);
  const midiClipboardRef = useRef<MockMidiNote[] | null>(null);
  /** While transport is playing with loop on, WAAPI spans only `[loopStart, loopEnd]` so the needle cannot glide past the loop end between RAF ticks. */
  const wapiSegLoopRef = useRef<{
    active: boolean;
    loopStartBeat: number;
    loopEndBeat: number;
    durMs: number;
    /** When true: one compositor-thread animation repeats forever (`iterations: Infinity`); RAF only splices audio on cycle index bumps. Avoids cancel/rebuild jerk at each wrap. */
    seamlessLoop: boolean;
  }>({ active: false, loopStartBeat: 0, loopEndBeat: 0, durMs: 1, seamlessLoop: false });
  /** Last loop cycle index seen from playhead `anim.currentTime` (floor(t / durMs)) when seamlessLoop segment is active. */
  const wapiLoopCycleSeenRef = useRef(0);
  /** Prior segment phase (mod durMs); detects wrap when RAF misses animation.currentTime crosses integer cycles. */
  const wapiPrevPhaseMsRef = useRef(-1);

  const timelineZoomRef = useRef(1);
  const scrubbingRef = useRef(false);
  /** Arrange-view lanes: draw / erase / drag MIDI (mirrors {@link MusioPianoRollPanel} tools). */
  const timelineMidiDragRef = useRef<{
    active: boolean;
    mode: 'move' | 'resize-left' | 'resize-right';
    trackIndex: number;
    noteIndex: number;
    beatPtrDown: number;
    anchorStart: number;
    anchorEnd: number;
  }>({
    active: false,
    mode: 'move',
    trackIndex: -1,
    noteIndex: -1,
    beatPtrDown: 0,
    anchorStart: 0,
    anchorEnd: 0,
  });
  const timelinePaintDragRef = useRef(false);
  const timelinePaintToolRef = useRef<PianoRollTool | null>(null);
  const timelinePaintLastClientRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const transportRafRef = useRef(0);
  const isScreenActiveRef = useRef(isScreenActive);
  const loopOnRef = useRef(loopOn);
  const loopBarsRef = useRef(loopBars);

  /** FL-style loop-region drag state.
   *  mode: 'draw' = painting new region, 'left'/'right' = resizing handles, 'slide' = moving whole region */
  const loopDragRef = useRef<{
    mode: 'draw' | 'left' | 'right' | 'slide';
    startBeatSnapshot: number;
    endBeatSnapshot: number;
    anchorBeat: number;   // beat under pointer at drag start
  } | null>(null);

  /** Pan knob drag state — tracks which channel is being turned and its starting values. */
  const panDragRef = useRef<{ trackIndex: number; startY: number; startPan: number } | null>(null);

  const onTrackFxSlotChange = useCallback((trackIndex: number, slot: 0 | 1 | 2, id: MixerEffectId) => {
    setTrackFxSlots((prev) => {
      const next = prev.slice();
      const base = next[trackIndex] ?? emptyMixerFxSlots();
      const row: [MixerEffectId, MixerEffectId, MixerEffectId] = [...base];
      row[slot] = id;
      next[trackIndex] = row;
      return next;
    });
  }, []);

  const onMasterFxSlotChange = useCallback((slot: 0 | 1 | 2, id: MixerEffectId) => {
    setMasterFxSlots((prev) => {
      const row: [MixerEffectId, MixerEffectId, MixerEffectId] = [...prev];
      row[slot] = id;
      return row;
    });
  }, []);

  const loopStartBeatRef = useRef(loopStartBeat);
  const loopEndBeatRef   = useRef(loopEndBeat);

  isScreenActiveRef.current = isScreenActive;

  useEffect(() => {
    if (!showMixer || !isScreenActive) return;
    let cancelled = false;
    const load = () => {
      void enumerateAudioDevices().then(({ inputs }) => {
        if (!cancelled) setMicInputDeviceOptions(inputs);
      });
    };
    load();
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', load);
      return () => {
        cancelled = true;
        navigator.mediaDevices.removeEventListener('devicechange', load);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [showMixer, isScreenActive]);

  useEffect(() => {
    if (!showMixer) setMixerAudioInputPopover(null);
  }, [showMixer]);

  useEffect(() => {
    if (mixerAudioInputPopover == null) return;
    const onPointerDown = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-mixer-audio-input-popover]')) return;
      if (t.closest('[data-mixer-audio-input-trigger]')) return;
      setMixerAudioInputPopover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMixerAudioInputPopover(null);
    };
    const onScroll = () => setMixerAudioInputPopover(null);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [mixerAudioInputPopover]);

  /** First record-armed audio track’s input drives `getUserMedia` (Studio One–style input routing). */
  useEffect(() => {
    const w = window as unknown as { __daMusicStudio2RecordInputDeviceId?: string };
    if (!isScreenActive) {
      delete w.__daMusicStudio2RecordInputDeviceId;
      return;
    }
    let chosen = settings.audioInput || 'default';
    for (let ti = 0; ti < studioTracks.length; ti++) {
      const t = studioTracks[ti];
      if (t?.kind === 'audio' && (trackRecordArmed[ti] ?? false)) {
        chosen = effectiveAudioInputDeviceId(t, settings.audioInput);
        break;
      }
    }
    w.__daMusicStudio2RecordInputDeviceId = chosen;
    return () => {
      delete w.__daMusicStudio2RecordInputDeviceId;
    };
  }, [isScreenActive, studioTracks, trackRecordArmed, settings.audioInput]);

  bpmRef.current = bpm;
  metroOnRef.current = metroOn;
  recordingRef.current = recording;
  timelineZoomRef.current = zoom;
  loopOnRef.current = loopOn;
  loopBarsRef.current = loopBars;
  loopStartBeatRef.current = loopStartBeat;
  loopEndBeatRef.current   = loopEndBeat;
  showMixerRef.current = showMixer;

  const studioTracksRef = useRef(studioTracks);
  studioTracksRef.current = studioTracks;

  const trackVolumesRef = useRef(trackVolumes);
  trackVolumesRef.current = trackVolumes;
  const trackPansRef = useRef(trackPans);
  trackPansRef.current = trackPans;
  const trackMutesRef = useRef(trackMutes);
  trackMutesRef.current = trackMutes;
  const trackMonosRef = useRef(trackMonos);
  trackMonosRef.current = trackMonos;
  const trackRecordArmedRef = useRef(trackRecordArmed);
  trackRecordArmedRef.current = trackRecordArmed;
  const selectedTrackIndexRef = useRef(selectedTrackIndex);
  selectedTrackIndexRef.current = selectedTrackIndex;
  const selectedPianoIdxRef = useRef(selectedPianoNoteIndex);
  selectedPianoIdxRef.current = selectedPianoNoteIndex;
  const selectedPianoIdxSetRef = useRef<Set<number>>(new Set());
  selectedPianoIdxSetRef.current = selectedPianoNoteIndexes;
  const pianoSnapEffRef = useRef(pianoSnapSubdivisions);
  pianoSnapEffRef.current = normalizePianoSnapSubdiv(pianoSnapSubdivisions);
  const pianoToolRef = useRef<PianoRollTool>('select');
  pianoToolRef.current = pianoTool;

  const applyPlayheadFull = useCallback((beat: number) => {
    const z = timelineZoomRef.current;
    const bpb = beatsPerBarRef.current;
    syncTimelineGridLayer(
      timelineCanvasRef.current,
      gridCacheRef,
      z,
      studioTracksRef.current,
      bpb,
      trackLaneHRef.current,
      selectedTrackIndexRef.current,
      selectedPianoIdxRef.current,
    );
    /* Seek WAAPI animations: pause → seek so compositor never flashes the from-keyframe. */
    const seekMs = Math.max(0, (beat / (wapiBpmRef.current / 60)) * 1000);
    const waSeek = (a: Animation | null) => {
      if (!a) return;
      const wasRunning = a.playState === 'running';
      a.pause();
      a.currentTime = seekMs;
      if (wasRunning) a.play();
    };
    waSeek(playheadWapiRef.current);
    waSeek(pianoPhWapiRef.current);
    /* Fallback static positioning (also sets the inner line / scroll). */
    positionTimelinePlayheadGroup(playheadGroupRef.current, playheadLineRef.current, beat, z, bpb);
    positionPianoPlayhead(pianoPlayheadRef.current, beat, z, bpb);
    scrollTimelineToPlayhead(timelineHScrollRef.current, beat, z, bpb);
  }, []);

  /**
   * Create (or recreate) compositor-thread WAAPI animations for both playheads.
   *
   * Each animation translates the element from beat-0 pixel to beat-N pixel at a linear
   * rate proportional to BPM. The RAF loop never writes style.transform for the playhead;
   * WAAPI drives it independently of JavaScript execution.
   *
   * @param beatNow  beat to seek the animation to (0 = start of song)
   * @param play     true = play immediately, false = create paused (for stopped state)
   */
  const launchWapiAnims = useCallback((beatNow: number, play: boolean) => {
    const bpm  = bpmRef.current;
    const z    = timelineZoomRef.current;
    const bpb  = beatsPerBarRef.current;
    const ppb  = ppbAtZoom(z, bpb);
    const tb   = totalBeatsRef.current;
    const gw   = PLAYHEAD_GRIP_W_PX;
    const pw   = PLAYHEAD_W_PX;
    const totalPx  = tb * ppb;

    wapiBpmRef.current = bpm;
    wapiPpbRef.current = ppb;

    const lsLoop = loopStartBeatRef.current;
    const leLoop = Math.min(loopEndBeatRef.current, tb);
    const useSegment =
      play &&
      loopOnRef.current &&
      leLoop > lsLoop &&
      lsLoop >= 0;

    let durMs: number;
    let x0Grip: number;
    let x1Grip: number;
    let x0Piano: number;
    let x1Piano: number;
    let seekMs: number;

    if (useSegment) {
      const spanBeats = leLoop - lsLoop;
      durMs = (spanBeats / (bpm / 60)) * 1000;
      x0Grip = lsLoop * ppb - gw / 2;
      x1Grip = leLoop * ppb - gw / 2;
      x0Piano = lsLoop * ppb - pw / 2;
      x1Piano = leLoop * ppb - pw / 2;
      const bn = Math.min(Math.max(beatNow, lsLoop), leLoop);
      seekMs = (bn - lsLoop) / (bpm / 60) * 1000;
      wapiSegLoopRef.current = {
        active: true,
        loopStartBeat: lsLoop,
        loopEndBeat: leLoop,
        durMs,
        seamlessLoop: true,
      };
    } else {
      durMs = (tb / (bpm / 60)) * 1000;
      x0Grip = -gw / 2;
      x1Grip = totalPx - gw / 2;
      x0Piano = -pw / 2;
      x1Piano = totalPx - pw / 2;
      seekMs = Math.max(0, beatNow / (bpm / 60) * 1000);
      wapiSegLoopRef.current = { active: false, loopStartBeat: lsLoop, loopEndBeat: leLoop, durMs, seamlessLoop: false };
    }

    seekMs = Math.max(0, Math.min(seekMs, durMs));
    const dSafe = Math.max(1e-9, durMs);
    if (useSegment) {
      wapiLoopCycleSeenRef.current = Math.floor(seekMs / dSafe);
      wapiPrevPhaseMsRef.current = -1;
    } else {
      wapiLoopCycleSeenRef.current = 0;
      wapiPrevPhaseMsRef.current = -1;
    }

    const makeAnim = (
      el: HTMLElement | null,
      x0: number,
      x1: number,
      durationMs: number,
      seekIntoMs: number,
      iterations: number,
    ): Animation | null => {
      if (!el) return null;
      el.getAnimations().forEach(a => a.cancel());
      const a = el.animate(
        [
          { transform: `translate3d(${x0}px, 0, 0)` },
          { transform: `translate3d(${x1}px, 0, 0)` },
        ],
        { duration: durationMs, easing: 'linear', fill: 'forwards', iterations },
      );
      /*
       * ALWAYS pause → seek → play (never play → seek).
       * If we set currentTime while the animation is already running there is one
       * compositor frame where the element sits at the "from" keyframe before the seek
       * takes effect — that is the visible flash/jump at bar 1.
       * Pausing first ensures the compositor only ever renders the correct start position.
       */
      a.pause();
      a.currentTime = Math.min(Math.max(seekIntoMs, 0), durationMs);
      if (play) a.play();
      return a;
    };

    const wapiIters = useSegment ? Infinity : 1;
    playheadWapiRef.current = makeAnim(playheadGroupRef.current, x0Grip, x1Grip, durMs, seekMs, wapiIters);
    pianoPhWapiRef.current  = makeAnim(pianoPlayheadRef.current, x0Piano, x1Piano, durMs, seekMs, wapiIters);
  }, []);

  const applyPlayheadLineOnly = useCallback((beat: number) => {
    const z = timelineZoomRef.current;
    const bpb = beatsPerBarRef.current;
    positionTimelinePlayheadGroup(playheadGroupRef.current, playheadLineRef.current, beat, z, bpb);
    positionPianoPlayhead(pianoPlayheadRef.current, beat, z, bpb);
    scrollTimelineToPlayhead(timelineHScrollRef.current, beat, z, bpb);
  }, []);

  const ensureCtx = useCallback(async () => {
    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = new AudioContext({ latencyHint: 'playback' });
      ctxRef.current = ctx;
    }
    if (!metroBusRef.current && ctx.state !== 'closed') {
      const g = ctx.createGain();
      g.gain.value = 1;
      g.connect(ctx.destination);
      metroBusRef.current = g;
    }
    if (!midiPreviewBusRef.current && ctx.state !== 'closed') {
      const g = ctx.createGain();
      g.gain.value = 0.32;
      g.connect(ctx.destination);
      midiPreviewBusRef.current = g;
    }
    if (!clickBufferRef.current && ctx.state !== 'closed') {
      clickBufferRef.current = createMusioClickBuffer(ctx, 1000, 0.02, 0.8);
      accentBufferRef.current = createMusioClickBuffer(ctx, 1500, 0.03, 1.0);
    }
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* autoplay */
      }
    }
    return ctx;
  }, []);

  const previewPianoPitch = useCallback(
    async (pitch: number, velocity01 = 0.9) => {
      const ctx = await ensureCtx();
      if (ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* autoplay */
        }
      }
      const bus = midiPreviewBusRef.current;
      const ti  = Math.max(0, Math.min(MAX_STUDIO_TRACKS - 1, selectedTrackIndexRef.current ?? 0));
      const pn  = trackPansRef.current[ti] ?? 64;
      const mo  = trackMonosRef.current[ti] ?? false;
      const fG  = mixerVolToLinearGain(trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL);
      if (bus) {
        previewMidiKeyThroughBus(ctx, bus, pitch, velocity01, 0.32, pn, mo, fG);
      } else {
        studioPreviewKeyBlipToDestination(ctx, pitch, velocity01, 0.32);
      }
    },
    [ensureCtx],
  );

  /** Latest `StudioSession` snapshot of the arranger — aligns with `studioSessionTypes` / Studio One export pipeline. */
  const editorStudioSessionRef = useRef<ReturnType<typeof buildStudioSessionFromEditor2Tracks> | null>(null);

  useEffect(() => {
    editorStudioSessionRef.current = buildStudioSessionFromEditor2Tracks(studioTracks as Editor2ArrangerTrack[], {
      projectName: 'Studio Editor 2',
      bpm,
      beatsPerBar,
      loopEnabled: loopOn,
      loopStartBeat,
      loopEndBeat,
    });
  }, [studioTracks, bpm, beatsPerBar, loopOn, loopStartBeat, loopEndBeat]);

  useEffect(() => {
    if (!pendingStudioAudioBlob || pendingStudioAudioBlob.size === 0) return;
    const blob = pendingStudioAudioBlob;
    let cancelled = false;
    void (async () => {
      try {
        const ctx = await ensureCtx();
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch {
            /* autoplay */
          }
        }
        const raw = await blob.arrayBuffer();
        const buffer = await ctx.decodeAudioData(raw.slice(0));
        if (cancelled) return;
        const sourceId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `src-${crypto.randomUUID()}`
            : `src-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        studioAudioBuffersRef.current.set(sourceId, buffer);
        const durBeats = audioDurationBeatsFromSeconds(buffer.duration, bpmRef.current);
        const clipId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `ac-${crypto.randomUUID()}`
            : `ac-${Date.now()}`;
        setStudioTracks((prev) => {
          const ai = prev.findIndex((t) => t.kind === 'audio');
          if (ai < 0) return prev;
          const tb = totalBeatsForSig(beatsPerBarRef.current);
          const clip: StudioAudioClip = {
            id: clipId,
            sourceId,
            startBeat: 0,
            durationBeats: Math.min(tb, durBeats),
            name: 'Imported audio',
          };
          return prev.map((t, i) => (i === ai ? { ...t, audioClips: [...t.audioClips, clip] } : t));
        });
        if (!cancelled) onPendingStudioAudioConsumed?.();
      } catch (e) {
        console.error('Studio Editor 2: failed to import pending audio blob', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingStudioAudioBlob, ensureCtx, onPendingStudioAudioConsumed]);

  const muteMetro = useCallback(() => {
    const ctx = ctxRef.current;
    const bus = metroBusRef.current;
    if (!ctx || ctx.state === 'closed' || !bus) return;
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(0, t);
  }, []);

  const unmuteMetro = useCallback(() => {
    const ctx = ctxRef.current;
    const bus = metroBusRef.current;
    if (!ctx || ctx.state === 'closed' || !bus) return;
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    /* Restore to master-volume level (same as {@link mixerVolToLinearGain}) */
    const mv = masterVolumeRef.current;
    const gain = mixerVolToLinearGain(mv);
    bus.gain.setValueAtTime(gain, t);
  }, []);

  /** Stop and discard all pre-scheduled metronome nodes — called on loop reset and transport stop
   *  to prevent previously queued clicks from firing after the transport jumps back to beat 0. */
  const cancelScheduledMetroNodes = useCallback(() => {
    const arr = scheduledMetroNodesRef.current;
    for (const src of arr) {
      try { src.stop(); } catch { /* already stopped */ }
      try { src.disconnect(); } catch { /* */ }
    }
    arr.length = 0;
  }, []);

  /* Master volume fader → audio bus gain (same dB law as printed scale / +6 dB max). */
  const masterVolumeRef = useRef(masterVolume);
  masterVolumeRef.current = masterVolume;
  /* Master fader → unity = 1.0 gain, top = +6 dB — matches channel strip standard */
  useEffect(() => {
    const ctx = ctxRef.current;
    const bus = metroBusRef.current;
    if (!ctx || ctx.state === 'closed' || !bus) return;
    const mv = masterVolumeRef.current;
    const gain = mixerVolToLinearGain(mv);
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(gain, ctx.currentTime);
  }, [masterVolume]);

  useEffect(() => {
    if (!mixerFaderActive) return undefined;
    const clear = () => setMixerFaderActive(null);
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    return () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
  }, [mixerFaderActive]);

  const playClick = useCallback((ctx: AudioContext, idealT: number, downbeat: boolean, _ctSnap: number) => {
    const buf = downbeat ? accentBufferRef.current : clickBufferRef.current;
    if (!buf) return;
    /*
     * refillMetronome already floors idealT to at least ctx.currentTime+AUDIO_START_FLOOR_SEC
     * before calling here, so we only need a minimal safety clamp (1 ms) to guard against
     * a stale ctx.currentTime snapshot — a second AUDIO_START_FLOOR_SEC floor would push
     * beat-0 an additional 50 ms late on the first scheduler tick.
     */
    const t0 = Math.max(idealT, ctx.currentTime + 0.001);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = METRO_VOLUME;
    src.connect(g);
    const bus = metroBusRef.current;
    if (bus) g.connect(bus);
    else g.connect(ctx.destination);
    src.start(t0);
    /* Track node so loop-reset can stop it before it fires (prevents doubling). */
    scheduledMetroNodesRef.current.push(src);
    src.onended = () => {
      /* Remove from tracking array on natural completion */
      const arr = scheduledMetroNodesRef.current;
      const idx = arr.indexOf(src);
      if (idx !== -1) arr.splice(idx, 1);
      try { src.disconnect(); g.disconnect(); } catch { /* */ }
    };
  }, []);

  /**
   * Wilson-style lookahead: advance `nextMetroKRef` while grid times are in the past, then
   * schedule every attack with `t = sessionStart + (k-origin)*spb` until `now + METRO_SCHEDULE_AHEAD_SEC`.
   */
  const refillMetronome = useCallback(
    (ctx: AudioContext, ctSnap: number, opts?: { loopContinuation?: boolean }) => {
      if (!runningRef.current || !metroOnRef.current) return;
      const spb = spbFromBpm(bpmRef.current);
    const origin = originBeatRef.current;
    const sessionStart = sessionStartRef.current;
      const horizon = ctSnap + METRO_SCHEDULE_AHEAD_SEC;
      /*
       * Use ctSnap (the caller's snapshot of ctx.currentTime) rather than re-reading
       * ctx.currentTime here.  Re-reading can give a value 1–2 ms ahead of ctSnap due
       * to audio render-quantum advances, which pushes beat-0 late by that margin and
       * widens the visual-ahead-of-audio gap.
       */
      const chainFloor = opts?.loopContinuation ? LOOP_METRO_CHAIN_FLOOR_SEC : AUDIO_START_FLOOR_SEC;
      let chain = ctSnap + chainFloor;
      let n = 0;

      const tb = totalBeatsRef.current;
      const bpb = beatsPerBarRef.current;
      /* Advance past already-elapsed beats â€” cap at tb to avoid stopping the scheduler. */
      while (nextMetroKRef.current <= tb) {
        const tNextQuarter = sessionStart + (nextMetroKRef.current + 1 - origin) * spb;
        if (tNextQuarter > ctSnap) break;
        nextMetroKRef.current += 1;
      }

      while (n < MAX_METRO_SCHEDULE_PER_CALL) {
        const k = nextMetroKRef.current;
        if (k > tb) break;
      const tGrid = sessionStart + (k - origin) * spb;
      if (tGrid >= horizon) break;
        const t0 = Math.max(tGrid, chain);
        try {
          playClick(ctx, t0, k % bpb === 0, ctSnap);
        } catch {
          break;
        }
        chain = t0 + METRO_NODE_EPS_SEC;
        nextMetroKRef.current = k + 1;
        n += 1;
      }
    },
    [playClick],
  );

  const refillMidiPreview = useCallback((ctx: AudioContext, ctSnap: number) => {
    if (!runningRef.current) return;
    const bus = midiPreviewBusRef.current;
    if (!bus || ctx.state === 'closed') return;
    const spb = spbFromBpm(bpmRef.current);
    const origin = originBeatRef.current;
    const sessionStart = sessionStartRef.current;
    const horizon = ctSnap + METRO_SCHEDULE_AHEAD_SEC;
    const tracks = studioTracksRef.current;
    const scheduled = midiPreviewScheduledRef.current;

    for (let ti = 0; ti < tracks.length; ti++) {
      const tr = tracks[ti];
      if (tr.kind !== 'midi') continue;
      for (let ni = 0; ni < tr.notes.length; ni++) {
        const note = tr.notes[ni];
        const key = `${tr.id}:${ni}:${note.startBeat}`;
        const tOn = sessionStart + (note.startBeat - origin) * spb;
        const dur = Math.max(0.04, note.durationBeats * spb);
        const tOff = tOn + dur;
        if (tOff < ctSnap - 0.02) {
          scheduled.delete(key);
        continue;
      }
        if (tOn > horizon) continue;
        if (scheduled.has(key)) continue;
        scheduled.add(key);
        const tStart = Math.max(tOn, ctSnap + 0.002);
        const tEnd = Math.min(tOff, tStart + Math.min(dur, 3));
        try {
          const panMs = trackPansRef.current[ti] ?? 64;
          const monoT = trackMonosRef.current[ti] ?? false;
          const faderV = trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL;
          playScheduledMidiNote(ctx, bus, tStart, tEnd, note.pitch, note.velocity / 127, panMs, monoT, faderV);
      } catch {
          scheduled.delete(key);
        }
      }
    }
  }, []);

  const refillAudioPreview = useCallback((ctx: AudioContext, ctSnap: number) => {
    if (!runningRef.current) return;
    const bus = midiPreviewBusRef.current;
    if (!bus || ctx.state === 'closed') return;
    const spb = spbFromBpm(bpmRef.current);
    const origin = originBeatRef.current;
    const sessionStart = sessionStartRef.current;
    const horizon = ctSnap + METRO_SCHEDULE_AHEAD_SEC;
    const tracks = studioTracksRef.current;
    const scheduled = audioPreviewScheduledRef.current;
    const buffers = studioAudioBuffersRef.current;
    const tracking = scheduledPreviewBufferSourcesRef.current;

    for (let ti = 0; ti < tracks.length; ti++) {
      const tr = tracks[ti];
      if (tr.kind !== 'audio') continue;
      const muted = trackMutesRef.current[ti] ?? false;
      if (muted) continue;
      for (const clip of tr.audioClips) {
        const buf = buffers.get(clip.sourceId);
        if (!buf) continue;
        const key = `${tr.id}:${clip.id}:${clip.startBeat}`;
        const tClipStart = sessionStart + (clip.startBeat - origin) * spb;
        const tClipEnd = tClipStart + clip.durationBeats * spb;
        if (tClipEnd < ctSnap - 0.02) {
          scheduled.delete(key);
          continue;
        }
        if (tClipStart > horizon) continue;
        if (scheduled.has(key)) continue;
        scheduled.add(key);
        try {
          const panMs = trackPansRef.current[ti] ?? 64;
          const monoT = trackMonosRef.current[ti] ?? false;
          const faderV = trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL;
          scheduleAudioClipOnPreviewBus({
            ctx,
            bus,
            buffer: buf,
            tClipStart,
            tClipEnd,
            tScheduleFrom: ctSnap + 0.002,
            pan127: panMs,
            monoTrack: monoT,
            faderVol127: faderV,
            tracking,
          });
        } catch {
          scheduled.delete(key);
        }
      }
    }
  }, []);

  const updateReadouts = useCallback((displayBeats: number, pausedLabel: boolean) => {
    const db = Math.max(0, displayBeats);
    const bars = formatBarsBeatsTicks(db, beatsPerBarRef.current);
    const sec = (db / Math.max(1, bpmRef.current)) * 60;
    const time = formatTimeMmSsFf(sec);
    const br = barsReadoutRef.current;
    const tr = timeReadoutRef.current;
    if (br) br.textContent = pausedLabel ? `pause ${bars}` : bars;
    if (tr) tr.textContent = time;
  }, []);

  /**
   * Core animation tick â€” called directly from the RAF loop with the browser's vsync timestamp.
   * Using rafTime (not performance.now()) gives hardware-vsync-aligned motion, the web equivalent
   * of CVDisplayLink used by the reference macOS app.
   *
   * READ â†’ COMPUTE â†’ WRITE order prevents layout thrashing:
   *   1. Read scroll state (layout reads) first
   *   2. Compute beat + pixel position
   *   3. Write transforms + scroll (layout writes)
   */
  const animationTick = useCallback((_rafTime: number) => {
    if (!runningRef.current && !isScreenActiveRef.current) return;

    const actxForAnchor = ctxRef.current;
    if (runningRef.current && actxForAnchor && actxForAnchor.state === 'running') {
      updateSchedAnchor(actxForAnchor, schedAnchorTimeRef, schedAnchorPerfRef);
    }

    const tb  = totalBeatsRef.current;
    const z   = timelineZoomRef.current;
    const bpb = beatsPerBarRef.current;
    const ppb = ppbAtZoom(z, bpb);
    const stripW = TOTAL_WIDTH_PX * z;

    /* ── 1. READ beat ───────────────────────────────────────────────────
     *
     *  Two beat values serve two different purposes:
     *
     *  b         – visual beat, read from the WAAPI compositor animation.
     *              Drives the scroll position (keepin the line centred on screen)
     *              and the loop-boundary check.  WAAPI is on the compositor thread
     *              so it is always smooth regardless of main-thread load.
     *
     *  bDisplay  – display beat, computed from the AUDIO CLOCK (ctx.currentTime
     *              extrapolated via schedAnchorTimeRef/schedAnchorPerfRef).
     *              This is the same clock the metronome uses, so the bar/beat counter
     *              rolls over at exactly the same instant as each metronome click.
     *              Falls back to b when the audio context isn't ready.
     * ─────────────────────────────────────────────────────────────────── */
    const wapiAnim = playheadWapiRef.current;
    let b: number;
    let bDisplay: number;

    if (runningRef.current && wapiAnim && wapiAnim.playState !== 'idle') {
      /* Visual beat from WAAPI */
      const animMs = Number(wapiAnim.currentTime ?? 0);
      const bpmUsed = wapiBpmRef.current;
      const seg = wapiSegLoopRef.current;
      const loopEndBeat = loopEndBeatRef.current;
      const loopStart = loopStartBeatRef.current;

      const seamless =
        seg.seamlessLoop &&
        loopOnRef.current &&
        seg.active &&
        loopEndBeat > loopStart &&
        loopEndBeatRef.current === seg.loopEndBeat &&
        loopStartBeatRef.current === seg.loopStartBeat;

      if (seamless) {
        const d = Math.max(1e-9, seg.durMs);
        const span = seg.loopEndBeat - seg.loopStartBeat;
        const phaseMs = ((animMs % d) + d) % d;
        b = seg.loopStartBeat + (phaseMs / d) * span;
      } else if (seg.active && loopOnRef.current) {
        const d = Math.max(1e-9, seg.durMs);
        const tClamped = Math.max(0, Math.min(seg.durMs, animMs));
        const span = seg.loopEndBeat - seg.loopStartBeat;
        b = Math.min(seg.loopEndBeat, Math.max(seg.loopStartBeat, seg.loopStartBeat + (tClamped / d) * span));
      } else {
        b = Math.max(0, Math.min(tb, animMs / 1000 * (bpmUsed / 60)));
      }

      /* Display beat from audio clock — locked to metronome */
      const actx = ctxRef.current;
      if (actx && actx.state === 'running' && schedAnchorTimeRef.current > 0) {
        const tSmooth = smoothSchedNow(schedAnchorTimeRef, schedAnchorPerfRef, actx);
        bDisplay = Math.max(0, Math.min(tb,
          originBeatRef.current + (tSmooth - sessionStartRef.current) * (bpmRef.current / 60),
        ));
      } else {
        bDisplay = b;
      }

      if (
        seamless &&
        wapiAnim.playState === 'running' &&
        loopOnRef.current
      ) {
        const d = Math.max(1e-9, seg.durMs);
        const span = seg.loopEndBeat - seg.loopStartBeat;
        const phaseMs = ((animMs % d) + d) % d;
        const bVis = Math.max(loopStart, Math.min(loopEndBeat, loopStart + (phaseMs / d) * span));
        const prevPh = wapiPrevPhaseMsRef.current;
        const cycle = Math.floor(animMs / d);
        /*
         * Splices audio at each compositor repeat boundary. Prefer Math.floor(time/duration) bumps; also
         * detect large backward jumps in wrapped phase when RAF skips so floor() never observes the edge.
         */
        const cycleBumped = cycle > wapiLoopCycleSeenRef.current;
        const phaseRewind = prevPh >= 0 && phaseMs < prevPh - d * 0.25;

        if (cycleBumped || phaseRewind) {
          /*
           * Match cold transport: seed sessionStart + sched anchoring exactly like startTransport.
           * originBeat solves for current smooth audio time × bVis from WAPI phase — not raw loopStart —
           * otherwise bar 2+ drifts versus click grid after each repeat splice.
           */
          const tSmoothSnap =
            actx && actx.state === 'running' && schedAnchorTimeRef.current > 0
              ? smoothSchedNow(schedAnchorTimeRef, schedAnchorPerfRef, actx)
              : null;

          const ctxLoop = ctxRef.current;
          if (ctxLoop && ctxLoop.state !== 'closed') {
            const tCapture = audioNow(ctxLoop);
            sessionStartRef.current = tCapture + AUDIO_START_FLOOR_SEC;
            schedAnchorTimeRef.current = tCapture;
            schedAnchorPerfRef.current = performance.now();
            perfSessionStartMsRef.current = performance.now() + AUDIO_START_FLOOR_SEC * 1000;

            const rate = bpmRef.current / 60;
            if (tSmoothSnap !== null) {
              originBeatRef.current = bVis - (tSmoothSnap - sessionStartRef.current) * rate;
            } else {
              originBeatRef.current = bVis;
            }

            cursorBeatRef.current = bVis;
            displayBeatRef.current = bVis;

            nextMetroKRef.current = snapBeatToQuarterGrid(Math.min(tb, Math.max(0, bVis)), tb);

            cancelScheduledMetroNodes();
            cancelArrangerPreviewScheduling();

            refillMetronome(ctxLoop, tCapture, { loopContinuation: true });
            refillMidiPreview(ctxLoop, tCapture);
            refillAudioPreview(ctxLoop, tCapture);
          }

          if (actx && actx.state === 'running' && schedAnchorTimeRef.current > 0) {
            const tSmoothAfter = smoothSchedNow(schedAnchorTimeRef, schedAnchorPerfRef, actx);
            bDisplay = Math.max(0, Math.min(tb,
              originBeatRef.current + (tSmoothAfter - sessionStartRef.current) * (bpmRef.current / 60),
            ));
          } else {
            bDisplay = bVis;
          }

          if (phaseRewind && !cycleBumped) {
            wapiLoopCycleSeenRef.current = Math.max(wapiLoopCycleSeenRef.current, cycle);
          } else {
            wapiLoopCycleSeenRef.current = cycle;
          }
        }
        wapiPrevPhaseMsRef.current = phaseMs;
      }

      /*
       * Discrete wrap (finite one-shot segment): rebuild animations at loop start after both clocks agree.
       * Repeating loop uses seamlessLoop + bump handler above instead.
       */
      const loopBeatEps = 1e-6;
      const loopEndMsEps = 0.65;
      const segEnds =
        seg.active &&
        loopOnRef.current &&
        loopEndBeatRef.current === seg.loopEndBeat &&
        animMs >= Math.max(0, seg.durMs - loopEndMsEps);
      const audioPastLoopEnd = bDisplay >= loopEndBeat - loopBeatEps;
      const compositorPastLoopEnd = b >= loopEndBeat - loopBeatEps || segEnds;
      const segmentTimedToLoopBar =
        seg.active &&
        loopOnRef.current &&
        loopEndBeatRef.current === seg.loopEndBeat &&
        loopEndBeat > loopStart;
      const shouldWrapLoopNow =
        !seamless &&
        loopOnRef.current &&
        loopEndBeat > loopStart &&
        (segmentTimedToLoopBar
          ? audioPastLoopEnd && compositorPastLoopEnd
          : audioPastLoopEnd || compositorPastLoopEnd);
      if (shouldWrapLoopNow) {
        const ls = loopStart;
        originBeatRef.current = ls;
        cursorBeatRef.current = ls;
        displayBeatRef.current = ls;

        nextMetroKRef.current = snapBeatToQuarterGrid(ls, tb);

        const ctxLoop = ctxRef.current;
        if (ctxLoop && ctxLoop.state !== 'closed') {
          /*
           * Same audio clock seeds as cold start (see startTransport). Refill keeps LOOP_METRO_CHAIN_FLOOR_SEC.
           */
          const tCapture = audioNow(ctxLoop);
          sessionStartRef.current = tCapture + AUDIO_START_FLOOR_SEC;
          schedAnchorTimeRef.current = tCapture;
          schedAnchorPerfRef.current = performance.now();
          perfSessionStartMsRef.current = performance.now() + AUDIO_START_FLOOR_SEC * 1000;

          cancelScheduledMetroNodes();
          cancelArrangerPreviewScheduling();

          refillMetronome(ctxLoop, tCapture, { loopContinuation: true });
          refillMidiPreview(ctxLoop, tCapture);
          refillAudioPreview(ctxLoop, tCapture);
        }

        launchWapiAnims(ls, true);
        b = ls;
        bDisplay = ls;
      }
      cursorBeatRef.current  = b;
      displayBeatRef.current = bDisplay;
    } else {
      b = cursorBeatRef.current;
      bDisplay = b;
      displayBeatRef.current = b;
    }

    /* ── 2. READ layout state ─────────────────────────────────────────── */
    const scrollEl    = timelineHScrollRef.current;
    const scrollLeft  = scrollEl ? scrollEl.scrollLeft : 0;
    const clientWidth = scrollEl ? scrollEl.clientWidth : 0;

    /* ── 3. COMPUTE pixel positions (scroll + inner-line correction only) */
    const bClamped   = Math.max(0, Math.min(b, tb));
    const lineCenter = bClamped * ppb;

    const gw = PLAYHEAD_GRIP_W_PX;
    const pw = PLAYHEAD_W_PX;
    // WAAPI uses unclamped group position (x = b*ppb - gw/2); algebraically innerOffset = 0 always.
    const innerOffset = 0;

    const pad = TIMELINE_SCROLL_MARGIN_PX;
    let newScrollLeft = scrollLeft;
    const playheadScreen = lineCenter - scrollLeft;
    if (playheadScreen < pad && scrollLeft > 0) {
      newScrollLeft = Math.max(0, lineCenter - pad);
    } else if (playheadScreen > clientWidth - pad) {
      newScrollLeft = Math.max(0, lineCenter - clientWidth + pad);
    }

    /* Bar/time readouts use the audio-clock beat so they roll over with the metronome. */
    const bars = formatBarsBeatsTicks(bDisplay, bpb);
    const sec  = (bDisplay / Math.max(1, bpmRef.current)) * 60;
    const time = formatTimeMmSsFf(sec);

    /* ── 4. WRITE — inner line, scroll, readouts only ─────────────────── */
    /* playheadGroupRef and pianoPlayheadRef are driven by WAAPI — do NOT touch them */
    const ln = playheadLineRef.current;
    if (ln) ln.style.transform = `translateX(${innerOffset}px)`;
    if (scrollEl && Math.abs(newScrollLeft - scrollLeft) >= 1) scrollEl.scrollLeft = newScrollLeft;
    const br = barsReadoutRef.current;
    if (br) br.textContent = runningRef.current ? bars : `pause ${bars}`;
    const tr = timeReadoutRef.current;
    if (tr) tr.textContent = time;

    if (!runningRef.current) {
      syncTimelineGridLayer(
      timelineCanvasRef.current,
      gridCacheRef,
      z,
      studioTracksRef.current,
      bpb,
      trackLaneHRef.current,
      selectedTrackIndexRef.current,
      selectedPianoIdxRef.current,
    );
    }

    /* ── 5. MIXER VU METERS (DOM-direct, no React state) ──────────────
     * Read MIDI note activity at the current beat to drive each channel's
     * stereo meter bars.  Only runs when the mixer panel is open.
     * ─────────────────────────────────────────────────────────────────── */
    if (showMixerRef.current) {
      const tracks   = studioTracksRef.current;
      const decayRate = runningRef.current ? 0.06 : 0.12; /* faster decay when stopped */
      let masterPeak = 0;

      for (let ti = 0; ti < tracks.length; ti++) {
        const trk    = tracks[ti];
        const muted  = (trackMutes[ti] ?? false);
        const monoT  = (trackMonos[ti] ?? false);
        const pan127 = trackPans[ti] ?? 64;
        let peak     = 0;

        if (runningRef.current && !muted) {
          if (trk.kind === 'midi') {
            for (const note of trk.notes) {
              if (bDisplay >= note.startBeat && bDisplay < note.startBeat + note.durationBeats) {
                const raw = (note.velocity / 127) * (0.9 + Math.random() * 0.15);
                const vMul = mixerVolToLinearGain(trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL);
                const adj = raw * vMul;
                if (adj > peak) peak = adj;
              }
            }
          } else if (trk.kind === 'audio') {
            for (const clip of trk.audioClips) {
              if (bDisplay >= clip.startBeat && bDisplay < clip.startBeat + clip.durationBeats) {
                const buf = studioAudioBuffersRef.current.get(clip.sourceId);
                const raw = (buf ? 0.62 : 0.42) * (0.88 + Math.random() * 0.12);
                const vMul = mixerVolToLinearGain(trackVolumesRef.current[ti] ?? MIXER_UNITY_VOL);
                const adj = raw * vMul;
                if (adj > peak) peak = adj;
              }
            }
          }
        }

        /* Smooth: jump up fast, decay slowly */
        const prev = mixerLevelsRef.current[ti] ?? 0;
        mixerLevelsRef.current[ti] = peak > prev ? peak : Math.max(0, prev - decayRate);
        const level = mixerLevelsRef.current[ti];

        /* Pan / mono → L/R metering (matches StereoPanner + mono-collapse path). */
        const { wl, wr } = mixerPanMeterWeights(pan127, monoT);
        const comp = monoT ? level : Math.max(level * wl, level * wr);

        /* Write heights directly to DOM — bypasses React rendering */
        const lEl = mixerMeterLsRef.current[ti];
        const rEl = mixerMeterRsRef.current[ti];
        const lVal = Math.max(0, level * wl);
        const lh = `${Math.round(lVal * 100)}%`;
        /* R channel keeps a hair of independent jitter so stereo meters feel alive */
        const rVal = monoT ? lVal : Math.max(0, level * wr - Math.random() * 0.06);
        const rh = `${Math.round(rVal * 100)}%`;
        if (lEl) {
          lEl.style.height = lh;
          lEl.style.background = meterFillGradient(lVal, muted);
        }
        if (rEl) {
          rEl.style.height = rh;
          rEl.style.background = meterFillGradient(rVal, muted);
        }

        if (comp > masterPeak) masterPeak = comp;
      }

      /* Master bus shows peak across all active tracks */
      const prevMaster = mixerLevelsRef.current[MAX_STUDIO_TRACKS] ?? 0;
      mixerLevelsRef.current[MAX_STUDIO_TRACKS] = masterPeak > prevMaster ? masterPeak : Math.max(0, prevMaster - decayRate);
      const masterLvl = mixerLevelsRef.current[MAX_STUDIO_TRACKS];
      const mlVal = Math.max(0, masterLvl);
      const mrVal = Math.max(0, masterLvl - Math.random() * 0.06);
      const mlh = `${Math.round(mlVal * 100)}%`;
      const mrh = `${Math.round(mrVal * 100)}%`;
      if (mixerMasterLRef.current) {
        mixerMasterLRef.current.style.height = mlh;
        mixerMasterLRef.current.style.background = meterFillGradient(mlVal, false);
      }
      if (mixerMasterRRef.current) {
        mixerMasterRRef.current.style.height = mrh;
        mixerMasterRRef.current.style.background = meterFillGradient(mrVal, false);
      }
    }
  }, [
    cancelArrangerPreviewScheduling,
    cancelScheduledMetroNodes,
    launchWapiAnims,
    refillAudioPreview,
    refillMetronome,
    refillMidiPreview,
    trackMutes,
    trackPans,
    trackMonos,
  ]);

  const paintTransport = useCallback(() => {
    animationTick(performance.now());
  }, [animationTick]);

  /** Thin wrapper so the RAF loop can pass its vsync timestamp straight through. */
  const transportFrame = useCallback((rafTime: number) => {
    if (!runningRef.current && !isScreenActiveRef.current) return;
    animationTick(rafTime);
  }, [animationTick]);

  const setBeatFromScrubClientX = useCallback(
    (clientX: number) => {
      const el = timelineRulerScrubRef.current ?? timelineStripRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const x = clientX - rect.left;
      const tb = totalBeatsRef.current;
      const b = (x / rect.width) * tb;
      cursorBeatRef.current = Math.max(0, Math.min(tb, b));
      displayBeatRef.current = cursorBeatRef.current;
      applyPlayheadFull(cursorBeatRef.current);
      updateReadouts(cursorBeatRef.current, true);
    },
    [applyPlayheadFull, updateReadouts],
  );

  /** Convert a clientX position on the timeline strip into a beat value.
   *  getBoundingClientRect() already accounts for scroll (it's viewport-relative),
   *  so subtracting rect.left gives the correct strip-local X without adding scrollLeft. */
  const clientXToBeat = useCallback((clientX: number): number => {
    const el = timelineStripRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const z    = timelineZoomRef.current;
    const bpb  = beatsPerBarRef.current;
    const ppb  = ppbAtZoom(z, bpb);
    /* rect.left is the viewport-left of the strip — already negative when scrolled right */
    const x    = clientX - rect.left;
    const tb   = totalBeatsRef.current;
    return Math.max(0, Math.min(tb, x / ppb));
  }, []);

  /** FL-style loop-region pointer-down on the ruler bar strip. */
  const onLoopRulerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);

    const beat = clientXToBeat(e.clientX);
    const ls   = loopStartBeatRef.current;
    const le   = loopEndBeatRef.current;
    const span = le - ls;
    const HANDLE_BEATS = Math.max(0.5, span * 0.06); // ~6% of region width for handle zone

    let mode: 'draw' | 'left' | 'right' | 'slide';
    if (Math.abs(beat - ls) <= HANDLE_BEATS) {
      mode = 'left';
    } else if (Math.abs(beat - le) <= HANDLE_BEATS) {
      mode = 'right';
    } else if (beat > ls && beat < le) {
      mode = 'slide';
    } else {
      mode = 'draw';
    }

    loopDragRef.current = { mode, startBeatSnapshot: ls, endBeatSnapshot: le, anchorBeat: beat };
    /* Auto-enable loop when user touches the ruler */
    if (!loopOnRef.current) setLoopOn(true);
  }, [clientXToBeat]);

  const onLoopRulerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = loopDragRef.current;
    if (!drag) return;
    const beat  = clientXToBeat(e.clientX);
    const tb    = totalBeatsRef.current;
    const delta = beat - drag.anchorBeat;
    const bpb   = beatsPerBarRef.current;

    let newStart = drag.startBeatSnapshot;
    let newEnd   = drag.endBeatSnapshot;

    if (drag.mode === 'draw') {
      const a = drag.anchorBeat;
      newStart = Math.max(0, Math.min(a, beat));
      newEnd   = Math.min(tb, Math.max(a, beat));
    } else if (drag.mode === 'left') {
      newStart = Math.max(0, Math.min(drag.endBeatSnapshot - bpb, beat));
    } else if (drag.mode === 'right') {
      newEnd = Math.min(tb, Math.max(drag.startBeatSnapshot + bpb, beat));
    } else if (drag.mode === 'slide') {
      newStart = Math.max(0, drag.startBeatSnapshot + delta);
      newEnd   = Math.min(tb, drag.endBeatSnapshot + delta);
      /* Clamp both edges without shrinking span */
      if (newStart <= 0) { newEnd = newEnd - newStart; newStart = 0; }
      if (newEnd >= tb)  { newStart = newStart - (newEnd - tb); newEnd = tb; }
    }

    setLoopStartBeat(newStart);
    setLoopEndBeat(newEnd);
    /* Keep loopBars in sync so the old loop engine stays consistent */
    const bars = Math.max(1, Math.round((newEnd - newStart) / bpb));
    setLoopBars(bars);
  }, [clientXToBeat]);

  const onLoopRulerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!loopDragRef.current) return;
    /* Snap to bar boundaries on release for clean loops */
    const bpb      = beatsPerBarRef.current;
    let newStart   = Math.round(loopStartBeatRef.current / bpb) * bpb;
    let newEnd     = Math.round(loopEndBeatRef.current   / bpb) * bpb;
    if (newEnd <= newStart) newEnd = newStart + bpb;
    setLoopStartBeat(newStart);
    setLoopEndBeat(newEnd);
    setLoopBars(Math.max(1, Math.round((newEnd - newStart) / bpb)));
    loopDragRef.current = null;
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch { /**/ }
  }, []);

  /** Piano bar ruler click-to-seek (same beat mapping as timeline; Musio `TrackPianoRollView` ruler). */
  const seekFromPianoStripX = useCallback(
    (stripXCss: number) => {
      const w = TOTAL_WIDTH_PX * timelineZoomRef.current;
      if (w <= 0) return;
      const tb = totalBeatsRef.current;
      const b = (stripXCss / w) * tb;
      cursorBeatRef.current = Math.max(0, Math.min(tb, b));
      displayBeatRef.current = cursorBeatRef.current;
      applyPlayheadFull(cursorBeatRef.current);
      updateReadouts(cursorBeatRef.current, true);
    },
    [applyPlayheadFull, updateReadouts],
  );

  /** `TransportView` Rewind / Fast-forward â€” nudge playhead by one bar when transport is idle. */
  const nudgePlayheadBeats = useCallback(
    (delta: number) => {
      if (runningRef.current) return;
      const tb = totalBeatsRef.current;
      const nb = Math.max(0, Math.min(tb, cursorBeatRef.current + delta));
      cursorBeatRef.current = nb;
      displayBeatRef.current = nb;
      applyPlayheadFull(nb);
      updateReadouts(nb, true);
    },
    [applyPlayheadFull, updateReadouts],
  );

  const updateTrackNotes = useCallback((trackIndex: number, notes: MockMidiNote[]) => {
    setStudioTracks((prev) =>
      prev.map((t, i) => (i === trackIndex && t.kind === 'midi' ? { ...t, notes } : t)),
    );
  }, []);

  const sortNotesLikePianoRoll = useCallback(
    (notes: MockMidiNote[]) =>
      [...notes].sort((a, b) => (a.startBeat !== b.startBeat ? a.startBeat - b.startBeat : a.pitch - b.pitch)),
    [],
  );

  const applyTracksMutation = useCallback((fn: (prev: MockMusioTrack[]) => MockMusioTrack[]) => {
    setStudioTracks((prev) => {
      undoStacksRef.current = [...undoStacksRef.current.slice(-49), snapshotStudioTracks(prev)];
      redoStacksRef.current = [];
      return fn(prev);
    });
  }, []);

  const closeEditorContextMenu = useCallback(() => {
    midiMenuTargetRef.current = null;
    setContextMenuHasNoteTarget(false);
    setEditorContextMenu(null);
  }, []);

  const clearSelectedPianoNotes = useCallback(() => {
    setSelectedPianoNoteIndex(null);
    setSelectedPianoNoteIndexes(new Set());
  }, []);

  const selectOnlyPianoNote = useCallback((idx: number | null) => {
    setSelectedPianoNoteIndex(idx);
    setSelectedPianoNoteIndexes(idx === null ? new Set() : new Set([idx]));
  }, []);

  const togglePianoNoteSelection = useCallback((idx: number) => {
    setSelectedPianoNoteIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      const arr = [...next].sort((a, b) => a - b);
      setSelectedPianoNoteIndex(arr.length ? arr[arr.length - 1]! : null);
      return next;
    });
  }, []);

  const selectedIndicesForTrack = useCallback((ti: number): number[] => {
    const tr = studioTracksRef.current[ti];
    if (!tr || tr.kind !== 'midi') return [];
    const setVals = [...selectedPianoIdxSetRef.current]
      .filter((i) => Number.isInteger(i) && i >= 0 && i < tr.notes.length)
      .sort((a, b) => a - b);
    if (setVals.length) return setVals;
    const single = selectedPianoIdxRef.current;
    return single !== null && single >= 0 && single < tr.notes.length ? [single] : [];
  }, []);

  /** FL-style convenience: if nothing is selected, actions target all notes on active MIDI track. */
  const selectedOrAllIndicesForTrack = useCallback((ti: number): number[] => {
    const tr = studioTracksRef.current[ti];
    if (!tr || tr.kind !== 'midi') return [];
    const selected = selectedIndicesForTrack(ti);
    if (selected.length) return selected;
    return tr.notes.map((_, i) => i);
  }, [selectedIndicesForTrack]);

  const selectTrackAndClearPianoNote = useCallback((i: number) => {
    setSelectedTrackIndex(i);
    clearSelectedPianoNotes();
  }, [clearSelectedPianoNotes]);

  const ingestDroppedAudioOnAudioTrack = useCallback(
    async (e: DragEvent<HTMLElement>, audioTrackIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      const dt = e.dataTransfer;
      if (!dt?.files?.length) return;
      const file = Array.from(dt.files).find(isDroppedAudioFile);
      if (!file || file.size <= 0) return;

      const tracksNow = studioTracksRef.current;
      const trTarget = tracksNow[audioTrackIndex];
      if (!trTarget || trTarget.kind !== 'audio') return;

      try {
        const ctx = await ensureCtx();
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch {
            /* autoplay */
          }
        }
        const raw = await file.arrayBuffer();
        const buffer = await ctx.decodeAudioData(raw.slice(0));
        const sourceId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `src-${crypto.randomUUID()}`
            : `src-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const clipId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `ac-${crypto.randomUUID()}`
            : `ac-${Date.now()}`;
        studioAudioBuffersRef.current.set(sourceId, buffer);

        const bpmNow = bpmRef.current;
        const bpb = beatsPerBarRef.current;
        const tb = totalBeatsForSig(bpb);
        const durBeats = Math.min(tb, audioDurationBeatsFromSeconds(buffer.duration, bpmNow));
        const rawNotes = audioBufferToMonophonicMidiNotes(buffer, bpmNow);
        const notes: MockMidiNote[] = rawNotes
          .map((n) => ({
            pitch: n.pitch,
            velocity: n.velocity,
            startBeat: Math.max(0, Math.min(tb - 1 / 128, n.startBeat)),
            durationBeats: Math.max(1 / 128, Math.min(tb - Math.max(0, n.startBeat), n.durationBeats)),
          }))
          .filter((n) => n.durationBeats >= 1 / 64);

        const baseName = (file.name.replace(/\.[^.]+$/, '') || 'Audio').slice(0, 48);
        const clip: StudioAudioClip = {
          id: clipId,
          sourceId,
          startBeat: 0,
          durationBeats: durBeats,
          name: baseName,
        };

        const hadRoom = tracksNow.length < MAX_STUDIO_TRACKS;
        const addMidi = hadRoom && notes.length > 0;

        applyTracksMutation((prev) => {
          const ti = audioTrackIndex;
          if (ti < 0 || ti >= prev.length) return prev;
          const tgt = prev[ti];
          if (!tgt || tgt.kind !== 'audio') return prev;
          const withClip: MockMusioTrack = { ...tgt, audioClips: [...tgt.audioClips, clip] };
          if (!addMidi) return prev.map((t, i) => (i === ti ? withClip : t));
          const midiTrack: MockMusioTrack = {
            id: newTrackId(),
            name: `${baseName} MIDI`,
            colorHex: NEW_TRACK_COLOR_HEX[(ti + 1) % NEW_TRACK_COLOR_HEX.length],
            kind: 'midi',
            notes,
            audioClips: [],
          };
          const next = prev.map((t, i) => (i === ti ? withClip : t));
          next.splice(ti + 1, 0, midiTrack);
          return next;
        });

        if (addMidi) {
          clearSelectedPianoNotes();
          setSelectedTrackIndex(audioTrackIndex + 1);
        } else {
          if (notes.length > 0 && !hadRoom) {
            console.warn('Studio Editor 2: track limit reached — audio clip imported, MIDI track skipped.');
          }
          setSelectedTrackIndex(audioTrackIndex);
        }
      } catch (err) {
        console.error('Studio Editor 2: audio → MIDI drop failed', err);
      }
    },
    [applyTracksMutation, clearSelectedPianoNotes, ensureCtx],
  );

  const onStudioAudioTrackHeaderDragOver = useCallback((e: DragEvent<HTMLDivElement>, ti: number) => {
    if (!e.dataTransfer.types?.includes?.('Files')) return;
    const tr = studioTracksRef.current[ti];
    if (tr?.kind !== 'audio') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onStudioTimelineAudioLaneDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types?.includes?.('Files')) return;
    const strip = timelineStripRef.current;
    if (!strip) return;
    const pos = timelineLanePointFromStripClient(
      strip,
      e.clientX,
      e.clientY,
      studioTracksRef.current.length,
      trackLaneHRef.current,
    );
    if (pos !== null && studioTracksRef.current[pos.ti]?.kind === 'audio') {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onStudioTimelineAudioLaneDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      if (!e.dataTransfer?.types?.includes?.('Files')) return;
      const strip = timelineStripRef.current;
      if (!strip) return;
      const pos = timelineLanePointFromStripClient(
        strip,
        e.clientX,
        e.clientY,
        studioTracksRef.current.length,
        trackLaneHRef.current,
      );
      if (pos === null) return;
      if (studioTracksRef.current[pos.ti]?.kind !== 'audio') return;
      e.preventDefault();
      e.stopPropagation();
      await ingestDroppedAudioOnAudioTrack(e, pos.ti);
    },
    [ingestDroppedAudioOnAudioTrack],
  );

  const putMidiOnClipboard = useCallback((clips: MockMidiNote[] | null) => {
    if (!clips?.length) {
      midiClipboardRef.current = null;
      setMidiClipboardHeld(false);
      return;
    }
    midiClipboardRef.current = clips.map((n) => ({ ...n }));
    setMidiClipboardHeld(true);
  }, []);

  const midiCopySelection = useCallback(() => {
    const mt = midiMenuTargetRef.current;
    const ti = mt?.trackIndex ?? selectedTrackIndexRef.current;
    const tr = studioTracksRef.current[ti];
    if (!tr || tr.kind !== 'midi') return;
    const fromMenu = mt?.noteIndex;
    const indices =
      fromMenu !== null && fromMenu !== undefined
        ? [fromMenu].filter((i) => i >= 0 && i < tr.notes.length)
        : selectedOrAllIndicesForTrack(ti);
    if (!indices.length) return;
    putMidiOnClipboard(indices.map((i) => ({ ...tr.notes[i]! })));
  }, [putMidiOnClipboard, selectedOrAllIndicesForTrack]);

  const midiCutSelection = useCallback(() => {
    const mt = midiMenuTargetRef.current;
    const ti = mt?.trackIndex ?? selectedTrackIndexRef.current;
    const tr = studioTracksRef.current[ti];
    if (!tr || tr.kind !== 'midi') return;
    const fromMenu = mt?.noteIndex;
    const indices =
      fromMenu !== null && fromMenu !== undefined
        ? [fromMenu].filter((i) => i >= 0 && i < tr.notes.length)
        : selectedOrAllIndicesForTrack(ti);
    if (!indices.length) return;
    const cutSet = new Set(indices);
    putMidiOnClipboard(indices.map((i) => ({ ...tr.notes[i]! })));
    applyTracksMutation((prev) =>
      prev.map((t, i) =>
        i === ti ? { ...t, notes: sortNotesLikePianoRoll(t.notes.filter((_, j) => !cutSet.has(j))) } : t,
      ),
    );
    clearSelectedPianoNotes();
    midiMenuTargetRef.current = null;
  }, [applyTracksMutation, putMidiOnClipboard, sortNotesLikePianoRoll, selectedOrAllIndicesForTrack, clearSelectedPianoNotes]);

  const midiPasteSelection = useCallback(() => {
    const buf = midiClipboardRef.current;
    if (!buf?.length) return;
    const mt = midiMenuTargetRef.current;
    const ti = mt?.trackIndex ?? selectedTrackIndexRef.current;
    const trPaste = studioTracksRef.current[ti];
    if (!trPaste || trPaste.kind !== 'midi') return;
    const snap = pianoSnapEffRef.current;
    const tb = totalBeatsRef.current;
    const anchor = Math.min(...buf.map((n) => n.startBeat));
    const pasteBeat = snapBeatToSubdivision(cursorBeatRef.current, snap, tb);
    const delta = pasteBeat - anchor;
    const pasted: MockMidiNote[] = buf.map((n) => {
      let sb = snapBeatToSubdivision(n.startBeat + delta, snap, tb);
      sb = Math.max(0, Math.min(tb - PIANO_MIN_NOTE_DURATION_BEATS, sb));
      const durCap = tb - sb;
      const dur = Math.max(PIANO_MIN_NOTE_DURATION_BEATS, Math.min(n.durationBeats, durCap));
      return { ...n, startBeat: sb, durationBeats: dur };
    });
    const pastedSelection = new Set<number>();
    flushSync(() => {
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== ti) return t;
          const merged = sortNotesLikePianoRoll([...t.notes, ...pasted]);
          pasted.forEach((p) => {
            const idx = merged.findIndex(
              (n) =>
                n.pitch === p.pitch &&
                Math.abs(n.startBeat - p.startBeat) < 1e-4 &&
                Math.abs(n.durationBeats - p.durationBeats) < 1e-4 &&
                Math.abs(n.velocity - p.velocity) < 1e-4,
            );
            if (idx >= 0) pastedSelection.add(idx);
          });
          return { ...t, notes: merged };
        }),
      );
    });
    const arr = [...pastedSelection].sort((a, b) => a - b);
    setSelectedPianoNoteIndexes(new Set(arr));
    setSelectedPianoNoteIndex(arr.length ? arr[arr.length - 1]! : null);
  }, [applyTracksMutation, sortNotesLikePianoRoll]);

  const midiDuplicateSelection = useCallback(() => {
    const mt = midiMenuTargetRef.current;
    const ti = mt?.trackIndex ?? selectedTrackIndexRef.current;
    const snap = pianoSnapEffRef.current;
    const tb = totalBeatsRef.current;
    const tr = studioTracksRef.current[ti];
    if (!tr || tr.kind !== 'midi') return;
    const fromMenu = mt?.noteIndex;
    const indices =
      fromMenu !== null && fromMenu !== undefined
        ? [fromMenu].filter((i) => i >= 0 && i < tr.notes.length)
        : selectedOrAllIndicesForTrack(ti);
    if (!indices.length) return;
    const clones: MockMidiNote[] = indices.map((ni) => {
      const n = tr.notes[ni]!;
      let newStart = snapBeatToSubdivision(n.startBeat + n.durationBeats, snap, tb);
      newStart = Math.max(0, Math.min(tb - PIANO_MIN_NOTE_DURATION_BEATS, newStart));
      const durCap = tb - newStart;
      const dur = Math.max(PIANO_MIN_NOTE_DURATION_BEATS, Math.min(n.durationBeats, durCap));
      return { pitch: n.pitch, velocity: n.velocity, startBeat: newStart, durationBeats: dur };
    });
    const sel = new Set<number>();
    flushSync(() => {
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== ti) return t;
          const merged = sortNotesLikePianoRoll([...t.notes, ...clones]);
          clones.forEach((c) => {
            const idx = merged.findIndex(
              (note) =>
                note.pitch === c.pitch &&
                Math.abs(note.startBeat - c.startBeat) < 1e-4 &&
                Math.abs(note.durationBeats - c.durationBeats) < 1e-4,
            );
            if (idx >= 0) sel.add(idx);
          });
          return { ...t, notes: merged };
        }),
      );
    });
    const arr = [...sel].sort((a, b) => a - b);
    setSelectedPianoNoteIndexes(new Set(arr));
    setSelectedPianoNoteIndex(arr.length ? arr[arr.length - 1]! : null);
  }, [applyTracksMutation, sortNotesLikePianoRoll, selectedOrAllIndicesForTrack]);

  const midiDeleteSelection = useCallback(() => {
    const mt = midiMenuTargetRef.current;
    const ti = mt?.trackIndex ?? selectedTrackIndexRef.current;
    const trDel = studioTracksRef.current[ti];
    if (!trDel || trDel.kind !== 'midi') return;
    const fromMenu = mt?.noteIndex;
    const indices =
      fromMenu !== null && fromMenu !== undefined
        ? [fromMenu].filter((i) => i >= 0 && i < trDel.notes.length)
        : selectedOrAllIndicesForTrack(ti);
    if (!indices.length) return;
    const delSet = new Set(indices);
    applyTracksMutation((prev) =>
      prev.map((t, i) =>
        i === ti && t.kind === 'midi'
          ? { ...t, notes: sortNotesLikePianoRoll(t.notes.filter((_, j) => !delSet.has(j))) }
          : t,
      ),
    );
    clearSelectedPianoNotes();
  }, [applyTracksMutation, sortNotesLikePianoRoll, selectedOrAllIndicesForTrack, clearSelectedPianoNotes]);

  const midiSplitSelection = useCallback(() => {
    const mt = midiMenuTargetRef.current;
    const ti = mt?.trackIndex ?? selectedTrackIndexRef.current;
    const ni = mt?.noteIndex ?? selectedPianoIdxRef.current;
    const snap = pianoSnapEffRef.current;
    const tb = totalBeatsRef.current;
    const tr = studioTracksRef.current[ti];
    if (ni === null || !tr || tr.kind !== 'midi' || ni < 0 || ni >= tr.notes.length) return;
    const n = tr.notes[ni]!;
    const splitRaw = snapBeatToSubdivision(cursorBeatRef.current, snap, tb);
    const eps = 1e-5;
    if (splitRaw <= n.startBeat + eps || splitRaw >= n.startBeat + n.durationBeats - eps) return;
    const durLeft = splitRaw - n.startBeat;
    const durRight = n.startBeat + n.durationBeats - splitRaw;
    if (durLeft < PIANO_MIN_NOTE_DURATION_BEATS || durRight < PIANO_MIN_NOTE_DURATION_BEATS) return;
    const left: MockMidiNote = { ...n, durationBeats: durLeft };
    const right: MockMidiNote = { ...n, startBeat: splitRaw, durationBeats: durRight };
    flushSync(() => {
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== ti) return t;
          const next = [...t.notes];
          next.splice(ni, 1, left, right);
          return { ...t, notes: sortNotesLikePianoRoll(next) };
        }),
      );
    });
    const trAfter = studioTracksRef.current[ti];
    if (trAfter) {
      const idx = trAfter.notes.findIndex(
        (note) =>
          note.pitch === n.pitch &&
          Math.abs(note.startBeat - splitRaw) < 1e-4 &&
          Math.abs(note.durationBeats - durRight) < 1e-4,
      );
      if (idx >= 0) setSelectedPianoNoteIndex(idx);
    }
  }, [applyTracksMutation, sortNotesLikePianoRoll]);

  const applySelectionTransform = useCallback(
    (transform: (notes: MockMidiNote[], selected: number[], snap: number, tb: number) => MockMidiNote[]) => {
      const ti = selectedTrackIndexRef.current;
      const tr = studioTracksRef.current[ti];
      if (!tr || tr.kind !== 'midi') return;
      const selected = selectedOrAllIndicesForTrack(ti);
      if (!selected.length) return;
      const snap = pianoSnapEffRef.current;
      const tb = totalBeatsRef.current;
      applyTracksMutation((prev) =>
        prev.map((t, i) => {
          if (i !== ti || t.kind !== 'midi') return t;
          return { ...t, notes: sortNotesLikePianoRoll(transform(t.notes, selected, snap, tb)) };
        }),
      );
    },
    [applyTracksMutation, selectedOrAllIndicesForTrack, sortNotesLikePianoRoll],
  );

  const quantizeSelected = useCallback(() => {
    applySelectionTransform((notes, selected, snap, tb) => {
      const set = new Set(selected);
      const strength = Math.max(0, Math.min(1, quantizeStrength / 100));
      const swing = Math.max(0, Math.min(0.49, quantizeSwing / 200));
      return notes.map((n, i) => {
        if (!set.has(i)) return n;
        const q = snapBeatToSubdivision(n.startBeat, snap, tb);
        const next = n.startBeat + (q - n.startBeat) * strength;
        const swingOff = ((Math.floor(next * snap) % 2) === 1 ? (1 / snap) * swing : 0);
        const sb = Math.max(0, Math.min(tb - PIANO_MIN_NOTE_DURATION_BEATS, next + swingOff));
        return { ...n, startBeat: sb };
      });
    });
  }, [applySelectionTransform, quantizeStrength, quantizeSwing]);

  const transposeSelected = useCallback((semi: number) => {
    applySelectionTransform((notes, selected) => {
      const set = new Set(selected);
      return notes.map((n, i) =>
        set.has(i) ? { ...n, pitch: Math.max(PIANO_PITCH_LO, Math.min(PIANO_PITCH_HI, n.pitch + semi)) } : n,
      );
    });
  }, [applySelectionTransform]);

  const humanizeSelected = useCallback(() => {
    applySelectionTransform((notes, selected, snap, tb) => {
      const set = new Set(selected);
      const halfCell = 0.5 * (1 / snap);
      return notes.map((n, i) => {
        if (!set.has(i)) return n;
        const j = Math.sin((n.pitch + 1) * 17.23 + n.startBeat * 43.11);
        const dt = j * halfCell * 0.35;
        const dv = Math.round(j * 10);
        return {
          ...n,
          startBeat: Math.max(0, Math.min(tb - PIANO_MIN_NOTE_DURATION_BEATS, n.startBeat + dt)),
          velocity: Math.max(1, Math.min(127, n.velocity + dv)),
        };
      });
    });
  }, [applySelectionTransform]);

  const legatoSelected = useCallback(() => {
    applySelectionTransform((notes, selected, _snap, tb) => {
      const sel = new Set(selected);
      const sortedSel = [...selected].sort((a, b) => notes[a]!.startBeat - notes[b]!.startBeat);
      const nextByIdx = new Map<number, MockMidiNote>();
      for (let i = 0; i < sortedSel.length - 1; i++) nextByIdx.set(sortedSel[i]!, notes[sortedSel[i + 1]!]!);
      return notes.map((n, i) => {
        if (!sel.has(i)) return n;
        const nx = nextByIdx.get(i);
        if (!nx) return n;
        const dur = Math.max(PIANO_MIN_NOTE_DURATION_BEATS, nx.startBeat - n.startBeat);
        return { ...n, durationBeats: Math.min(tb - n.startBeat, dur) };
      });
    });
  }, [applySelectionTransform]);

  const duplicateSelectedPhrase = useCallback(() => {
    const ti = selectedTrackIndexRef.current;
    const tr = studioTracksRef.current[ti];
    if (!tr || tr.kind !== 'midi') return;
    const sel = selectedOrAllIndicesForTrack(ti);
    if (!sel.length) return;
    const selectedNotes = sel.map((i) => tr.notes[i]!).sort((a, b) => a.startBeat - b.startBeat);
    const minStart = selectedNotes[0]!.startBeat;
    const maxEnd = Math.max(...selectedNotes.map((n) => n.startBeat + n.durationBeats));
    const delta = Math.max(1 / pianoSnapEffRef.current, maxEnd - minStart);
    const tb = totalBeatsRef.current;
    const clones = selectedNotes.map((n) => ({
      ...n,
      startBeat: Math.max(0, Math.min(tb - PIANO_MIN_NOTE_DURATION_BEATS, n.startBeat + delta)),
    }));
    applyTracksMutation((prev) =>
      prev.map((t, i) => (i === ti && t.kind === 'midi' ? { ...t, notes: sortNotesLikePianoRoll([...t.notes, ...clones]) } : t)),
    );
  }, [applyTracksMutation, selectedOrAllIndicesForTrack, sortNotesLikePianoRoll]);

  const arpeggiateSelected = useCallback(() => {
    applySelectionTransform((notes, selected, snap, tb) => {
      const ordered = selected.map((i) => ({ i, n: notes[i]! })).sort((a, b) => a.n.pitch - b.n.pitch);
      if (!ordered.length) return notes;
      const step = Math.max(1 / snap, 0.25);
      const anchor = ordered[0]!.n.startBeat;
      const out = [...notes];
      ordered.forEach((o, idx) => {
        out[o.i] = { ...o.n, startBeat: Math.max(0, Math.min(tb - PIANO_MIN_NOTE_DURATION_BEATS, anchor + idx * step)) };
      });
      return out;
    });
  }, [applySelectionTransform]);

  const strumSelected = useCallback(() => {
    applySelectionTransform((notes, selected, _snap, tb) => {
      const ordered = selected.map((i) => ({ i, n: notes[i]! })).sort((a, b) => a.n.pitch - b.n.pitch);
      const out = [...notes];
      ordered.forEach((o, idx) => {
        out[o.i] = { ...o.n, startBeat: Math.max(0, Math.min(tb - PIANO_MIN_NOTE_DURATION_BEATS, o.n.startBeat + idx * 0.03)) };
      });
      return out;
    });
  }, [applySelectionTransform]);

  const chopSelected = useCallback(() => {
    const ti = selectedTrackIndexRef.current;
    const tr = studioTracksRef.current[ti];
    if (!tr || tr.kind !== 'midi') return;
    const sel = selectedOrAllIndicesForTrack(ti);
    if (!sel.length) return;
    const set = new Set(sel);
    const extra: MockMidiNote[] = [];
    const next = tr.notes.flatMap((n, i) => {
      if (!set.has(i)) return [n];
      const count = 3;
      const subDur = Math.max(PIANO_MIN_NOTE_DURATION_BEATS, n.durationBeats / count);
      for (let c = 1; c < count; c++) {
        extra.push({ ...n, startBeat: n.startBeat + c * subDur, durationBeats: subDur, velocity: Math.max(1, Math.min(127, n.velocity - c * 6)) });
      }
      return [{ ...n, durationBeats: subDur }];
    });
    applyTracksMutation((prev) =>
      prev.map((t, i) => (i === ti && t.kind === 'midi' ? { ...t, notes: sortNotesLikePianoRoll([...next, ...extra]) } : t)),
    );
  }, [applyTracksMutation, selectedOrAllIndicesForTrack, sortNotesLikePianoRoll]);

  const randomizeVelocitySelected = useCallback(() => {
    applySelectionTransform((notes, selected) => {
      const set = new Set(selected);
      return notes.map((n, i) => {
        if (!set.has(i)) return n;
        const r = Math.sin((n.startBeat + n.pitch * 0.31) * 91.7);
        return { ...n, velocity: Math.max(1, Math.min(127, Math.round(n.velocity + r * 22))) };
      });
    });
  }, [applySelectionTransform]);

  const midiUndoEdit = useCallback(() => {
    const u = undoStacksRef.current;
    if (!u.length) return;
    const snap = u[u.length - 1]!;
    undoStacksRef.current = u.slice(0, -1);
    redoStacksRef.current = [...redoStacksRef.current.slice(-49), snapshotStudioTracks(studioTracksRef.current)];
    setStudioTracks(snapshotStudioTracks(snap));
    setSelectedPianoNoteIndex(null);
  }, []);

  const midiRedoEdit = useCallback(() => {
    const rsn = redoStacksRef.current;
    if (!rsn.length) return;
    const snap = rsn[rsn.length - 1]!;
    redoStacksRef.current = rsn.slice(0, -1);
    undoStacksRef.current = [...undoStacksRef.current.slice(-49), snapshotStudioTracks(studioTracksRef.current)];
    setStudioTracks(snapshotStudioTracks(snap));
    setSelectedPianoNoteIndex(null);
  }, []);

  const handlePianoRollNotesContextMenu = useCallback(
    (info: { clientX: number; clientY: number; noteHitIndex: number | null }) => {
      if (!isScreenActiveRef.current) return;
      if (info.noteHitIndex !== null) setSelectedPianoNoteIndex(info.noteHitIndex);
      const ti = selectedTrackIndexRef.current;
      const ni = info.noteHitIndex !== null ? info.noteHitIndex : selectedPianoIdxRef.current;
      midiMenuTargetRef.current = { trackIndex: ti, noteIndex: ni };
      setContextMenuHasNoteTarget(info.noteHitIndex !== null || selectedPianoIdxRef.current !== null);
      setEditorContextMenu({ x: info.clientX, y: info.clientY });
    },
    [],
  );

  const applyMidiSelectionFromTimelineStripPoint = useCallback((clientX: number, clientY: number) => {
    const strip = timelineStripRef.current;
    if (!strip) return;
    const rect = strip.getBoundingClientRect();
    const yRel = clientY - rect.top - RULER_TOTAL_H_PX;
    if (!Number.isFinite(yRel) || yRel < 0) return;
    const lh = trackLaneHRef.current;
    const ti = Math.floor(yRel / lh);
    if (ti < 0 || ti >= studioTracksRef.current.length) return;
    const xCss = clientX - rect.left;
    const yLaneLocal = yRel - ti * lh;
    const bpb = beatsPerBarRef.current;
    const z = timelineZoomRef.current;
    const ppb = ppbAtZoom(z, bpb);
    const hit = hitTimelineMidiNoteIndex(studioTracksRef.current[ti]!, xCss, yLaneLocal, ppb, lh);
    const prevTrack = selectedTrackIndexRef.current;
    setSelectedTrackIndex(ti);
    if (hit >= 0) {
      setSelectedPianoNoteIndex(hit);
      midiMenuTargetRef.current = { trackIndex: ti, noteIndex: hit };
      return;
    }
    if (ti === prevTrack) {
      const prevNi = selectedPianoIdxRef.current;
      const tr = studioTracksRef.current[ti];
      if (prevNi !== null && tr && tr.kind === 'midi' && prevNi >= 0 && prevNi < tr.notes.length) {
        setSelectedPianoNoteIndex(prevNi);
        midiMenuTargetRef.current = { trackIndex: ti, noteIndex: prevNi };
        return;
      }
    }
    setSelectedPianoNoteIndex(null);
    midiMenuTargetRef.current = { trackIndex: ti, noteIndex: null };
  }, []);

  const onTimelineLaneMidiContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      applyMidiSelectionFromTimelineStripPoint(e.clientX, e.clientY);
      setContextMenuHasNoteTarget(midiMenuTargetRef.current?.noteIndex != null);
      setEditorContextMenu({ x: e.clientX, y: e.clientY });
    },
    [applyMidiSelectionFromTimelineStripPoint],
  );

  const onTimelinePlayheadContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const strip = timelineStripRef.current;
      if (!strip) return;
      const yRel = e.clientY - strip.getBoundingClientRect().top;
      if (yRel >= RULER_TOTAL_H_PX) {
        applyMidiSelectionFromTimelineStripPoint(e.clientX, e.clientY);
        setContextMenuHasNoteTarget(midiMenuTargetRef.current?.noteIndex != null);
      } else {
        midiMenuTargetRef.current = {
          trackIndex: selectedTrackIndexRef.current,
          noteIndex: selectedPianoIdxRef.current,
        };
        setContextMenuHasNoteTarget(selectedPianoIdxRef.current !== null);
      }
      setEditorContextMenu({ x: e.clientX, y: e.clientY });
    },
    [applyMidiSelectionFromTimelineStripPoint],
  );

  const midiHasNoteSel = selectedPianoNoteIndex !== null || selectedPianoNoteIndexes.size > 0;
  const canMidiUndo = undoStacksRef.current.length > 0;
  const canMidiRedo = redoStacksRef.current.length > 0;

  const addEmptyTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const newTrack: MockMusioTrack = {
      id: newTrackId(),
      name: nextMidiTrackName(prev),
      colorHex: NEW_TRACK_COLOR_HEX[prev.length % NEW_TRACK_COLOR_HEX.length],
      kind: 'midi',
      notes: [],
      audioClips: [],
    };
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(next.length - 1);
    setSelectedPianoNoteIndex(null);
  }, []);

  const addAudioTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const newTrack: MockMusioTrack = {
      id: newTrackId(),
      name: nextAudioTrackName(prev),
      colorHex: NEW_TRACK_COLOR_HEX[prev.length % NEW_TRACK_COLOR_HEX.length],
      kind: 'audio',
      notes: [],
      audioClips: [],
      audioInputDeviceId: '',
    };
    const next = [...prev, newTrack];
    setStudioTracks(next);
    setSelectedTrackIndex(next.length - 1);
    setSelectedPianoNoteIndex(null);
  }, []);

  const duplicateSelectedTrack = useCallback(() => {
    const prev = studioTracksRef.current;
    if (prev.length >= MAX_STUDIO_TRACKS) return;
    const ti = Math.max(0, Math.min(selectedTrackIndex, prev.length - 1));
    const src = prev[ti];
    if (!src) return;
    const copy: MockMusioTrack = {
      id: newTrackId(),
      name: `${src.name} copy`,
      colorHex: src.colorHex,
      kind: src.kind,
      notes: src.notes.map((n) => ({ ...n })),
      audioClips: src.audioClips.map((c) => ({ ...c })),
      ...(src.kind === 'audio' ? { audioInputDeviceId: src.audioInputDeviceId ?? '' } : {}),
    };
    const next = [...prev.slice(0, ti + 1), copy, ...prev.slice(ti + 1)];
    setStudioTracks(next);
    setSelectedTrackIndex(ti + 1);
    setSelectedPianoNoteIndex(null);
  }, [selectedTrackIndex]);

  const startTransport = useCallback(async () => {
    const ctx = await ensureCtx();
    muteMetro();
    cancelArrangerPreviewScheduling();
    const snapped = snapBeatToQuarterGrid(cursorBeatRef.current, totalBeatsRef.current);
    cursorBeatRef.current = snapped;
    originBeatRef.current = snapped;
    const tCapture = audioNow(ctx);
    sessionStartRef.current = tCapture + AUDIO_START_FLOOR_SEC;
    /* Seed both clocks so the first RAF frame has correct values before the 25ms tick fires. */
    schedAnchorTimeRef.current = tCapture;
    schedAnchorPerfRef.current = performance.now();
    /* perfSessionStart = now + AUDIO_START_FLOOR_SEC (visual beat 0 = when audio starts). */
    perfSessionStartMsRef.current = performance.now() + AUDIO_START_FLOOR_SEC * 1000;
    nextMetroKRef.current = Math.floor(snapped);
    displayBeatRef.current = snapped;
    /* Launch compositor-thread WAAPI animation — this is what the user sees. */
    launchWapiAnims(snapped, true);
      runningRef.current = true;
      setRunning(true);
    if (isScreenActiveRef.current) paintTransport();
    unmuteMetro();
    /*
     * Fill the audio queue NOW, while ctx.currentTime ≈ tCapture.
     * Without this, the first refill happens 25 ms later (setInterval) by which time
     * ctx.currentTime has advanced, pushing beat-0's click to tCapture+0.075 s instead
     * of tCapture+0.05 s.  That 25 ms late beat-0 makes the rhythm feel rushed for the
     * first bar then abruptly correct — perceived as a "skip" at bar 2.
     */
    refillMetronome(ctx, tCapture);
    refillMidiPreview(ctx, tCapture);
    refillAudioPreview(ctx, tCapture);
  }, [
    cancelArrangerPreviewScheduling,
    ensureCtx,
    muteMetro,
    unmuteMetro,
    paintTransport,
    launchWapiAnims,
    refillAudioPreview,
    refillMetronome,
    refillMidiPreview,
  ]);

  const pauseTransport = useCallback(() => {
    muteMetro();
    cancelScheduledMetroNodes();
    cancelArrangerPreviewScheduling();
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') {
      runningRef.current = false;
      setRunning(false);
      setRecording(false);
      displayBeatRef.current = cursorBeatRef.current;
      return;
    }
    /* Pause position using the same scheduling-domain smooth clock as animationTick. */
    const tb = totalBeatsRef.current;
    updateSchedAnchor(ctx, schedAnchorTimeRef, schedAnchorPerfRef);
    const tNow = smoothSchedNow(schedAnchorTimeRef, schedAnchorPerfRef, ctx);
    const pauseBeat = Math.max(0, Math.min(tb, originBeatRef.current + Math.max(0, tNow - sessionStartRef.current) * (bpmRef.current / 60)));
    cursorBeatRef.current = pauseBeat;
    displayBeatRef.current = pauseBeat;
    runningRef.current = false;
    setRunning(false);
    setRecording(false);
    /* Replace loop segment (short duration WAAPI) with full-span paused animations at `pauseBeat`. */
    const z = timelineZoomRef.current;
    const bpb = beatsPerBarRef.current;
    launchWapiAnims(pauseBeat, false);
    syncTimelineGridLayer(
      timelineCanvasRef.current,
      gridCacheRef,
      z,
      studioTracksRef.current,
      bpb,
      trackLaneHRef.current,
      selectedTrackIndexRef.current,
      selectedPianoIdxRef.current,
    );
    updateReadouts(cursorBeatRef.current, true);
  }, [cancelArrangerPreviewScheduling, muteMetro, cancelScheduledMetroNodes, launchWapiAnims, updateReadouts]);

  const timelineLaneBrushSegment = useCallback(
    (cx0: number, cy0: number, cx1: number, cy1: number) => {
      const brush = pianoToolRef.current;
      if (brush !== 'pencil' && brush !== 'erase') return;

      const strip = timelineStripRef.current;
      if (!strip) return;
      const rect = strip.getBoundingClientRect();
      const snap = pianoSnapEffRef.current;
      const tb = totalBeatsRef.current;
      const dur = oneCellDurationBeats(snap);

      const samplePoint = (cx: number, cy: number) => {
        const lh = trackLaneHRef.current;
        const yRel = cy - rect.top - RULER_TOTAL_H_PX;
        if (!Number.isFinite(yRel) || yRel < 0) return null;
        const ti = Math.floor(yRel / lh);
        const trs = studioTracksRef.current;
        if (ti < 0 || ti >= trs.length) return null;
        const trLane = trs[ti]!;
        if (trLane.kind !== 'midi') return null;
        const yLane = yRel - ti * lh;
        const xCss = cx - rect.left;
        const beat = snapBeatToSubdivision(clientXToBeat(cx), snap, tb);
        return { ti, yLane, xCss, beat, tr: trLane };
      };

      const dx = cx1 - cx0;
      const dy = cy1 - cy0;
      const dist = Math.hypot(dx, dy);
      const stepCount = Math.min(384, Math.max(1, Math.ceil(dist / 3)));

      if (brush === 'pencil') {
        const segDone = new Set<string>();
        let lastIdx = -1;
        let lastTi = -1;

        for (let s = 0; s <= stepCount; s++) {
          const tfrac = stepCount === 0 ? 0 : s / stepCount;
          const cx = cx0 + dx * tfrac;
          const cy = cy0 + dy * tfrac;
          const pt = samplePoint(cx, cy);
          if (!pt) continue;

          const freshTr = studioTracksRef.current[pt.ti]!;
          const lh = trackLaneHRef.current;
          const pitch = pitchFromTimelineLaneY(freshTr, pt.yLane, lh);
          const cellKey = `${pt.ti}|${pitch}|${pt.beat.toFixed(4)}`;
          if (segDone.has(cellKey)) continue;
          segDone.add(cellKey);

          const working = [...freshTr.notes];
          const dup = working.some((n) => n.pitch === pitch && Math.abs(n.startBeat - pt.beat) < 1e-5);
          if (dup) continue;

          working.push({ pitch, startBeat: pt.beat, durationBeats: dur, velocity: 100 });
          working.sort((a, b) => (a.startBeat !== b.startBeat ? a.startBeat - b.startBeat : a.pitch - b.pitch));
          updateTrackNotes(pt.ti, working);
          setSelectedTrackIndex(pt.ti);
          lastTi = pt.ti;
          lastIdx = working.findIndex((n) => Math.abs(n.startBeat - pt.beat) < 1e-6 && n.pitch === pitch);
          void previewPianoPitch(pitch, 100 / 127);
        }
        if (lastIdx >= 0 && lastTi >= 0) setSelectedPianoNoteIndex(lastIdx);
        return;
      }

      for (let s = 0; s <= stepCount; s++) {
        const tfrac = stepCount === 0 ? 0 : s / stepCount;
        const cx = cx0 + dx * tfrac;
        const cy = cy0 + dy * tfrac;
        const pt = samplePoint(cx, cy);
        if (!pt) continue;
        const z = timelineZoomRef.current;
        const bpb = beatsPerBarRef.current;
        const ppb = ppbAtZoom(z, bpb);
        const freshTr = studioTracksRef.current[pt.ti]!;
        const hit = hitTimelineMidiNoteIndex(freshTr, pt.xCss, pt.yLane, ppb, trackLaneHRef.current);
        if (hit < 0) continue;
        updateTrackNotes(
          pt.ti,
          freshTr.notes.filter((_, j) => j !== hit),
        );
        setSelectedTrackIndex(pt.ti);
        setSelectedPianoNoteIndex(null);
      }
    },
    [clientXToBeat, previewPianoPitch, updateTrackNotes],
  );

  const onTimelineLanePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const strip = timelineStripRef.current;
      if (!strip) return;
      if (runningRef.current) void Promise.resolve(pauseTransport());

      const tool = pianoToolRef.current;
      const tc = studioTracksRef.current.length;
      const pos = timelineLanePointFromStripClient(strip, e.clientX, e.clientY, tc, trackLaneHRef.current);
      if (!pos) return;

      if (tool === 'pencil' || tool === 'erase') {
        if (studioTracksRef.current[pos.ti]?.kind !== 'midi') return;
        timelinePaintLastClientRef.current = { clientX: e.clientX, clientY: e.clientY };
        timelineLaneBrushSegment(e.clientX, e.clientY, e.clientX, e.clientY);
        timelinePaintToolRef.current = tool;
        timelinePaintDragRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
        return;
      }

      setSelectedTrackIndex(pos.ti);
      const z = timelineZoomRef.current;
      const bpb = beatsPerBarRef.current;
      const ppb = ppbAtZoom(z, bpb);
      const tr = studioTracksRef.current[pos.ti]!;
      const dm = hitTimelineMidiNoteDragMode(tr, pos.xCss, pos.yLaneLocal, ppb, trackLaneHRef.current);
      if (!dm) {
        setSelectedPianoNoteIndex(null);
        return;
      }
      setSelectedPianoNoteIndex(dm.index);
      const n = tr.notes[dm.index];
      if (!n) return;
      const beatPtr = clientXToBeat(e.clientX);
      timelineMidiDragRef.current = {
        active: true,
        mode: dm.mode,
        trackIndex: pos.ti,
        noteIndex: dm.index,
        beatPtrDown: beatPtr,
        anchorStart: n.startBeat,
        anchorEnd: n.startBeat + n.durationBeats,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    [clientXToBeat, pauseTransport, timelineLaneBrushSegment],
  );

  const onTimelineLanePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const nd = timelineMidiDragRef.current;
      if (nd.active) {
        const strip = timelineStripRef.current;
        if (!strip) return;
        const rect = strip.getBoundingClientRect();
        const yRel = e.clientY - rect.top - RULER_TOTAL_H_PX;
        if (!Number.isFinite(yRel)) {
          timelineMidiDragRef.current = {
            active: false,
            mode: 'move',
            trackIndex: -1,
            noteIndex: -1,
            beatPtrDown: 0,
            anchorStart: 0,
            anchorEnd: 0,
          };
          return;
        }
        const lh = trackLaneHRef.current;
        const yLane = yRel - nd.trackIndex * lh;
        const tr = studioTracksRef.current[nd.trackIndex];
        const n = tr?.notes[nd.noteIndex];
        if (!tr || !n) {
          timelineMidiDragRef.current = {
            active: false,
            mode: 'move',
            trackIndex: -1,
            noteIndex: -1,
            beatPtrDown: 0,
            anchorStart: 0,
            anchorEnd: 0,
          };
          return;
        }
        const yLaneClamped = Math.max(0, Math.min(lh - 1e-6, yLane));
        const beatPtr = clientXToBeat(e.clientX);
        const snap = pianoSnapEffRef.current;
        const tb = totalBeatsRef.current;

        if (nd.mode === 'move') {
          const rawDelta = beatPtr - nd.beatPtrDown;
          let newStart = snapBeatToSubdivision(nd.anchorStart + rawDelta, snap, tb);
          newStart = Math.max(0, Math.min(tb - n.durationBeats, newStart));
          const newPitch = pitchFromTimelineLaneY(tr, yLaneClamped, lh);
          updateTrackNotes(
            nd.trackIndex,
            tr.notes.map((ev, j) => (j === nd.noteIndex ? { ...ev, startBeat: newStart, pitch: newPitch } : ev)),
          );
        } else if (nd.mode === 'resize-right') {
          const rawDelta = beatPtr - nd.beatPtrDown;
          let newEnd = snapBeatToSubdivision(nd.anchorEnd + rawDelta, snap, tb);
          newEnd = Math.max(n.startBeat + PIANO_MIN_NOTE_DURATION_BEATS, Math.min(tb, newEnd));
          const newDur = newEnd - n.startBeat;
          updateTrackNotes(
            nd.trackIndex,
            tr.notes.map((ev, j) => (j === nd.noteIndex ? { ...ev, durationBeats: newDur } : ev)),
          );
        } else {
          const rawDelta = beatPtr - nd.beatPtrDown;
          let newStart = snapBeatToSubdivision(nd.anchorStart + rawDelta, snap, tb);
          const maxStart = nd.anchorEnd - PIANO_MIN_NOTE_DURATION_BEATS;
          newStart = Math.max(0, Math.min(maxStart, newStart));
          const newDur = nd.anchorEnd - newStart;
          updateTrackNotes(
            nd.trackIndex,
            tr.notes.map((ev, j) => (j === nd.noteIndex ? { ...ev, startBeat: newStart, durationBeats: newDur } : ev)),
          );
        }
        return;
      }

      if (!timelinePaintDragRef.current) return;
      const ptt = timelinePaintToolRef.current;
      if (ptt !== 'pencil' && ptt !== 'erase') return;
      const last = timelinePaintLastClientRef.current;
      timelineLaneBrushSegment(last?.clientX ?? e.clientX, last?.clientY ?? e.clientY, e.clientX, e.clientY);
      timelinePaintLastClientRef.current = { clientX: e.clientX, clientY: e.clientY };
    },
    [clientXToBeat, timelineLaneBrushSegment, updateTrackNotes],
  );

  const onTimelineLanePointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    timelinePaintDragRef.current = false;
    timelinePaintToolRef.current = null;
    timelinePaintLastClientRef.current = null;
    timelineMidiDragRef.current = {
      active: false,
      mode: 'move',
      trackIndex: -1,
      noteIndex: -1,
      beatPtrDown: 0,
      anchorStart: 0,
      anchorEnd: 0,
    };
    const el = e.currentTarget;
    if (typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(e.pointerId)) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    }
  }, []);

  const onPlayheadPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const strip = timelineStripRef.current;
      if (!strip) return;
      if (runningRef.current) pauseTransport();
      scrubbingRef.current = true;
      try {
        strip.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
      setBeatFromScrubClientX(e.clientX);
    },
    [pauseTransport, setBeatFromScrubClientX],
  );

  const onTogglePlayPause = useCallback(async () => {
    const now = performance.now();
    if (now - lastToggleMsRef.current < TOGGLE_DEBOUNCE_MS) return;
    lastToggleMsRef.current = now;
    if (!runningRef.current) await startTransport();
    else pauseTransport();
  }, [startTransport, pauseTransport]);

  useEffect(() => {
    if (!isScreenActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (el?.closest('[data-studio-piano-roll-keys]')) return;
      e.preventDefault();
      void onTogglePlayPause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isScreenActive, onTogglePlayPause]);

  useEffect(() => {
    if (!isScreenActive || !running) return;
    if (!metroOn) { muteMetro(); return; }
    unmuteMetro();
    /* Scheduling is handled by the dedicated interval â€” no need to call refill here. */
  }, [isScreenActive, running, metroOn, muteMetro, unmuteMetro]);

  const onReturnToZero = useCallback(async () => {
    const ctx = await ensureCtx();
    if (ctx.state === 'closed') return;
    muteMetro();
    cancelArrangerPreviewScheduling();
    cursorBeatRef.current = 0;
    originBeatRef.current = 0;
    displayBeatRef.current = 0;
    nextMetroKRef.current = 0;
    if (runningRef.current) {
      const tCap = audioNow(ctx);
      sessionStartRef.current     = tCap + AUDIO_START_FLOOR_SEC;
      schedAnchorTimeRef.current  = tCap;
      schedAnchorPerfRef.current  = performance.now();
      perfSessionStartMsRef.current = performance.now() + AUDIO_START_FLOOR_SEC * 1000;
      launchWapiAnims(0, true);
      unmuteMetro();
      cancelArrangerPreviewScheduling();
    } else {
      sessionStartRef.current     = 0;
      schedAnchorTimeRef.current  = 0;
      schedAnchorPerfRef.current  = 0;
      perfSessionStartMsRef.current = 0;
      launchWapiAnims(0, false);
    }
    updateReadouts(0, !runningRef.current);
    applyPlayheadFull(0);
  }, [
    applyPlayheadFull,
    cancelArrangerPreviewScheduling,
    ensureCtx,
    launchWapiAnims,
    muteMetro,
    unmuteMetro,
    updateReadouts,
  ]);

  const onRecordClick = useCallback(() => {
    if (recordingRef.current) {
      setRecording(false);
      return;
    }
    setRecording(true);
    void (async () => {
      if (!runningRef.current) await startTransport();
    })();
  }, [startTransport]);

  const onStop = useCallback(() => {
    muteMetro();
    cancelArrangerPreviewScheduling();
    runningRef.current = false;
    setRecording(false);
    cursorBeatRef.current = 0;
    originBeatRef.current = 0;
    displayBeatRef.current = 0;
    sessionStartRef.current = 0;
    nextMetroKRef.current = 0;
    setRunning(false);
    gridCacheRef.current = null;
    /* Stop and reset WAAPI compositor animations. */
    playheadWapiRef.current?.cancel();
    pianoPhWapiRef.current?.cancel();
    playheadWapiRef.current = null;
    pianoPhWapiRef.current  = null;
    const br = barsReadoutRef.current;
    const tr = timeReadoutRef.current;
    if (br) br.textContent = '1.1.00';
    if (tr) tr.textContent = '00:00:00';
    applyPlayheadFull(0);
  }, [cancelArrangerPreviewScheduling, muteMetro, applyPlayheadFull]);

  useEffect(() => {
    if (!isScreenActive) return;
    const onKey = (e: KeyboardEvent) => {
      const root = studioUiRootRef.current;
      if (!root) return;
      const t = e.target;
      if (t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"], a[href]')) return;
      const ae = document.activeElement;
      const inStudioUi =
        (t instanceof Node && root.contains(t)) ||
        (ae instanceof Node && root.contains(ae)) ||
        ae === document.body ||
        ae === document.documentElement;
      if (!inStudioUi) return;
      const mod = e.metaKey || e.ctrlKey;
      const hasSelection = selectedPianoIdxSetRef.current.size > 0 || selectedPianoIdxRef.current !== null;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (hasSelection) {
          e.preventDefault();
          midiDeleteSelection();
        }
        return;
      }

      if (!mod || e.repeat) return;

      if (e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) midiRedoEdit();
        else midiUndoEdit();
        return;
      }
      if (e.code === 'KeyY') {
        e.preventDefault();
        midiRedoEdit();
        return;
      }
      if (e.code === 'KeyX') {
        if (!hasSelection) return;
        e.preventDefault();
        midiCutSelection();
        return;
      }
      if (e.code === 'KeyC') {
        if (!hasSelection) return;
        e.preventDefault();
        midiCopySelection();
        return;
      }
      if (e.code === 'KeyV') {
        if (!midiClipboardRef.current?.length) return;
        e.preventDefault();
        midiPasteSelection();
        return;
      }
      if (e.code === 'KeyD') {
        if (!hasSelection) return;
        e.preventDefault();
        midiDuplicateSelection();
        return;
      }
      if (e.code === 'KeyE') {
        if (!hasSelection) return;
        e.preventDefault();
        midiSplitSelection();
        return;
      }
      if (e.code === 'KeyQ') {
        if (!hasSelection) return;
        e.preventDefault();
        quantizeSelected();
        return;
      }
      if (e.code === 'ArrowUp') {
        if (!hasSelection) return;
        e.preventDefault();
        transposeSelected(e.shiftKey ? 12 : 1);
        return;
      }
      if (e.code === 'ArrowDown') {
        if (!hasSelection) return;
        e.preventDefault();
        transposeSelected(e.shiftKey ? -12 : -1);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    isScreenActive,
    midiCutSelection,
    midiCopySelection,
    midiPasteSelection,
    midiDuplicateSelection,
    midiSplitSelection,
    midiDeleteSelection,
    quantizeSelected,
    transposeSelected,
    midiUndoEdit,
    midiRedoEdit,
  ]);

  useLayoutEffect(() => {
    const tb = totalBeatsForSig(beatsPerBar);
    if (cursorBeatRef.current > tb) cursorBeatRef.current = tb;
    if (displayBeatRef.current > tb) displayBeatRef.current = tb;

    if (!isScreenActive) return;

    const c = ctxRef.current;
    const z = timelineZoomRef.current;
    const bpb = beatsPerBarRef.current;
    if (c && c.state !== 'closed' && runningRef.current) {
      syncTimelineGridLayer(
      timelineCanvasRef.current,
      gridCacheRef,
      z,
      studioTracksRef.current,
      bpb,
      trackLaneHRef.current,
      selectedTrackIndexRef.current,
      selectedPianoIdxRef.current,
    );
      paintTransport();
    } else {
      displayBeatRef.current = cursorBeatRef.current;
      applyPlayheadFull(cursorBeatRef.current);
      updateReadouts(displayBeatRef.current, !runningRef.current);
    }
  }, [
    isScreenActive,
    beatsPerBar,
    studioTracks,
    trackLaneHeightPx,
    selectedTrackIndex,
    selectedPianoNoteIndex,
    paintTransport,
    applyPlayheadFull,
    updateReadouts,
  ]);

  useEffect(() => {
    if (!isScreenActive) return;
    if (runningRef.current) {
      /* Zoom changed while playing — recreate WAAPI animations with new pixel values. */
      launchWapiAnims(cursorBeatRef.current, true);
    } else {
      paintTransport();
    }
  }, [zoom, isScreenActive, paintTransport, launchWapiAnims]);

  useEffect(() => {
    if (!isScreenActive || !runningRef.current) return;
    launchWapiAnims(cursorBeatRef.current, true);
  }, [loopOn, loopStartBeat, loopEndBeat, isScreenActive, launchWapiAnims]);

  useEffect(() => {
    if (!running) return;
    const hostRaw = transportPaintHostRef.current;
    const host = hostRaw as ElementWithVfc | null;
    const vfcSupported = host !== null && typeof host.requestVideoFrameCallback === 'function';

    /* Always use plain rAF â€” VFC is for <video> elements only and doesn't help here. */
    const loop = (rafTime: DOMHighResTimeStamp) => {
      transportRafRef.current = 0;
      if (!runningRef.current) return;
      try {
        transportFrame(rafTime);
      } catch {
        /* */
      }
      if (runningRef.current) transportRafRef.current = requestAnimationFrame(loop);
    };
    transportRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (transportRafRef.current) cancelAnimationFrame(transportRafRef.current);
    };
  }, [running, transportFrame]);

  /**
   * Dedicated audio scheduling loop â€” runs every 25 ms, completely separate from the RAF visual loop.
   * Keeping audio work out of RAF prevents AudioNode creation spikes from dropping animation frames.
   */
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (!runningRef.current) return;
      const c = ctxRef.current;
      if (!c || c.state === 'closed') return;
      if (c.state === 'suspended') {
        void c.resume().catch(() => { /* autoplay policy */ });
        return;
      }
      const t = audioNow(c);
      /*
       * Re-anchor the visual clock every 25 ms.
       * Converts sessionStartRef (audio/ctx.currentTime domain) â†’ performance.now() domain
       * so the RAF loop can use rafTime (vsync-aligned) without ever touching ctx.currentTime.
       * Formula: perfSessionStart = perfNow + (sessionStart_ctx - ctx.currentTime) * 1000
       */
      perfSessionStartMsRef.current = performance.now() + (sessionStartRef.current - t) * 1000;
      /* Update scheduling-domain anchor for pauseTransport's beat snapshot. */
      schedAnchorTimeRef.current = t;
      schedAnchorPerfRef.current = performance.now();
      refillMetronome(c, t);
      refillMidiPreview(c, t);
      refillAudioPreview(c, t);
    };
    const id = window.setInterval(tick, 25);
    /* Fire immediately so the first beat is scheduled before the first interval fires. */
    tick();
    return () => window.clearInterval(id);
  }, [running, refillAudioPreview, refillMetronome, refillMidiPreview]);

  const transportBtnBase =
    'inline-flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7cf4c6]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0e]';

  const arrangeLaneH = clampArrangeLaneHeightPx(trackLaneHeightPx);

  const atTrackCap = studioTracks.length >= MAX_STUDIO_TRACKS;
  const arrangeContentH = arrangementHeightPx(studioTracks.length, arrangeLaneH);
  const selectedTrack = studioTracks[Math.max(0, Math.min(studioTracks.length - 1, selectedTrackIndex))];
  const selectedTrackIsMidi = selectedTrack?.kind === 'midi';

  const onPianoResizeStart = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = pianoPanelH;
      const onMove = (ev: globalThis.MouseEvent) => {
        const dy = startY - ev.clientY;
        setPianoPanelH(Math.max(PIANO_PANEL_H_MIN, Math.min(PIANO_PANEL_H_MAX, startH + dy)));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [pianoPanelH],
  );

  const onMixerResizeStart = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = mixerPanelH;
      const onMove = (ev: globalThis.MouseEvent) => {
        const dy = startY - ev.clientY;
        setMixerPanelH(Math.max(260, Math.min(480, startH + dy)));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [mixerPanelH],
  );

  /** Drag bottom edge of track-name row: changes all arrange lane heights (DAW-style). */
  const onArrangeLaneResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = trackLaneHRef.current;
    const onMove = (ev: globalThis.MouseEvent) => {
      const dy = ev.clientY - startY;
      const next = Math.round(
        Math.max(MIN_TRACK_LANE_H_PX, Math.min(MAX_TRACK_LANE_H_PX, startH + dy)),
      );
      setTrackLaneHeightPx(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  return (
    <div
      ref={studioUiRootRef}
      className="relative flex flex-col h-full min-h-0 text-[#c8c8d0] antialiased"
      style={{ background: '#060607' }}
    >
      <header
        className="shrink-0 flex items-center justify-between gap-3 px-4 h-10 border-b select-none"
        style={{ borderColor: '#141418', background: '#09090c' }}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-6 sm:gap-8">
          <div className="flex min-w-0 shrink-0 items-baseline gap-2">
            <span className="truncate text-sm font-semibold tracking-tight text-white">Da Music Box</span>
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-widest" style={{ color: '#4a4a58' }}>
              Studio 2
            </span>
          </div>
          <div
            className="flex shrink-0 items-center gap-3"
            role="tablist"
            aria-label="Main view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!showPianoRoll && !showMixer}
              title="Track view — timeline and track lanes"
              className={`rounded-md border px-3 py-1 text-[10px] font-bold tracking-wide normal-case transition-colors ${transportBtnBase}`}
              style={{
                borderColor: !showPianoRoll && !showMixer ? 'rgba(124,244,198,0.38)' : '#2a2a32',
                background: !showPianoRoll && !showMixer ? 'rgba(124,244,198,0.14)' : 'rgba(255,255,255,0.02)',
                color: !showPianoRoll && !showMixer ? '#7cf4c6' : '#6a6a78',
                boxShadow: !showPianoRoll && !showMixer ? '0 0 0 1px rgba(124,244,198,0.08)' : 'none',
              }}
              onClick={() => { setShowPianoRoll(false); setPianoRollExpanded(false); setShowMixer(false); }}
            >
              Track view
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showPianoRoll}
              title="Piano roll editor for the selected track"
              className={`rounded-md border px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${transportBtnBase}`}
              style={{
                borderColor: showPianoRoll ? 'rgba(124,244,198,0.38)' : '#2a2a32',
                background: showPianoRoll ? 'rgba(124,244,198,0.14)' : 'rgba(255,255,255,0.02)',
                color: showPianoRoll ? '#7cf4c6' : '#6a6a78',
                boxShadow: showPianoRoll ? '0 0 0 1px rgba(124,244,198,0.08)' : 'none',
              }}
              onClick={() => { setShowPianoRoll(true); setShowMixer(false); }}
            >
              Piano
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showMixer}
              title="Audio channel mixer"
              className={`rounded-md border px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${transportBtnBase}`}
              style={{
                borderColor: showMixer ? 'rgba(124,244,198,0.38)' : '#2a2a32',
                background: showMixer ? 'rgba(124,244,198,0.14)' : 'rgba(255,255,255,0.02)',
                color: showMixer ? '#7cf4c6' : '#6a6a78',
                boxShadow: showMixer ? '0 0 0 1px rgba(124,244,198,0.08)' : 'none',
              }}
              onClick={() => { setShowMixer((v) => !v); setShowPianoRoll(false); setPianoRollExpanded(false); }}
            >
              Mix
            </button>
        </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <a
            href={REF_MUSIO_CREATE_REPO}
            target="_blank"
            rel="noopener noreferrer"
            title="Musio Create (reference)"
            className={`${transportBtnBase} rounded-md p-2 text-[#8a8a98] hover:text-[#b8b8c8] hover:bg-white/[0.04]`}
          >
            <Github size={18} strokeWidth={1.75} />
          </a>
          <a
            href={REF_MUSIO_CREATE_VIDEO}
            target="_blank"
            rel="noopener noreferrer"
            title="Musio Create â€” walkthrough"
            className={`${transportBtnBase} rounded-md p-2 text-[#8a8a98] hover:text-[#b8b8c8] hover:bg-white/[0.04]`}
          >
            <Youtube size={18} strokeWidth={1.75} />
          </a>
        </div>
      </header>

      <main className={showPianoRoll && pianoRollExpanded ? 'flex-1 min-h-0 flex flex-col p-0' : 'flex-1 min-h-0 flex flex-col p-3 sm:p-4'}>
        <div
          ref={transportPaintHostRef}
          className={showPianoRoll && pianoRollExpanded
            ? 'relative flex min-h-0 shrink-0 flex-1 flex-col overflow-hidden border-0 rounded-none shadow-none'
            : 'relative flex min-h-0 shrink-0 flex-1 flex-col overflow-hidden rounded-md border shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'}
          style={{
            borderColor: showPianoRoll && pianoRollExpanded ? 'transparent' : '#1a1a22',
            background: 'linear-gradient(165deg, #0c0c12 0%, #07070b 55%, #060609 100%)',
            boxShadow: showPianoRoll && pianoRollExpanded
              ? 'none'
              : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 40px rgba(0,0,0,0.45)',
            minHeight: showPianoRoll && pianoRollExpanded ? 0 : 200,
          }}
          onWheel={(e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            setZoom((z) => {
              const n = Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)) / ZOOM_STEP) * ZOOM_STEP;
              return n;
            });
          }}
        >
          {/*
            One vertical scroll for track names + timeline lanes so they stay aligned when many tracks
            exceed the viewport (same content height: ruler + lanes).
          */}
          <div className={showPianoRoll && pianoRollExpanded ? 'hidden' : 'flex min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain'}>
            <div className="flex w-full min-w-0 shrink-0 flex-row items-stretch">
              {/* `TrackHeaderView`-style column â€” matches lane order in canvas */}
              <div
                className="flex shrink-0 flex-col border-r select-none"
                style={{
                  width: TRACK_HEADER_W_PX,
                  borderColor: '#1e1e26',
                  background: 'linear-gradient(90deg, #0e0e12 0%, #0a0a0e 100%)',
                  boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.35)',
                }}
              >
                {/*
                  Total height must equal RULER_TOTAL_H_PX (52) with no extra border pixels — canvas uses
                  exactly that many CSS px before lane 0. Hairlines use inset box-shadow (no layout shift).
                */}
                <div className="shrink-0 flex flex-col" style={{ color: '#4a4a58' }}>
                  <div
                    className="shrink-0 flex items-center justify-center px-1.5"
                    style={{
                      height: RULER_BAR_H_PX,
                      boxSizing: 'border-box',
                      boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.06)',
                    }}
                  >
                    <span
                      className="text-center text-[5px] font-bold uppercase tracking-wider leading-none"
                      style={{ color: '#b4b4c4' }}
                    >
                      Tracks
        </span>
                  </div>
                  <div
                    className="grid shrink-0 grid-cols-3 gap-0.5 px-1.5 items-stretch"
                    style={{ height: RULER_MEAS_H_PX, boxSizing: 'border-box' }}
                  >
                    <button
                      type="button"
                      title={
                        atTrackCap
                          ? `Track limit (${MAX_STUDIO_TRACKS}) reached`
                          : 'Duplicate selected track (same instrument / notes)'
                      }
                      aria-label="Duplicate selected track"
                      disabled={atTrackCap}
                      onClick={duplicateSelectedTrack}
                      className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-0 rounded border px-0.5 py-0 transition-colors hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      style={{ borderColor: '#2a2a32', color: '#9a9aac' }}
                    >
                      <Copy size={10} strokeWidth={2} className="shrink-0" aria-hidden />
                      <span className="text-center text-[8px] font-medium leading-none tracking-tight">Dupe</span>
                    </button>
                    <button
                      type="button"
                      title={atTrackCap ? `Track limit (${MAX_STUDIO_TRACKS}) reached` : 'Add MIDI track'}
                      aria-label="Add MIDI track"
                      disabled={atTrackCap}
                      onClick={addEmptyTrack}
                      className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-0 rounded border px-0.5 py-0 transition-colors hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      style={{ borderColor: '#2a2a32', color: '#9a9aac' }}
                    >
                      <Plus size={9} strokeWidth={2} className="shrink-0" aria-hidden />
                      <span className="max-w-full text-center text-[8px] font-medium leading-none tracking-tight">
                        + MIDI
                      </span>
                    </button>
                    <button
                      type="button"
                      title={atTrackCap ? `Track limit (${MAX_STUDIO_TRACKS}) reached` : 'Add audio track'}
                      aria-label="Add audio track"
                      disabled={atTrackCap}
                      onClick={addAudioTrack}
                      className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-0 rounded border px-0.5 py-0 transition-colors hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      style={{ borderColor: '#2a2a32', color: '#9a9aac' }}
                    >
                      <Plus size={9} strokeWidth={2} className="shrink-0" aria-hidden />
                      <span className="max-w-full text-center text-[8px] font-medium leading-none tracking-tight">
                        + Aud
                      </span>
                    </button>
                  </div>
                </div>
            {studioTracks.map((tr, ti) => {
              const active = ti === selectedTrackIndex;
              const chPad = Math.max(2, String(studioTracks.length).length);
              const chNum = String(ti + 1).padStart(chPad, '0');
              return (
                <div
                  key={tr.id}
                  className="group relative shrink-0 w-full flex flex-col"
                  style={{
                    height: arrangeLaneH,
                    boxSizing: 'border-box',
                    /* Hairline only — `border-b` inside a fixed height steals 1px from lane vs canvas. */
                    boxShadow: [
                      'inset 0 -1px 0 rgba(255,255,255,0.06)',
                      active ? `inset 3px 0 0 ${tr.colorHex}, inset 0 0 0 1px rgba(255,255,255,0.05)` : '',
                    ]
                      .filter(Boolean)
                      .join(', '),
                    background: active
                      ? `linear-gradient(90deg, rgba(124,244,198,0.12) 0%, rgba(8,8,12,0.5) 100%)`
                      : ti % 2 === 0
                        ? 'rgba(255,255,255,0.02)'
                        : 'transparent',
                  }}
                  {...(tr.kind === 'audio'
                    ? {
                        onDragOver: (e: DragEvent<HTMLDivElement>) => onStudioAudioTrackHeaderDragOver(e, ti),
                        onDrop: (e: DragEvent<HTMLDivElement>) => void ingestDroppedAudioOnAudioTrack(e, ti),
                      }
                    : {})}
                >
                  {/* Full lane height — matches canvas lane; resize handle overlays bottom (does not shrink this row). */}
                  <div className="relative flex h-full min-h-0 flex-row items-center gap-1.5 pr-1">
                    <span
                      className="absolute left-1 top-1 z-[1] font-mono tabular-nums text-[7px] leading-none pointer-events-none"
                      style={{ color: active ? tr.colorHex : '#6a6a7c' }}
                      aria-hidden
                      title={`Channel ${ti + 1}`}
                    >
                      {`CH ${chNum}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => selectTrackAndClearPianoNote(ti)}
                      className={`flex min-w-0 flex-1 items-center gap-1.5 px-2 pl-11 text-left cursor-pointer transition-colors ${TRACK_NAME_UI_CLASS}`}
                      style={{
                        height: arrangeLaneH,
                        maxHeight: arrangeLaneH,
                        color: active ? '#ececf4' : '#9c9cac',
                        background: 'transparent',
                        border: 'none',
                      }}
                      title={tr.name}
                    >
                      {/* Dot left of name — vertical center tracks canvas lane midpoint */}
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0 self-center"
                        style={{ background: tr.colorHex, boxShadow: active ? `0 0 4px ${tr.colorHex}66` : undefined }}
                        aria-hidden
                      />
                      <span className="truncate min-w-0 self-center">{tr.name}</span>
                    </button>
                    {active && studioTracks.length > 1 && (
                      <button
                        type="button"
                        title={`Delete ${tr.name}`}
                        aria-label={`Delete track ${tr.name}`}
            disabled={running}
                        onClick={() => {
                          setStudioTracks((prev) => prev.filter((_, j) => j !== ti));
                          setSelectedTrackIndex(Math.max(0, ti - 1));
                          setSelectedPianoNoteIndex(null);
                        }}
                        className="shrink-0 self-center rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity disabled:opacity-20"
                        style={{ color: '#ff8080' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                          <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`Resize all track lanes, ${arrangeLaneH} pixels tall. Drag vertically.`}
                    title={`Lane height: ${arrangeLaneH}px — drag`}
                    className="absolute bottom-0 left-0 right-0 z-[3] flex h-2 cursor-ns-resize items-center justify-center bg-transparent transition-opacity opacity-30 hover:opacity-100"
                    onMouseDown={onArrangeLaneResizeStart}
                  >
                    <GripHorizontal className="h-2.5 w-9 text-white/35 pointer-events-none" strokeWidth={2.25} aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>

          <div
            ref={timelineHScrollRef}
            className="min-h-0 min-w-0 shrink-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ height: arrangeContentH, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div
              ref={timelineStripRef}
              className="relative shrink-0"
              data-studio-midi-context
              style={{
                width: TOTAL_WIDTH_PX * zoom,
                height: arrangeContentH,
                backgroundColor: '#0a0a10',
                lineHeight: 0,
              }}
            >
              <canvas ref={timelineCanvasRef} className="block max-w-none pointer-events-none" style={{ verticalAlign: 'top' }} />
              {/* TOP STRIP: loop-region bar (FL Studio drag-to-paint) */}
              {(() => {
                const ppb  = ppbAtZoom(zoom, beatsPerBar);
                const lsX  = beatColumnLeftPx(loopStartBeat, ppb);
                const leX  = beatColumnLeftPx(loopEndBeat,   ppb);
                const span = Math.max(0, leX - lsX);
                const HANDLE_W = 6;
                return (
                  <div
                    className="absolute left-0 right-0 top-0 z-[5]"
                    style={{ height: RULER_BAR_H_PX, cursor: 'crosshair', touchAction: 'none', userSelect: 'none' }}
                    aria-label="Loop region bar"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerDown={onLoopRulerPointerDown}
                    onPointerMove={onLoopRulerPointerMove}
                    onPointerUp={onLoopRulerPointerUp}
                    onPointerCancel={(e) => {
                      loopDragRef.current = null;
                      try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch { /**/ }
                    }}
                  >
                    {loopOn && span > 0 && (
                      <>
                        <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: lsX, width: span, background: 'rgba(124,244,198,0.22)', borderTop: '2px solid #7cf4c6' }} />
                        <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: lsX, width: HANDLE_W, background: '#7cf4c6' }} />
                        <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: leX - HANDLE_W, width: HANDLE_W, background: '#7cf4c6' }} />
                        {span > 40 && (
                          <div className="absolute top-0 bottom-0 flex items-center pointer-events-none" style={{ left: lsX + HANDLE_W + 3, fontSize: 8, color: '#7cf4c6', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {`${Math.round((loopEndBeat - loopStartBeat) / beatsPerBar)} bar loop`}
                          </div>
                        )}
                      </>
                    )}
                    {!loopOn && (
                      <div className="absolute inset-0 flex items-center px-2 pointer-events-none" style={{ fontSize: 8, color: '#3a3a4a' }}>
                        drag to set loop
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* BOTTOM STRIP: scrub playhead */}
              <div
                ref={timelineRulerScrubRef}
                className="absolute left-0 right-0 z-[3]"
                style={{ top: RULER_BAR_H_PX, height: RULER_MEAS_H_PX, cursor: running ? 'default' : 'col-resize', touchAction: 'none' }}
                aria-label="Timeline ruler — drag to scrub"
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onPointerDown={(e) => {
                  if (runningRef.current || e.button !== 0) return;
                  e.preventDefault();
                  (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                  scrubbingRef.current = true;
                  setBeatFromScrubClientX(e.clientX);
                }}
                onPointerMove={(e) => { if (!scrubbingRef.current || runningRef.current) return; setBeatFromScrubClientX(e.clientX); }}
                onPointerUp={(e) => {
                  scrubbingRef.current = false;
                  try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch { /**/ }
                }}
                onPointerCancel={() => { scrubbingRef.current = false; }}
              />
              {/* Lane gestures: select track / draw & edit MIDI (tools match piano roll toolbar). */}
              <div
                className="absolute left-0 right-0 z-[2]"
                style={{
                  top: RULER_TOTAL_H_PX,
                  bottom: 0,
                  cursor:
                    pianoTool === 'pencil' ? 'crosshair' : pianoTool === 'erase' ? 'cell' : 'default',
                  touchAction: 'none',
                  userSelect: 'none',
                }}
                aria-hidden
                onDragOver={onStudioTimelineAudioLaneDragOver}
                onDrop={(e) => void onStudioTimelineAudioLaneDrop(e)}
                onContextMenu={onTimelineLaneMidiContextMenu}
                onPointerDown={onTimelineLanePointerDown}
                onPointerMove={onTimelineLanePointerMove}
                onPointerUp={onTimelineLanePointerUp}
                onPointerCancel={onTimelineLanePointerUp}
              />
              {/* Full-height loop tint over lanes */}
              {loopOn && (
                <div
                  className="absolute pointer-events-none z-[1]"
                  style={{
                    top: RULER_TOTAL_H_PX, bottom: 0,
                    left: beatColumnLeftPx(loopStartBeat, ppbAtZoom(zoom, beatsPerBar)),
                    width: Math.max(0, beatColumnLeftPx(loopEndBeat, ppbAtZoom(zoom, beatsPerBar)) - beatColumnLeftPx(loopStartBeat, ppbAtZoom(zoom, beatsPerBar))),
                    background: 'rgba(124,244,198,0.05)',
                    boxShadow: 'inset 0 0 0 1px rgba(124,244,198,0.15)',
                  }}
                  aria-hidden
                />
              )}
              <div
                ref={playheadGroupRef}
                className="absolute top-0 bottom-0 z-[4] flex justify-center pointer-events-auto select-none"
                style={{
                  width: PLAYHEAD_GRIP_W_PX,
                  cursor: 'ew-resize',
                  touchAction: 'none',
                  willChange: 'transform',
                }}
                onPointerDown={onPlayheadPointerDown}
                onContextMenu={onTimelinePlayheadContextMenu}
              >
                <div
                  ref={playheadLineRef}
                  data-playhead-line
                  className="absolute top-0 bottom-0 pointer-events-none rounded-[1px]"
                  style={{
                    left: (PLAYHEAD_GRIP_W_PX - PLAYHEAD_W_PX) / 2,
                    width: PLAYHEAD_W_PX,
                    background: 'linear-gradient(180deg, #9fffd8 0%, #5ee9b4 50%, #34d399 100%)',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 0 10px rgba(52,211,153,0.4)',
                    willChange: 'transform',
                  }}
                />
              </div>
            </div>
          </div>
            </div>
          </div>
        </div>
        {!pianoRollExpanded && (
          <MusioPianoRollPanel
            visible={showPianoRoll}
            panelHeight={pianoPanelH}
            expanded={false}
            onToggleExpanded={() => setPianoRollExpanded(true)}
            onResizeStart={onPianoResizeStart}
            zoom={zoom}
            beatsPerBar={beatsPerBar}
            snapSubdivisions={pianoSnapSubdivisions}
            onBeatsPerBarChange={setBeatsPerBar}
            onSnapSubdivisionsChange={setPianoSnapSubdivisions}
            tracks={studioTracks}
            selectedTrackIndex={selectedTrackIndex}
            onSelectTrackIndex={selectTrackAndClearPianoNote}
            onUpdateTrackNotes={updateTrackNotes}
            tool={pianoTool}
            onToolChange={setPianoTool}
            selectedNoteIndex={selectedPianoNoteIndex}
            selectedNoteIndexes={selectedPianoNoteIndexes}
            onSelectNoteIndex={selectOnlyPianoNote}
            onToggleNoteIndex={togglePianoNoteSelection}
            onSelectOnlyNoteIndex={selectOnlyPianoNote}
            onSetSelectedNoteIndexes={setSelectedPianoNoteIndexes}
            onClearSelectedNotes={clearSelectedPianoNotes}
            playheadRef={pianoPlayheadRef}
            running={running}
            loopOn={loopOn}
            onLoopOnChange={setLoopOn}
            loopBars={loopBars}
            onLoopBarsChange={(n: number) => {
              setLoopBars(n);
              setLoopEndBeat(loopStartBeat + n * beatsPerBar);
            }}
            loopStartBeat={loopStartBeat}
            loopEndBeat={loopEndBeat}
            onPauseForEdit={pauseTransport}
            onSeekFromPianoRuler={seekFromPianoStripX}
            onPreviewPitch={previewPianoPitch}
            onNotesContextMenu={handlePianoRollNotesContextMenu}
            onQuantizeSelected={quantizeSelected}
            onDuplicateSelectedPhrase={duplicateSelectedPhrase}
            onTransposeSelected={transposeSelected}
            onHumanizeSelected={humanizeSelected}
            onLegatoSelected={legatoSelected}
            onArpeggiateSelected={arpeggiateSelected}
            onStrumSelected={strumSelected}
            onChopSelected={chopSelected}
            onRandomizeVelocitySelected={randomizeVelocitySelected}
            onQuantizeStrengthChange={setQuantizeStrength}
            quantizeStrength={quantizeStrength}
            onQuantizeSwingChange={setQuantizeSwing}
            quantizeSwing={quantizeSwing}
            showGhostNotes={showGhostNotes}
            onShowGhostNotesChange={setShowGhostNotes}
            showScaleGuides={showScaleGuides}
            onShowScaleGuidesChange={setShowScaleGuides}
          />
        )}

        {showPianoRoll && pianoRollExpanded &&
            <div
              className="absolute inset-0 z-[220] flex min-h-0 flex-col"
              style={{ background: 'linear-gradient(165deg, #0c0c12 0%, #07070b 55%, #060609 100%)' }}
            >
              <MusioPianoRollPanel
                visible
                panelHeight={pianoPanelH}
                expanded
                onToggleExpanded={() => setPianoRollExpanded(false)}
                onResizeStart={onPianoResizeStart}
                zoom={zoom}
                beatsPerBar={beatsPerBar}
                snapSubdivisions={pianoSnapSubdivisions}
                onBeatsPerBarChange={setBeatsPerBar}
                onSnapSubdivisionsChange={setPianoSnapSubdivisions}
                tracks={studioTracks}
                selectedTrackIndex={selectedTrackIndex}
                onSelectTrackIndex={selectTrackAndClearPianoNote}
                onUpdateTrackNotes={updateTrackNotes}
                tool={pianoTool}
                onToolChange={setPianoTool}
                selectedNoteIndex={selectedPianoNoteIndex}
                selectedNoteIndexes={selectedPianoNoteIndexes}
                onSelectNoteIndex={selectOnlyPianoNote}
                onToggleNoteIndex={togglePianoNoteSelection}
                onSelectOnlyNoteIndex={selectOnlyPianoNote}
                onSetSelectedNoteIndexes={setSelectedPianoNoteIndexes}
                onClearSelectedNotes={clearSelectedPianoNotes}
                playheadRef={pianoPlayheadRef}
                running={running}
                loopOn={loopOn}
                onLoopOnChange={setLoopOn}
                loopBars={loopBars}
                onLoopBarsChange={(n: number) => {
                  setLoopBars(n);
                  setLoopEndBeat(loopStartBeat + n * beatsPerBar);
                }}
                loopStartBeat={loopStartBeat}
                loopEndBeat={loopEndBeat}
                onPauseForEdit={pauseTransport}
                onSeekFromPianoRuler={seekFromPianoStripX}
                onPreviewPitch={previewPianoPitch}
                onNotesContextMenu={handlePianoRollNotesContextMenu}
                onQuantizeSelected={quantizeSelected}
                onDuplicateSelectedPhrase={duplicateSelectedPhrase}
                onTransposeSelected={transposeSelected}
                onHumanizeSelected={humanizeSelected}
                onLegatoSelected={legatoSelected}
                onArpeggiateSelected={arpeggiateSelected}
                onStrumSelected={strumSelected}
                onChopSelected={chopSelected}
                onRandomizeVelocitySelected={randomizeVelocitySelected}
                onQuantizeStrengthChange={setQuantizeStrength}
                quantizeStrength={quantizeStrength}
                onQuantizeSwingChange={setQuantizeSwing}
                quantizeSwing={quantizeSwing}
                showGhostNotes={showGhostNotes}
                onShowGhostNotesChange={setShowGhostNotes}
                showScaleGuides={showScaleGuides}
                onShowScaleGuidesChange={setShowScaleGuides}
              />
            </div>}

        {/* ── Audio Channel Mixer Panel ──────────────────────────────────── */}
        {showMixer && !(showPianoRoll && pianoRollExpanded) && (
          <div
            className="shrink-0 flex flex-col border-t select-none"
            style={{
              height: mixerPanelH,
              borderColor: '#1a1a22',
              background: '#07070a',
            }}
          >
            {/* Resize handle */}
            <button
              type="button"
              aria-label="Resize mixer panel"
              onMouseDown={onMixerResizeStart}
              className="w-full shrink-0 flex items-center justify-center cursor-ns-resize group"
              style={{ height: 8, background: 'transparent', border: 'none', padding: 0 }}
            >
              <div
                className="rounded-full group-hover:opacity-100 transition-opacity"
                style={{ width: 32, height: 3, background: '#3a3a48', opacity: 0.5 }}
              />
            </button>

            {/* Toolbar */}
            <div
              className="shrink-0 flex items-center gap-2 px-2 border-b"
              style={{ height: 24, borderColor: '#1a1a22' }}
            >
              <SlidersHorizontal size={11} style={{ color: '#7cf4c6' }} />
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#7cf4c6' }}>
                Audio Channels
              </span>
              <span className="text-[8px] font-medium truncate min-w-0" style={{ color: '#4a4a58' }}>
                FX per strip · {studioTracks.length} track{studioTracks.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Channel strips */}
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
              <div className="flex h-full" style={{ gap: 1, background: '#0a0a0f', minWidth: 'max-content' }}>

                {studioTracks.map((tr, i) => {
                  const chPad = Math.max(2, String(studioTracks.length).length);
                  const chNum = String(i + 1).padStart(chPad, '0');
                  const vol      = trackVolumes[i] ?? MIXER_UNITY_VOL;
                  const pan      = trackPans[i] ?? 64;
                  const muted    = trackMutes[i] ?? false;
                  const soloed   = trackSolos[i] ?? false;
                  const monoOn   = trackMonos[i] ?? false;
                  const recArm   = trackRecordArmed[i] ?? false;
                  const stripSelected = i === selectedTrackIndex;
                  const panOff   = pan - 64;
                  const panLabel = panOff === 0 ? 'C' : panOff > 0 ? `R${panOff}` : `L${Math.abs(panOff)}`;
                  const dbLabel  = formatMixerFaderDb(vol);
                  const faderTracking = mixerFaderActive?.kind === 'track' && mixerFaderActive.index === i;

                  return (
                    /* ── Ohm Studio-style channel strip ─────────────────────────────
                     * Layout: narrow strip, charcoal bg, color accent under name,
                     * fader + meters side-by-side as one integrated tall column.    */
                    <div
                      key={tr.id}
                      className="flex flex-col shrink-0 h-full"
                      onClick={() => selectTrackAndClearPianoNote(i)}
                      style={{
                        width: MIXER_STRIP_W_PX,
                        cursor: 'pointer',
                        background: stripSelected
                          ? `linear-gradient(90deg, rgba(124,244,198,0.12) 0%, rgba(19,19,24,0.95) 52%)`
                          : '#131318',
                        borderRight: '1px solid #1e1e28',
                        boxShadow: stripSelected
                          ? `inset 3px 0 0 ${tr.colorHex}, inset 0 0 0 1px rgba(255,255,255,0.06)`
                          : undefined,
                      }}
                    >
                      {/* ── Track name only (FX sits under meters — own row) ── */}
                      <div
                        className="shrink-0 flex items-center justify-center px-0.5 w-full"
                        style={{ height: 20, background: '#1a1a22', borderBottom: `2px solid ${tr.colorHex}` }}
                      >
                        <span
                          className={`truncate w-full text-center ${TRACK_NAME_MIXER_CLASS}`}
                          style={{ color: muted ? '#3a3a50' : '#a8a8bc', letterSpacing: '0.02em' }}
                          title={tr.name}
                        >
                          {tr.name}
                        </span>
                      </div>

                      {/* ── Fader + Meters integrated area ── */}
                      <div className="flex-1 flex min-h-0 w-full px-2 py-1 gap-2">
                        {/* Fader column */}
                        <div
                          className="relative flex-1 flex items-center justify-center min-h-0 min-w-0 overflow-hidden"
                          style={{ paddingLeft: 8, paddingRight: 2 }}
                        >
                          {/* Rail groove — inset, dark; shifted slightly right to leave room for scale labels */}
                          <div
                            className="absolute"
                            style={{
                              width: 3, top: MIXER_FADER_INSET_TOP_PX, bottom: MIXER_FADER_INSET_BOTTOM_PX, left: MIXER_FADER_RAIL_LEFT, transform: 'translateX(-50%)',
                              background: '#0a0a12',
                              borderRadius: 2,
                              boxShadow: 'inset 0 2px 4px rgba(0,0,0,1), inset 0 0 0 1px rgba(0,0,0,0.5)',
                            }}
                          />
                          {/* Colour fill strip — from bottom to knob */}
                          <div
                            className="absolute"
                            style={{
                              width: 3, bottom: MIXER_FADER_INSET_BOTTOM_PX, left: MIXER_FADER_RAIL_LEFT, transform: 'translateX(-50%)',
                              height: mixerFaderFillHeight(vol),
                              background: muted ? '#252530' : tr.colorHex,
                              opacity: muted ? 1 : 0.7,
                              borderRadius: 2,
                              transition: 'height 0.04s',
                            }}
                          />

                          {/* dB scale — printed +6 … −60 (use readout for −∞ at minimum) */}
                          {MIXER_FADER_DB_TICKS.map(({ label, vol: v }) => {
                            const btm = mixerFaderTravelBottom(v);
                            const isZero = label === '0';
                            const isFloor60 = label === '-60';
                            return (
                              <div
                                key={`tr-${i}-${v}-${label}`}
                                className="absolute pointer-events-none flex flex-row items-center justify-end"
                                style={{
                                  bottom: btm,
                                  left: MIXER_DB_SCALE_EDGE_LEFT_PX,
                                  right: MIXER_DB_SCALE_EDGE_RIGHT,
                                  transform: 'translateY(50%)',
                                  zIndex: 3,
                                }}
                              >
                                <span style={{
                                  fontSize: 10,
                                  fontFamily: 'ui-monospace, SF Mono, monospace',
                                  lineHeight: 1.2,
                                  whiteSpace: 'nowrap',
                                  marginRight: 6,
                                  display: 'inline-block',
                                  textAlign: 'right' as const,
                                  minWidth: '3ch',
                                  color: isZero ? '#f0f0ff' : isFloor60 ? '#f4f4ff' : '#d8d8ee',
                                  fontWeight: isZero ? 800 : isFloor60 ? 700 : 600,
                                  textShadow: '0 1px 2px rgba(0,0,0,0.95)',
                                  letterSpacing: isZero ? 0 : '0.02em',
                                  ...(isFloor60
                                    ? {
                                        background: 'rgba(16,16,24,0.97)',
                                        padding: '1px 3px',
                                        borderRadius: 2,
                                        boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
                                      }
                                    : {}),
                                }}>{label}</span>
                                <div style={{
                                  width: isZero ? 8 : 5,
                                  height: isZero ? 2 : 1,
                                  flexShrink: 0,
                                  background: isZero ? '#d8d8f0' : '#9898b8',
                                  boxShadow: isZero ? '0 0 3px rgba(220,220,248,0.35)' : 'none',
                                  borderRadius: 0.5,
                                }} />
                              </div>
                            );
                          })}

                          {/* Interaction: hidden range */}
          <input
                            type="range" min={0} max={127} value={vol}
                            onChange={(e) => { const n = [...trackVolumes]; n[i] = Number(e.target.value); setTrackVolumes(n); }}
                            onPointerDown={(e) => { e.stopPropagation(); setMixerFaderActive({ kind: 'track', index: i }); }}
                            style={{ writingMode: 'vertical-lr', direction: 'rtl', position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'ns-resize' }}
                            title={`${tr.name}: ${dbLabel} dB`}
                          />
                          {/* Fader knob — taller capsule so it's easy to grab and drag */}
                          <div
                            className="absolute pointer-events-none"
                            style={{
                              width: 26, height: MIXER_FADER_KNOB_H_PX,
                              bottom: mixerFaderKnobBottom(vol),
                              left: MIXER_FADER_RAIL_LEFT, transform: 'translateX(-50%)', zIndex: 2,
                              borderRadius: 4,
                              background: muted
                                ? 'linear-gradient(180deg, #3a3a4a 0%, #282832 100%)'
                                : 'linear-gradient(180deg, #dcdce8 0%, #aaaabc 40%, #8888a0 70%, #606072 100%)',
                              boxShadow: muted
                                ? 'none'
                                : '0 3px 7px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 0 rgba(0,0,0,0.3)',
                              transition: 'bottom 0.04s',
                            }}
                          >
                            {/* Level arrow — points at printed dB; glows while dragging */}
                            <div
                              aria-hidden
                              style={{
                                position: 'absolute',
                                left: -6,
                                top: 2,
                                width: 0,
                                height: 0,
                                borderTop: '3px solid transparent',
                                borderBottom: '3px solid transparent',
                                borderRight: `6px solid ${
                                  faderTracking ? '#7cf4c6' : muted ? '#5a5a68' : tr.colorHex
                                }`,
                                filter: faderTracking
                                  ? 'drop-shadow(0 0 8px rgba(124,244,198,0.95)) drop-shadow(0 0 4px rgba(124,244,198,0.6))'
                                  : undefined,
                              }}
                            />
                            {/* Top grip line */}
                            <div style={{ position: 'absolute', inset: '0 5px', top: 5, height: 1, background: muted ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.3)', borderRadius: 1 }} />
                            {/* Centre indicator line */}
                            <div style={{ position: 'absolute', inset: '0 4px', top: 9, height: 1, background: muted ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.5)', borderRadius: 1 }} />
                            {/* Bottom grip line */}
                            <div style={{ position: 'absolute', inset: '0 5px', top: 13, height: 1, background: muted ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.3)', borderRadius: 1 }} />
                          </div>
                        </div>

                        {/* Meters — in stereo, extra gutter so L/R LEDs read as two columns; mono keeps them tight */}
                        <div
                          className="flex shrink-0"
                          style={{
                            width: monoOn ? 14 : 24,
                            gap: monoOn ? 2 : 6,
                          }}
                        >
                          {(['L', 'R'] as const).map((ch, ci) => (
                            <div
                              key={ch}
                              className="relative flex-1 overflow-hidden rounded-sm"
                              style={{
                                background: 'linear-gradient(180deg, #0d0d14 0%, #07070f 100%)',
                                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 10px rgba(0,0,0,0.85)',
                              }}
                            >
                              <div
                                ref={(el) => {
                                  if (ci === 0) mixerMeterLsRef.current[i] = el;
                                  else          mixerMeterRsRef.current[i] = el;
                                }}
                                className="absolute bottom-0 left-0 right-0"
                                style={{
                                  height: '0%',
                                  background: muted
                                    ? '#1c1c28'
                                    : 'linear-gradient(to top, #00c853 0%, #00c853 96%, #ffb020 98.5%, #ff3b3b 100%)',
                                  transition: 'height 0.04s linear',
                                }}
                              />
                              <div
                                className="absolute top-0 left-0 right-0 h-[18%] pointer-events-none"
                                style={{
                                  background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 100%)',
                                  mixBlendMode: 'screen',
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── FX: under meters — CH + index left, F|X right (room for 3-digit indices) ── */}
                      <div
                        className="shrink-0 flex w-full items-center justify-between gap-1 px-1"
                        style={{
                          paddingTop: 2,
                          paddingBottom: 2,
                          borderTop: '1px solid #1a1a22',
                          background: 'linear-gradient(180deg, #101018 0%, #0c0c10 100%)',
                        }}
                      >
                        <div
                          className="flex shrink-0 min-w-0 items-baseline gap-0.5"
                          style={{ paddingLeft: 2 }}
                          title={`Channel ${i + 1}`}
                        >
        <span
                            className="font-black tabular-nums leading-none tracking-tight"
                            style={{
                              fontSize: 10,
                              minWidth: `${chPad}ch`,
                              textAlign: 'right',
                              color: stripSelected ? tr.colorHex : '#ececf4',
                              textShadow: stripSelected ? `0 0 8px ${tr.colorHex}55` : '0 1px 2px rgba(0,0,0,0.95)',
                            }}
                          >
                            {chNum}
        </span>
                        </div>
                        <div className="flex shrink-0">
                          <ChannelStripFxButton
                            variant="track"
                            channelLabel={`CH ${chNum}`}
                            slots={trackFxSlots[i] ?? emptyMixerFxSlots()}
                            onSlotChange={(slot, id) => onTrackFxSlotChange(i, slot, id)}
                            trackAccentHex={tr.colorHex}
                            onActivate={() => selectTrackAndClearPianoNote(i)}
                          />
                        </div>
                      </div>

                      {/* ── dB readout (compact vertical so fader pocket stays visually above CH strip) ── */}
                      <div className="shrink-0 flex items-center justify-center" style={{ paddingTop: 0, paddingBottom: 1, lineHeight: 1 }}>
                        <span
                          className="font-mono tabular-nums transition-all text-[8px]"
                          style={{
                            lineHeight: 1,
                            color: muted ? '#2e2e40' : faderTracking ? '#7cf4c6' : '#585868',
                            textShadow: faderTracking ? '0 0 8px rgba(124,244,198,0.45)' : undefined,
                          }}
                        >
                          {dbLabel}
                        </span>
                      </div>

                      {/* ── ST / Mono + Record (under ST) / Pan (under M) — 2×2 grid aligned with buttons above ── */}
                      <div
                        className="shrink-0 grid w-full px-2 pb-1"
                        style={{
                          borderTop: '1px solid #1e1e28',
                          gridTemplateColumns: '1fr 1fr',
                          columnGap: 1,
                          rowGap: 6,
                          paddingTop: 6,
                          paddingBottom: 4,
                        }}
                      >
        <button
          type="button"
                          title="Stereo — pan knob affects L/R"
                          onClick={() => { const n = [...trackMonos]; n[i] = false; setTrackMonos(n); }}
                          className="w-full font-bold uppercase"
          style={{
                            padding: '2px 0', fontSize: 6, letterSpacing: '0.04em', borderRadius: 2,
                            background: !monoOn ? '#24243a' : '#14141c',
                            color: !monoOn ? '#e8e8f8' : '#4a4a65',
                            border: `1px solid ${!monoOn ? tr.colorHex : '#252530'}`,
                            boxShadow: !monoOn ? `0 0 6px ${tr.colorHex}33` : 'none',
                          }}
                        >ST</button>
                        <button
                          type="button"
                          title="Mono — same signal to L and R (pan ignored)"
                          onClick={() => { const n = [...trackMonos]; n[i] = true; setTrackMonos(n); }}
                          className="w-full font-bold uppercase"
                          style={{
                            padding: '2px 0', fontSize: 6, letterSpacing: '0.04em', borderRadius: 2,
                            background: monoOn ? '#24243a' : '#14141c',
                            color: monoOn ? '#e8e8f8' : '#4a4a65',
                            border: `1px solid ${monoOn ? tr.colorHex : '#252530'}`,
                            boxShadow: monoOn ? `0 0 6px ${tr.colorHex}33` : 'none',
                          }}
                        >M</button>

                        {/* Row 2: rec · input (audio) · pan — full strip width */}
                        <div
                          className="flex w-full min-w-0 items-start justify-between gap-1"
                          style={{ gridColumn: '1 / -1' }}
                        >
                          <div className="flex flex-col items-center justify-start gap-0.5 min-w-0">
                            <button
                              type="button"
                              aria-label={recArm ? `Record-enable off for ${tr.name}` : `Record-enable on for ${tr.name}`}
                              aria-pressed={recArm}
                              title={
                                recArm
                                  ? 'Record Enable ON — armed for recording (tap to disarm)'
                                  : 'Record Enable — arm track for recording (DAW mixer R)'
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                selectTrackAndClearPianoNote(i);
                                setTrackRecordArmed((prev) => {
                                  const next = [...prev];
                                  next[i] = !(next[i] ?? false);
                                  return next;
                                });
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="flex items-center justify-center outline-none rounded-full transition-all shrink-0"
                              style={{
                                width: 40,
                                height: 40,
                                padding: 0,
                                border: 'none',
                                cursor: muted ? 'not-allowed' : 'pointer',
                                background: 'transparent',
                                opacity: muted ? 0.45 : 1,
                              }}
                            >
                              <span
                                className={`rounded-full block ${recording && recArm ? 'animate-pulse' : ''}`}
                                style={{
                                  width: 20,
                                  height: 20,
                                  boxSizing: 'border-box',
                                  background: recArm
                                    ? 'radial-gradient(circle at 32% 28%, #ff5a52 0%, #c91818 45%, #6a0909 100%)'
                                    : 'radial-gradient(circle at 32% 28%, #2a1818 0%, #120a0a 85%)',
                                  border: recArm ? '2px solid #ff9a9a' : '2px solid #5e2828',
                                  boxShadow: recArm
                                    ? `${recording ? '0 0 14px rgba(255,72,72,0.95), ' : ''}0 2px 4px rgba(0,0,0,1), inset 0 1px 0 rgba(255,230,230,0.4)`
                                    : 'inset 0 2px 5px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(90,44,44,0.3)',
                                }}
                              />
        </button>
                            <span
                              className="text-[6px] font-semibold uppercase leading-none tracking-wide"
                              style={{ color: recArm ? '#ff8a8a' : '#5a5a6a' }}
                              aria-hidden
                            >
                              rec
                            </span>
                          </div>

                          {/* Mic opens floating input picker (audio only); MIDI keeps layout alignment */}
                          {tr.kind === 'audio' ? (() => {
                            const ov = (tr.audioInputDeviceId ?? '').trim();
                            const devLabel = ov
                              ? micInputDeviceOptions.find((d) => d.deviceId === ov)?.label
                              : null;
                            const sum = devLabel
                              ? (devLabel.length > 28 ? `${devLabel.slice(0, 26)}…` : devLabel)
                              : 'Project default (Settings)';
                            const inputOpen = mixerAudioInputPopover?.trackIndex === i;
                            const hasOverride = Boolean(ov);
                            return (
                              <div className="flex flex-col items-center justify-start gap-0.5 shrink-0">
        <button
          type="button"
                                  data-mixer-audio-input-trigger
                                  aria-label={`Input for ${tr.name}: ${sum}. Click to choose microphone or line source.`}
                                  aria-expanded={inputOpen}
                                  aria-haspopup="listbox"
                                  title={`Input — ${sum} · click to change`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectTrackAndClearPianoNote(i);
                                    const btn = e.currentTarget;
                                    setMixerAudioInputPopover((prev) => {
                                      if (prev?.trackIndex === i) return null;
                                      const r = btn.getBoundingClientRect();
                                      const w = 200;
                                      const left = Math.min(
                                        window.innerWidth - w - 8,
                                        Math.max(8, Math.round(r.left + r.width / 2 - w / 2)),
                                      );
                                      return { trackIndex: i, top: Math.round(r.bottom + 6), left };
                                    });
                                  }}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  className="flex items-center justify-center outline-none rounded-md transition-all shrink-0"
          style={{
                                    width: 22,
                                    height: 22,
                                    padding: 0,
                                    border: `1px solid ${inputOpen || hasOverride ? tr.colorHex : '#35354a'}`,
                                    cursor: 'pointer',
                                    background: inputOpen
                                      ? 'linear-gradient(180deg, #1c2430 0%, #12121a 100%)'
                                      : 'linear-gradient(180deg, #181820 0%, #0e0e14 100%)',
                                    boxShadow: inputOpen || hasOverride ? `0 0 8px ${tr.colorHex}44` : 'inset 0 1px 0 rgba(255,255,255,0.06)',
                                    opacity: muted ? 0.5 : 1,
                                  }}
                                >
                                  <Mic
                                    size={12}
                                    strokeWidth={2.25}
                                    style={{
                                      color: hasOverride || inputOpen ? tr.colorHex : '#7a7a94',
                                    }}
                                    aria-hidden
                                  />
        </button>
                                <span
                                  className="text-[6px] font-semibold uppercase leading-none tracking-wide"
                                  style={{ color: hasOverride ? tr.colorHex : '#5a5a6a' }}
                                  aria-hidden
                                >
                                  in
                                </span>
      </div>
                            );
                          })() : (
                            <div className="shrink-0" style={{ width: 26 }} aria-hidden />
                          )}

                          <div className="flex flex-col items-center gap-0.5 min-w-0 justify-start">
                            {/* Round pan knob — drag up/down to pan; double-click resets to centre */}
        <div
                              title={monoOn ? 'Pan (inactive in MONO — press ST for stereo imaging)' : 'Pan — drag up/down · double-click to centre'}
          style={{
                                width: 24, height: 24,
                                borderRadius: '50%',
                                background: muted
                                  ? 'radial-gradient(circle at 34% 30%, #2b2b39 0%, #151520 46%, #0a0a12 100%)'
                                  : 'radial-gradient(circle at 34% 30%, #7c7c92 0%, #3f3f53 42%, #1b1b28 78%, #0d0d15 100%)',
                                boxShadow: muted
                                  ? 'inset 0 2px 5px rgba(0,0,0,0.92), inset 0 0 0 1px rgba(255,255,255,0.04)'
                                  : '0 2px 8px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.26), inset 0 -1px 0 rgba(0,0,0,0.56), inset 0 0 0 1px rgba(255,255,255,0.08)',
                                position: 'relative',
                                cursor: monoOn ? 'default' : 'ns-resize',
                                transform: `rotate(${((pan - 64) / 63) * 140}deg)`,
                                flexShrink: 0,
                                touchAction: 'none',
                                userSelect: 'none',
                                opacity: muted ? 1 : monoOn ? 0.42 : 1,
                              }}
                              onPointerDown={(e) => {
                                if (monoOn || muted) return;
                                e.currentTarget.setPointerCapture(e.pointerId);
                                panDragRef.current = { trackIndex: i, startY: e.clientY, startPan: pan };
                              }}
                              onPointerMove={(e) => {
                                if (!panDragRef.current || panDragRef.current.trackIndex !== i) return;
                                const delta = panDragRef.current.startY - e.clientY;
                                const newPan = Math.max(0, Math.min(127, Math.round(panDragRef.current.startPan + delta * 0.7)));
                                const n = [...trackPans]; n[i] = newPan; setTrackPans(n);
                              }}
                              onPointerUp={(e) => {
                                panDragRef.current = null;
                                try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ok */ }
                              }}
                              onDoubleClick={() => { if (monoOn || muted) return; const n = [...trackPans]; n[i] = 64; setTrackPans(n); }}
        >
          <div
            style={{
                                  position: 'absolute',
                                  left: '50%',
                                  top: '50%',
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  background: muted ? '#202030' : 'radial-gradient(circle at 35% 35%, #e7e7f4 0%, #8e8ea5 100%)',
                                  boxShadow: muted ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.7)',
                                }}
                              />
                              {/* Pointer cap at 12 o'clock */}
                              <div style={{
                                position: 'absolute',
                                width: 4, height: 6, borderRadius: 2,
                                top: 2.5, left: '50%', transform: 'translateX(-50%)',
                                background: muted ? '#2e2e44' : tr.colorHex,
                                boxShadow: muted ? 'none' : `0 0 6px ${tr.colorHex}aa`,
                              }} />
                            </div>
                            <span className="text-[6px] font-mono tabular-nums" style={{ color: '#484858' }}>{panLabel}</span>
                          </div>
                        </div>
                      </div>

                      {/* ── Mute / Solo ── */}
                      <div className="shrink-0 flex gap-px w-full px-2 pb-2">
                        <button
                          type="button" title="Mute"
                          onClick={() => { const n = [...trackMutes]; n[i] = !n[i]; setTrackMutes(n); }}
                          className="flex-1 font-bold uppercase"
                          style={{
                            padding: '3px 0', fontSize: 7, letterSpacing: '0.05em', borderRadius: 2,
                            background: muted ? '#2c1200' : '#1a1a24',
                            color: muted ? '#ff9933' : '#383848',
                            border: `1px solid ${muted ? '#4a2200' : '#252530'}`,
                          }}
                        >M</button>
                        <button
                          type="button" title="Solo"
                          onClick={() => { const n = [...trackSolos]; n[i] = !n[i]; setTrackSolos(n); }}
                          className="flex-1 font-bold uppercase"
                          style={{
                            padding: '3px 0', fontSize: 7, letterSpacing: '0.05em', borderRadius: 2,
                            background: soloed ? '#0c2018' : '#1a1a24',
                            color: soloed ? '#7cf4c6' : '#383848',
                            border: `1px solid ${soloed ? '#1a4030' : '#252530'}`,
                          }}
                        >S</button>
                      </div>
                    </div>
                  );
                })}

                {/* ── Master bus — Ohm Studio style, teal accent ── */}
                {(() => {
                  const mvDb  = formatMixerFaderDb(masterVolume);
                  const faderMasterHot = mixerFaderActive?.kind === 'master';
                  return (
                    <div
                      className="flex flex-col shrink-0 h-full"
                      style={{ width: MIXER_STRIP_W_PX, background: '#0e0e16', borderLeft: '2px solid #2a3a34' }}
                    >
                      <div
                        className="shrink-0 flex items-center justify-center px-0.5 w-full"
                        style={{ height: 20, background: '#141e1a', borderBottom: '2px solid #7cf4c6' }}
                      >
                        <span
                          className={`w-full text-center truncate ${TRACK_NAME_MIXER_CLASS}`}
                          style={{ color: '#6ab89a', letterSpacing: '0.04em' }}
                        >
                          Master
                        </span>
                      </div>

                      {/* Fader + meters */}
                      <div className="flex-1 flex min-h-0 w-full px-2 py-1 gap-2">
                        {/* Master Fader */}
                        <div
                          className="relative flex-1 flex items-center justify-center min-h-0 min-w-0 overflow-hidden"
                          style={{ paddingLeft: 8, paddingRight: 2 }}
                        >
                          {/* Rail */}
                          <div className="absolute" style={{ width: 3, top: MIXER_FADER_INSET_TOP_PX, bottom: MIXER_FADER_INSET_BOTTOM_PX, left: MIXER_FADER_RAIL_LEFT, transform: 'translateX(-50%)', background: '#0a0a12', borderRadius: 2, boxShadow: 'inset 0 2px 4px rgba(0,0,0,1)' }} />
                          {/* Fill */}
                          <div className="absolute" style={{ width: 3, bottom: MIXER_FADER_INSET_BOTTOM_PX, left: MIXER_FADER_RAIL_LEFT, transform: 'translateX(-50%)', height: mixerFaderFillHeight(masterVolume), background: '#7cf4c6', opacity: 0.6, borderRadius: 2, transition: 'height 0.04s' }} />

                          {/* dB scale — printed +6 … −60; readout shows −∞ at bottom */}
                          {MIXER_FADER_DB_TICKS.map(({ label, vol: v }) => {
                            const btm = mixerFaderTravelBottom(v);
                            const isZero = label === '0';
                            const isFloor60 = label === '-60';
                            return (
                              <div
                                key={`ms-${v}-${label}`}
                                className="absolute pointer-events-none flex flex-row items-center justify-end"
                                style={{
                                  bottom: btm,
                                  left: MIXER_DB_SCALE_EDGE_LEFT_PX,
                                  right: MIXER_DB_SCALE_EDGE_RIGHT,
                                  transform: 'translateY(50%)',
                                  zIndex: 3,
                                }}
                              >
                                <span style={{
                                  fontSize: 10,
                                  fontFamily: 'ui-monospace, SF Mono, monospace',
                                  lineHeight: 1.2,
                                  whiteSpace: 'nowrap',
                                  marginRight: 6,
                                  display: 'inline-block',
                                  textAlign: 'right' as const,
                                  minWidth: '3ch',
                                  color: isZero ? '#ecfdf6' : isFloor60 ? '#e4fff8' : '#c8eee4',
                                  fontWeight: isZero ? 800 : isFloor60 ? 700 : 600,
                                  textShadow: '0 1px 2px rgba(0,0,0,0.92)',
                                  letterSpacing: isZero ? 0 : '0.02em',
                                  ...(isFloor60
                                    ? {
                                        background: 'rgba(12,24,22,0.96)',
                                        padding: '1px 3px',
                                        borderRadius: 2,
                                        boxShadow: '0 0 0 1px rgba(124,244,198,0.12)',
                                      }
                                    : {}),
                                }}>{label}</span>
                                <div style={{
                                  width: isZero ? 8 : 5,
                                  height: isZero ? 2 : 1,
                                  flexShrink: 0,
                                  background: isZero ? '#e2fff4' : '#96d4c4',
                                  boxShadow: isZero ? '0 0 4px rgba(124,244,198,0.35)' : 'none',
                                  borderRadius: 0.5,
                                }} />
                              </div>
                            );
                          })}

                          <input
                            type="range"
                            min={0}
                            max={127}
                            value={masterVolume}
                            onChange={(e) => setMasterVolume(Number(e.target.value))}
                            onPointerDown={() => setMixerFaderActive({ kind: 'master' })}
                            style={{ writingMode: 'vertical-lr', direction: 'rtl', position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'ns-resize' }}
                            title={`Master: ${mvDb} dB`}
                          />
                          {/* Teal-tinted knob */}
                          <div className="absolute pointer-events-none" style={{
                            width: 26, height: MIXER_FADER_KNOB_H_PX,
                            bottom: mixerFaderKnobBottom(masterVolume),
                            left: MIXER_FADER_RAIL_LEFT,
                            transform: 'translateX(-50%)',
                            zIndex: 2,
                            borderRadius: 4, background: 'linear-gradient(180deg, #c8ede4 0%, #88c8b8 40%, #60a090 70%, #3a7868 100%)', boxShadow: '0 3px 7px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.3)', transition: 'bottom 0.04s'
                          }}>
                            <div
                              aria-hidden
                              style={{
                                position: 'absolute',
                                left: -6,
                                top: 2,
                                width: 0,
                                height: 0,
                                borderTop: '3px solid transparent',
                                borderBottom: '3px solid transparent',
                                borderRight: `6px solid ${faderMasterHot ? '#7cf4c6' : '#6ab89a'}`,
                                filter: faderMasterHot
                                  ? 'drop-shadow(0 0 8px rgba(124,244,198,0.95)) drop-shadow(0 0 4px rgba(124,244,198,0.6))'
                                  : undefined,
                              }}
                            />
                            <div style={{ position: 'absolute', inset: '0 5px', top: 5,  height: 1, background: 'rgba(0,0,0,0.25)', borderRadius: 1 }} />
                            <div style={{ position: 'absolute', inset: '0 4px', top: 9, height: 1, background: 'rgba(0,0,0,0.45)', borderRadius: 1 }} />
                            <div style={{ position: 'absolute', inset: '0 5px', top: 13, height: 1, background: 'rgba(0,0,0,0.25)', borderRadius: 1 }} />
          </div>
        </div>
                        {/* Master L/R — same stereo gutter as track channels in ST mode */}
                        <div className="flex shrink-0" style={{ width: 24, gap: 6 }}>
                          {(['L', 'R'] as const).map((ch) => (
                            <div
                              key={ch}
                              className="relative flex-1 overflow-hidden rounded-sm"
                              style={{
                                background: 'linear-gradient(180deg, #09110f 0%, #050b0a 100%)',
                                boxShadow: 'inset 0 0 0 1px rgba(124,244,198,0.12), inset 0 0 10px rgba(0,0,0,0.8)',
                              }}
                            >
                              <div ref={ch === 'L' ? mixerMasterLRef : mixerMasterRRef} className="absolute bottom-0 left-0 right-0" style={{ height: '0%', background: 'linear-gradient(to top, #00c853 0%, #00c853 96%, #ffb020 98.5%, #ff3b3b 100%)', transition: 'height 0.04s linear' }} />
                              <div className="absolute top-0 left-0 right-0 h-[18%] pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 100%)', mixBlendMode: 'screen' }} />
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* FX under master VU meters */}
                      <div
                        className="shrink-0 flex w-full items-center justify-center"
                        style={{
                          paddingTop: 2,
                          paddingBottom: 2,
                          borderTop: '1px solid #1a2820',
                          background: 'linear-gradient(180deg, #0c1412 0%, #080c0e 100%)',
                        }}
                      >
                        <ChannelStripFxButton
                          variant="master"
                          channelLabel="MASTER"
                          slots={masterFxSlots}
                          onSlotChange={onMasterFxSlotChange}
                        />
                      </div>
                      {/* dB — compact row */}
                      <div className="shrink-0 flex items-center justify-center" style={{ paddingTop: 0, paddingBottom: 1, lineHeight: 1 }}>
                        <span
                          className="font-mono tabular-nums transition-all text-[8px]"
                          style={{
                            lineHeight: 1,
                            color: faderMasterHot ? '#7cf4c6' : '#3a6858',
                            textShadow: faderMasterHot ? '0 0 8px rgba(124,244,198,0.45)' : undefined,
                          }}
                        >
                          {mvDb}
                        </span>
                      </div>
                      {/* Pan knob — master always centred (not wired) */}
                      <div className="shrink-0 w-full px-2 pb-1" style={{ borderTop: '1px solid #1e2820' }}>
                        <div className="flex flex-col items-center gap-0.5 pt-1.5 pb-0.5">
                          <div
                            title="Master Pan — always centred"
                            style={{
                              width: 24, height: 24, borderRadius: '50%',
                              background: 'radial-gradient(circle at 34% 30%, #5aa890 0%, #2e5c4f 45%, #12241f 80%, #08120f 100%)',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.5), inset 0 0 0 1px rgba(124,244,198,0.2)',
                              position: 'relative', flexShrink: 0,
                            }}
                          >
                            <div style={{
                              position: 'absolute', left: '50%', top: '50%', width: 8, height: 8, borderRadius: '50%',
                              transform: 'translate(-50%, -50%)',
                              background: 'radial-gradient(circle at 35% 35%, #d7fff1 0%, #79c8af 100%)',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.6)',
                            }} />
                            <div style={{
                              position: 'absolute', width: 4, height: 6, borderRadius: 2,
                              top: 3, left: '50%', transform: 'translateX(-50%)',
                              background: '#7cf4c6', boxShadow: '0 0 4px #7cf4c688',
                            }} />
                          </div>
                          <span className="text-[6px] font-mono" style={{ color: '#2a5040' }}>C</span>
                        </div>
                      </div>
                      {/* M/S placeholders */}
                      <div className="shrink-0 flex gap-px w-full px-2 pb-2">
                        <div className="flex-1 font-bold uppercase text-center" style={{ padding: '3px 0', fontSize: 7, borderRadius: 2, background: '#111118', color: '#202830', border: '1px solid #1a2420' }}>M</div>
                        <div className="flex-1 font-bold uppercase text-center" style={{ padding: '3px 0', fontSize: 7, borderRadius: 2, background: '#111118', color: '#202830', border: '1px solid #1a2420' }}>S</div>
      </div>
    </div>
  );
                })()}

              </div>
            </div>
            {mixerAudioInputPopover != null &&
              studioTracks[mixerAudioInputPopover.trackIndex]?.kind === 'audio' &&
              typeof document !== 'undefined' &&
              createPortal(
                (() => {
                  const pi = mixerAudioInputPopover.trackIndex;
                  const popTr = studioTracks[pi];
                  if (!popTr || popTr.kind !== 'audio') return null;
                  const cur = (popTr.audioInputDeviceId ?? '').trim();
                  const setInput = (deviceId: string) => {
                    setStudioTracks((prev) =>
                      prev.map((t, idx) =>
                        idx === pi && t.kind === 'audio' ? { ...t, audioInputDeviceId: deviceId } : t,
                      ),
                    );
                    setMixerAudioInputPopover(null);
                  };
                  return (
                    <div
                      data-mixer-audio-input-popover
                      role="listbox"
                      aria-label={`Microphone / line input for ${popTr.name}`}
                      className="rounded border overflow-x-hidden overflow-y-auto font-mono"
                      style={{
                        position: 'fixed',
                        top: mixerAudioInputPopover.top,
                        left: mixerAudioInputPopover.left,
                        width: 200,
                        zIndex: 10060,
                        maxHeight: 240,
                        background: '#0e0e14',
                        borderColor: '#3a3a4c',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.05)',
                      }}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={cur === ''}
                        className="block w-full text-left outline-none border-b truncate"
                        style={{
                          padding: '6px 8px',
                          fontSize: 9,
                          fontWeight: 700,
                          color: cur === '' ? '#7cf4c6' : '#b8b8cc',
                          background: cur === '' ? 'rgba(124,244,198,0.08)' : 'transparent',
                          borderColor: '#22222c',
                        }}
                        onClick={() => setInput('')}
                      >
                        Project default (Settings)
                      </button>
                      {micInputDeviceOptions.map((d) => {
                        const lab = d.label.length > 26 ? `${d.label.slice(0, 24)}…` : d.label;
                        const sel = cur === d.deviceId;
                        return (
                          <button
                            key={d.deviceId}
                            type="button"
                            role="option"
                            aria-selected={sel}
                            className="block w-full text-left outline-none border-b last:border-b-0 truncate"
                            style={{
                              padding: '5px 8px',
                              fontSize: 8,
                              fontWeight: 600,
                              color: sel ? popTr.colorHex : '#a4a4b8',
                              background: sel ? `${popTr.colorHex}18` : 'transparent',
                              borderColor: '#1a1a22',
                            }}
                            title={d.label}
                            onClick={() => setInput(d.deviceId)}
                          >
                            {lab}
                          </button>
                        );
                      })}
                    </div>
                  );
                })(),
                document.body,
              )}
          </div>
        )}
      </main>

      {!(showPianoRoll && pianoRollExpanded) && (
      <footer
        className="shrink-0 border-t flex flex-wrap items-center px-2 sm:px-3 py-2 sm:py-2.5"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          borderColor: '#12121a',
          background: 'linear-gradient(180deg, #0c0c10 0%, #08080c 100%)',
          gap: '12px 32px',
        }}
      >
        {/* Transport */}
        <div className="flex items-center gap-2 shrink-0 box-border">
          <button
            type="button"
            title="Stop / Return to Zero"
            className={`${transportBtnBase} h-9 w-9 rounded-md border`}
            style={{ borderColor: '#2a2a32', color: '#b0b0bc' }}
            onClick={onStop}
          >
            <SkipBack size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            title="Rewind one bar"
            disabled={running}
            className={`${transportBtnBase} h-9 w-9 rounded-md border disabled:opacity-40`}
            style={{ borderColor: '#2a2a32', color: '#b0b0bc' }}
            onClick={() => nudgePlayheadBeats(-beatsPerBar)}
          >
            <Rewind size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            title={running ? 'Pause' : 'Play'}
            className={`${transportBtnBase} h-10 w-10 rounded-full border`}
            style={{
              background: running ? '#152018' : '#13221c',
              borderColor: running ? '#2a4a38' : '#2d5a48',
            color: '#7cf4c6',
          }}
            onClick={() => void onTogglePlayPause()}
        >
            {running ? <Pause size={20} strokeWidth={2} /> : <Play size={20} className="ml-0.5" strokeWidth={2} />}
        </button>
        <button
          type="button"
            title={recording ? 'Recording active (visual marker â€” no MIDI capture yet). Click to stop.' : 'Record marker â€” starts transport and marks the session'}
            aria-pressed={recording}
            className={`${transportBtnBase} h-9 w-9 rounded-md border`}
          style={{
              background: recording ? 'rgba(255,60,60,0.15)' : 'transparent',
              borderColor: recording ? '#aa3030' : '#2a2a32',
              color: recording ? '#ff6b6b' : '#b0b0bc',
              boxShadow: recording ? '0 0 8px rgba(255,80,80,0.3)' : undefined,
            }}
            onClick={onRecordClick}
          >
            <Mic size={17} strokeWidth={2} className={recording ? 'animate-pulse' : ''} />
          </button>
          <button
            type="button"
            title="Stop"
            className={`${transportBtnBase} h-9 w-9 rounded-md border`}
            style={{
              background: '#1a1214',
              borderColor: '#3a2828',
              color: '#e89898',
          }}
          onClick={onStop}
        >
            <Square size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            title="Fast-forward one bar"
            disabled={running}
            className={`${transportBtnBase} h-9 w-9 rounded-md border disabled:opacity-40`}
            style={{ borderColor: '#2a2a32', color: '#b0b0bc' }}
            onClick={() => nudgePlayheadBeats(beatsPerBar)}
          >
            <FastForward size={16} strokeWidth={2} />
        </button>
      </div>

        {/* Bars / Time / BPM */}
        <div className="flex items-center gap-3 shrink-0 box-border">
          <div
            className="h-8 rounded border px-2 flex flex-col justify-center items-center min-w-[8.25rem] max-w-none"
            style={{ background: 'rgba(0,0,0,0.45)', borderColor: '#1e1e26', boxSizing: 'border-box' }}
          >
            <span className="text-[7px] font-semibold uppercase tracking-wide leading-none" style={{ color: '#6a6a78' }}>
              Bars
            </span>
            <span
              ref={barsReadoutRef}
              className="text-xs font-mono font-bold tabular-nums leading-none mt-px text-white whitespace-nowrap text-center px-0.5 w-full"
            >
              1.1.00
            </span>
          </div>
          <div
            className="h-8 rounded border px-1.5 flex flex-col justify-center items-center min-w-[3.5rem]"
            style={{ background: 'rgba(0,0,0,0.45)', borderColor: '#1e1e26', boxSizing: 'border-box' }}
          >
            <span className="text-[7px] font-semibold uppercase tracking-wide leading-none" style={{ color: '#6a6a78' }}>
              Time
            </span>
            <span
              ref={timeReadoutRef}
              className="text-xs font-mono font-bold tabular-nums leading-none mt-px"
              style={{ color: '#7cf4c6' }}
            >
              00:00:00
            </span>
          </div>

          {/* BPM Â± (`TransportView`) — same outer height as Bar/Time chips */}
          <div
            className="flex items-center shrink-0 h-8 gap-0.5 rounded border px-0.5 box-border"
            style={{ borderColor: '#2a2a32', background: 'rgba(0,0,0,0.35)' }}
          >
            <button
              type="button"
              title="BPM âˆ’1"
              disabled={running}
              className={`${transportBtnBase} h-8 w-7 rounded text-[#c8c8d0] disabled:opacity-40`}
              onClick={() => setBpm((b) => Math.max(40, b - 1))}
            >
              <Minus size={14} strokeWidth={2} />
            </button>
            <div className="flex flex-col items-center justify-center px-0.5 min-w-[2.625rem] h-full">
              <span className="text-[7px] font-semibold uppercase leading-none" style={{ color: '#6a6a78' }}>
                BPM
              </span>
              <input
                type="number"
                min={40}
                max={240}
                value={bpm}
                disabled={running}
                onChange={(e) => setBpm(Math.max(40, Math.min(240, Number(e.target.value) || 120)))}
                className="w-full max-w-[2.75rem] tabular-nums text-center leading-none text-[11px] font-mono font-bold bg-transparent border-0 outline-none py-0 h-4 disabled:opacity-45"
                style={{ color: '#ffb84d' }}
              />
            </div>
            <button
              type="button"
              title="BPM +1"
              disabled={running}
              className={`${transportBtnBase} h-8 w-7 rounded text-[#c8c8d0] disabled:opacity-40`}
              onClick={() => setBpm((b) => Math.min(240, b + 1))}
            >
              <Plus size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Panel toggles + zoom — isolate Met from “Zoom …” visually */}
        <div
          className="flex flex-wrap items-center shrink-0"
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 36px' }}
        >
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              title={showPianoRoll ? 'Hide piano roll' : 'Show piano roll'}
              aria-pressed={showPianoRoll}
              className={`${transportBtnBase} h-9 w-9 rounded-md border shrink-0`}
          style={{
                borderColor: showPianoRoll ? '#2a4a3c' : '#2a2a32',
                color: showPianoRoll ? '#7cf4c6' : '#6a6a78',
                background: showPianoRoll ? '#14221c' : 'transparent',
              }}
              onClick={() => {
                setShowPianoRoll((v) => {
                  const next = !v;
                  if (!next) setPianoRollExpanded(false);
                  return next;
                });
                setShowMixer(false);
              }}
            >
              <Piano size={17} strokeWidth={2} />
            </button>
            <button
              type="button"
              title={
                selectedTrackIsMidi
                  ? 'Open piano roll for the selected MIDI track'
                  : 'Select a MIDI track, then open piano roll'
              }
              disabled={!selectedTrackIsMidi}
              className={`${transportBtnBase} h-9 rounded-md border px-2.5 text-[10px] font-bold uppercase tracking-wide shrink-0 disabled:opacity-40 disabled:cursor-not-allowed`}
              style={{
                borderColor: showPianoRoll && selectedTrackIsMidi ? '#2a4a3c' : '#2a2a32',
                color: showPianoRoll && selectedTrackIsMidi ? '#7cf4c6' : '#8a8a98',
                background: showPianoRoll && selectedTrackIsMidi ? '#14221c' : 'transparent',
              }}
              onClick={() => {
                if (!selectedTrackIsMidi) return;
                setShowPianoRoll(true);
                setPianoRollExpanded(true);
                setShowMixer(false);
              }}
            >
              Edit PR
            </button>

            <button
              type="button"
              title={showMixer ? 'Hide mixer' : 'Show audio channel mixer'}
              aria-pressed={showMixer}
              className={`${transportBtnBase} h-9 w-9 rounded-md border shrink-0`}
            style={{
                borderColor: showMixer ? '#2a4a3c' : '#2a2a32',
                color: showMixer ? '#7cf4c6' : '#6a6a78',
                background: showMixer ? '#14221c' : 'transparent',
              }}
              onClick={() => { setShowMixer((v) => !v); setShowPianoRoll(false); setPianoRollExpanded(false); }}
            >
              <SlidersHorizontal size={16} strokeWidth={2} />
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={metroOn}
              title="Metronome"
              className={`${transportBtnBase} h-9 w-9 rounded-md border shrink-0 text-[11px] font-bold uppercase`}
              style={{
                borderColor: metroOn ? '#2a4a3c' : '#2a2a32',
                color: metroOn ? '#7cf4c6' : '#5c5c68',
                background: metroOn ? '#14221c' : 'transparent',
              }}
              onClick={() => setMetroOn((v) => !v)}
            >
              Met
            </button>
          </div>

          <label
            className="flex items-center shrink-0 gap-2 text-[9px] font-semibold uppercase tracking-wide select-none min-w-[7rem]"
            style={{ color: '#6a6a78', margin: 0, paddingLeft: 8 }}
            title="Timeline zoom"
          >
            Zoom
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              value={zoom}
              onChange={(e) => {
                const v = Number(e.target.value);
                setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number.isFinite(v) ? v : 1)));
              }}
              className="h-1.5 rounded-full align-middle cursor-pointer shrink-0"
              style={{ accentColor: '#7cf4c6', width: 72 }}
            />
            <span className="tabular-nums text-[10px] font-mono shrink-0" style={{ color: '#9898a8', minWidth: '2rem' }}>
              {zoom.toFixed(2)}×
            </span>
          </label>
          </div>
      </footer>
      )}
      <TimelineContextMenu
        contextMenu={editorContextMenu}
        onClose={closeEditorContextMenu}
        onCut={midiCutSelection}
        onCopy={midiCopySelection}
        onPaste={midiPasteSelection}
        onDuplicate={midiDuplicateSelection}
        onSplit={midiSplitSelection}
        onDelete={midiDeleteSelection}
        onUndo={midiUndoEdit}
        onRedo={midiRedoEdit}
        canPaste={midiClipboardHeld}
        cutDisabled={!contextMenuHasNoteTarget}
        copyDisabled={!contextMenuHasNoteTarget}
        duplicateDisabled={!contextMenuHasNoteTarget}
        splitDisabled={!contextMenuHasNoteTarget}
        deleteDisabled={!contextMenuHasNoteTarget}
        undoDisabled={!canMidiUndo}
        redoDisabled={!canMidiRedo}
        extraItems={[
          { label: 'Quantize', action: quantizeSelected, shortcut: 'Ctrl+Q', disabled: !midiHasNoteSel },
          { label: 'Transpose +1', action: () => transposeSelected(1), shortcut: 'Up', disabled: !midiHasNoteSel },
          { label: 'Transpose -1', action: () => transposeSelected(-1), shortcut: 'Down', disabled: !midiHasNoteSel },
          { label: 'Humanize', action: humanizeSelected, disabled: !midiHasNoteSel },
          { label: 'Legato', action: legatoSelected, disabled: !midiHasNoteSel },
          { label: 'Arpeggiate', action: arpeggiateSelected, disabled: !midiHasNoteSel },
          { label: 'Strum', action: strumSelected, disabled: !midiHasNoteSel },
          { label: 'Chop', action: chopSelected, disabled: !midiHasNoteSel },
          { label: 'Randomize Velocity', action: randomizeVelocitySelected, disabled: !midiHasNoteSel },
        ]}
      />
    </div>
  );
}
