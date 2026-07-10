"""Turn a short loop into a longer arrangement + optional bass/melody layer."""
from __future__ import annotations

from ai_song_pipeline.config import MELODY_BASE_MIDI, MELODY_ROW_SEMITONES
from ai_song_pipeline.schemas import CommitteePatternPayload, MidiEvent

# Root MIDI per genre (bass register) — simple static harmony bed under the loop.
_GENRE_ROOT: dict[str, int] = {
    "hip-hop": 36,
    "trap": 36,
    "r&b": 33,
    "pop": 40,
    "lo-fi": 36,
    "electronic": 38,
    "jazz": 35,
    "rock": 38,
    "soul": 33,
    "afrobeats": 36,
}

_MOOD_INTERVAL: dict[str, int] = {
    "chill": 0,
    "hype": 7,
    "dark": 3,
    "romantic": 5,
    "uplifting": 7,
    "melancholic": 3,
    "aggressive": 0,
    "dreamy": 5,
}


def loop_duration_sec(loop_bars: int, bpm: float) -> float:
    return loop_bars * 4.0 * (60.0 / bpm)


def tile_events(
    events: list[MidiEvent],
    *,
    loop_bars: int,
    output_bars: int,
    bpm: float,
) -> list[MidiEvent]:
    """Repeat a pattern loop until `output_bars` is filled."""
    if output_bars <= loop_bars or not events:
        return list(events)
    loop_sec = loop_duration_sec(loop_bars, bpm)
    repeats = max(1, output_bars // loop_bars)
    out: list[MidiEvent] = []
    for rep in range(repeats):
        offset = rep * loop_sec
        for ev in events:
            out.append(
                MidiEvent(
                    pitch=ev.pitch,
                    velocity=ev.velocity,
                    start_sec=ev.start_sec + offset,
                    duration_sec=ev.duration_sec,
                    is_drum=ev.is_drum,
                )
            )
    out.sort(key=lambda e: (e.start_sec, e.pitch))
    return out


def bass_melody_events(
    payload: CommitteePatternPayload,
    *,
    output_bars: int,
) -> list[MidiEvent]:
    """
    Simple bass + hook line from genre/mood — pitched synth layer (not drums).
    Root on bar downbeats; fifth or mood interval on bar 2 and 4 of each 4-bar block.
    """
    genre = (getattr(payload, "genre", None) or "hip-hop").lower().strip()
    mood = (getattr(payload, "mood", None) or "chill").lower().strip()
    root = _GENRE_ROOT.get(genre, 36) + payload.key_root
    fifth = root + _MOOD_INTERVAL.get(mood, 7)
    hook = root + (MELODY_ROW_SEMITONES[4] if len(MELODY_ROW_SEMITONES) > 4 else 7)

    bpm = payload.bpm
    sec_per_bar = 4.0 * (60.0 / bpm)
    note_dur = sec_per_bar * 0.92
    events: list[MidiEvent] = []

    # 4-bar bass phrase; alternate A/B every 8 bars so long renders aren't identical loops.
    phrase_a = [(0, root), (1, fifth), (2, root), (3, hook)]
    phrase_b = [(0, root), (1, hook), (2, fifth), (3, root + 2)]
    for bar in range(output_bars):
        t_bar = bar * sec_per_bar
        phrase = phrase_a if (bar // 8) % 2 == 0 else phrase_b
        _, pitch = phrase[bar % 4]
        events.append(
            MidiEvent(
                pitch=pitch,
                velocity=82,
                start_sec=t_bar,
                duration_sec=note_dur,
                is_drum=False,
            )
        )
    return events


def pad_chord_pitches(payload: CommitteePatternPayload) -> list[int]:
    """Quiet background pad (root + third + fifth) per 4-bar block."""
    genre = (getattr(payload, "genre", None) or "hip-hop").lower().strip()
    root = _GENRE_ROOT.get(genre, 36) + payload.key_root + 12
    return [root, root + 4, root + 7]


def section_fill_events(
    drum_events: list[MidiEvent],
    *,
    output_bars: int,
    bpm: float,
    loop_bars: int,
) -> list[MidiEvent]:
    """Extra snare + open hat on every 8th bar so tiled loops feel like sections."""
    if output_bars < 8:
        return []
    sec_per_bar = 4.0 * (60.0 / bpm)
    fills: list[MidiEvent] = []
    snare_pitch = 38
    hat_pitch = 46
    for bar in range(7, output_bars, 8):
        t = bar * sec_per_bar + sec_per_bar * 0.75
        fills.append(MidiEvent(pitch=snare_pitch, velocity=105, start_sec=t, duration_sec=0.08, is_drum=True))
        fills.append(MidiEvent(pitch=snare_pitch, velocity=98, start_sec=t + 0.06, duration_sec=0.06, is_drum=True))
        fills.append(MidiEvent(pitch=hat_pitch, velocity=88, start_sec=t + 0.12, duration_sec=0.14, is_drum=True))
    return fills


def merge_midi_events(*groups: list[MidiEvent]) -> list[MidiEvent]:
    merged: list[MidiEvent] = []
    for g in groups:
        merged.extend(g)
    merged.sort(key=lambda e: (e.start_sec, e.pitch))
    return merged
