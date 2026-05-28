import {
  beatLabMelodicChannelForLane,
  beatLabSynth2ChannelOptions,
  beatLabSynth2NormalizePair,
} from '@/app/lib/creationStation/beatLabSynthV2LaneRoles';
import {
  BEAT_LAB_SYNTH2_PIANO_ROLL_BANK,
  beatLabSynth2PianoInstrumentLabel,
  normalizeBeatLabSynth2PianoInstrument,
} from '@/app/lib/creationStation/beatLabSynthV2PianoBank';

type Props = {
  bassLane: number;
  harmonyLane: number;
  pianoInstrumentId: string;
  onBassLaneChange: (lane: number) => void;
  onHarmonyLaneChange: (lane: number) => void;
  onPianoInstrumentChange: (instrumentId: string) => void;
  disabled?: boolean;
};

const btnStyle: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  padding: '3px 6px',
  borderRadius: 4,
  border: '1px solid #3a4860',
  background: '#121820',
  color: '#d8e4f8',
  cursor: 'pointer',
};

export function BeatLabSynthV2ChannelAssign({
  bassLane,
  harmonyLane,
  pianoInstrumentId,
  onBassLaneChange,
  onHarmonyLaneChange,
  onPianoInstrumentChange,
  disabled = false,
}: Props) {
  const chOpts = beatLabSynth2ChannelOptions();
  const pianoId = normalizeBeatLabSynth2PianoInstrument(pianoInstrumentId);

  const setBassCh = (ch: number) => {
    const lane = ch - 1;
    const next = beatLabSynth2NormalizePair(lane, harmonyLane);
    onBassLaneChange(next.bassLane);
    if (next.harmonyLane !== harmonyLane) onHarmonyLaneChange(next.harmonyLane);
  };

  const setHarmonyCh = (ch: number) => {
    const lane = ch - 1;
    const next = beatLabSynth2NormalizePair(bassLane, lane);
    onHarmonyLaneChange(next.harmonyLane);
    if (next.bassLane !== bassLane) onBassLaneChange(next.bassLane);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 8, fontWeight: 900, color: '#7cf4c6', letterSpacing: 0.4 }}>
        NEW SYNTH CH
      </span>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#9aa6bc' }}>
        Bass
        <select
          disabled={disabled}
          value={beatLabMelodicChannelForLane(bassLane)}
          onChange={(e) => setBassCh(Number(e.target.value))}
          title="Mixer channel for bassline + GENERATOR (bass presets)"
          style={{ ...btnStyle, cursor: disabled ? 'default' : 'pointer' }}
        >
          {chOpts.map(({ ch }) => (
            <option key={`b-${ch}`} value={ch}>
              CH {ch}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#9aa6bc' }}>
        Piano roll
        <select
          disabled={disabled}
          value={beatLabMelodicChannelForLane(harmonyLane)}
          onChange={(e) => setHarmonyCh(Number(e.target.value))}
          title="Mixer channel for chords / Groove Lab piano roll"
          style={{ ...btnStyle, cursor: disabled ? 'default' : 'pointer' }}
        >
          {chOpts.map(({ ch }) => (
            <option key={`h-${ch}`} value={ch} disabled={ch === beatLabMelodicChannelForLane(bassLane)}>
              CH {ch}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#93c5fd' }}>
        Piano bank
        <select
          disabled={disabled}
          value={pianoId}
          onChange={(e) => onPianoInstrumentChange(e.target.value)}
          title="Sound for piano-roll channel only (keys, organ, strings…)"
          style={{
            ...btnStyle,
            minWidth: 120,
            borderColor: 'rgba(147,197,253,0.45)',
            color: '#bfdbfe',
          }}
        >
          {BEAT_LAB_SYNTH2_PIANO_ROLL_BANK.map((o) => (
            <option key={o.id} value={o.id}>
              {o.group} · {o.label}
            </option>
          ))}
        </select>
      </label>
      <span style={{ fontSize: 7, color: '#6a7d92', fontWeight: 600 }}>
        {beatLabSynth2PianoInstrumentLabel(pianoId)} on CH {beatLabMelodicChannelForLane(harmonyLane)}
      </span>
    </div>
  );
}
