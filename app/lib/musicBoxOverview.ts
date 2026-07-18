/**
 * Da Muzik Box — product overview (commercial / demo script source).
 * Tabbed explainer for Creation Station, Studio Editor 2 (Beat Pads), Mastering Bay, AI Vocal Lab, AI tools.
 */

import { MAX_STUDIO_TRACKS, SE2_ARRANGEMENT_BARS } from '@/app/lib/studio/se2ArrangementConstants';

export type MusicBoxOverviewMainTabId =
  | 'welcome'
  | 'creation-station'
  | 'studio-editor-2'
  | 'mastering-bay'
  | 'vocal-lab'
  | 'ai-song'
  | 'ai-music-match';

export type CreationStationOverviewTabId =
  | 'cs-intro'
  | 'beat-lab'
  | 'groove-lab'
  | 'chord-builder'
  | '808-lab'
  | 'kit-generator'
  | 'chord-bass-seq';

export type StudioEditor2OverviewTabId =
  | 'se2-intro'
  | 'se2-beat-pads'
  | 'se2-chord-generator'
  | 'se2-synth-geno'
  | 'se2-ultra-bass-guitar'
  | 'se2-drums-harmony'
  | 'se2-vocals-midi';

export interface MusicBoxOverviewBlock {
  title: string;
  tagline?: string;
  /** Short commercial paragraphs — voiceover / slide copy. */
  paragraphs: readonly string[];
  /** Feature bullets — on-screen callouts. */
  bullets: readonly string[];
  highlight?: boolean;
}

export const MUSIC_BOX_OVERVIEW_MAIN_TABS: readonly {
  id: MusicBoxOverviewMainTabId;
  label: string;
}[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'creation-station', label: 'Creation Station' },
  { id: 'studio-editor-2', label: 'Studio Editor 2' },
  { id: 'mastering-bay', label: 'Mastering Bay' },
  { id: 'vocal-lab', label: 'AI Vocal Lab' },
  { id: 'ai-song', label: 'AI Song Generator' },
  { id: 'ai-music-match', label: 'AI Music Match' },
] as const;

export const CREATION_STATION_OVERVIEW_TABS: readonly {
  id: CreationStationOverviewTabId;
  label: string;
}[] = [
  { id: 'cs-intro', label: 'Overview' },
  { id: 'beat-lab', label: 'Beat Lab' },
  { id: 'groove-lab', label: 'Groove Lab' },
  { id: 'chord-builder', label: 'Chord Builder' },
  { id: '808-lab', label: '808 Lab' },
  { id: 'kit-generator', label: 'Kit Generator' },
  { id: 'chord-bass-seq', label: 'Chord / Bass Seq' },
] as const;

export const STUDIO_EDITOR2_OVERVIEW_TABS: readonly {
  id: StudioEditor2OverviewTabId;
  label: string;
}[] = [
  { id: 'se2-intro', label: 'SE2 Hub' },
  { id: 'se2-beat-pads', label: 'Beat Pads' },
  { id: 'se2-chord-generator', label: 'Chord Generator' },
  { id: 'se2-synth-geno', label: 'Synth Geno' },
  { id: 'se2-ultra-bass-guitar', label: 'Ultra · Bass · Guitar' },
  { id: 'se2-drums-harmony', label: 'Drums & Harmony' },
  { id: 'se2-vocals-midi', label: 'Vocals & MIDI' },
] as const;

/** One short post — copy from Welcome or Copy All in the overview modal. */
export const MUSIC_BOX_OVERVIEW_SOCIAL_BLURB = `Da Muzik Box is a chord-theory-first production suite: sketch in Creation Station, finish the record in Studio Editor 2 — ${MAX_STUDIO_TRACKS} tracks with Beat Pads (VocalBox · Lane Placements · Auto Drum · Pad Spread · Match Chords) as the drum machine on the timeline — then finish loud and clean in Mastering Bay (Bass X → DMB Match → Master X1, live meters, DA-MUZIK BOX presets, Save New Master with cover art). Real grids. Real synths. Real arrangement. Real masters. AI when you want it — your ear stays in control.`;

export const MUSIC_BOX_OVERVIEW_WELCOME: MusicBoxOverviewBlock = {
  title: 'Da Muzik Box — Music Production Suite',
  tagline: 'Sketch. Arrange. Beat Pads on the timeline. Master in the Bay. Your ear stays in control.',
  highlight: true,
  paragraphs: [
    'Da Muzik Box is a complete music production suite for artists, producers, and songwriters who already think in chords, groove, and song form — and want tools that respect that craft instead of hiding it behind one “generate” button.',
    'Creation Station is where ideas start: Beat Lab, Groove Lab, Chord Builder, 808 Lab, Kit Generator, and the Chord/Bass Sequencer. Program pads and synths, build progressions from genre packs, lock key and BPM, and optionally Session-Link labs so one clock drives the station.',
    `Studio Editor 2 is the center of the suite — your full song DAW. Up to ${MAX_STUDIO_TRACKS} dedicated tracks on a ${SE2_ARRANGEMENT_BARS}-bar timeline, Track · Piano · Mix views, and every major tool as its own lane type with its own mixer strip. This is where sketches become records.`,
    '★ BEAT PADS lives inside Studio Editor 2 as the headline drum machine — not a side sketch. Sixteen sample pads, Pattern Bank, Lane Placements (paint Kick / Snare / Hats one lane at a time across Trap, R&B, Drill, Afro, and more), VocalBox (beatbox mouth → grid), Auto Drum (plain English → 16-step groove), Pad Spread (chromatic 808 rolls), and Match Chords so the pocket follows your progression. Slave / Master sync to the SE2 song clock. Duplicate the track to stack a second kit.',
    '★ MASTERING BAY is the finish line. Send Stereo mix → Mastering Bay from SE2 (or drop a WAV/MP3). The rack runs In → Bass X → DMB Match → Master X1 → Out, with optional De-Noise, live meters, DA-MUZIK BOX factory presets, and Save New Master — title, artist, album, ISRC, cover art, 44.1 or 48 kHz. From bounce to streaming-ready file without leaving Da Muzik Box.',
    'Around those two pillars: SE2 Chord Generator (400+ cards, Type & Go, SE2 MIDI Composer), Synth Geno, Drum Generator, Groove Lead, Geno Ultra / Geno Bass / Guitar, 808 Lab, Hum Capture, Audio → MIDI, AI Vocal Lab, and AI Music Match. AI Song Generator is coming soon. AI drafts — you decide every note.',
    'Trap, R&B, gospel, K-Pop, dance, drill, lo-fi, reggae, jazz studies, full vocal records — one environment from first chord to final master. Creation Station to sketch. Studio Editor 2 + Beat Pads to arrange. Mastering Bay to ship.',
  ],
  bullets: [
    '★ BEAT PADS (INSIDE SE2) — 16-pad drum machine · VocalBox · Lane Placements · Auto Drum · Pad Spread · Match Chords · Pattern Bank',
    '★ MASTERING BAY — Bass X → DMB Match → Master X1 · De-Noise · live meters · DA-MUZIK BOX presets · Save New Master',
    `★ STUDIO EDITOR 2 — ${MAX_STUDIO_TRACKS} tracks · ${SE2_ARRANGEMENT_BARS} bars · Track · Piano · Mix · one song clock`,
    '★ CREATION STATION — Beat Lab · Groove Lab · Chord Builder · 808 Lab · Kit Generator · Chord/Bass Sequencer',
    '★ BEAT LAB — CH 1–16 pads + CH 17–32 NEW SYNTH · step grid · kits · metronome-locked transport',
    '★ GROOVE LAB — progression packs · Orchid strip · WaveLeaf · CH 33–48',
    '★ SE2 CHORD GENERATOR — 400+ cards · Type & Go · MIDI Composer (local + BYOK)',
    '★ SYNTH GENO · DRUM GENERATOR · GENO ULTRA / BASS · GUITAR · 808 · HUM CAPTURE',
    '★ AI VOCAL LAB · AI MUSIC MATCH — assist paths into SE2 and Creation Station',
    '★ AI SONG GENERATOR — Coming soon',
    '★ PHILOSOPHY — Chord-theory-first · hands-on production · AI when you want it',
  ],
};

