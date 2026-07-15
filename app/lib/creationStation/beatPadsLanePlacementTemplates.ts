/**
 * Beat Pads — per-lane 16th-note placement templates by drum role + genre.
 * One bar of steps tiled across the loop; replaces a single sequencer row only.
 */

import {
  trapHats16,
  trapHats8,
  trapHatsEightThenRoll,
  trapHatsRollEnd,
  trapHatsSteadyThenRoll,
  trapHatsTripletFill,
  trapHatsTwoStep,
  trapKickBarRush,
  trapKickLean,
  trapKickMetro,
  trapKickMinimal,
  trapKickSlide,
  trapKickSouth,
  trapKickSparse,
  trapKickSyncopated,
  trapOh24,
  trapOhGroove,
  trapSnare24,
  trapSnareBarPush,
  trapSnareHalfTime,
  trapSnarePocket,
  trapRimOff,
} from '@/app/lib/creationStation/beatLabTrapPatternGrid';
import {
  BEAT_PADS_STEPS_PER_BAR,
  beatPadsPatternCols,
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import { beatPadsLaneFromBooleanTemplate } from '@/app/lib/creationStation/beatPadsPatternEdit';
import { BEAT_PADS_EXTENDED_GENRE_TEMPLATES } from '@/app/lib/creationStation/beatPadsLanePlacementExtendedGenres';
import { BEAT_PADS_KICK_PACK_TEMPLATES } from '@/app/lib/creationStation/beatPadsLanePlacementKickPack';

export type BeatPadsDrumRole = 'kick' | 'snare' | 'clap' | 'hihat' | 'openHat' | 'rim';

export type BeatPadsPlacementGenre =
  | 'trap'
  | 'rnb'
  | 'pop'
  | 'house'
  | 'dance'
  | 'kpop'
  | 'soulBlues'
  | 'afro'
  | 'reggae';

export interface BeatPadsLanePlacementTemplate {
  id: string;
  name: string;
  role: BeatPadsDrumRole;
  genre: BeatPadsPlacementGenre;
  desc: string;
  /** Active 16th-note steps in one 4/4 bar (0–15). */
  steps: readonly number[];
}

export const BEAT_PADS_PLACEMENT_GENRES: readonly {
  id: BeatPadsPlacementGenre;
  label: string;
}[] = [
  { id: 'trap', label: 'Trap' },
  { id: 'rnb', label: 'R&B' },
  { id: 'pop', label: 'Pop' },
  { id: 'house', label: 'House' },
  { id: 'dance', label: 'Dance' },
  { id: 'kpop', label: 'K-Pop' },
  { id: 'soulBlues', label: 'Soul Blues' },
  { id: 'afro', label: 'Afro' },
  { id: 'reggae', label: 'Reggae' },
] as const;

export const BEAT_PADS_DRUM_ROLES: readonly {
  id: BeatPadsDrumRole;
  label: string;
}[] = [
  { id: 'kick', label: 'Kick' },
  { id: 'snare', label: 'Snare' },
  { id: 'clap', label: 'Clap' },
  { id: 'hihat', label: 'Hi-Hat' },
  { id: 'openHat', label: 'Open Hat' },
  { id: 'rim', label: 'Rim / Perc' },
] as const;

function rowSteps(hits: ReadonlyArray<[number, number]>, row: number): number[] {
  return hits
    .filter(([r]) => r === row)
    .map(([, s]) => s)
    .sort((a, b) => a - b);
}

function tpl(
  id: string,
  name: string,
  role: BeatPadsDrumRole,
  genre: BeatPadsPlacementGenre,
  desc: string,
  steps: readonly number[],
): BeatPadsLanePlacementTemplate {
  return { id, name, role, genre, desc, steps };
}

function bar(...steps: number[]): readonly number[] {
  return steps;
}

/** Hand-authored + trap grid helpers — ~12+ per role × genre where possible. */
const ALL_TEMPLATES: readonly BeatPadsLanePlacementTemplate[] = [
  // ── TRAP KICK ──
  tpl('trap-kick-sparse', 'Sparse Trunk', 'kick', 'trap', 'Beat 1 · sync into 3 · bar pickup', rowSteps(trapKickSparse(), 0)),
  tpl('trap-kick-sync', 'Sync Pocket', 'kick', 'trap', '1 · & of 2 · triplet lean into 3', rowSteps(trapKickSyncopated(), 0)),
  tpl('trap-kick-metro', 'Metro Bounce', 'kick', 'trap', '1 · &2 · 3 · &4 — NI pocket', rowSteps(trapKickMetro(), 0)),
  tpl('trap-kick-south', 'Dirty South', 'kick', 'trap', 'Behind-the-grid Southern sync', rowSteps(trapKickSouth(), 0)),
  tpl('trap-kick-lean', 'Lean Back', 'kick', 'trap', 'Late pocket — kicks sit behind grid', rowSteps(trapKickLean(), 0)),
  tpl('trap-kick-slide', 'Slide Phrase', 'kick', 'trap', 'Bar-end roll into next downbeat', rowSteps(trapKickSlide(), 0)),
  tpl('trap-kick-rush', 'Bar Rush', 'kick', 'trap', 'Doubles into the downbeat', rowSteps(trapKickBarRush(), 0)),
  tpl('trap-kick-minimal', 'Two-Hit', 'kick', 'trap', 'Beat 1 + beat 3 only', rowSteps(trapKickMinimal(), 0)),
  tpl('trap-kick-808-min', '808 Minimal', 'kick', 'trap', '1 · 3 · late &4', bar(0, 8, 14)),
  tpl('trap-kick-half', 'Half-Time Anchor', 'kick', 'trap', 'Downbeat + beat 3 trunk', bar(0, 8)),
  tpl('trap-kick-pickup', 'Pickup Only', 'kick', 'trap', 'Ghost before bar 1', bar(14, 15)),
  tpl('trap-kick-triple', 'Triplet Lean', 'kick', 'trap', '1 · 7 · 10 · 11', bar(0, 7, 10, 11)),

  // ── TRAP SNARE ──
  tpl('trap-snare-24', '2 & 4 Snap', 'snare', 'trap', 'Classic trap backbeat', rowSteps(trapSnare24(), 1)),
  tpl('trap-snare-half', 'Half-Time', 'snare', 'trap', 'Snare on beat 3 only', rowSteps(trapSnareHalfTime(), 1)),
  tpl('trap-snare-push', 'Bar Push', 'snare', 'trap', 'Ghost before downbeat', rowSteps(trapSnareBarPush(), 1)),
  tpl('trap-snare-pocket', 'Club Pocket', 'snare', 'trap', '2 & 4 + push + tail', rowSteps(trapSnarePocket(), 1)),
  tpl('trap-snare-clap-stack', 'Snare Stack', 'snare', 'trap', '2 & 4 locked', bar(4, 12)),
  tpl('trap-snare-late-2', 'Late 2', 'snare', 'trap', 'Snare sits behind beat 2', bar(5, 13)),
  tpl('trap-snare-ghost', 'Ghost &4', 'snare', 'trap', 'Backbeat + soft & of 4', bar(4, 12, 14)),
  tpl('trap-snare-fill', 'Fill Tail', 'snare', 'trap', '2 & 4 + steps 14–15', bar(4, 12, 14, 15)),
  tpl('trap-snare-minimal', 'Beat 3 Only', 'snare', 'trap', 'Half-time single hit', bar(8)),
  tpl('trap-snare-off', 'Offbeat 2', 'snare', 'trap', 'Snare on & of 2 and & of 4', bar(6, 14)),
  tpl('trap-snare-double', 'Double 4', 'snare', 'trap', 'Beat 4 double tap', bar(4, 12, 15)),
  tpl('trap-snare-sparse', 'Sparse One', 'snare', 'trap', 'Single snare beat 2', bar(4)),

  // ── TRAP HI-HAT ──
  tpl('trap-hat-twostep', 'Two-Step', 'hihat', 'trap', 'Trap foundation 8ths', rowSteps(trapHatsTwoStep(), 3)),
  tpl('trap-hat-8', '8th Pocket', 'hihat', 'trap', 'Skips snare-adjacent steps', rowSteps(trapHats8(), 3)),
  tpl('trap-hat-16', 'Full 16ths', 'hihat', 'trap', 'Machine roll — use velocity', rowSteps(trapHats16(), 3)),
  tpl('trap-hat-8-roll', '8th → Roll', 'hihat', 'trap', 'Steady then beat-4 burst', rowSteps(trapHatsEightThenRoll(), 3)),
  tpl('trap-hat-steady-roll', 'Steady → Roll', 'hihat', 'trap', '16ths through 3, roll on 4', rowSteps(trapHatsSteadyThenRoll(), 3)),
  tpl('trap-hat-roll-end', 'Roll End', 'hihat', 'trap', 'Beat 4 fill only', rowSteps(trapHatsRollEnd(), 3)),
  tpl('trap-hat-triplet', 'Triplet Fill', 'hihat', 'trap', 'Galloping bar-end push', rowSteps(trapHatsTripletFill(), 3)),
  tpl('trap-hat-off', 'Offbeat 8ths', 'hihat', 'trap', '& of each beat', bar(2, 6, 10, 14)),
  tpl('trap-hat-sparse', 'Sparse 4', 'hihat', 'trap', 'Quarter-note hats', bar(0, 4, 8, 12)),
  tpl('trap-hat-sync', 'Syncopated', 'hihat', 'trap', 'Skip downbeats', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('trap-hat-build', 'Build Up', 'hihat', 'trap', 'Accelerating second half', bar(0, 2, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15)),
  tpl('trap-hat-minimal', 'Minimal 2', 'hihat', 'trap', 'Two hat hits per bar', bar(2, 10)),

  // ── TRAP CLAP ──
  tpl('trap-clap-24', '2 & 4', 'clap', 'trap', 'Stack on snare beats', bar(4, 12)),
  tpl('trap-clap-late', 'Late Clap', 'clap', 'trap', 'Behind the 2 & 4', bar(5, 13)),
  tpl('trap-clap-echo', 'Echo', 'clap', 'trap', '2 & 4 + ghost after', bar(4, 5, 12, 13)),
  tpl('trap-clap-one', 'Beat 2 Only', 'clap', 'trap', 'Single clap accent', bar(4)),
  tpl('trap-clap-fill', 'Bar Fill', 'clap', 'trap', 'Claps into downbeat', bar(13, 14, 15)),
  tpl('trap-clap-off', 'Off Clap', 'clap', 'trap', '& of 2 and & of 4', bar(6, 14)),
  tpl('trap-clap-double', 'Double 4', 'clap', 'trap', 'Two hits on beat 4', bar(12, 14)),
  tpl('trap-clap-sparse', 'Sparse', 'clap', 'trap', 'Beat 4 only', bar(12)),
  tpl('trap-clap-push', 'Push Ghost', 'clap', 'trap', 'Ghost before bar line', bar(14)),
  tpl('trap-clap-half', 'Half-Time', 'clap', 'trap', 'Beat 3 clap', bar(8)),

  // ── TRAP OPEN HAT ──
  tpl('trap-oh-groove', 'OH Groove', 'openHat', 'trap', '& of every beat', rowSteps(trapOhGroove(), 4)),
  tpl('trap-oh-24', 'OH 2 & 4', 'openHat', 'trap', 'Light pocket breathing', rowSteps(trapOh24(), 4)),
  tpl('trap-oh-lift', 'Bar Lift', 'openHat', 'trap', 'Open on & of 4', bar(14)),
  tpl('trap-oh-sparse', 'Sparse OH', 'openHat', 'trap', 'One open per bar', bar(6)),
  tpl('trap-oh-fill', 'Fill OH', 'openHat', 'trap', 'Open into downbeat', bar(15)),
  tpl('trap-oh-sync', 'Sync OH', 'openHat', 'trap', 'Offbeat 2 and 4', bar(6, 14)),
  tpl('trap-oh-minimal', 'Minimal', 'openHat', 'trap', 'Beat 2 & only', bar(6)),
  tpl('trap-oh-double', 'Double Lift', 'openHat', 'trap', 'Two opens bar end', bar(13, 15)),

  // ── R&B KICK ──
  tpl('rnb-kick-night', 'Night Grind', 'kick', 'rnb', 'Slow pocket — 1 · &2 · 3 · &4', bar(0, 6, 10, 14)),
  tpl('rnb-kick-solid', 'Solid 1 & 3', 'kick', 'rnb', 'Dry trunk 1 and 3', bar(0, 8, 11)),
  tpl('rnb-kick-after', 'After Dark', 'kick', 'rnb', 'Behind-the-grid late pocket', bar(0, 7, 11, 14)),
  tpl('rnb-kick-velvet', 'Velvet Sub', 'kick', 'rnb', 'Soft 1 · late 3', bar(0, 10, 14)),
  tpl('rnb-kick-bloom', '808 Bloom', 'kick', 'rnb', 'Sparse with pickup', bar(0, 8, 14)),
  tpl('rnb-kick-slow', 'Slow Burn', 'kick', 'rnb', 'Minimal two-hit', bar(0, 8)),
  tpl('rnb-kick-shuffle', 'Shuffle', 'kick', 'rnb', 'Laid-back sync', bar(0, 5, 10)),
  tpl('rnb-kick-ghost', 'Ghost Pickup', 'kick', 'rnb', '1 + soft before 3', bar(0, 9, 10)),
  tpl('rnb-kick-brush', 'Velvet Brush', 'kick', 'rnb', 'Brush pocket 1 · &3', bar(0, 7, 8)),
  tpl('rnb-kick-heavy', 'Heavy Pulse', 'kick', 'rnb', 'Punchy 1 · 3 · late 4', bar(0, 8, 14)),
  tpl('rnb-kick-minimal', 'One Drop', 'kick', 'rnb', 'Downbeat only', bar(0)),
  tpl('rnb-kick-late', 'Late 3', 'kick', 'rnb', '1 and behind-the-3', bar(0, 11)),

  // ── R&B SNARE ──
  tpl('rnb-snare-24', '2 & 4 Dry', 'snare', 'rnb', 'Classic R&B backbeat', bar(4, 12)),
  tpl('rnb-snare-late', 'Late & Snare', 'snare', 'rnb', 'Snare on & of 1 and & of 3', bar(2, 10)),
  tpl('rnb-snare-soft', 'Soft 2 & 4', 'snare', 'rnb', 'Laid-back snare', bar(5, 13)),
  tpl('rnb-snare-ghost', 'Ghost Layer', 'snare', 'rnb', '2 & 4 + soft ghost', bar(4, 12, 14)),
  tpl('rnb-snare-brush', 'Brush Snare', 'snare', 'rnb', 'Behind beat 2', bar(5, 13)),
  tpl('rnb-snare-minimal', 'Beat 2', 'snare', 'rnb', 'Single snare accent', bar(4)),
  tpl('rnb-snare-half', 'Half Snare', 'snare', 'rnb', 'Beat 3 feel', bar(8)),
  tpl('rnb-snare-fill', 'Soft Fill', 'snare', 'rnb', '2 & 4 + bar tail', bar(4, 12, 15)),
  tpl('rnb-snare-off', 'Offbeat', 'snare', 'rnb', '& of 2 and & of 4', bar(6, 14)),
  tpl('rnb-snare-stack', 'Stack Hit', 'snare', 'rnb', 'Double on 4', bar(4, 12, 14)),
  tpl('rnb-snare-sparse', 'One Hit', 'snare', 'rnb', 'Beat 4 only', bar(12)),
  tpl('rnb-snare-push', 'Push', 'snare', 'rnb', 'Ghost before 1', bar(14, 15)),

  // ── R&B HI-HAT ──
  tpl('rnb-hat-8', 'Silk 8ths', 'hihat', 'rnb', 'Smooth eighth hats', bar(0, 2, 4, 6, 8, 10, 12, 14)),
  tpl('rnb-hat-shuffle', 'Shuffle', 'hihat', 'rnb', 'Swung 16th feel', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('rnb-hat-sparse', 'Sparse', 'hihat', 'rnb', 'Quarter hats', bar(0, 4, 8, 12)),
  tpl('rnb-hat-off', 'Offbeat', 'hihat', 'rnb', '& of each beat', bar(2, 6, 10, 14)),
  tpl('rnb-hat-brush', 'Brush', 'hihat', 'rnb', 'Light 8ths skip 2', bar(0, 2, 6, 8, 10, 14)),
  tpl('rnb-hat-minimal', 'Two Hits', 'hihat', 'rnb', 'Minimal movement', bar(2, 10)),
  tpl('rnb-hat-laid', 'Laid Back', 'hihat', 'rnb', 'Late grid hats', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('rnb-hat-build', 'Build', 'hihat', 'rnb', 'More density bar 4', bar(0, 2, 4, 6, 8, 10, 11, 12, 13, 14, 15)),
  tpl('rnb-hat-open-close', 'Open Close', 'hihat', 'rnb', 'Alternating feel', bar(0, 3, 4, 7, 8, 11, 12, 15)),
  tpl('rnb-hat-triplet', 'Triplet Feel', 'hihat', 'rnb', 'Triplet approximation', bar(0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14)),
  tpl('rnb-hat-16-soft', 'Soft 16ths', 'hihat', 'rnb', 'Full bar — mix low', bar(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)),
  tpl('rnb-hat-stop', 'Stop Time', 'hihat', 'rnb', 'Hats cut bar 4', bar(0, 2, 4, 6, 8, 10)),

  // ── POP KICK ──
  tpl('pop-kick-four', 'Four Floor Light', 'kick', 'pop', '1 · 2 · 3 · 4', bar(0, 4, 8, 12)),
  tpl('pop-kick-13', '1 & 3', 'kick', 'pop', 'Standard pop trunk', bar(0, 8)),
  tpl('pop-kick-sync', 'Sync Pop', 'kick', 'pop', '1 · &2 · 3', bar(0, 6, 10)),
  tpl('pop-kick-drive', 'Driving', 'kick', 'pop', 'Energetic 1 · 2& · 3', bar(0, 6, 8, 10)),
  tpl('pop-kick-minimal', 'Minimal', 'kick', 'pop', 'Downbeat anchor', bar(0)),
  tpl('pop-kick-pickup', 'Pickup', 'kick', 'pop', 'Fill into chorus', bar(12, 14, 15)),
  tpl('pop-kick-half', 'Half-Time', 'kick', 'pop', 'Beat 1 + 3 wide', bar(0, 8)),
  tpl('pop-kick-bounce', 'Bounce', 'kick', 'pop', 'Upbeat sync', bar(0, 3, 8, 11)),
  tpl('pop-kick-verse', 'Verse Sparse', 'kick', 'pop', 'Light verse pocket', bar(0, 10)),
  tpl('pop-kick-chorus', 'Chorus Push', 'kick', 'pop', 'Chorus energy', bar(0, 4, 8, 10, 14)),
  tpl('pop-kick-latin', 'Latin Pop', 'kick', 'pop', 'Syncopated pop-latin', bar(0, 3, 6, 10, 13)),
  tpl('pop-kick-ballad', 'Ballad', 'kick', 'pop', 'Slow 1 and 3', bar(0, 8, 12)),

  // ── POP SNARE ──
  tpl('pop-snare-24', '2 & 4', 'snare', 'pop', 'Pop backbeat', bar(4, 12)),
  tpl('pop-snare-clap', 'Snare + Clap', 'snare', 'pop', 'Stacked 2 & 4', bar(4, 12)),
  tpl('pop-snare-fill', 'Fill', 'snare', 'pop', 'Bar-end fill', bar(4, 12, 14, 15)),
  tpl('pop-snare-minimal', 'Beat 2', 'snare', 'pop', 'Single hit', bar(4)),
  tpl('pop-snare-lift', 'Lift', 'snare', 'pop', 'Pre-chorus push', bar(4, 12, 14)),
  tpl('pop-snare-ghost', 'Ghost', 'snare', 'pop', '2 & 4 + ghost', bar(4, 12, 15)),
  tpl('pop-snare-half', 'Half-Time', 'snare', 'pop', 'Beat 3 snare', bar(8)),
  tpl('pop-snare-off', 'Offbeat', 'snare', 'pop', '& of 2 and & of 4', bar(6, 14)),
  tpl('pop-snare-double', 'Double', 'snare', 'pop', 'Double on 4', bar(4, 12, 15)),
  tpl('pop-snare-sparse', 'Sparse', 'snare', 'pop', 'Beat 4 only', bar(12)),
  tpl('pop-snare-rim', 'Rim Layer', 'snare', 'pop', 'Snare + rim ghost', bar(4, 12, 7)),
  tpl('pop-snare-build', 'Build', 'snare', 'pop', 'Accelerating bar 4', bar(4, 12, 13, 14, 15)),

  // ── POP HI-HAT ──
  tpl('pop-hat-8', '8th Hats', 'hihat', 'pop', 'Straight eighths', bar(0, 2, 4, 6, 8, 10, 12, 14)),
  tpl('pop-hat-16', '16th Hats', 'hihat', 'pop', 'Driving sixteenths', bar(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)),
  tpl('pop-hat-off', 'Offbeat', 'hihat', 'pop', '& of each beat', bar(2, 6, 10, 14)),
  tpl('pop-hat-sparse', 'Sparse', 'hihat', 'pop', 'Quarter notes', bar(0, 4, 8, 12)),
  tpl('pop-hat-build', 'Build', 'hihat', 'pop', 'Chorus build', bar(0, 2, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15)),
  tpl('pop-hat-minimal', 'Minimal', 'hihat', 'pop', 'Two hits', bar(2, 10)),
  tpl('pop-hat-shuffle', 'Shuffle', 'hihat', 'pop', 'Swung feel', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('pop-hat-stop', 'Stop', 'hihat', 'pop', 'Cut on beat 4', bar(0, 2, 4, 6, 8, 10)),
  tpl('pop-hat-open', 'Open Accent', 'hihat', 'pop', 'Closed + open accent', bar(0, 2, 4, 6, 8, 10, 12, 14)),
  tpl('pop-hat-triplet', 'Triplet', 'hihat', 'pop', 'Triplet fill end', bar(9, 10, 11, 13, 14, 15)),
  tpl('pop-hat-verse', 'Verse Light', 'hihat', 'pop', 'Light verse', bar(0, 4, 8, 12)),
  tpl('pop-hat-chorus', 'Chorus Drive', 'hihat', 'pop', 'Full chorus energy', bar(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)),

  // ── HOUSE KICK ──
  tpl('house-kick-four', 'Four on Floor', 'kick', 'house', 'Classic house kick', bar(0, 4, 8, 12)),
  tpl('house-kick-punch', 'Punch', 'kick', 'house', 'Accent every beat', bar(0, 4, 8, 12)),
  tpl('house-kick-off', 'Offbeat', 'kick', 'house', 'Syncopated house', bar(0, 3, 6, 10, 12)),
  tpl('house-kick-minimal', 'Minimal', 'kick', 'house', '1 and 3', bar(0, 8)),
  tpl('house-kick-drive', 'Driving', 'kick', 'house', 'Tech-house drive', bar(0, 4, 8, 10, 12)),
  tpl('house-kick-pickup', 'Pickup', 'kick', 'house', 'Drop pickup', bar(14, 15)),
  tpl('house-kick-deep', 'Deep', 'kick', 'house', 'Deep house sparse', bar(0, 8, 12)),
  tpl('house-kick-garage', 'Garage', 'kick', 'house', 'UK garage skip', bar(0, 5, 8, 13)),
  tpl('house-kick-techno', 'Techno', 'kick', 'house', 'Hard four floor', bar(0, 4, 8, 12)),
  tpl('house-kick-future', 'Future', 'kick', 'house', 'Future house sync', bar(0, 6, 8, 14)),
  tpl('house-kick-break', 'Break', 'kick', 'house', 'Breakdown sparse', bar(0)),
  tpl('house-kick-build', 'Build', 'kick', 'house', 'Build to drop', bar(0, 4, 8, 10, 12, 14, 15)),

  // ── HOUSE SNARE / CLAP ──
  tpl('house-snare-24', '2 & 4 Clap', 'snare', 'house', 'House clap backbeat', bar(4, 12)),
  tpl('house-snare-off', 'Off Clap', 'snare', 'house', '& of 2 and & of 4', bar(6, 14)),
  tpl('house-snare-rim', 'Rim Shot', 'snare', 'house', 'Rim on 2 & 4', bar(4, 12)),
  tpl('house-snare-fill', 'Fill', 'snare', 'house', 'Bar-end fill', bar(4, 12, 14, 15)),
  tpl('house-snare-minimal', 'Beat 2', 'snare', 'house', 'Single clap', bar(4)),
  tpl('house-snare-lift', 'Lift', 'snare', 'house', 'Pre-drop', bar(4, 12, 15)),
  tpl('house-clap-24', 'Clap 2 & 4', 'clap', 'house', 'Classic house clap', bar(4, 12)),
  tpl('house-clap-off', 'Off Clap', 'clap', 'house', 'Offbeat clap', bar(6, 14)),
  tpl('house-clap-double', 'Double', 'clap', 'house', 'Double clap 4', bar(12, 14)),
  tpl('house-clap-fill', 'Fill Clap', 'clap', 'house', 'Fill into drop', bar(13, 14, 15)),

  // ── HOUSE HI-HAT ──
  tpl('house-hat-16', '16th Groove', 'hihat', 'house', 'Classic house hats', bar(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)),
  tpl('house-hat-off', 'Offbeat', 'hihat', 'house', 'Open offbeat feel', bar(2, 6, 10, 14)),
  tpl('house-hat-8', '8th', 'hihat', 'house', 'Straight 8ths', bar(0, 2, 4, 6, 8, 10, 12, 14)),
  tpl('house-hat-shuffle', 'Shuffle', 'hihat', 'house', 'Swung house', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('house-hat-open', 'Open Accent', 'hihat', 'house', 'Closed + open', bar(0, 2, 4, 6, 8, 10, 12, 14)),
  tpl('house-hat-minimal', 'Minimal', 'hihat', 'house', 'Sparse groove', bar(2, 10)),
  tpl('house-hat-build', 'Build', 'hihat', 'house', 'Riser bar 4', bar(8, 9, 10, 11, 12, 13, 14, 15)),
  tpl('house-hat-perc', 'Perc Hat', 'hihat', 'house', 'Percussive pattern', bar(0, 3, 4, 7, 8, 11, 12, 15)),

  // ── DANCE (similar to house but brighter) ──
  tpl('dance-kick-four', 'Four Floor', 'kick', 'dance', 'EDM four on floor', bar(0, 4, 8, 12)),
  tpl('dance-kick-drop', 'Drop', 'kick', 'dance', 'Drop energy', bar(0, 4, 8, 10, 12, 14)),
  tpl('dance-kick-build', 'Build', 'kick', 'dance', 'Pre-drop build', bar(0, 8, 12, 14, 15)),
  tpl('dance-kick-minimal', 'Breakdown', 'kick', 'dance', 'Breakdown sparse', bar(0, 8)),
  tpl('dance-kick-sync', 'Sync', 'kick', 'dance', 'Syncopated dance', bar(0, 6, 8, 14)),
  tpl('dance-kick-pickup', 'Pickup', 'kick', 'dance', 'Into the drop', bar(13, 14, 15)),
  tpl('dance-kick-half', 'Half-Time', 'kick', 'dance', 'Half-time section', bar(0, 8)),
  tpl('dance-kick-drive', 'Drive', 'kick', 'dance', 'Driving dance', bar(0, 4, 8, 10, 12)),
  tpl('dance-kick-bounce', 'Bounce', 'kick', 'dance', 'Bouncy sync', bar(0, 3, 8, 11)),
  tpl('dance-kick-techno', 'Techno', 'kick', 'dance', 'Hard kick', bar(0, 4, 8, 12)),
  tpl('dance-kick-verse', 'Verse', 'kick', 'dance', 'Light verse', bar(0, 8)),
  tpl('dance-kick-chorus', 'Chorus', 'kick', 'dance', 'Full chorus', bar(0, 4, 8, 12, 14)),

  tpl('dance-snare-24', '2 & 4', 'snare', 'dance', 'Dance backbeat', bar(4, 12)),
  tpl('dance-snare-fill', 'Fill', 'snare', 'dance', 'Build fill', bar(4, 12, 14, 15)),
  tpl('dance-snare-lift', 'Lift', 'snare', 'dance', 'Pre-drop snare', bar(4, 12, 15)),
  tpl('dance-snare-minimal', 'Single', 'snare', 'dance', 'Beat 2 only', bar(4)),
  tpl('dance-snare-half', 'Half', 'snare', 'dance', 'Beat 3', bar(8)),
  tpl('dance-snare-build', 'Build', 'snare', 'dance', 'Roll into drop', bar(12, 13, 14, 15)),
  tpl('dance-snare-off', 'Offbeat', 'snare', 'dance', '& of 2 & 4', bar(6, 14)),
  tpl('dance-snare-double', 'Double', 'snare', 'dance', 'Double 4', bar(4, 12, 15)),
  tpl('dance-snare-ghost', 'Ghost', 'snare', 'dance', 'Ghost layer', bar(4, 12, 14)),
  tpl('dance-snare-rim', 'Rim', 'snare', 'dance', 'Rim accent', bar(4, 12)),
  tpl('dance-snare-sparse', 'Sparse', 'snare', 'dance', 'Beat 4', bar(12)),
  tpl('dance-snare-push', 'Push', 'snare', 'dance', 'Push ghost', bar(14, 15)),

  tpl('dance-hat-16', '16th Drive', 'hihat', 'dance', 'Full sixteenths', bar(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)),
  tpl('dance-hat-8', '8th', 'hihat', 'dance', 'Straight 8ths', bar(0, 2, 4, 6, 8, 10, 12, 14)),
  tpl('dance-hat-off', 'Offbeat', 'hihat', 'dance', '& of each beat', bar(2, 6, 10, 14)),
  tpl('dance-hat-build', 'Build', 'hihat', 'dance', 'Riser hats', bar(8, 9, 10, 11, 12, 13, 14, 15)),
  tpl('dance-hat-minimal', 'Minimal', 'hihat', 'dance', 'Two hits', bar(2, 10)),
  tpl('dance-hat-sparse', 'Sparse', 'hihat', 'dance', 'Quarters', bar(0, 4, 8, 12)),
  tpl('dance-hat-shuffle', 'Shuffle', 'hihat', 'dance', 'Swung', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('dance-hat-roll', 'Roll', 'hihat', 'dance', 'Bar-end roll', bar(12, 13, 14, 15)),
  tpl('dance-hat-open', 'Open Mix', 'hihat', 'dance', 'Open accent mix', bar(0, 2, 4, 6, 8, 10, 12, 14)),
  tpl('dance-hat-stop', 'Stop', 'hihat', 'dance', 'Cut beat 4', bar(0, 2, 4, 6, 8, 10)),
  tpl('dance-hat-triplet', 'Triplet', 'hihat', 'dance', 'Triplet fill', bar(9, 10, 11, 13, 14, 15)),
  tpl('dance-hat-verse', 'Verse', 'hihat', 'dance', 'Light verse', bar(0, 4, 8, 12)),

  // ── MODERN EXPANSION — trap (+8), R&B / pop / house / dance (+6 each) ──
  // Trap: Metro/ATL pocket, club snare, steady→roll hats, rim ghosts (GM-style 1·8·11 kick).
  tpl('trap-kick-modern-138', 'Modern 1·8·11', 'kick', 'trap', '2020s trap trunk — downbeat · &2 · late 3', bar(0, 8, 11)),
  tpl('trap-kick-atl-memphis', 'ATL Memphis', 'kick', 'trap', 'Redd Block bounce — sync into 3 + lean', bar(0, 6, 10, 11)),
  tpl('trap-kick-drop-rush', 'Drop Rush', 'kick', 'trap', 'Lean trunk + bar-end doubles into 1', bar(0, 7, 10, 13, 14, 15)),
  tpl('trap-snare-club-pocket', 'Club Pocket', 'snare', 'trap', '2 & 4 + push ghost + bar tail', rowSteps(trapSnarePocket(), 1)),
  tpl('trap-snare-wide-stack', 'Wide Stack', 'snare', 'trap', 'Layered 2 & 4 + late clap width', bar(4, 5, 12, 13)),
  tpl('trap-hat-steady-burst', 'Steady → Burst', 'hihat', 'trap', '16ths through 3 · roll finishes bar', rowSteps(trapHatsSteadyThenRoll(), 3)),
  tpl('trap-hat-velocity-skip', 'Velocity Skip', 'hihat', 'trap', 'Skip downbeats — pump with velocity', bar(1, 3, 4, 5, 7, 9, 11, 12, 13, 15)),
  tpl('trap-rim-ghost-off', 'Rim Ghost', 'rim', 'trap', 'Light rim on every & — pocket glue', rowSteps(trapRimOff(), 7)),

  // R&B — neo-trap silk + first clap / open hat / rim rows.
  tpl('rnb-kick-neo-pocket', 'Neo Pocket', 'kick', 'rnb', 'Trap-influenced R&B — 1 · 3 lean · pickup', bar(0, 8, 11, 14)),
  tpl('rnb-snare-soft-push', 'Soft Push', 'snare', 'rnb', 'Laid 2 & 4 + ghost into bar line', bar(4, 12, 14, 15)),
  tpl('rnb-hat-silk-roll', 'Silk Roll', 'hihat', 'rnb', 'Smooth 8ths → second-half roll', bar(0, 2, 4, 6, 8, 10, 12, 13, 14, 15)),
  tpl('rnb-clap-layer', 'Clap Layer', 'clap', 'rnb', 'Soft stack on 2 & 4', bar(4, 12)),
  tpl('rnb-oh-breath', 'Breath OH', 'openHat', 'rnb', 'Open on & of each beat — air', bar(2, 6, 10, 14)),
  tpl('rnb-rim-brush', 'Brush Rim', 'rim', 'rnb', 'Brush rim on offbeat &s', bar(2, 6, 10, 14)),

  // Pop — hook-ready backbeat + sync hats.
  tpl('pop-kick-hook-drive', 'Hook Drive', 'kick', 'pop', 'Chorus pocket — 1 · 2& · 3', bar(0, 4, 6, 8, 10)),
  tpl('pop-snare-tiktok', 'TikTok Snap', 'snare', 'pop', '2 & 4 + lift on & of 4', bar(4, 12, 14)),
  tpl('pop-hat-sync-bounce', 'Sync Bounce', 'hihat', 'pop', 'Swung skip pattern — radio bounce', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('pop-clap-stack', 'Clap Stack', 'clap', 'pop', 'Wide clap on backbeat', bar(4, 12)),
  tpl('pop-oh-chorus', 'Chorus OH', 'openHat', 'pop', 'Open lift on & of 2 and & of 4', bar(6, 14)),
  tpl('pop-rim-shaker', 'Shaker Rim', 'rim', 'pop', 'Light shaker-style rim ticks', bar(1, 5, 9, 13)),

  // House — four-on-floor + Chicago hat feel + perc rim.
  tpl('house-kick-deep-groove', 'Deep Groove', 'kick', 'house', 'Four floor + late & of 3', bar(0, 4, 8, 10, 12)),
  tpl('house-kick-future-sync', 'Future Sync', 'kick', 'house', 'Future-house offbeat push', bar(0, 6, 8, 14)),
  tpl('house-snare-rim-stack', 'Rim Stack', 'snare', 'house', 'Clap 2 & 4 + rim shots', bar(4, 7, 12, 15)),
  tpl('house-hat-chicago', 'Chicago 16', 'hihat', 'house', 'Driving Chicago house 16ths', bar(0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15)),
  tpl('house-clap-sidechain', 'Sidechain Clap', 'clap', 'house', 'Stacked clap width on 2 & 4', bar(4, 5, 12, 13)),
  tpl('house-oh-pump', 'Pump OH', 'openHat', 'house', 'Open hat pump on offbeats', bar(2, 6, 10, 14)),
  tpl('house-rim-shuffle', 'Rim Shuffle', 'rim', 'house', 'Shuffled rim percussion grid', bar(1, 3, 5, 7, 9, 11, 13, 15)),

  // Dance / EDM — festival drop + riser hats.
  tpl('dance-kick-festival', 'Festival Floor', 'kick', 'dance', 'EDM four-on + pre-drop sync', bar(0, 4, 8, 10, 12, 14)),
  tpl('dance-snare-anthem', 'Anthem Snap', 'snare', 'dance', 'Big-room 2 & 4 + double 4', bar(4, 12, 14, 15)),
  tpl('dance-hat-mainstage', 'Mainstage Riser', 'hihat', 'dance', 'Build hats bar 3–4', bar(8, 9, 10, 11, 12, 13, 14, 15)),
  tpl('dance-clap-anthem', 'Anthem Clap', 'clap', 'dance', 'Festival clap on backbeat', bar(4, 12)),
  tpl('dance-oh-drop-rise', 'Drop Rise', 'openHat', 'dance', 'Open lift into the drop', bar(14, 15)),
  tpl('dance-rim-groove', 'Perc Groove', 'rim', 'dance', 'Offbeat perc rim layer', bar(2, 6, 10, 14)),

  ...BEAT_PADS_EXTENDED_GENRE_TEMPLATES,
  ...BEAT_PADS_KICK_PACK_TEMPLATES,
];

export function beatPadsPlacementGenreLabel(genre: BeatPadsPlacementGenre): string {
  return BEAT_PADS_PLACEMENT_GENRES.find((g) => g.id === genre)?.label ?? genre;
}

export function beatPadsDrumRoleLabel(role: BeatPadsDrumRole): string {
  return BEAT_PADS_DRUM_ROLES.find((r) => r.id === role)?.label ?? role;
}

export function getBeatPadsLaneTemplates(
  role: BeatPadsDrumRole,
  genre: BeatPadsPlacementGenre,
): readonly BeatPadsLanePlacementTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.role === role && t.genre === genre);
}

export function getBeatPadsLaneTemplateById(id: string): BeatPadsLanePlacementTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

export function beatPadsDrumRoleFromLabel(label: string, laneIndex: number): BeatPadsDrumRole {
  const l = label.toLowerCase();
  if (l.includes('kick') || l.includes('808')) return 'kick';
  if (l.includes('snare')) return 'snare';
  if (l.includes('clap')) return 'clap';
  if (l.includes('open') && l.includes('hat')) return 'openHat';
  if (l.includes('hat') || l.includes('hh') || l.includes('hi-hat')) return 'hihat';
  if (l.includes('rim') || l.includes('perc') || l.includes('shaker')) return 'rim';
  if (laneIndex === 0) return 'kick';
  if (laneIndex === 1 || laneIndex === 2) return 'snare';
  if (laneIndex === 3) return 'hihat';
  if (laneIndex === 4) return 'openHat';
  if (laneIndex === 7) return 'rim';
  return 'kick';
}

/** Standard Beat Pads / Beat Lab row for each drum role (matches GENIUS_LANE_LABELS). */
export const BEAT_PADS_CANONICAL_LANE_FOR_ROLE: Readonly<Record<BeatPadsDrumRole, number>> = {
  kick: 0,
  snare: 1,
  clap: 2,
  hihat: 3,
  openHat: 4,
  rim: 7,
};

/**
 * Grid lane for a lane-placement template — not the FX edit pad when roles differ.
 * Uses the selected lane when its label matches the role; otherwise the canonical row.
 */
export function resolveBeatPadsLaneForDrumRole(
  role: BeatPadsDrumRole,
  padLabelForPad?: (lane: number) => string | undefined,
  preferredLane?: number,
): number {
  if (preferredLane != null && preferredLane >= 0 && preferredLane < 16) {
    const label = padLabelForPad?.(preferredLane)?.trim() ?? '';
    if (beatPadsDrumRoleFromLabel(label, preferredLane) === role) {
      return preferredLane;
    }
  }
  return BEAT_PADS_CANONICAL_LANE_FOR_ROLE[role];
}

/** Tile one bar of steps across the loop length — replaces one lane row only. */
export function applyBeatPadsLanePlacementTemplate(
  pattern: BeatPadsDrumPattern,
  lane: number,
  loopBars: number,
  steps: readonly number[],
  stepsPerBar: BeatPadsGridStepsPerBar = BEAT_PADS_STEPS_PER_BAR,
): BeatPadsDrumPattern {
  if (lane < 0 || lane >= pattern.length) return pattern;
  const cols = beatPadsPatternCols(loopBars, stepsPerBar);
  const notes = beatPadsLaneFromBooleanTemplate(cols, steps, stepsPerBar);
  return pattern.map((r, i) => (i === lane ? notes : r));
}

export function pickRandomBeatPadsLaneTemplate(
  role: BeatPadsDrumRole,
  genre: BeatPadsPlacementGenre,
): BeatPadsLanePlacementTemplate | undefined {
  const list = getBeatPadsLaneTemplates(role, genre);
  if (list.length === 0) return undefined;
  return list[Math.floor(Math.random() * list.length)];
}

/** Random template for role/genre, skipping the current one when possible. */
export function pickAlternateBeatPadsLaneTemplate(
  role: BeatPadsDrumRole,
  genre: BeatPadsPlacementGenre,
  excludeId?: string | null,
): BeatPadsLanePlacementTemplate | undefined {
  const list = getBeatPadsLaneTemplates(role, genre);
  if (list.length === 0) return undefined;
  const alternates = excludeId ? list.filter((t) => t.id !== excludeId) : list;
  const pool = alternates.length > 0 ? alternates : list;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Compact visual for template picker — 16-step bar as string. */
export function beatPadsPlacementStepPreview(steps: readonly number[]): string {
  const set = new Set(steps);
  return Array.from({ length: BEAT_PADS_STEPS_PER_BAR }, (_, i) => (set.has(i) ? '●' : '·')).join('');
}
