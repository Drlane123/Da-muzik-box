import type { LucideIcon } from 'lucide-react';
import {
  Eraser,
  Gauge,
  Maximize2,
  Minimize2,
  MousePointer2,
  Music2,
  Pencil,
  Redo2,
  RotateCcw,
  Scissors,
  StretchHorizontal,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { BeatLabEditTool, BeatLabGridZoomMode } from '@/app/lib/creationStation/beatLabMidiRoll';

function chipStyle(active: boolean) {
  return {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: 3,
    fontSize: 9,
    fontWeight: 800 as const,
    color: active ? '#7cf4c6' : '#8a8a98',
    background: active ? 'rgba(124, 244, 198, 0.14)' : 'rgba(255, 255, 255, 0.04)',
    border: `1px solid ${active ? 'rgba(124, 244, 198, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
    borderRadius: 4,
    padding: '3px 6px',
    cursor: 'pointer' as const,
  };
}

const groupStyle = {
  display: 'flex',
  alignItems: 'center' as const,
  gap: 4,
  marginLeft: 4,
  paddingLeft: 8,
  borderLeft: '1px solid rgba(124, 244, 198, 0.18)',
  flexWrap: 'wrap' as const,
};

const VIEW_TOOLS: Array<{
  id: BeatLabEditTool;
  label: string;
  Icon: LucideIcon;
  title: string;
}> = [
  {
    id: 'pointer',
    label: 'PTR',
    Icon: MousePointer2,
    title: 'Pointer (P) — drag body · drag edges to resize · Shift/Ctrl lock axis · Alt+drag copy · Del delete',
  },
  {
    id: 'draw',
    label: 'DRAW',
    Icon: Pencil,
    title: 'Draw (FL Pencil) — drag to paint · R-click delete note',
  },
  {
    id: 'erase',
    label: 'ERASE',
    Icon: Eraser,
    title: 'Erase (FL Delete) — click or drag to delete notes · R-click delete',
  },
  {
    id: 'mute',
    label: 'MUTE',
    Icon: VolumeX,
    title: 'Mute — click or drag on piano-roll notes to mute (Logic/Cubase mute)',
  },
  {
    id: 'velocity',
    label: 'VEL',
    Icon: Gauge,
    title: 'Velocity (FL) — drag up/down on a note to change loudness',
  },
  {
    id: 'automation',
    label: 'VOL',
    Icon: Volume2,
    title: 'Volume — drag tiny steps in VOL lane (8 per grid step); Shift+drag = ramp · baseline is low',
  },
  {
    id: 'pitch',
    label: 'PITCH',
    Icon: Music2,
    title:
      'Pitch — drag shows ±st readout · Shift+drag = ramp · Alt+drag = select · Ctrl+C copy bar/selection · Ctrl+V paste at playhead',
  },
  {
    id: 'slice',
    label: 'SLICE',
    Icon: Scissors,
    title: 'Slice (FL C) — split notes · Shift = pitch slice (+1 semitone on right piece)',
  },
];

const COMPACT_TOOL_IDS: BeatLabEditTool[] = ['pointer', 'draw'];

export function BeatLabHistoryControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onResetVol,
  onResetPitch,
  disabled,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onResetVol: () => void;
  onResetPitch: () => void;
  disabled?: boolean;
}) {
  const off = disabled === true;
  return (
    <div style={groupStyle}>
      <span style={{ fontSize: 8, fontWeight: 800, color: '#5c5c68', letterSpacing: 0.6 }}>EDIT</span>
      <button
        type="button"
        disabled={off || !canUndo}
        onClick={onUndo}
        title="Undo (Ctrl+Z) — notes, drums, VOL/PITCH lanes"
        style={{
          ...chipStyle(false),
          opacity: off || !canUndo ? 0.4 : 1,
          cursor: off || !canUndo ? 'not-allowed' : 'pointer',
        }}
      >
        <Undo2 size={10} aria-hidden />
        UNDO
      </button>
      <button
        type="button"
        disabled={off || !canRedo}
        onClick={onRedo}
        title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
        style={{
          ...chipStyle(false),
          opacity: off || !canRedo ? 0.4 : 1,
          cursor: off || !canRedo ? 'not-allowed' : 'pointer',
        }}
      >
        <Redo2 size={10} aria-hidden />
        REDO
      </button>
      <button
        type="button"
        disabled={off}
        onClick={onResetVol}
        title="Reset volume lane to default (quiet baseline)"
        style={{ ...chipStyle(false), opacity: off ? 0.4 : 1 }}
      >
        <RotateCcw size={10} aria-hidden />
        RST VOL
      </button>
      <button
        type="button"
        disabled={off}
        onClick={onResetPitch}
        title="Reset pitch lane to center (0 semitones)"
        style={{ ...chipStyle(false), opacity: off ? 0.4 : 1 }}
      >
        <RotateCcw size={10} aria-hidden />
        RST PITCH
      </button>
    </div>
  );
}

export function BeatLabGridZoomToggle({
  mode,
  onMin,
  onMax,
  loopBars,
}: {
  mode: BeatLabGridZoomMode;
  onMin: () => void;
  onMax: () => void;
  loopBars: number;
}) {
  return (
    <div style={groupStyle}>
      <span style={{ fontSize: 8, fontWeight: 800, color: '#5c5c68', letterSpacing: 0.6 }}>ZOOM</span>
      <button
        type="button"
        onClick={onMin}
        title="Minimize grid — default column width with horizontal scroll"
        style={chipStyle(mode === 'min')}
      >
        <Minimize2 size={10} aria-hidden />
        MIN
      </button>
      <button
        type="button"
        onClick={onMax}
        title={`Maximize grid — fit all ${loopBars} bar${loopBars !== 1 ? 's' : ''} in view`}
        style={chipStyle(mode === 'max')}
      >
        <Maximize2 size={10} aria-hidden />
        MAX
      </button>
    </div>
  );
}

export function BeatLabEditToolToggle({
  mode,
  onModeChange,
  onPointer,
  onDraw,
  timeStretch,
  onTimeStretchChange,
  snapHint,
  embedded,
  compact,
}: {
  mode: BeatLabEditTool;
  /** Preferred — single handler for tool chips. */
  onModeChange?: (mode: BeatLabEditTool) => void;
  /** Legacy top-toolbar callbacks (pointer / draw only). */
  onPointer?: () => void;
  onDraw?: () => void;
  timeStretch?: boolean;
  onTimeStretchChange?: (on: boolean) => void;
  snapHint?: string;
  embedded?: boolean;
  /** Top transport row — PTR + DRAW only. */
  compact?: boolean;
}) {
  const pickMode = (id: BeatLabEditTool) => {
    if (onModeChange) {
      onModeChange(id);
      return;
    }
    if (id === 'pointer') onPointer?.();
    else if (id === 'draw') onDraw?.();
  };

  const tools = compact
    ? VIEW_TOOLS.filter((t) => COMPACT_TOOL_IDS.includes(t.id))
    : VIEW_TOOLS;

  return (
    <div
      style={embedded ? { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' } : groupStyle}
      title={snapHint ? `Edit tool — one column = ${snapHint} step` : undefined}
    >
      <span style={{ fontSize: 8, fontWeight: 800, color: '#5c5c68', letterSpacing: 0.6 }}>TOOL</span>
      {tools.map(({ id, label, Icon, title }) => (
        <button
          key={id}
          type="button"
          aria-pressed={mode === id}
          onClick={() => pickMode(id)}
          title={title}
          style={chipStyle(mode === id)}
        >
          <Icon size={10} aria-hidden />
          {label}
        </button>
      ))}
      {!compact && onTimeStretchChange ? (
        <button
          type="button"
          aria-pressed={timeStretch === true}
          onClick={() => onTimeStretchChange(!timeStretch)}
          title={
            timeStretch
              ? 'Time-stretch on — session BPM changes speed, not pitch (pad samples with SRC BPM)'
              : 'Time-stretch off — tape mode: BPM sync shifts pitch + speed'
          }
          style={chipStyle(timeStretch === true)}
        >
          <StretchHorizontal size={10} aria-hidden />
          STRETCH
        </button>
      ) : null}
    </div>
  );
}