export const MUSIC_BOX_OVERVIEW_BLOCKS: Record<
  MusicBoxOverviewMainTabId | CreationStationOverviewTabId | StudioEditor2OverviewTabId,
  MusicBoxOverviewBlock
> = {
  welcome: MUSIC_BOX_OVERVIEW_WELCOME,

  'creation-station': {
    title: 'Creation Station',
    tagline: 'Where beats, chords, bass, and groove are born — linked, not isolated.',
    paragraphs: [
      'Creation Station is the creative hub of Da Muzik Box. Open it from Modules and choose a sub-lab: Beat Lab for drums and synth lanes, Groove Lab for progression-driven harmony, Chord Builder for theory tools, 808 Lab for trap low end, Kit Generator for drum kits, and Chord/Bass Sequencer for grid-first harmony.',
      'Each lab has its own transport and sound, but Session Link lets you lock BPM, mirror play/stop, and send MIDI between tabs when you stack a beat under a progression or sync an 808 roll to Groove Lab\'s clock.',
      'When you are ready for the full song, export into Studio Editor 2 — where Beat Pads becomes the timeline drum machine, and the finished stereo bounce can go straight to Mastering Bay.',
    ],
    bullets: [
      'Sub-nav: Beat Lab · Groove Lab · Chord Builder · 808 Lab · Kit Generator · Chord/Bass Sequencer',
      'Shared master audio output — one AudioContext, independent transport per lab where needed',
      'Beat Lab ↔ Groove Lab ↔ 808 ↔ Chord Builder session mirrors (optional, user-controlled)',
      'Export to Studio Editor 2 · Beat Pads path · WAV / MIDI · then Mastering Bay for the final file',
    ],
    highlight: true,
  },

  'cs-intro': {
    title: 'Creation Station — how the labs connect',
    tagline: 'One station, many specialized rooms.',
    paragraphs: [
      'Think of Creation Station as a building: Beat Lab is the drum room, Groove Lab is the harmony suite, Chord Builder is the theory desk, 808 Lab is the sub-bass vault. You move between rooms without losing the session tempo or the key you chose.',
      'Most workflows start with either a groove (Groove Lab progression → drop to roll) or a beat (Beat Lab grid → add synth melody on CH 17–32). Chord Builder can feed either side. 808 Lab locks roots to your progression when you want modern trap/sub weight under existing chords.',
    ],
    bullets: [
      'Pick a sub-tab under Creation Station in the left sidebar dropdown',
      'Set project BPM once — linked labs follow when Session Link is on',
      'Use Groove Lab for harmonic foundation; Beat Lab for rhythm and melodic synth lanes',
      'Finish sketches by exporting or sending to Studio Editor 2',
    ],
  },

  'beat-lab': {
    title: 'Beat Lab',
    tagline: 'Sixteen pads. Sixteen synth lanes. One locked transport.',
    paragraphs: [
      'Beat Lab is a full step sequencer and melodic workstation. Channels 1–16 are your drum and sample pads — load producer kits, tune hits, and paint patterns on a grid with verified metronome and playhead sync.',
      'Channels 17–32 are dedicated NEW SYNTH lanes with their own piano rolls, mixer strips, and voice engines — not a single global preset. Import chords from Chord Builder, basslines from the sequencer, or melody from Groove Lab and hear them on real synth voices while the beat runs.',
      'The same pad-and-grid workflow exists inside Studio Editor 2 as the Beat Pads lane type — with VocalBox, Lane Placements, and Match Chords added for full-session production.',
    ],
    bullets: [
      'Step grid with Drumloop-style presets (1–16 bars), per-pad FX, and sample-accurate scheduling',
      'Independent Beat Lab transport (playhead locks to metronome — SE2-mirror pattern)',
      'CH 1–16: drums/samples · CH 17–32: NEW SYNTH melodic lanes with piano rolls',
      'Chord Builder / Groove import paths into synth lanes',
      'Kit Generator loads external drum kits onto the pad grid',
      'Mixer meters, channel volume, and export to Studio Editor 2 or pads',
    ],
    highlight: true,
  },

  'groove-lab': {
    title: 'Groove Lab',
    tagline: 'Progression-first harmony for producers who think in changes.',
    paragraphs: [
      'Groove Lab is built around the idea that great production starts with great harmony. The Progression panel is the flagship: browse genre packs (R&B, Gospel, Reggae, Pop…), audition loops, build an eight-bar timeline, then drop chords to the piano roll as green harmonic layers.',
      'The Orchid chord strip ties theory to the grid — SMART MATCH respects scale degrees, TYPE buttons shape quality, and WaveLeaf / guitar / orchestra panels add melodic and rhythmic color on dedicated channels CH 33–48.',
      'Progression ideas export to Studio Editor 2 as Progression+ timelines on MIDI lanes, or feed SE2 Chord Generator, Drum Generator, Beat Pads Match Chords, and Groove Lead melody generation.',
    ],
    bullets: [
      'Progression: genre packs, 8-bar sketch, timeline BUILD, Rhythm Edit chops',
      'Orchid chord strip + bass keypad + WaveLeaf melody generation',
      '16-channel mixer (CH 33–48) with role assignment: CHORD · GUITAR · LEAD · SAMPLE',
      '808 / Beat Lab session link for synced low end and transport',
      'Drop progression with optional MATCH BASS to follow roots',
      'Full transport bar with tempo strip, MET, and piano-roll playhead',
    ],
    highlight: true,
  },

  'chord-builder': {
    title: 'Chord Builder',
    tagline: 'Theory-aware harmony that feeds the rest of the station.',
    paragraphs: [
      'Chord Builder is the harmonic brain of Creation Station. Analyze progressions, build voicings, preview changes on a keyboard, and send results directly into Beat Lab synth lanes or Groove Lab rolls — without retyping chord symbols.',
      'The same harmonic thinking powers Progression+ inside Studio Editor 2 and feeds SE2 Chord Generator, Drum Generator, and Beat Pads when you link lanes to a progression.',
    ],
    bullets: [
      'Key + mode lock for consistent spelling across exports',
      'Progression paste (`C Am F G`) and step-based chord cards',
      'Import / export paths to Beat Lab NEW SYNTH and Groove Lab',
      'Session Link play mirror with Beat Lab and Groove Lab when enabled',
      'Preview voicings before committing to the grid',
    ],
  },

  '808-lab': {
    title: '808 Lab',
    tagline: 'Trap sub-bass and MPC-style rolls — locked to your groove.',
    paragraphs: [
      '808 Lab is a dedicated low-end laboratory: MPC pad grid, trap and bass presets, filter and drive macros, and optional groove-clock sync from Groove Lab so every 808 hit lands in the same session as your progression.',
      'Studio Editor 2 also has a standalone 808 Lab lane with tone grid, chord lock, and trap pocket generation from harmony — same spirit, full timeline context.',
    ],
    bullets: [
      'Pad-deck MPC with kit banks and per-pad FX',
      'Trap / bass preset lanes with HP/LP shaping',
      'Groove Lab transport mirror and BPM sync strip',
      'Progression root lock for harmonic 808 lines',
      'Export MIDI and audio; mirror play with Session Link',
    ],
  },

  'kit-generator': {
    title: 'Kit Generator → Beat Lab',
    tagline: 'Load real drum kits onto Beat Lab pads.',
    paragraphs: [
      'Kit Generator connects external and bundled drum kits to Beat Lab\'s sixteen pad channels. Browse folders, preview hits, and assign samples to the grid you already program in Beat Lab — no separate drum machine app.',
    ],
    bullets: [
      'Producer kit import path into Beat Lab CH 1–16',
      'Lex / trap / crew kits cached on project drive',
      'Pad assignment persists with the Beat Lab session',
      'Same kits load into SE2 Beat Pads producer browser',
    ],
  },

  'chord-bass-seq': {
    title: 'Chord / Bass Sequencer',
    tagline: 'Step sequenced harmony and bass for grid-first producers.',
    paragraphs: [
      'The Chord / Bass Sequencer gives you a lane-focused view for stacking chord changes and bass motion before they land on Beat Lab or Groove rolls. Use it when you want sequenced harmonic motion separate from the full Orchid progression UI.',
    ],
    bullets: [
      'Dedicated chord-seq tab under Creation Station',
      'Feeds Beat Lab and export paths',
      'Works alongside Chord Builder and Groove Lab — not a replacement',
    ],
  },

  'studio-editor-2': {
    title: 'Studio Editor 2',
    tagline: 'Your full song DAW — Beat Pads on the timeline, harmony lanes around it, then Mastering Bay for the final file.',
    paragraphs: [
      `Studio Editor 2 is where sketches become records. A ${SE2_ARRANGEMENT_BARS}-bar timeline, up to ${MAX_STUDIO_TRACKS} dedicated tracks, one transport clock, three views — Track (arrange), Piano (edit MIDI), and Mix (faders, pan, mute, solo, three FX inserts per lane, master meters). Every major tool is its own lane type: its own row, its own panel, its own mixer strip.`,
      '★ BEAT PADS is the drum machine built into Studio Editor 2. Add a Beat Pads track and you get sixteen sample pads, Pattern Bank, Lane Placements, VocalBox, Auto Drum, Pad Spread, Match Chords, and Slave/Master sync to the SE2 song clock — a full instrument on the arrangement, not a detached sketch room. Open the Beat Pads sub-tab below for the deep walkthrough.',
      'Build the rest of the song on the same clock: SE2 Chord Generator (400+ cards, Type & Go, SE2 MIDI Composer), Synth Geno, Drum Generator, Groove Lead, Rhythm Edit, 808 Lab, Guitar, Bass Glide, Geno Ultra / Geno Bass, Hum Capture, vocals, Audio → MIDI, and Progression+ feeding linked lanes.',
      'When the mix is ready, send Stereo mix → Mastering Bay — Bass X → DMB Match → Master X1 — and Save New Master with metadata and cover art. Arrange here. Finish in the Bay.',
    ],
    bullets: [
      `★ ${MAX_STUDIO_TRACKS} timeline tracks · ${SE2_ARRANGEMENT_BARS} bars · Track · Piano · Mix`,
      '★ BEAT PADS (INSIDE SE2) — VocalBox · Lane Placements · Auto Drum · Pad Spread · Match Chords · Pattern Bank',
      '★ PATH TO MASTERING BAY — Stereo mix → Bass X → DMB Match → Master X1 → Save New Master',
      '★ SE2 CHORD GENERATOR — 400+ cards · Type & Go · MIDI Composer (local + BYOK)',
      '★ SYNTH GENO · DRUM GENERATOR · GENO ULTRA / BASS · GUITAR',
      'Groove Lead · Rhythm Edit · 808 Lab · Bass Glide · Hum Capture · Audio → MIDI',
      'Record vocals · Pitch Tune · Vocoder · My Projects save',
      'Sub-tabs: Beat Pads · Chord Generator · Synth Geno · Ultra · Bass · Guitar · Drums & Harmony · Vocals & MIDI',
    ],
    highlight: true,
  },

  'se2-intro': {
    title: 'Studio Editor 2 — complete production suite',
    tagline: `${MAX_STUDIO_TRACKS} tracks · Beat Pads on the timeline · one clock from first bar to the bounce into Mastering Bay.`,
    paragraphs: [
      `Studio Editor 2 is Da Muzik Box's full song DAW — ${SE2_ARRANGEMENT_BARS} bars, up to ${MAX_STUDIO_TRACKS} dedicated tracks, its own transport, Mix console, loop region, and My Projects save. Built for vocal-heavy sessions and instrument stacks on one mix.`,
      '★ Start with Beat Pads when the pocket matters: add the lane, load a kit, paint with Lane Placements or VocalBox, lock Match Chords to your progression, and keep Slave sync on so drums follow the song. That drum machine is native to SE2 — see the Beat Pads sub-tab for every feature we shipped.',
      'Each specialized lane is one timeline row with its own panel and mixer strip. Duplicate to stack a second Beat Pads kit, a second Geno part, or layered vocals — settings do not bleed across lanes. Progression+ (or SE2 Chord Generator) can drive Beat Pads, Drum Generator, Bass Glide, 808 chord lock, Hum Capture, and Groove Lead from one harmony chart.',
      'Workflow: harmony → Beat Pads pocket → synths / bass / leads → vocals → Mix → Stereo mix → Mastering Bay. Arrange and mix here; polish and export the master in the Bay.',
    ],
    bullets: [
      `★ ${MAX_STUDIO_TRACKS} timeline tracks · ${SE2_ARRANGEMENT_BARS} bars · Track · Piano · Mix`,
      '★ BEAT PADS — native SE2 drum machine · VocalBox · Lane Placements · Auto Drum · Pad Spread · Match Chords',
      '★ AFTER THE MIX — Stereo mix → Mastering Bay (Bass X · DMB Match · Master X1)',
      'Each lane = one row + one panel + one mixer strip — duplicate to stack parts',
      '+ MIDI · + Audio · Beat Pads · SE2 Chord Generator · Synth Geno · Drum Generator',
      'Geno Ultra · Geno Bass · Guitar · Groove Lead · Rhythm Edit · 808 · Hum Capture · A2M',
      'Progression+ links drums, bass, Beat Pads, and leads to one chord timeline',
      'My Projects · verified SE2 transport · master bus meters',
    ],
    highlight: true,
  },

  'se2-beat-pads': {
    title: 'Beat Pads — inside Studio Editor 2',
    tagline: 'The Da Muzik Box drum machine on your song timeline — VocalBox, Lane Placements, Auto Drum, Pad Spread, Match Chords.',
    paragraphs: [
      'Beat Pads is a dedicated Studio Editor 2 track type: a complete drum machine living on the arrangement. Sixteen sample pads, producer kit browser (Trap Kit, folder import), per-pad drive/filter/color FX, a 16-lane step sequencer (4/8/16-bar loops, 16th or 32nd grid), Pattern Bank with full genre loops, A/B pattern slots, its own mixer strip, and Export loop WAV. Sync to SE2: Slave (follow the song — recommended), Master (push BPM), or Off (local loop).',
      'Lane Placements paints drums one lane at a time. Highlight a sequencer row, pick Kick / Snare / Clap / Hi-Hat / Open Hat / Rim, then a genre — Trap, R&B, Pop, Drill, Lo-Fi, K-Pop, Soul Blues, Afro, Reggae, House, and more. Tap a card to drop a real groove on that lane only; Regen rolls another in the same family. Auto Drum takes plain English — “trap hi-hat roll bpm 140”, “boom bap snare”, “afro kick” — and writes a 16-step line on the highlighted row.',
      'VocalBox turns your mouth into the drummer. Load kick/snare/hat/clap samples, set BPM and quantize, count-in + metronome, then beatbox. Hits land on a visual grid; preview through real samples, nudge timing, merge into the step pattern — a human pocket without clicking every step.',
      'Pad Spread chromaticizes one sample on internal CH 17–32 without touching the main 16 pads. ↓16 / ↑16 semitone rows, 2/4/8-bar mini roll, optional 808 in key from matched chords, export MIDI/WAV to another SE2 track.',
      'Match Chords links Beat Pads to Progression+, Rhythm Edit, SE2 Chord Generator, or Synth Geno — BPM, loop bars, song key, style chips, kick key lock, regenerate pad to chord rhythm. Duplicate the Beat Pads track to stack a second kit. When the whole song is balanced, bounce the stereo mix into Mastering Bay.',
    ],
    bullets: [
      '★ INSIDE STUDIO EDITOR 2 — dedicated Beat Pads lane · own mixer strip · SE2 song clock',
      '★ VOCALBOX — beatbox → kick/snare/hat/clap · count-in · quantize · hit map · merge to grid',
      '★ LANE PLACEMENTS — Kick/Snare/Clap/Hat/Rim · Trap/R&B/Drill/Afro/Reggae/House… · Regen',
      '★ AUTO DRUM — plain-English phrase → 16-step groove on selected lane',
      '★ PAD SPREAD — chromatic roll CH 17–32 · 808 in key · export MIDI/WAV',
      '16 pads · producer kits · Pattern Bank · A/B slots · per-pad FX',
      'Match Chords · Sync Slave/Master/Off · Export loop WAV · duplicate for second kit',
      '★ NEXT STEP — Stereo mix → Mastering Bay for Bass X · DMB Match · Master X1',
    ],
    highlight: true,
  },

  'se2-chord-generator': {
    title: 'SE2 Chord Generator',
    tagline: 'Harmony command center — 400+ cards, Type & Go compose, and SE2 MIDI Composer on your timeline.',
    paragraphs: [
      'SE2 Chord Generator is a dedicated harmonic lane — add it from the track menu and it becomes your song\'s chord brain, not a generic MIDI row. Dock the panel to sketch 4- or 8-bar chord card rows on a mini roll, audition with SE2 transport sync, save your own patterns, then export cards and MIDI to the lane piano roll when the progression feels right. Every other linked lane — Beat Pads Match Chords, Drum Generator, Bass Glide, 808 chord lock, Groove Lead, Hum Capture — can follow what you build here.',
      'The preset catalog is massive: 400+ progression cards from genre packs. Browse, hit Generate for a fresh take, and read labels formatted in your chosen key. Geno Chord Creator Wheel sets key and mode; Wheel style picks genre voicing. Save, rename, and recall your own progressions — your harmonic library grows with every session.',
      'Type & Go is the fast path. Type plain English — “sad R&B 8 bars in D minor”, “gospel lift in Ab”, “dark trap chords 4 bars” — and the engine matches genre, key, bar count, BPM, and passing-chord color. Go applies; Regen tries another take without retyping. Passing chord tools add movement inside the bar without breaking the loop.',
      'SE2 MIDI Composer is the AI-assisted layer on top. Toggle it on in the panel: chat-style prompt plus controls for Key, Scale, Type, Length (4–32 bars), Genre, and note grid. Types: Chords (card rows), Melody, Lead, Bass, or Full arrangement (cards + top-line melody). Workflow: Generate → Preview → Regenerate → Go Back → Apply to Roll. Hear it first, commit when it fits.',
      'Providers: Da Muzik Box local engine (no API key), Gemini, Grok, OpenAI, or Custom API — bring your own key via Set, stored on your device only. Cloud failure falls back to the local engine automatically. Your ear stays in control; AI drafts harmony and MIDI you still edit note by note on the roll.',
    ],
    bullets: [
      'Dedicated harmonic lane — chord cards + piano roll on one timeline row',
      '400+ preset progression cards · genre packs · Generate fresh takes',
      'Geno Chord Creator Wheel — key/mode · Wheel style voicing · user-saved patterns',
      '★ TYPE & GO — plain English → matched progression · passing chords · Regen',
      '★ SE2 MIDI COMPOSER — Chords · Melody · Lead · Bass · Full arrangement',
      'Generate → Preview → Apply to Roll · 4–32 bars · SE2 transport sync',
      'Providers: Da Muzik Box (local) · Gemini · Grok · OpenAI · Custom API (BYOK)',
      'Feeds Beat Pads · Drum Generator · Bass Glide · 808 · Groove Lead across session',
    ],
    highlight: true,
  },

  'se2-synth-geno': {
    title: 'Synth Geno',
    tagline: 'The flagship harmonic synth — Geno Build, Fusion / Note Flex, and a real Web Audio voice per lane.',
    paragraphs: [
      'Synth Geno is a dedicated SE2 lane for producers who think in chords first. Add it from the track menu — each instance gets its own Web Audio voice, patch, prompts, and mixer strip. Duplicate the track to stack a second Geno part; nothing bleeds between lanes.',
      'Geno Build 1: live chord pads with genre-tuned voicings and one-key triggers, plus an 8-bar loop editor where chords, arp, and bass preview together. Hear the loop, tweak voicing, Apply to roll. Lock Groove Lead spins up a Groove Lead lane locked to your Geno progression — silky top line on its own track.',
      'Geno Build 2: 4- or 8-bar progression loop editor. Era and genre progression triggers, dual-keyboard input, chord cards matched to loop length. Preview the full harmonic stack, then apply chords, melody, and bass onto the lane in one pass.',
      'Fusion / Note Flex: Sound field shapes the synth patch (tone, filter, timbre); Prompt field drives 8-bar MIDI on Pad, Melody, and Bass roll lanes. SpaceWalk macros — Richness, Flow, Smoothness — and character chips (Gentle, Luminous, Cinematic…) steer feel. Generate sound only, Create MIDI only, or full Fusion for patch + notes together. Note Flex adds per-note pitch curves. Preview, export MIDI/audio, Apply → Roll.',
      'Link Drum Generator to the same Geno lane so drums inherit your harmonic context. Offline audio render from the Fusion roll. Example prompt chips and per-lane sound pickers keep the workflow fast on the timeline.',
    ],
    bullets: [
      'Dedicated lane · own Web Audio voice per track · duplicate to stack parts',
      '★ GENO BUILD 1 — live chord pads · 8-bar loop (chords + arp + bass) · Apply to roll · Lock Groove Lead',
      '★ GENO BUILD 2 — 4/8-bar progression cycles · era/genre triggers · apply chords, melody & bass',
      '★ FUSION / NOTE FLEX — Sound (patch) + Prompt (MIDI) · SpaceWalk macros · Pad/Melody/Bass roll',
      'Note Flex per-note pitch curves · Generate · Preview · Apply → Roll · export MIDI/audio',
      'Links to Drum Generator · Groove Lead bridge from Build 1/2 progressions',
    ],
    highlight: true,
  },

  'se2-ultra-bass-guitar': {
    title: 'Geno Ultra · Geno Bass · Guitar',
    tagline: 'Three powerhouse instrument lanes — deep subtractive synths and real sampled guitar on the timeline.',
    paragraphs: [
      'Geno Ultra Synth, Geno Bass Synth, and Guitar are dedicated SE2 track types — each one gets its own timeline row, its own docked panel, its own Web Audio or sampled voice, and its own mixer strip. Duplicate any of them to stack a second lead, a sub layer, or a rhythm guitar part without sharing presets across lanes.',
      'Geno Ultra Synth is the grid-style subtractive beast — separate from Synth Geno’s chord-builder workflow. Three oscillators, multi-mode filter with drive, amp and filter envelopes, two LFOs, and an 8-slot mod matrix for routing velocity, envelopes, and LFOs into pitch, filter, and level. Factory banks cover lead, pad, bass, pluck, and keys — plus derived variations so you are not stuck on one timbre. Draw on the piano roll or fire Preview C4 to audition through the lane strip. Built-in ARP: polyphonic step sequencer, chord import from Progression+ or other SE2 lanes, style presets, bar length and variation controls — arpeggios that follow your session harmony. Clear notes wipes roll MIDI only; your patch stays on the track.',
      'Geno Bass Synth uses the same subtractive engine, tuned for low end. Fifty-five factory bass sounds grouped for fast browsing: Mooga, Retro Box, FM / Digital, analog, sub / 808, funk, and cinematic hits. Warm wood-grain panel with a focused bass UI — filter, amp, sub oscillator, bass keyboard for preview, patch label, and user saves. Register C1–G3 on the piano roll; each lane keeps its own preset id and mixer routing. Stack Geno Bass under Geno Ultra pads, 808 Lab, or Bass Glide for layered low end on the same song.',
      'Guitar is a full sampled-guitar workstation on the timeline — not a generic MIDI instrument. Loop player: pick genre (R&B, country, funk, blues, rock), choose 4- or 8-bar length, tap a preset card to drop a complete part at the playhead — neo-soul cycles, blues turnarounds, Key to the Highway-style forms, each card showing chord feel and length with matching tone applied automatically. Strummer panel for chord strums and rhythmic comping. Quick licks drop one-bar fills; draw custom lines on the piano roll after insert. Multiple guitar instruments and rig presets (clean, driven, chorus-washed) with Drive, Chorus, and Reverb on the lane for preview and transport. Transpose shifts playback without redrawing notes; fretboard visualization follows what you play. Transport schedules through the lane mixer strip like every other SE2 instrument.',
      'All three link into the same harmony ecosystem: Progression+, SE2 Chord Generator, Rhythm Edit, and Synth Geno can feed chord context for ARP import, bass root lock, or guitar placement. Record, edit in Piano, balance in Mix — real instruments on a real arrangement clock.',
    ],
    bullets: [
      '★ GENO ULTRA SYNTH — 3 OSC · filter · 2 LFOs · 8-slot mod matrix · lead/pad/pluck/keys',
      'ARP step sequencer · chord import from SE2 lanes · style presets · bar length & variation',
      'Preview C4 · factory + derived presets · duplicate lane for second lead or pad',
      '★ GENO BASS SYNTH — 55 sounds · Mooga · Retro Box · FM · analog · sub/808 · funk · cinematic',
      'C1–G3 bass register · sub osc · bass keyboard preview · user patch saves',
      '★ GUITAR LANE — loop player R&B/country/funk/blues/rock · 4/8-bar preset cards',
      'Strummer · Quick licks · piano-roll edits · rig presets · Drive/Chorus/Reverb FX',
      'Transpose · fretboard view · Test tone · own mixer strip per guitar track',
      'Each lane = one timeline row — stack leads, bass, and rhythm guitar on one mix',
    ],
    highlight: true,
  },

  'se2-drums-harmony': {
    title: 'Drums, Leads & Harmony Lanes',
    tagline: 'Drum Generator, Groove Lead, Rhythm Edit, 808 Lab, Guitar, Bass Glide — all on the same timeline, locked to your chords.',
    paragraphs: [
      'Drum Generator is its own SE2 lane on MIDI channel 10. Pick a style — Pop, R&B, Trap, K-Pop, Gospel, Dance, Disco, Dark — and Generate drums tiles a 4-bar loop from producer pattern libraries. Bank 2 adds Drill, Lo-Fi, Dance, and K-Pop grooves matched to a linked chord lane. Match cards pick Synth Geno or Progression+ after Apply MIDI. Swap all 16 pad sounds from producer kits; Re-roll and Variation add ghost notes and syncopation. Link to SE2 Chord Generator, Rhythm Edit, Bass Glide, and Groove Lead so the pocket follows your harmony.',
      'Groove Lead is the R&B and gospel synth lead lane — WaveLeaf engine with presets like R&B Silk, Gospel Cry, and Neo Glide. Draw melodies C5–C6 or Generate melody from Progression+ or Rhythm Edit. Lock Groove Lead from Synth Geno Build 1/2 for a top line that already knows your changes. Each lane keeps its own preset, glide, filter, and mixer strip.',
      'Rhythm Edit turns chord symbols into hit patterns: card rows above the piano roll, HITS (1×–4×) and BEAT grids per chord, + Chord or Paste (`C Am F G`), copy FROM another lane, set LOOP bars, Apply to roll chops cards into separate piano-roll strikes. Perfect when you want rhythmic chord comping, not just sustained pads.',
      '808 Lab on SE2: 808 Kick and Bass Low presets, HP/LP filters, 16 chromatic tone pads, 16th-note tone grid (4/8/16 bars), chord lock from song key or any harmony track, Generate roots and Regenerate trap pocket, export MIDI/WAV, bounce To roll or To track.',
      'For Geno Ultra Synth, Geno Bass Synth, and the Guitar lane — full subtractive synths and sampled guitar loops on their own tracks — see the Ultra · Bass · Guitar sub-tab.',
    ],
    bullets: [
      '★ DRUM GENERATOR — Pop · Trap · K-Pop · R&B · Dance · Drill · Lo-Fi · chord-matched Bank 2',
      '16 pad sound swap · Re-roll · Variation slider · Drum pat preset load',
      '★ GROOVE LEAD — WaveLeaf R&B/gospel lead · melody from Progression+ · Lock from Synth Geno',
      '★ RHYTHM EDIT — chord cards · hit patterns · Apply to roll · copy from other lanes',
      '808 Lab SE2 lane — tone grid · chord lock · trap pocket gen · MIDI/WAV export',
      'Bass Glide synth bass + harmony sync',
      '★ Geno Ultra · Geno Bass · Guitar — see Ultra · Bass · Guitar tab',
      'Progression+ on MIDI lanes feeds all of the above from one chord timeline',
    ],
    highlight: true,
  },

  'se2-vocals-midi': {
    title: 'Vocals, Hum Capture & Audio → MIDI',
    tagline: 'Record, hum, convert, and align — vocals and clips on the same timeline as your beats and chords.',
    paragraphs: [
      'Hum Capture is a dedicated SE2 lane: mic, pitch scope, and melody roll synced to the piano roll below. Twelve key pads, key lock, scale, Match chords to Progression+, Rhythm Edit, SE2 Chord Generator, or Synth Geno. Pick an instrument — piano, guitar, brass, synth — and transport plays through the lane mixer strip. Sing or hum; notes land on the roll ready to edit.',
      '+ Aud lanes are for vocals, references, and bounces. Arm Record Enable (R) on the mixer strip, choose mic input, hit transport Record — takes appear as clips you drag, trim, and layer across bars. Pitch Tune and Vocoder FX live on the audio strip.',
      'Track Align time-stretches imported audio to the session grid — detected BPM on drop keeps vocals and samples on the bar lines without manual warping.',
      'Audio → MIDI (A2M): drop a clip, convert in Melodic, Bass line, or Drums mode. Clip-level conversion with detected key and BPM; notes map to project tempo. Use the result as a harmony source for Geno Ultra, Geno Bass, Guitar, and other lanes.',
      'Import desktop audio by drag-drop onto a lane. Neural Hum MIDI from Vocal Lab lands on the timeline (+ optional WAV reference). Consolidate track clips, bounce loops, hardware MIDI out per instrument lane — all inside the same SE2 session. For deep copy on Geno Ultra Synth, Geno Bass Synth, and Guitar, open the Ultra · Bass · Guitar sub-tab.',
    ],
    bullets: [
      '★ HUM CAPTURE — sing/hum → melody roll on timeline · key lock · Match chords',
      'Record vocals on + Aud lanes · Pitch Tune · Vocoder · per-strip mic input',
      'Track Align — time-stretch audio to session grid · detected BPM on import',
      '★ AUDIO → MIDI — Melodic · Bass line · Drums modes per clip',
      '★ Geno Ultra · Geno Bass · Guitar — full instrument copy on dedicated sub-tab',
      'Neural Hum from Vocal Lab · consolidate · hardware MIDI out',
    ],
    highlight: true,
  },

  'mastering-bay': {
    title: 'Mastering Bay',
    tagline: 'Finish the record after Studio Editor 2 — Bass X, DMB Match, Master X1, then Save New Master.',
    paragraphs: [
      'Mastering Bay is Da Muzik Box\'s dedicated mastering workstation — the polish step after you arrange and mix in Studio Editor 2 (including Beat Pads on the timeline). Load a stereo bounce along the bottom — drag WAV or MP3, or send **Stereo mix → Mastering Bay** straight from SE2. Top meters show peak, RMS, and loudness-style readouts live; a VU sidebar watches levels while you work the rack.',
      'The chain is built for modern production: **In → Bass X → DMB Match → Master X1 → Out**. Optional **De-Noise** cleans broadband hiss and click/pop — place it before or after Master X1 for home recordings and older samples.',
      '**Bass X (BassOne)** shapes low end first: **Sub**, **Drive**, and **Tone** — sub lift, analog-style drive, harmonics, focus, output. Tighten 808s and kick weight from your Beat Pads / 808 Lab sessions without blowing the ceiling.',
      '**DMB Match (DaMatch)** is reference-style matching: match amount, tone, dynamics, loudness, and stereo width against built-in commercial feels (Streaming, Club Punch, Vintage Warm, CD Master, and more).',
      '**Master X1 (FastMaster)** is final polish — EQ, transients, compression, stereo imaging, and limiting. Loudness targets from −5 to −10 dBFS; optional **X1 Loud** drives harder into the limiter with peaks kept safe.',
      'Factory **DA-MUZIK BOX** presets: Club Ready, Streaming Clean, Warm Low End, Radio Loud, Trap 808 Punch, Hip-Hop Headroom, R&B Smooth / Velvet / Urban, Pop, K-Pop, EDM Festival, Drill Dark, Afrobeat Glow, Lo-Fi, Apple Safe, YouTube Punch, and many more. Save and rename your own — they sit beside factory masters.',
      'Source clip gain (drag vertically on the clip), waveform, transport, seek, and scrub while the rack processes in real time.',
      '**Save New Master** exports the finished file with title, artist, album, ISRC, optional cover art, and 44.1 or 48 kHz. Workflow: SE2 mix (Beat Pads + instruments + vocals) → Mastering Bay → preset or hand-tune → meters → Save New Master. From arrangement to shipping file inside Da Muzik Box.',
    ],
    bullets: [
      '★ AFTER STUDIO EDITOR 2 — Stereo mix → Mastering Bay (works with Beat Pads sessions)',
      '★ SIGNAL CHAIN — In → Bass X → DMB Match → Master X1 → Out · De-Noise optional',
      '★ BASS X — Sub · Drive · Tone · sub lift · harmonics · low-end focus',
      '★ DMB MATCH — reference match · tone · dynamics · loudness · stereo width',
      '★ MASTER X1 — EQ · transients · compress · stereo · limit · X1 Loud',
      'Live meters + VU sidebar · real-time rack while you play',
      'DA-MUZIK BOX presets — Club · Streaming · Trap · R&B · Pop · K-Pop · Drill · Lo-Fi…',
      'User presets — save / rename alongside factory',
      '★ SAVE NEW MASTER — title · artist · album · ISRC · cover art · 44.1/48 kHz',
    ],
    highlight: true,
  },

  'vocal-lab': {
    title: 'AI Vocal Lab',
    tagline: 'Hum it. Capture it. Transform it. Send it to the song.',
    paragraphs: [
      'AI Vocal Lab turns ideas in your voice into production assets. Neural Hum listens to you sing or hum a melody, converts pitch to MIDI, and routes it to Studio Editor 2 or back into Creation Station — Groove Lab or Beat Lab NEW SYNTH — so harmony tools wrap around what you actually sang.',
      'Inside Studio Editor 2, Hum Capture lanes use the same capture philosophy on the timeline. Melody-to-MIDI and Harmony Match extend the assist: transcription and voicing suggestions that fit your key — not a replacement for your ear.',
    ],
    bullets: [
      'Neural Hum — mic capture → melody MIDI + optional render WAV',
      'Send to Studio Editor 2 or Creation Station (Groove / Beat Lab synth)',
      'SE2 Hum Capture lane — melody roll on timeline with Match chords',
      'Melody-to-MIDI transcription sub-tool',
      'Harmony Match — suggest changes that fit your key and progression',
      'Vocal tracks panel, enhancement, WAV/MP3 export',
    ],
    highlight: true,
  },

  'ai-song': {
    title: 'AI Song Generator',
    tagline: 'Coming soon — not included in Basic or Premium at launch.',
    paragraphs: [
      'AI Song Generator is marked Coming soon on the pricing page and is not part of the launch packages. The menu name stays while a new generator is designed.',
      'Until it ships, use Creation Station, Groove Lab, SE2 Chord Generator, SE2 MIDI Composer, AI Music Match, Beat Pads inside Studio Editor 2, and Mastering Bay for write → arrange → finish.',
    ],
    bullets: [
      '★ COMING SOON — not in Basic or Premium at launch',
      'Menu entry preserved for the future generator',
      'Today: AI Music Match · SE2 MIDI Composer · Beat Pads · Mastering Bay',
    ],
    highlight: true,
  },

  'ai-music-match': {
    title: 'AI Music Match',
    tagline: 'Vocal stem in, matched chords + bass out.',
    paragraphs: [
      'Upload a vocal or melody stem. We detect the key, then suggest chord progressions and a matching bass line shaped by genre and mood. Chords + bass only; no drums.',
      'Tap a match to load chords and bass in Groove Lab — then export to Studio Editor 2 for full arrangement with Beat Pads, Drum Generator, and Synth Geno on the same timeline.',
    ],
    bullets: [
      'Drag & drop WAV/MP3 stems',
      'Based on: Vocals · Instruments · Bass · Full mix',
      'Auto key detection from your audio',
      'Genre + mood for chord and bass feel',
      'One tap → Groove Lab (chords + bass) → Studio Editor 2',
    ],
    highlight: true,
  },
};

