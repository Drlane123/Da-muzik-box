/**
 * Lane placement templates — K-Pop, Southern Soul Blues, Afro, Reggae.
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

/** @internal Extended genres merged into ALL_TEMPLATES. */
export const BEAT_PADS_EXTENDED_GENRE_TEMPLATES: readonly BeatPadsLanePlacementTemplate[] = [
  // ── K-POP KICK ──
  tpl('kpop-kick-four', 'Four Floor', 'kick', 'kpop', 'Bright EDM-pop trunk', bar(0, 4, 8, 12)),
  tpl('kpop-kick-sync', 'Sync Bounce', 'kick', 'kpop', '1 · &2 · 3 — radio pocket', bar(0, 6, 8, 10)),
  tpl('kpop-kick-chorus', 'Chorus Drive', 'kick', 'kpop', 'Hook energy — 1 · 2& · 3', bar(0, 4, 6, 8, 10)),
  tpl('kpop-kick-verse', 'Verse Light', 'kick', 'kpop', 'Sparse verse anchor', bar(0, 8)),
  tpl('kpop-kick-drop', 'Drop Hit', 'kick', 'kpop', 'Pre-chorus pickup into drop', bar(0, 8, 12, 14, 15)),
  tpl('kpop-kick-minimal', 'Minimal', 'kick', 'kpop', 'Downbeat only', bar(0)),
  tpl('kpop-kick-half', 'Half-Time', 'kick', 'kpop', 'Beat 1 + 3 wide', bar(0, 8)),
  tpl('kpop-kick-pickup', 'Pickup', 'kick', 'kpop', 'Bar-end lift', bar(12, 14, 15)),
  tpl('kpop-kick-stack', 'Stack Pulse', 'kick', 'kpop', 'Doubles into chorus', bar(0, 3, 8, 11)),
  tpl('kpop-kick-latin', 'Latin Pop', 'kick', 'kpop', 'Syncopated K-pop latin', bar(0, 3, 6, 10, 13)),

  // ── K-POP SNARE ──
  tpl('kpop-snare-24', '2 & 4 Snap', 'snare', 'kpop', 'Tight idol backbeat', bar(4, 12)),
  tpl('kpop-snare-fill', 'Bar Fill', 'snare', 'kpop', '2 & 4 + tail fill', bar(4, 12, 14, 15)),
  tpl('kpop-snare-clap', 'Clap Stack', 'snare', 'kpop', 'Snare + clap width', bar(4, 5, 12, 13)),
  tpl('kpop-snare-lift', 'Lift', 'snare', 'kpop', 'Pre-hook push', bar(4, 12, 14)),
  tpl('kpop-snare-minimal', 'Beat 2', 'snare', 'kpop', 'Single accent', bar(4)),
  tpl('kpop-snare-ghost', 'Ghost', 'snare', 'kpop', '2 & 4 + soft ghost', bar(4, 12, 14)),
  tpl('kpop-snare-build', 'Build', 'snare', 'kpop', 'Roll into drop', bar(12, 13, 14, 15)),
  tpl('kpop-snare-off', 'Offbeat', 'snare', 'kpop', '& of 2 and & of 4', bar(6, 14)),
  tpl('kpop-snare-double', 'Double 4', 'snare', 'kpop', 'Double on beat 4', bar(4, 12, 15)),
  tpl('kpop-snare-rim', 'Rim Layer', 'snare', 'kpop', 'Snare + rim tick', bar(4, 7, 12, 15)),

  // ── K-POP HI-HAT ──
  tpl('kpop-hat-16', '16th Drive', 'hihat', 'kpop', 'Machine 16ths', bar(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)),
  tpl('kpop-hat-sync', 'Sync Bounce', 'hihat', 'kpop', 'Swung skip — radio bounce', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('kpop-hat-8', '8th Straight', 'hihat', 'kpop', 'Clean 8ths', bar(0, 2, 4, 6, 8, 10, 12, 14)),
  tpl('kpop-hat-build', 'Build', 'hihat', 'kpop', 'Riser into chorus', bar(8, 9, 10, 11, 12, 13, 14, 15)),
  tpl('kpop-hat-sparse', 'Sparse', 'hihat', 'kpop', 'Verse quarters', bar(0, 4, 8, 12)),
  tpl('kpop-hat-roll', 'Roll', 'hihat', 'kpop', 'Bar-end burst', bar(12, 13, 14, 15)),
  tpl('kpop-hat-off', 'Offbeat', 'hihat', 'kpop', '& of each beat', bar(2, 6, 10, 14)),
  tpl('kpop-hat-minimal', 'Minimal', 'hihat', 'kpop', 'Two hits', bar(2, 10)),
  tpl('kpop-hat-triplet', 'Triplet', 'hihat', 'kpop', 'Triplet fill push', bar(9, 10, 11, 13, 14, 15)),
  tpl('kpop-hat-verse', 'Verse', 'hihat', 'kpop', 'Light verse pattern', bar(0, 4, 8, 12)),

  tpl('kpop-clap-24', '2 & 4', 'clap', 'kpop', 'Stacked clap backbeat', bar(4, 12)),
  tpl('kpop-clap-wide', 'Wide Stack', 'clap', 'kpop', 'Layered clap width', bar(4, 5, 12, 13)),
  tpl('kpop-clap-fill', 'Fill', 'clap', 'kpop', 'Claps into downbeat', bar(13, 14, 15)),
  tpl('kpop-clap-one', 'Beat 2', 'clap', 'kpop', 'Single clap accent', bar(4)),
  tpl('kpop-clap-echo', 'Echo', 'clap', 'kpop', '2 & 4 + echo', bar(4, 5, 12, 13)),
  tpl('kpop-clap-late', 'Late', 'clap', 'kpop', 'Behind the grid', bar(5, 13)),

  tpl('kpop-oh-lift', 'Lift', 'openHat', 'kpop', '& of 4 open', bar(14)),
  tpl('kpop-oh-chorus', 'Chorus OH', 'openHat', 'kpop', 'Open on & of 2 and 4', bar(6, 14)),
  tpl('kpop-oh-sparse', 'Sparse', 'openHat', 'kpop', 'One open per bar', bar(6)),
  tpl('kpop-oh-fill', 'Fill', 'openHat', 'kpop', 'Into the drop', bar(15)),

  tpl('kpop-rim-shaker', 'Shaker', 'rim', 'kpop', 'Light shaker ticks', bar(1, 5, 9, 13)),
  tpl('kpop-rim-off', 'Offbeat', 'rim', 'kpop', 'Offbeat perc layer', bar(2, 6, 10, 14)),
  tpl('kpop-rim-fill', 'Fill', 'rim', 'kpop', 'Bar-end perc', bar(13, 14, 15)),
  tpl('kpop-rim-sparse', 'Sparse', 'rim', 'kpop', 'Quarter rim', bar(0, 4, 8, 12)),

  // ── SOUL BLUES KICK ──
  tpl('soulblues-kick-shuffle', 'Shuffle', 'kick', 'soulBlues', 'Southern shuffle — 1 · late 2 · 3', bar(0, 5, 10)),
  tpl('soulblues-kick-slow', 'Slow 1 & 3', 'kick', 'soulBlues', 'Memphis trunk', bar(0, 8)),
  tpl('soulblues-kick-one', 'One Drop', 'kick', 'soulBlues', 'Downbeat anchor', bar(0)),
  tpl('soulblues-kick-behind', 'Behind Grid', 'kick', 'soulBlues', 'Laid-back late pocket', bar(0, 7, 11)),
  tpl('soulblues-kick-gospel', 'Gospel Push', 'kick', 'soulBlues', '1 · 3 · pickup', bar(0, 8, 14)),
  tpl('soulblues-kick-walk', 'Walking', 'kick', 'soulBlues', 'Blues walk feel', bar(0, 4, 8, 12)),
  tpl('soulblues-kick-heavy', 'Heavy', 'kick', 'soulBlues', 'Punchy 1 and 3', bar(0, 8, 11)),
  tpl('soulblues-kick-brush', 'Brush', 'kick', 'soulBlues', 'Soft brush pocket', bar(0, 10)),
  tpl('soulblues-kick-half', 'Half-Time', 'kick', 'soulBlues', 'Slow jam half-time', bar(0, 8)),
  tpl('soulblues-kick-pickup', 'Pickup', 'kick', 'soulBlues', 'Turnaround pickup', bar(14, 15)),

  tpl('soulblues-snare-24', '2 & 4 Backbeat', 'snare', 'soulBlues', 'Classic soul snare', bar(4, 12)),
  tpl('soulblues-snare-brush', 'Brush', 'snare', 'soulBlues', 'Behind-the-beat brush', bar(5, 13)),
  tpl('soulblues-snare-ghost', 'Ghost', 'snare', 'soulBlues', '2 & 4 + ghost layer', bar(4, 12, 14)),
  tpl('soulblues-snare-fill', 'Fill', 'snare', 'soulBlues', 'Bar-end soul fill', bar(4, 12, 14, 15)),
  tpl('soulblues-snare-half', 'Beat 3', 'snare', 'soulBlues', 'Half-time snare', bar(8)),
  tpl('soulblues-snare-soft', 'Soft', 'snare', 'soulBlues', 'Laid-back 2 & 4', bar(5, 13)),
  tpl('soulblues-snare-rim', 'Rim Shot', 'snare', 'soulBlues', 'Rim on backbeat', bar(4, 12)),
  tpl('soulblues-snare-sparse', 'Sparse', 'snare', 'soulBlues', 'Beat 2 only', bar(4)),
  tpl('soulblues-snare-push', 'Push', 'snare', 'soulBlues', 'Ghost before 1', bar(14, 15)),
  tpl('soulblues-snare-stack', 'Stack', 'snare', 'soulBlues', 'Double on 4', bar(4, 12, 14)),

  tpl('soulblues-hat-shuffle', 'Shuffle', 'hihat', 'soulBlues', 'Swung shuffle grid', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('soulblues-hat-8', '8th Ride', 'hihat', 'soulBlues', 'Straight 8th ride', bar(0, 2, 4, 6, 8, 10, 12, 14)),
  tpl('soulblues-hat-sparse', 'Sparse', 'hihat', 'soulBlues', 'Quarter hats', bar(0, 4, 8, 12)),
  tpl('soulblues-hat-brush', 'Brush', 'hihat', 'soulBlues', 'Brush pattern', bar(2, 6, 10, 14)),
  tpl('soulblues-hat-minimal', 'Minimal', 'hihat', 'soulBlues', 'Two hits', bar(2, 10)),
  tpl('soulblues-hat-off', 'Offbeat', 'hihat', 'soulBlues', '& of each beat', bar(2, 6, 10, 14)),
  tpl('soulblues-hat-slow', 'Slow Swing', 'hihat', 'soulBlues', 'Slow blues swing', bar(0, 3, 6, 9, 12, 15)),
  tpl('soulblues-hat-fill', 'Fill', 'hihat', 'soulBlues', 'Turnaround fill', bar(12, 13, 14, 15)),

  tpl('soulblues-clap-24', '2 & 4', 'clap', 'soulBlues', 'Soul clap backbeat', bar(4, 12)),
  tpl('soulblues-clap-late', 'Late', 'clap', 'soulBlues', 'Behind the snare', bar(5, 13)),
  tpl('soulblues-clap-soft', 'Soft', 'clap', 'soulBlues', 'Gospel soft clap', bar(4, 12)),
  tpl('soulblues-clap-fill', 'Fill', 'clap', 'soulBlues', 'Clap turnaround', bar(13, 14, 15)),

  tpl('soulblues-oh-sparse', 'Sparse', 'openHat', 'soulBlues', 'One open breath', bar(6)),
  tpl('soulblues-oh-lift', 'Lift', 'openHat', 'soulBlues', '& of 4 lift', bar(14)),
  tpl('soulblues-oh-groove', 'Groove', 'openHat', 'soulBlues', 'Offbeat air', bar(2, 6, 10, 14)),

  tpl('soulblues-rim-brush', 'Brush Rim', 'rim', 'soulBlues', 'Brush rim shuffle', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('soulblues-rim-ghost', 'Ghost', 'rim', 'soulBlues', 'Soft rim ghosts', bar(2, 6, 10, 14)),
  tpl('soulblues-rim-sparse', 'Sparse', 'rim', 'soulBlues', 'Quarter rim', bar(0, 4, 8, 12)),
  tpl('soulblues-rim-fill', 'Fill', 'rim', 'soulBlues', 'Turnaround rim', bar(13, 14, 15)),

  // ── AFRO KICK ──
  tpl('afro-kick-dembow', 'Dembow', 'kick', 'afro', '3+3+2 dembow kick', bar(0, 3, 6, 8, 11)),
  tpl('afro-kick-lagos', 'Lagos Pulse', 'kick', 'afro', 'Naija downbeat + sync', bar(0, 6, 8, 10)),
  tpl('afro-kick-four-lite', 'Four Lite', 'kick', 'afro', 'Afropop four-on-lite', bar(0, 4, 8, 12)),
  tpl('afro-kick-bounce', 'Bounce', 'kick', 'afro', 'Accra swing pocket', bar(0, 5, 8, 13)),
  tpl('afro-kick-amapiano', 'Amapiano', 'kick', 'afro', 'Log drum pocket', bar(0, 8, 10)),
  tpl('afro-kick-minimal', 'Minimal', 'kick', 'afro', 'Sparse trunk', bar(0, 8)),
  tpl('afro-kick-push', 'Push', 'kick', 'afro', 'Push into bar line', bar(0, 7, 10, 14)),
  tpl('afro-kick-shaku', 'Shaku', 'kick', 'afro', 'Shaku shaku stomp', bar(0, 3, 8, 11)),
  tpl('afro-kick-highlife', 'Highlife', 'kick', 'afro', 'Highlife 1 and 3', bar(0, 8, 12)),
  tpl('afro-kick-pickup', 'Pickup', 'kick', 'afro', 'Bar pickup', bar(14, 15)),

  tpl('afro-snare-24', '2 & 4', 'snare', 'afro', 'Afropop backbeat', bar(4, 12)),
  tpl('afro-snare-clap', 'Clap Stack', 'snare', 'afro', 'Snare + clap stack', bar(4, 5, 12, 13)),
  tpl('afro-snare-fill', 'Fill', 'snare', 'afro', 'Bar-end fill', bar(4, 12, 14, 15)),
  tpl('afro-snare-rim', 'Rim', 'snare', 'afro', 'Rim accent layer', bar(4, 7, 12)),
  tpl('afro-snare-minimal', 'Beat 2', 'snare', 'afro', 'Single hit', bar(4)),
  tpl('afro-snare-off', 'Offbeat', 'snare', 'afro', '& of 2 and & of 4', bar(6, 14)),
  tpl('afro-snare-ghost', 'Ghost', 'snare', 'afro', 'Ghost layer', bar(4, 12, 14)),
  tpl('afro-snare-push', 'Push', 'snare', 'afro', 'Push before 1', bar(14, 15)),
  tpl('afro-snare-double', 'Double', 'snare', 'afro', 'Double 4', bar(4, 12, 15)),
  tpl('afro-snare-sparse', 'Sparse', 'snare', 'afro', 'Beat 4 only', bar(12)),

  tpl('afro-hat-skitter', 'Skitter', 'hihat', 'afro', 'Amapiano skitter 16ths', bar(0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15)),
  tpl('afro-hat-off', 'Offbeat', 'hihat', 'afro', '& of each beat', bar(2, 6, 10, 14)),
  tpl('afro-hat-8', '8th', 'hihat', 'afro', 'Straight 8ths', bar(0, 2, 4, 6, 8, 10, 12, 14)),
  tpl('afro-hat-sparse', 'Sparse', 'hihat', 'afro', 'Quarter hats', bar(0, 4, 8, 12)),
  tpl('afro-hat-build', 'Build', 'hihat', 'afro', 'Riser fill', bar(8, 9, 10, 11, 12, 13, 14, 15)),
  tpl('afro-hat-shuffle', 'Shuffle', 'hihat', 'afro', 'Swung afro shuffle', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('afro-hat-minimal', 'Minimal', 'hihat', 'afro', 'Two hits', bar(2, 10)),
  tpl('afro-hat-roll', 'Roll', 'hihat', 'afro', 'Bar-end roll', bar(12, 13, 14, 15)),

  tpl('afro-clap-stack', 'Stack', 'clap', 'afro', 'Wide clap stack', bar(4, 5, 12, 13)),
  tpl('afro-clap-24', '2 & 4', 'clap', 'afro', 'Backbeat clap', bar(4, 12)),
  tpl('afro-clap-fill', 'Fill', 'clap', 'afro', 'Clap fill', bar(13, 14, 15)),
  tpl('afro-clap-one', 'Beat 2', 'clap', 'afro', 'Single clap', bar(4)),

  tpl('afro-oh-off', 'Offbeat OH', 'openHat', 'afro', 'Open on &s — air', bar(2, 6, 10, 14)),
  tpl('afro-oh-sparse', 'Sparse', 'openHat', 'afro', 'One open', bar(6)),
  tpl('afro-oh-lift', 'Lift', 'openHat', 'afro', 'Bar lift', bar(14)),
  tpl('afro-oh-fill', 'Fill', 'openHat', 'afro', 'Into downbeat', bar(15)),

  tpl('afro-rim-perc', 'Perc', 'rim', 'afro', 'Percussion grid', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('afro-rim-talk', 'Drum Talk', 'rim', 'afro', 'Call-response rim', bar(2, 6, 10, 14)),
  tpl('afro-rim-sparse', 'Sparse', 'rim', 'afro', 'Quarter rim', bar(0, 4, 8, 12)),
  tpl('afro-rim-fill', 'Fill', 'rim', 'afro', 'Bar-end perc', bar(13, 14, 15)),

  // ── REGGAE KICK ──
  tpl('reggae-kick-onedrop', 'One Drop', 'kick', 'reggae', 'Kick on beat 3 only', bar(8)),
  tpl('reggae-kick-steppers', 'Steppers', 'kick', 'reggae', 'Four-on-floor steppers', bar(0, 4, 8, 12)),
  tpl('reggae-kick-rockers', 'Rockers', 'kick', 'reggae', 'Rockers steady 1 & 3', bar(0, 8)),
  tpl('reggae-kick-dancehall', 'Dancehall', 'kick', 'reggae', 'Dancehall push', bar(0, 6, 8, 14)),
  tpl('reggae-kick-dub', 'Dub Space', 'kick', 'reggae', 'Sparse dub kick', bar(0)),
  tpl('reggae-kick-bubble', 'Bubble', 'kick', 'reggae', 'Bubble bass pocket', bar(0, 8, 10)),
  tpl('reggae-kick-roots', 'Roots', 'kick', 'reggae', 'Roots pedal', bar(0, 8, 12)),
  tpl('reggae-kick-island', 'Island', 'kick', 'reggae', 'Island one-drop variant', bar(8, 14)),
  tpl('reggae-kick-rub', 'Rub-a-Dub', 'kick', 'reggae', 'Rub-a-dub sync', bar(0, 5, 8, 13)),
  tpl('reggae-kick-pickup', 'Pickup', 'kick', 'reggae', 'Turnaround', bar(14, 15)),

  tpl('reggae-snare-onedrop', 'One Drop Rim', 'snare', 'reggae', 'Rim on beat 3', bar(8)),
  tpl('reggae-snare-24', '2 & 4', 'snare', 'reggae', 'Rocksteady backbeat', bar(4, 12)),
  tpl('reggae-snare-rim', 'Rim Shot', 'snare', 'reggae', 'Rim shot accent', bar(4, 12)),
  tpl('reggae-snare-clap', 'Clap Layer', 'snare', 'reggae', 'Snare + clap', bar(4, 12)),
  tpl('reggae-snare-fill', 'Fill', 'snare', 'reggae', 'Dub fill tail', bar(12, 14, 15)),
  tpl('reggae-snare-sparse', 'Sparse', 'snare', 'reggae', 'Beat 2 only', bar(4)),
  tpl('reggae-snare-ragga', 'Ragga Snap', 'snare', 'reggae', 'Fast dancehall snap', bar(4, 12, 14)),
  tpl('reggae-snare-ghost', 'Ghost', 'snare', 'reggae', 'Soft ghost', bar(4, 12, 14)),
  tpl('reggae-snare-off', 'Offbeat', 'snare', 'reggae', '& of 2 and 4', bar(6, 14)),
  tpl('reggae-snare-stack', 'Stack', 'snare', 'reggae', 'Clap stack width', bar(4, 5, 12, 13)),

  tpl('reggae-hat-steady', 'Steady 8th', 'hihat', 'reggae', 'Rocksteady 8ths', bar(0, 2, 4, 6, 8, 10, 12, 14)),
  tpl('reggae-hat-off', 'Offbeat', 'hihat', 'reggae', 'Skank offbeats', bar(2, 6, 10, 14)),
  tpl('reggae-hat-sparse', 'Sparse', 'hihat', 'reggae', 'Quarter hats', bar(0, 4, 8, 12)),
  tpl('reggae-hat-rider', 'Rider', 'hihat', 'reggae', 'Dub ride pattern', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('reggae-hat-minimal', 'Minimal', 'hihat', 'reggae', 'Two hits', bar(2, 10)),
  tpl('reggae-hat-fill', 'Fill', 'hihat', 'reggae', 'Turnaround', bar(12, 13, 14, 15)),
  tpl('reggae-hat-ska', 'Ska Up', 'hihat', 'reggae', 'Ska upstroke feel', bar(1, 5, 9, 13)),
  tpl('reggae-hat-lovers', 'Lovers', 'hihat', 'reggae', 'Slow lovers rock', bar(0, 4, 8, 12)),

  tpl('reggae-clap-24', '2 & 4', 'clap', 'reggae', 'Island clap', bar(4, 12)),
  tpl('reggae-clap-stack', 'Stack', 'clap', 'reggae', 'Stepper clap stack', bar(4, 5, 12, 13)),
  tpl('reggae-clap-fill', 'Fill', 'clap', 'reggae', 'Clap fill', bar(13, 14, 15)),
  tpl('reggae-clap-one', 'Beat 2', 'clap', 'reggae', 'Single clap', bar(4)),

  tpl('reggae-oh-skank', 'Skank OH', 'openHat', 'reggae', 'Open skank offbeats', bar(2, 6, 10, 14)),
  tpl('reggae-oh-lift', 'Lift', 'openHat', 'reggae', '& of 4', bar(14)),
  tpl('reggae-oh-sparse', 'Sparse', 'openHat', 'reggae', 'One breath', bar(6)),
  tpl('reggae-oh-dub', 'Dub', 'openHat', 'reggae', 'Dub space open', bar(15)),

  tpl('reggae-rim-skank', 'Skank', 'rim', 'reggae', 'Classic skank grid', bar(2, 6, 10, 14)),
  tpl('reggae-rim-count', 'Count', 'rim', 'reggae', 'Fast offbeat rim', bar(1, 3, 5, 7, 9, 11, 13, 15)),
  tpl('reggae-rim-nyabinghi', 'Nyabinghi', 'rim', 'reggae', 'Nyabinghi pulse', bar(0, 4, 8, 12)),
  tpl('reggae-rim-sparse', 'Sparse', 'rim', 'reggae', 'Quarter rim', bar(0, 4, 8, 12)),
] as const;
