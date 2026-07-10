#!/usr/bin/env python3
"""
R&B Groove Lead — chord-locked melody generator + legato MIDI byte stream.

The lead is 100% derived from active chord MIDI arrays. No random pitch selection.
Pitch pool per chord: chord tones (+12/+24), root+14 (9th), root+17 (11th) only.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Sequence, Tuple

MIDI_PPQ = 480
LEGATO_ON_RATIO = 0.9
OVERLAP_TICKS = 15
POCKET_TICKS = 18
BREATH_AFTER = 5
LEAD_LO = 60
LEAD_HI = 96
VEL_SCALE = 1.1


@dataclass(frozen=True)
class ChordEvent:
    """One chord region in the progression."""
    start_beat: float
    duration_beats: float
    midi_notes: Tuple[int, ...]
    midi_velocities: Tuple[int, ...] | None = None


@dataclass
class Note:
    pitch: int
    start_beat: float
    duration_beats: float
    velocity: int = 95
    passing: bool = False


@dataclass
class MidiPacket:
    delta_ticks: int
    status: int
    data1: int
    data2: int


def _clamp_midi(pitch: int) -> int:
    return max(0, min(127, int(pitch)))


def _fit_register(pitch: int, lo: int = LEAD_LO, hi: int = LEAD_HI) -> int | None:
    p = pitch
    while p < lo:
        p += 12
    while p > hi:
        p -= 12
    return p if lo <= p <= hi else None


def chord_root(active_chord: Sequence[int]) -> int:
    return min(active_chord)


def allowed_lead_pitches(active_chord: Sequence[int], lo: int = LEAD_LO, hi: int = LEAD_HI) -> List[int]:
    """
    Strict pitch pool:
      - chord tones (+0, +12, +24)
      - root + 14 (9th), root + 17 (11th) with +12 octave shift
    """
    if not active_chord:
        return []
    root = chord_root(active_chord)
    pool: set[int] = set()
    for n in active_chord:
        for shift in (0, 12, 24):
            fitted = _fit_register(n + shift, lo, hi)
            if fitted is not None:
                pool.add(fitted)
    for ext in (14, 17):
        for shift in (0, 12):
            fitted = _fit_register(root + ext + shift, lo, hi)
            if fitted is not None:
                pool.add(fitted)
    return sorted(pool)


def chord_tones_in_register(active_chord: Sequence[int], lo: int = LEAD_LO, hi: int = LEAD_HI) -> List[int]:
    """Raw chord array tones shifted into the lead register (downbeat candidates)."""
    pool: set[int] = set()
    for n in active_chord:
        for shift in (0, 12, 24, -12):
            fitted = _fit_register(n + shift, lo, hi)
            if fitted is not None:
                pool.add(fitted)
    return sorted(pool)


def downbeat_anchor_pitch(active_chord: Sequence[int], lo: int = LEAD_LO, hi: int = LEAD_HI) -> int:
    """
    First chord downbeat: 3rd index (character tone) or highest chord tone + 12.
    """
    if len(active_chord) > 3:
        anchor = _fit_register(active_chord[3], lo, hi)
        if anchor is not None:
            return anchor
    anchor = _fit_register(max(active_chord) + 12, lo, hi)
    if anchor is not None:
        return anchor
    tones = chord_tones_in_register(active_chord, lo, hi)
    if tones:
        return tones[-1]
    allowed = allowed_lead_pitches(active_chord, lo, hi)
    return allowed[0] if allowed else lo


def closest_voice_lead(last_note: int, candidates: Sequence[int]) -> int:
    if not candidates:
        return last_note
    best = candidates[0]
    best_dist = abs(best - last_note)
    for n in candidates[1:]:
        dist = abs(n - last_note)
        if dist < best_dist or (dist == best_dist and n < best):
            best = n
            best_dist = dist
    return best


def chord_avg_velocity(event: ChordEvent, default: int = 90) -> int:
    if event.midi_velocities and len(event.midi_velocities) == len(event.midi_notes):
        avg = sum(event.midi_velocities) / len(event.midi_velocities)
    else:
        avg = float(default)
    return _clamp_midi(int(round(min(127, avg * VEL_SCALE))))


def _phrase_note_count(duration_beats: float) -> int:
    if duration_beats >= 3.5:
        return 3
    if duration_beats >= 2.0:
        return 2
    return 1


def _phrase_offsets(duration_beats: float, count: int) -> List[float]:
    if count <= 1:
        return [0.0]
    usable = max(0.5, duration_beats * 0.92)
    step = usable / count
    return [i * step for i in range(count)]


def _next_melody_pitch(
    last_pitch: int,
    pool: Sequence[int],
    step_index: int,
) -> int:
    """Deterministic pool walk — smallest voice-leading distance, tie-break upward."""
    if not pool:
        return last_pitch
    others = [p for p in pool if p != last_pitch]
    if not others:
        return last_pitch
    if step_index == 0:
        return closest_voice_lead(last_pitch, others)
    ranked = sorted(others, key=lambda p: (abs(p - last_pitch), p))
    idx = step_index % len(ranked)
    return ranked[idx]


def generate_lead_from_chords(
    chord_events: Sequence[ChordEvent],
    lo: int = LEAD_LO,
    hi: int = LEAD_HI,
) -> List[Note]:
    """
    Build a groove-lead melody strictly from chord MIDI arrays.
    No random pitches — only chord tones, octave shifts, 9th/11th, and voice leading.
    """
    if not chord_events:
        return []

    out: List[Note] = []
    last_pitch: int | None = None

    for ci, event in enumerate(chord_events):
        chord = event.midi_notes
        if not chord:
            continue

        pool = allowed_lead_pitches(chord, lo, hi)
        if not pool:
            continue

        chord_tones = chord_tones_in_register(chord, lo, hi)
        vel = chord_avg_velocity(event)
        count = _phrase_note_count(event.duration_beats)
        offsets = _phrase_offsets(event.duration_beats, count)

        for ni, offset in enumerate(offsets):
            start = event.start_beat + offset
            if ni == 0:
                if last_pitch is None:
                    pitch = downbeat_anchor_pitch(chord, lo, hi)
                else:
                    pitch = closest_voice_lead(last_pitch, chord_tones or pool)
                if pitch not in pool and pitch not in chord_tones:
                    pitch = closest_voice_lead(last_pitch, pool)
            else:
                pitch = _next_melody_pitch(last_pitch or pool[0], pool, ni)

            if ni > 0 and last_pitch is not None and pitch == last_pitch:
                alts = [p for p in pool if p != last_pitch]
                if alts:
                    pitch = closest_voice_lead(last_pitch, alts)

            next_start = (
                event.start_beat + offsets[ni + 1]
                if ni + 1 < len(offsets)
                else event.start_beat + event.duration_beats
            )
            span = max(0.35, next_start - start)
            bleed = 0.08 if ni + 1 < len(offsets) else 0.18
            duration = span + bleed if ni + 1 < len(offsets) else max(1.2, span + bleed)

            out.append(
                Note(
                    pitch=_clamp_midi(pitch),
                    start_beat=start,
                    duration_beats=duration,
                    velocity=vel,
                    passing=False,
                )
            )
            last_pitch = pitch

    return out


def beat_to_tick(beat: float, tpq: int = MIDI_PPQ) -> int:
    return max(0, int(round(beat * tpq)))


def build_absolute_events(
    notes: Sequence[Note],
    tpq: int = MIDI_PPQ,
    channel: int = 0,
    beats_per_bar: float = 4.0,
    chord_change_beats: Iterable[float] | None = None,
) -> List[Tuple[int, int, Tuple[int, int, int]]]:
    """
    Legato byte order: Note2 On before Note1 Off (monophonic glide).
  """
    ch = channel & 0x0F
    chord_set = {round(b * 1000) for b in (chord_change_beats or [])}
    breath_gap = int(tpq * beats_per_bar * 0.75)
    sorted_notes = sorted(notes, key=lambda n: (n.start_beat, n.pitch))

    events: List[Tuple[int, int, Tuple[int, int, int]]] = []
    note_on_streak = 0
    time_shift = 0
    order = 0

    i = 0
    while i < len(sorted_notes):
        if note_on_streak >= BREATH_AFTER:
            time_shift += breath_gap
            note_on_streak = 0

        cur = sorted_notes[i]
        nxt = sorted_notes[i + 1] if i + 1 < len(sorted_notes) else None
        pitch = _clamp_midi(cur.pitch)
        vel = _clamp_midi(cur.velocity)

        start_tick = beat_to_tick(cur.start_beat, tpq) + time_shift
        if round(cur.start_beat * 1000) in chord_set or (i == 0 and not chord_set):
            start_tick += POCKET_TICKS

        if nxt is not None:
            dur_ticks = max(1, beat_to_tick(cur.duration_beats, tpq))
            note2_on = start_tick + int(dur_ticks * LEGATO_ON_RATIO)
            note1_off = note2_on + OVERLAP_TICKS
            n2pitch = _clamp_midi(nxt.pitch)
            n2vel = _clamp_midi(nxt.velocity)

            events.append((start_tick, order, (0x90 | ch, pitch, vel)))
            order += 1
            note_on_streak += 1
            events.append((note2_on, order, (0x90 | ch, n2pitch, n2vel)))
            order += 1
            note_on_streak += 1
            events.append((note1_off, -order, (0x80 | ch, pitch, 0)))
            last_dur = max(1, beat_to_tick(nxt.duration_beats, tpq))
            events.append((note2_on + last_dur, -order - 1, (0x80 | ch, n2pitch, 0)))
            i += 2
        else:
            dur_ticks = max(1, beat_to_tick(cur.duration_beats, tpq))
            events.append((start_tick, order, (0x90 | ch, pitch, vel)))
            order += 1
            note_on_streak += 1
            events.append((start_tick + dur_ticks, -order, (0x80 | ch, pitch, 0)))
            i += 1

    events.sort(key=lambda e: (e[0], e[1]))
    return events


def to_delta_packets(events: Sequence[Tuple[int, int, Tuple[int, int, int]]]) -> List[MidiPacket]:
    out: List[MidiPacket] = []
    last = 0
    for tick, _order, (st, d1, d2) in events:
        out.append(MidiPacket(delta_ticks=max(0, tick - last), status=st, data1=d1, data2=d2))
        last = tick
    return out


def generate_groove_lead_midi(
    notes: Sequence[Note],
    **kwargs,
) -> List[MidiPacket]:
    return to_delta_packets(build_absolute_events(notes, **kwargs))


def generate_chord_locked_lead_midi(
    chord_events: Sequence[ChordEvent],
    **kwargs,
) -> Tuple[List[Note], List[MidiPacket]]:
    """Full pipeline: chord progression → locked melody → legato MIDI packets."""
    notes = generate_lead_from_chords(chord_events)
    change_beats = [e.start_beat for e in chord_events]
    packets = generate_groove_lead_midi(notes, chord_change_beats=change_beats, **kwargs)
    return notes, packets


if __name__ == "__main__":
    progression = [
        ChordEvent(0.0, 4.0, (60, 63, 67, 70), (90, 86, 88, 82)),
        ChordEvent(4.0, 4.0, (65, 68, 72, 75), (92, 87, 90, 85)),
        ChordEvent(8.0, 4.0, (67, 70, 74, 77), (88, 84, 89, 83)),
    ]
    melody, packets = generate_chord_locked_lead_midi(progression)

    print("=== Chord-locked lead melody ===")
    for n in melody:
        print(f"  pitch={n.pitch:3d}  start={n.start_beat:.2f}  dur={n.duration_beats:.2f}  vel={n.velocity}")

    print("\n=== Legato MIDI stream ===")
    for p in packets:
        print(f"d{p.delta_ticks:4d}  [{p.status:02X} {p.data1:02X} {p.data2:02X}]")