export const MUSIC_BOX_OVERVIEW_STORAGE = 'da-music-box-overview-seen-v1';

/** Plain-text for one overview block — copy current tab. */
export function musicBoxOverviewBlockPlainText(block: MusicBoxOverviewBlock): string {
  const lines: string[] = [block.title];
  if (block.tagline) {
    lines.push(block.tagline);
  }
  lines.push('');
  for (const p of block.paragraphs) {
    lines.push(p);
    lines.push('');
  }
  if (block.bullets.length) {
    lines.push('— Highlights —');
    for (const b of block.bullets) {
      lines.push(`• ${b}`);
    }
  }
  return lines.join('\n').trim();
}

type OverviewContentKey =
  | MusicBoxOverviewMainTabId
  | CreationStationOverviewTabId
  | StudioEditor2OverviewTabId;

const OVERVIEW_EXPORT_ORDER: readonly { heading: string; key: OverviewContentKey }[] = [
  { heading: 'WELCOME', key: 'welcome' },
  { heading: 'CREATION STATION', key: 'creation-station' },
  { heading: 'CREATION STATION — OVERVIEW', key: 'cs-intro' },
  { heading: 'BEAT LAB', key: 'beat-lab' },
  { heading: 'GROOVE LAB', key: 'groove-lab' },
  { heading: 'CHORD BUILDER', key: 'chord-builder' },
  { heading: '808 LAB', key: '808-lab' },
  { heading: 'KIT GENERATOR', key: 'kit-generator' },
  { heading: 'CHORD / BASS SEQUENCER', key: 'chord-bass-seq' },
  { heading: 'STUDIO EDITOR 2', key: 'studio-editor-2' },
  { heading: 'SE2 — COMPLETE PRODUCTION SUITE', key: 'se2-intro' },
  { heading: 'SE2 — BEAT PADS (INSIDE STUDIO EDITOR 2)', key: 'se2-beat-pads' },
  { heading: 'SE2 — CHORD GENERATOR & MIDI COMPOSER', key: 'se2-chord-generator' },
  { heading: 'SE2 — SYNTH GENO', key: 'se2-synth-geno' },
  { heading: 'SE2 — GENO ULTRA · GENO BASS · GUITAR', key: 'se2-ultra-bass-guitar' },
  { heading: 'SE2 — DRUMS & HARMONY LANES', key: 'se2-drums-harmony' },
  { heading: 'SE2 — VOCALS & MIDI', key: 'se2-vocals-midi' },
  { heading: 'MASTERING BAY', key: 'mastering-bay' },
  { heading: 'AI VOCAL LAB', key: 'vocal-lab' },
  { heading: 'AI SONG GENERATOR', key: 'ai-song' },
  { heading: 'AI MUSIC MATCH', key: 'ai-music-match' },
];

