#!/usr/bin/env python3
"""
Platinum Urban drum MIDI byte generator — reference for Trap, R&B, Pop formulas.

Outputs note-on tuples: (tick, note, velocity) at PPQ=480, 16 steps/bar.
Row → GM drum map (Beat Lab pattern row order):
  0=Kick(36) 1=Snare(38) 2=Clap(39) 3=Closed HH(42) 4=Open HH(46)
  5=Tom(45) 6=808/Sub(35) 7=Rim(37)
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Iterable, List, Sequence, Tuple

PPQ = 480
STEPS = 16
TICKS_PER_STEP = PPQ // 4  # 16th notes in 4/4

VEL_DOWNBEAT = (0x6F, 0x7F)
VEL_HAT = (0x46, 0x5A)
VEL_STUTTER = (0x32, 0x46)

ROW_NOTE = {0: 36, 1: 38, 2: 39, 3: 42, 4: 46, 5: 45, 6: 35, 7: 37}

NoteEvent = Tuple[int, int, int]  # tick, note, velocity


def step_tick(step: int) -> int:
    return step * TICKS_PER_STEP


def vel_tier(tier: str, roll_idx: int = 0, roll_len: int = 1) -> int:
    if tier == "downbeat":
        lo, hi = VEL_DOWNBEAT
    elif tier == "stutter":
        lo, hi = VEL_STUTTER
        if roll_len > 1:
            t = roll_idx / max(1, roll_len - 1)
            return int(hi - t * (hi - lo))
    else:
        lo, hi = VEL_HAT
    return (lo + hi) // 2


def emit(row: int, step: int, tier: str = "hat", roll_idx: int = 0, roll_len: int = 1) -> NoteEvent:
    note = ROW_NOTE[row]
    tick = step_tick(step)
    if row in (0, 1, 2) and step in (0, 4, 8, 12):
        tier = "downbeat"
    return (tick, note, vel_tier(tier, roll_idx, roll_len))


def halftime_snare() -> List[NoteEvent]:
    return [emit(1, 8, "downbeat"), emit(2, 8, "downbeat")]


def trap_kick_metro() -> Sequence[int]:
    return (0, 5, 9, 14)


def trap_kick_south() -> Sequence[int]:
    return (0, 3, 7, 11, 15)


def body808_offbeat(kick_steps: Sequence[int]) -> List[NoteEvent]:
    kick = set(kick_steps)
    events = [emit(6, 0, "downbeat")]
    for s in (2, 6, 10, 14):
        if s not in kick:
            events.append(emit(6, s, "downbeat"))
    return events


def hat_stutter_engine(seed: int, base: Sequence[int] | None = None, ratio: float = 0.2) -> List[NoteEvent]:
    rng = random.Random(seed)
    active = list(base or range(STEPS))
    pick_n = max(1, round(len(active) * ratio))
    roots = rng.sample(active, pick_n)
    hit_set = set(active)
    for root in roots:
        if root == 8:
            continue
        if rng.random() < 0.55:
            if root + 1 < STEPS:
                hit_set.add(root + 1)
        else:
            if root + 1 < STEPS:
                hit_set.add(root + 1)
            if root + 2 < STEPS:
                hit_set.add(root + 2)
    events: List[NoteEvent] = []
    for s in sorted(hit_set):
        events.append(emit(3, s, "hat"))
    # velocity ramp on consecutive hat clusters
    cluster: List[int] = []
    for i, s in enumerate(sorted(hit_set)):
        if cluster and s == cluster[-1] + 1:
            cluster.append(s)
        else:
            if len(cluster) > 1:
                for j, cs in enumerate(cluster):
                    events = [e for e in events if not (e[0] == step_tick(cs) and e[1] == 42)]
                    events.append(emit(3, cs, "stutter", j, len(cluster)))
            cluster = [s]
    if len(cluster) > 1:
        for j, cs in enumerate(cluster):
            events = [e for e in events if not (e[0] == step_tick(cs) and e[1] == 42)]
            events.append(emit(3, cs, "stutter", j, len(cluster)))
    return sorted(events, key=lambda e: e[0])


def trap_halftime_bar(seed: int, kick: str = "metro") -> List[NoteEvent]:
    kicks = trap_kick_metro() if kick == "metro" else trap_kick_south()
    events: List[NoteEvent] = []
    for s in kicks:
        events.append(emit(0, s, "downbeat"))
    events.extend(halftime_snare())
    events.extend(hat_stutter_engine(seed))
    events.extend(body808_offbeat(kicks))
    return sorted(events, key=lambda e: e[0])


def rnb_trapsoul_bar(sparse: bool = False) -> List[NoteEvent]:
    kicks = (10, 14) if sparse else (0, 7, 11, 14)
    events: List[NoteEvent] = []
    for s in kicks:
        events.append(emit(0, s, "downbeat"))
    events.append(emit(1, 8, "downbeat"))
    events.append(emit(7, 13, "hat"))
    events.append(emit(2, 8, "downbeat"))
    for s in (0, 1, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15):
        events.append(emit(3, s, "hat"))
    events.append(emit(4, 2, "hat"))
    events.append(emit(4, 10, "hat"))
    events.append(emit(6, 0, "downbeat"))
    events.append(emit(6, 10, "downbeat"))
    return sorted(events, key=lambda e: e[0])


def pop_kick_bar_a() -> List[NoteEvent]:
    return [emit(0, 0, "downbeat"), emit(0, 6, "downbeat")]


def pop_kick_bar_b() -> List[NoteEvent]:
    return [emit(0, 0, "downbeat"), emit(0, 8, "downbeat"), emit(0, 14, "downbeat")]


def pop_perc_push() -> List[NoteEvent]:
    return [emit(7, s, "hat") for s in (0, 3, 6, 9, 12, 15)]


def pop_bar(kind: str) -> List[NoteEvent]:
    events = pop_kick_bar_a() if kind == "A" else pop_kick_bar_b()
    events += [emit(1, 4, "downbeat"), emit(1, 12, "downbeat")]
    events += [emit(2, 4, "downbeat"), emit(2, 12, "downbeat")]
    events += [emit(3, s, "hat") for s in (0, 2, 4, 6, 8, 10, 12, 14)]
    events.extend(pop_perc_push())
    return sorted(events, key=lambda e: e[0])


if __name__ == "__main__":
    demos = {
        "trap_halftime": trap_halftime_bar(42),
        "rnb_trapsoul": rnb_trapsoul_bar(),
        "pop_a": pop_bar("A"),
        "pop_b": pop_bar("B"),
    }
    for name, evts in demos.items():
        print(f"=== {name} ===")
        for tick, note, vel in evts[:12]:
            print(f"  tick={tick:4d} note={note:2d} vel={vel:3d}")
        print(f"  ... ({len(evts)} events total)")
