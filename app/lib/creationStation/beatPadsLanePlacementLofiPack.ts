/**
 * Beat Pads Lane Placements — Lo-Fi pack.
 * 20 snares · 20 claps · 20 closed hats · 20 open hats (one-lane 16th patterns).
 */
import type {
  BeatPadsDrumRole,
  BeatPadsLanePlacementTemplate,
  BeatPadsPlacementGenre,
} from '@/app/lib/creationStation/beatPadsLanePlacementTemplates';

function bar(...steps: number[]): readonly number[] {
  return steps;
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

/** @internal Merged into ALL_TEMPLATES. */
export const BEAT_PADS_LOFI_LANE_TEMPLATES: readonly BeatPadsLanePlacementTemplate[] = [
  // ── LO-FI SNARE (20) ──
  tpl('lofi-snare-24', 'Dusty 2 & 4', 'snare', 'lofi', 'Soft study-beat backbeat', bar(4, 12)),
  tpl('lofi-snare-late', 'Late Pocket', 'snare', 'lofi', 'Snare sits behind 2 & 4', bar(5, 13)),
  tpl('lofi-snare-half', 'Half-Time', 'snare', 'lofi', 'Beat 3 only — chill hop', bar(8)),
  tpl('lofi-snare-brush', 'Brush Soft', 'snare', 'lofi', 'Brush behind beat 2', bar(5, 13)),
  tpl('lofi-snare-ghost', 'Ghost Tail', 'snare', 'lofi', '2 & 4 + soft & of 4', bar(4, 12, 14)),
  tpl('lofi-snare-vinyl', 'Vinyl Crack', 'snare', 'lofi', 'Sparse beat 2 crack', bar(4)),
  tpl('lofi-snare-swing', 'Swing Lean', 'snare', 'lofi', '& of 2 and & of 4 lean', bar(6, 14)),
  tpl('lofi-snare-tape', 'Tape Slap', 'snare', 'lofi', '2 & 4 + soft double 4', bar(4, 12, 13)),
  tpl('lofi-snare-room', 'Room Snap', 'snare', 'lofi', 'Wide 2 & 4 room hit', bar(4, 5, 12, 13)),
  tpl('lofi-snare-fill', 'Bar Dust', 'snare', 'lofi', '2 & 4 + dusty bar tail', bar(4, 12, 14, 15)),
  tpl('lofi-snare-minimal', 'One Hit', 'snare', 'lofi', 'Beat 4 only', bar(12)),
  tpl('lofi-snare-push', 'Push Ghost', 'snare', 'lofi', 'Ghost into the bar line', bar(14, 15)),
  tpl('lofi-snare-lazy', 'Lazy 3', 'snare', 'lofi', 'Soft beat 3 + ghost', bar(8, 14)),
  tpl('lofi-snare-side', 'Side Stick', 'snare', 'lofi', 'Rim-feel on 2 & 4', bar(4, 12)),
  tpl('lofi-snare-double', 'Soft Double', 'snare', 'lofi', 'Double tap on 4', bar(4, 12, 15)),
  tpl('lofi-snare-skip', 'Skip 4', 'snare', 'lofi', 'Beat 2 + soft bar ghost', bar(4, 15)),
  tpl('lofi-snare-fog', 'Fog Layer', 'snare', 'lofi', '2 & 4 + mid ghost', bar(4, 10, 12)),
  tpl('lofi-snare-waltz', '3 Feel', 'snare', 'lofi', 'Off-grid waltz lean', bar(5, 11)),
  tpl('lofi-snare-cassette', 'Cassette', 'snare', 'lofi', 'Warped late backbeat', bar(5, 12, 13)),
  tpl('lofi-snare-study', 'Study Snap', 'snare', 'lofi', 'Classic chill hop 2 + ghost 4', bar(4, 11, 12)),

  // ── LO-FI CLAP (20) ──
  tpl('lofi-clap-24', 'Soft Clap', 'clap', 'lofi', 'Dusty clap on 2 & 4', bar(4, 12)),
  tpl('lofi-clap-late', 'Late Clap', 'clap', 'lofi', 'Behind the snare pocket', bar(5, 13)),
  tpl('lofi-clap-echo', 'Room Echo', 'clap', 'lofi', '2 & 4 + soft echo', bar(4, 5, 12, 13)),
  tpl('lofi-clap-one', 'Beat 2', 'clap', 'lofi', 'Single clap accent', bar(4)),
  tpl('lofi-clap-sparse', 'Sparse 4', 'clap', 'lofi', 'Beat 4 only', bar(12)),
  tpl('lofi-clap-half', 'Half Clap', 'clap', 'lofi', 'Beat 3 clap', bar(8)),
  tpl('lofi-clap-off', 'Offbeat', 'clap', 'lofi', '& of 2 and & of 4', bar(6, 14)),
  tpl('lofi-clap-fill', 'Tail Clap', 'clap', 'lofi', 'Claps into downbeat', bar(13, 14, 15)),
  tpl('lofi-clap-double', 'Double Soft', 'clap', 'lofi', 'Two hits on beat 4', bar(12, 14)),
  tpl('lofi-clap-push', 'Push Ghost', 'clap', 'lofi', 'Ghost before bar line', bar(14)),
  tpl('lofi-clap-wide', 'Wide Stack', 'clap', 'lofi', 'Layered clap width', bar(4, 5, 12, 13)),
  tpl('lofi-clap-vinyl', 'Vinyl Clap', 'clap', 'lofi', 'Thin vinyl clap 2 & 4', bar(4, 12)),
  tpl('lofi-clap-tape', 'Tape Layer', 'clap', 'lofi', '2 & 4 + tape ghost', bar(4, 12, 14)),
  tpl('lofi-clap-lazy', 'Lazy Stack', 'clap', 'lofi', 'Late stack on 4', bar(5, 12, 13)),
  tpl('lofi-clap-minimal', 'One Soft', 'clap', 'lofi', 'Single soft clap', bar(12)),
  tpl('lofi-clap-fog', 'Fog Clap', 'clap', 'lofi', 'Soft mid + backbeat', bar(4, 10, 12)),
  tpl('lofi-clap-brush', 'Brush Clap', 'clap', 'lofi', 'Brushy late 2 & 4', bar(5, 13)),
  tpl('lofi-clap-study', 'Study Clap', 'clap', 'lofi', 'Chill hop clap pocket', bar(4, 12)),
  tpl('lofi-clap-side', 'Side Soft', 'clap', 'lofi', 'Soft side clap 2', bar(4, 5)),
  tpl('lofi-clap-room', 'Room Wash', 'clap', 'lofi', 'Wide room on 2 & 4', bar(4, 5, 12)),

  // ── LO-FI HI-HAT (20) ──
  tpl('lofi-hat-8', 'Dusty 8ths', 'hihat', 'lofi', 'Soft closed 8ths', bar(0, 2, 4, 6, 8, 10, 12, 14)),
  tpl('lofi-hat-off', 'Offbeat Chick', 'hihat', 'lofi', '& of each beat', bar(2, 6, 10, 14)),
  tpl('lofi-hat-sparse', 'Sparse Quarters', 'hihat', 'lofi', 'Quarter-note chicks', bar(0, 4, 8, 12)),
  tpl('lofi-hat-swing', 'Swing Skip', 'hihat', 'lofi', 'Skip downbeats — swing lean', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('lofi-hat-minimal', 'Two Chicks', 'hihat', 'lofi', 'Two soft hits', bar(2, 10)),
  tpl('lofi-hat-16', 'Soft 16ths', 'hihat', 'lofi', 'Quiet machine 16ths', bar(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)),
  tpl('lofi-hat-half', 'Half Pulse', 'hihat', 'lofi', 'Every other 8th', bar(0, 4, 8, 12)),
  tpl('lofi-hat-lazy', 'Lazy Pocket', 'hihat', 'lofi', 'Laid-back mid hits', bar(2, 6, 10, 13)),
  tpl('lofi-hat-tape', 'Tape Tick', 'hihat', 'lofi', 'Sparse tape ticks', bar(0, 6, 8, 14)),
  tpl('lofi-hat-vinyl', 'Vinyl Tick', 'hihat', 'lofi', 'Irregular vinyl ticks', bar(1, 4, 7, 10, 13)),
  tpl('lofi-hat-build', 'Soft Build', 'hihat', 'lofi', 'Second-half denser', bar(0, 4, 8, 9, 10, 11, 12, 13, 14, 15)),
  tpl('lofi-hat-roll', 'Dust Roll', 'hihat', 'lofi', 'Soft bar-end roll', bar(12, 13, 14, 15)),
  tpl('lofi-hat-triplet', 'Triplet Fog', 'hihat', 'lofi', 'Soft triplet push', bar(9, 10, 11, 13, 14, 15)),
  tpl('lofi-hat-verse', 'Verse Light', 'hihat', 'lofi', 'Light verse pattern', bar(0, 4, 8, 12)),
  tpl('lofi-hat-skip', 'Skip Snare', 'hihat', 'lofi', 'Skip snare-adjacent steps', bar(0, 2, 6, 8, 10, 14)),
  tpl('lofi-hat-fog', 'Fog 8ths', 'hihat', 'lofi', 'Soft foggy 8ths', bar(0, 2, 4, 7, 8, 10, 12, 15)),
  tpl('lofi-hat-study', 'Study Tick', 'hihat', 'lofi', 'Study-beat tick pocket', bar(2, 6, 10, 14)),
  tpl('lofi-hat-cassette', 'Cassette', 'hihat', 'lofi', 'Warped mid ticks', bar(1, 5, 9, 11, 14)),
  tpl('lofi-hat-brush', 'Brush Tick', 'hihat', 'lofi', 'Brushy offbeat ticks', bar(3, 7, 11, 15)),
  tpl('lofi-hat-night', 'Night Pulse', 'hihat', 'lofi', 'Sparse night pulse', bar(0, 8, 12)),

  // ── LO-FI OPEN HAT (20) ──
  tpl('lofi-oh-lift', 'Soft Lift', 'openHat', 'lofi', 'Open on & of 4', bar(14)),
  tpl('lofi-oh-24', 'Breath 2 & 4', 'openHat', 'lofi', 'Light open on & of 2 & 4', bar(6, 14)),
  tpl('lofi-oh-sparse', 'One Open', 'openHat', 'lofi', 'One open per bar', bar(6)),
  tpl('lofi-oh-fill', 'Into Bar', 'openHat', 'lofi', 'Open into downbeat', bar(15)),
  tpl('lofi-oh-groove', 'OH Groove', 'openHat', 'lofi', '& of every beat soft', bar(2, 6, 10, 14)),
  tpl('lofi-oh-minimal', 'Beat 2 &', 'openHat', 'lofi', 'Open on & of 2 only', bar(6)),
  tpl('lofi-oh-double', 'Double Lift', 'openHat', 'lofi', 'Two opens bar end', bar(13, 15)),
  tpl('lofi-oh-late', 'Late Sizzle', 'openHat', 'lofi', 'Late & of 4 sizzle', bar(15)),
  tpl('lofi-oh-fog', 'Fog Open', 'openHat', 'lofi', 'Soft mid open', bar(10)),
  tpl('lofi-oh-vinyl', 'Vinyl Open', 'openHat', 'lofi', 'Thin vinyl open', bar(14)),
  tpl('lofi-oh-tape', 'Tape Breath', 'openHat', 'lofi', 'Tape breath on & of 4', bar(14)),
  tpl('lofi-oh-study', 'Study Breath', 'openHat', 'lofi', 'Chill hop open lift', bar(6, 14)),
  tpl('lofi-oh-half', 'Half Open', 'openHat', 'lofi', 'Open near beat 3', bar(8, 14)),
  tpl('lofi-oh-push', 'Push Open', 'openHat', 'lofi', 'Open before bar line', bar(14, 15)),
  tpl('lofi-oh-room', 'Room Wash', 'openHat', 'lofi', 'Wide room open', bar(6, 13, 14)),
  tpl('lofi-oh-lazy', 'Lazy OH', 'openHat', 'lofi', 'Lazy offbeat opens', bar(7, 14)),
  tpl('lofi-oh-cassette', 'Cassette OH', 'openHat', 'lofi', 'Warped open accents', bar(5, 14)),
  tpl('lofi-oh-night', 'Night Sizzle', 'openHat', 'lofi', 'Night sizzle on 4', bar(12, 14)),
  tpl('lofi-oh-brush', 'Brush Open', 'openHat', 'lofi', 'Brushy open lift', bar(6)),
  tpl('lofi-oh-sparse2', 'Sparse &4', 'openHat', 'lofi', 'Sparse & of 4 only', bar(14)),
];