/** Plain-text export — social blurb + every section (copy everything). */
export function musicBoxOverviewAllPlainText(): string {
  const lines: string[] = [
    'DA MUZIK BOX — PRODUCT OVERVIEW',
    'Complete suite guide — Creation Station, Studio Editor 2 (Beat Pads), Mastering Bay, Vocal Lab, AI tools',
    '',
    '══════════════════════════════════════',
    'COPY FOR SOCIAL / PITCH',
    '══════════════════════════════════════',
    MUSIC_BOX_OVERVIEW_SOCIAL_BLURB,
    '',
  ];
  for (const { heading, key } of OVERVIEW_EXPORT_ORDER) {
    const block = MUSIC_BOX_OVERVIEW_BLOCKS[key];
    lines.push('══════════════════════════════════════');
    lines.push(heading);
    lines.push('══════════════════════════════════════');
    lines.push('');
    lines.push(musicBoxOverviewBlockPlainText(block));
    lines.push('');
  }
  return lines.join('\n').trim();
}

/** Plain-text for the currently visible tab (including Creation Station / SE2 sub-tabs). */
export function musicBoxOverviewCurrentPlainText(opts: {
  mainTab: MusicBoxOverviewMainTabId;
  creationTab?: CreationStationOverviewTabId;
  se2Tab?: StudioEditor2OverviewTabId;
}): string {
  let key: OverviewContentKey = opts.mainTab;
  if (opts.mainTab === 'creation-station' && opts.creationTab) {
    key = opts.creationTab;
  } else if (opts.mainTab === 'studio-editor-2' && opts.se2Tab) {
    key = opts.se2Tab;
  }
  return musicBoxOverviewBlockPlainText(MUSIC_BOX_OVERVIEW_BLOCKS[key]);
}
