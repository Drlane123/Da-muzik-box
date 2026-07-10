"""
Map token streams → sequential MIDI events using mido.

Produces NoteOn/NoteOff messages with delta times in ticks, plus a flat
`MidiEvent` list with absolute seconds for conditioning extraction.
"""
from __future__ import annotations

import math
from typing import Iterable

import mido

from ai_song_pipeline.schemas import MidiEvent, TokenStream

TICKS_PER_BEAT = 480


def _step_to_tick(step: int, steps_per_bar: int) -> int:
    """16th-note step index → MIDI tick (quarter = 480)."""
    steps_per_quarter = max(1, steps_per_bar // 4)
    return int(step * (TICKS_PER_BEAT / steps_per_quarter))


def token_stream_to_midi_events(stream: TokenStream) -> list[MidiEvent]:
    """Convert flat tokens to timed note events in seconds."""
    spq = stream.steps_per_bar / 4.0
    sec_per_step = (60.0 / stream.bpm) / spq
    step_duration = sec_per_step * 0.9  # slightly staccato

    events: list[MidiEvent] = []
    for pitch, vel, step in zip(stream.pitches, stream.velocities, stream.step_indices):
        start = step * sec_per_step
        events.append(
            MidiEvent(
                pitch=int(pitch),
                velocity=max(1, min(127, int(vel))),
                start_sec=start,
                duration_sec=step_duration,
                is_drum=stream.is_drum,
            )
        )
    events.sort(key=lambda e: (e.start_sec, e.pitch))
    return events


def midi_events_to_mido_track(events: Iterable[MidiEvent], bpm: float) -> mido.MidiTrack:
    """Build a mido track with delta-time NoteOn/NoteOff pairs."""
    track = mido.MidiTrack()
    track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm), time=0))

    scheduled: list[tuple[int, mido.Message]] = []
    for ev in events:
        beats = ev.start_sec * (bpm / 60.0)
        start_tick = int(beats * TICKS_PER_BEAT)
        dur_beats = ev.duration_sec * (bpm / 60.0)
        dur_ticks = max(1, int(dur_beats * TICKS_PER_BEAT))
        ch = 9 if ev.is_drum else 0
        scheduled.append(
            (start_tick, mido.Message("note_on", note=ev.pitch, velocity=ev.velocity, channel=ch))
        )
        scheduled.append(
            (start_tick + dur_ticks, mido.Message("note_off", note=ev.pitch, velocity=0, channel=ch))
        )

    scheduled.sort(key=lambda x: x[0])
    last = 0
    for abs_tick, msg in scheduled:
        delta = max(0, abs_tick - last)
        msg = msg.copy(time=delta)
        track.append(msg)
        last = abs_tick
    return track


def build_midi_file(events: list[MidiEvent], bpm: float, track_name: str = "Committee") -> mido.MidiFile:
    mid = mido.MidiFile(ticks_per_beat=TICKS_PER_BEAT)
    track = midi_events_to_mido_track(events, bpm)
    track.insert(0, mido.MetaMessage("track_name", name=track_name, time=0))
    mid.tracks.append(track)
    return mid


def midi_note_to_hz(pitch: int) -> float:
    return 440.0 * (2.0 ** ((pitch - 69) / 12.0))


def hz_to_midi_note(hz: float) -> float:
    if hz <= 0:
        return 0.0
    return 69.0 + 12.0 * math.log2(hz / 440.0)
