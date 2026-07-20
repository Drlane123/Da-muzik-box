/** Studio Editor 2 — DAW arrange, record, import, and mix a complete song. */

import { MAX_STUDIO_TRACKS } from '@/app/lib/studio/se2ArrangementConstants';
import {
  SE2_SYNTH_GENO_BUILD_1_LABEL,
  SE2_SYNTH_GENO_BUILD_2_LABEL,
  SE2_SYNTH_GENO_BUILD_TAB_LABEL,
  SE2_SYNTH_GENO_FUSION_NOTE_FLEX_LABEL,
} from '@/app/lib/studio/se2SynthGenoFusionEngine';

export type StudioEditor2HelpTabId =
  | 'overview'
  | 'timeline'
  | 'record'
  | 'import'
  | 'piano'
  | 'mixer'
  | 'transport'
  | 'rhythmEdit'
  | 'grooveLead'
  | 'lab808'
  | 'genoUltraSynth'
  | 'genoBassSynth'
  | 'synthGeno'
  | 'fusionSound'
  | 'fusionPrompt'
  | 'drumGenerator'
  | 'beatPadsSe2'
  | 'humCapture'
  | 'guitar';

export interface StudioEditor2HelpSubsection {
  title: string;
  lines: readonly string[];
}

export interface StudioEditor2HelpSection {
  id: StudioEditor2HelpTabId;
  label: string;
  title: string;
  highlight?: boolean;
  lines: readonly string[];
  /** Optional grouped topics — used for long guides (e.g. Beat Pads in SE2). */
  subsections?: readonly StudioEditor2HelpSubsection[];
}

export const STUDIO_EDITOR2_HELP_SECTIONS: readonly StudioEditor2HelpSection[] = [
  {
    id: 'overview',
    label: 'Start',
    title: 'Studio Editor 2 — your song DAW',
    lines: [
      'This is the arrange-and-mix workspace — where beats, vocals, and MIDI become a full song.',
      'Creation Station, Vocal Lab, and other labs export here when you are ready to assemble.',
      'Track view = timeline lanes; Piano = note editor for the selected MIDI track; Mix = channel strips.',
      `Up to ${MAX_STUDIO_TRACKS} timeline tracks (room for many vocal/audio lanes plus Beat Pads, Synth Geno, drums, and other plugin lanes), long-form bar count, loop region, and shared transport clock.`,
      'Workflow: import or record → arrange clips on the timeline → edit in Piano → balance in Mix → export onward.',
    ],
  },
  {
    id: 'timeline',
    label: '★ Arrange',
    title: 'Timeline & track lanes',
    highlight: true,
    lines: [
      'Track view is the arranger — every lane is a MIDI or audio track with clips placed in time.',
      '+ MIDI adds an empty note lane; + Aud adds an audio lane for vocals, bounces, and imports.',
      'Click a track name to select it; the playhead and piano roll follow the selected lane.',
      'MIDI notes show as colored blocks; audio shows as waveform clips you can drag along the grid.',
      'Drag audio files onto an audio track header or lane to drop a new clip at the playhead.',
      'Right-click timeline regions for clip tools; resize lane height with the handle at the lane bottom.',
    ],
  },
  {
    id: 'record',
    label: 'Record',
    title: 'Vocals & audio lanes',
    lines: [
      'Add an **+ Aud** track for vocals — audio clips live on the timeline, not in the piano roll.',
      'In **Mix**, tap the red **R** on an audio strip to arm Record Enable for that input.',
      'Pick mic/line input per audio strip (mic icon) or use Settings → Audio Input as project default.',
      'Transport **mic** only arms record (red) — it does not play or capture. Hit **Play** to start the take (optional **Pre** count-in).',
      'Recorded or imported vocal takes stack as clips you can move, trim, and layer across bars.',
    ],
  },
  {
    id: 'import',
    label: 'Import',
    title: 'Bring labs into Studio 2',
    lines: [
      '**Vocal Lab** → Studio Editor 2 sends Neural Hum MIDI (+ optional rendered WAV reference).',
      'Vocal Lab / other screens **To Studio Editor 2** drop audio blobs on the first audio track.',
      'Creation Station exports (pads, patterns, hums) can land here when you pick Studio as the destination.',
      'Drag any audio file from your desktop onto an audio lane to import at the current playhead.',
      'Drop audio onto a lane and convert to MIDI when you want a monophonic note lane from a take.',
    ],
  },
  {
    id: 'piano',
    label: 'Piano',
    title: 'Piano roll editor',
    lines: [
      'Open **Piano** for the selected MIDI track — paint, select, erase, and resize notes.',
      'Tools: pointer (select/move), pencil (draw), eraser — snap grid follows the quantize setting.',
      'Quantize, transpose, humanize, legato, and phrase tools edit the current selection.',
      'Velocity lane under the grid; ghost notes and scale guides optional in the toolbar.',
      'Audio tracks show a message here — switch to Track view to edit their waveform clips instead.',
    ],
  },
  {
    id: 'mixer',
    label: 'Mix',
    title: 'Channel mixer',
    lines: [
      '**Mix** opens per-track faders, pan, mute, solo, and three FX insert slots.',
      'Master strip on the right — same dB scale as channel faders; meters show peak level while playing.',
      'Audio strips: **R** = record arm, mic menu = input device, **M** / **S** = mute / solo.',
      'Mono toggle collapses stereo pan on a strip; FX dropdowns are per-channel inserts (UI routing).',
      'Resize the mixer panel with the drag handle at the top edge of the mix section.',
    ],
  },
  {
    id: 'transport',
    label: 'Play',
    title: 'Transport & loop',
    lines: [
      '▶ Play / Pause runs the full arrangement — MIDI, audio clips, and metronome share one clock.',
      'RTZ (skip back) returns to bar 1; rewind/ff nudge one bar when stopped.',
      'BARS / TIME readouts follow the playhead; BPM ± and time signature live in the transport strip.',
      'Loop toggle + draggable loop braces on the ruler constrain playback to a section.',
      'Metronome click follows the same grid as the playhead — toggle in the transport cluster.',
      'Spacebar toggles play/pause when focus is not in a text field or piano key strip.',
    ],
  },
  {
    id: 'rhythmEdit',
    label: 'Rhythm',
    title: 'Rhythm Edit lane — hits per bar',
    highlight: true,
    lines: [
      'Add a **Rhythm Edit** track from the track-type menu — it is its own lane, not a MIDI add-on.',
      'Build chord **cards** above the piano roll: chord symbol, length (¼ · ½ · 1 bar), and which beats fire.',
      '**HITS** (1×–4×) and **BEAT** (1+3, 2+4, all four…) control how many times each chord strikes inside a bar.',
      '**+ Chord** or **Paste** (`C Am F G`) stacks steps on the rhythm timeline; **▶** on a card previews one chord.',
      '**FROM / Copy** pulls MIDI notes or chord steps from another lane into this rhythm lane.',
      '**LOOP** sets how many bars **Apply to roll** paints; then click **Apply to roll** to chop cards into separate piano-roll hits.',
      '**Clear notes** wipes the roll only — your rhythm cards stay so you can re-apply without rebuilding.',
      'Pick an instrument in the piano-roll toolbar or mixer; transport plays the baked MIDI like any melodic lane.',
    ],
  },
  {
    id: 'grooveLead',
    label: 'Lead',
    title: 'Groove Lead lane — R&B / gospel synth',
    highlight: true,
    lines: [
      'Add **Groove Lead** from the track-type menu — same WaveLeaf synth engine as Groove Lab, as its own channel.',
      'Open the docked panel above the piano roll: preset banks (R&B Silk, Gospel Cry, Neo Glide…), macros, preview keys.',
      'Draw lead melodies on the piano roll (default register C5–C6); duplicate the track for a second lead layer.',
      '**Chords from** links a Progression+ or Rhythm Edit lane so **Generate melody** knows your harmony.',
      'Each Groove Lead lane keeps its own preset, glide, filter, and output — lanes do not share one global sound.',
      '**Clear notes** removes roll MIDI only; synth settings and preset stay on the track.',
      'Transport schedules the WaveLeaf voice through the lane mixer strip (volume, pan, FX like other MIDI tracks).',
    ],
  },
  {
    id: 'lab808',
    label: '808',
    title: '808 Lab — trap kick & bass synth',
    highlight: true,
    lines: [
      'Add **808 Lab** from the track-type menu — trap 808 kick and bass-low synth on its own SE2 channel (same engine as Creation Station, standalone here).',
      '**808 Kick** / **Bass Low** — switch lane, pick a trap-kick or bass-low preset, set output level, and tune **HP/LP** filters (live filter graph under the pads).',
      '**Tone pads** — 16 chromatic pads (8×2); **Oct− / Oct+** shifts range. Strike pads to preview; chord-locked pads show root chord labels.',
      '**Chord lock** — follow **song key**, a chosen **key**, or a harmony **track** (Progression+, Rhythm Edit, Synth Geno, Glide Bass, Groove Lead, Geno Ultra, SE2 Chord Generator…).',
      '**Root scope** dial shows the active key and progression roots; pick a root to highlight it on the grid.',
      '**Generate roots** writes harmony roots onto the **tone grid**; **Regenerate** keeps the same key/roots but rolls a new pocket for the selected **Genre** (sparse kicks + breathing 808 root hits — not melodic runs).',
      '**Genre** — Trap · R&B · K-pop · Dance · Hip-hop · Drill · **Dark** · **Sci-fi** — changes kick/808 pocket feel (not the synth sound). Dark/Sci-fi use cinematic sparse hits and darker 808 interval moves. Picking a genre also sets a sensible default **Quantize**.',
      '**Quantize** (1/4 · 1/8 · 1/16 · 1/32) next to Loop — Generate/Regenerate snap to that grid. Default **1/8** for Trap; Dance defaults to **1/4** four-on-the-floor.',
      '**Snare / Clap** — sticky **timing-only** 1-bar strip at the top (Preview / SE2 play). Louder snappy 808 snare + clap for groove while you work — **not** included in MIDI / WAV / To roll / To track exports (kick/bass tone grid only).',
      '**Tone grid** — 16 piano-key lanes, 16th-note steps, **4 / 8 / 16-bar** loop. Tools: **Select** (drag steps), **Draw**, **Erase**, **Clear**. **Play / Stop** previews the loop; scrub bar numbers to move the playhead.',
      '**Grid** slider zooms the step grid in and out without changing your pattern.',
      '**Export** — **MIDI** or **WAV** download; **To roll** sends the grid to this track’s piano roll; **To track** bounces a WAV loop onto a new audio lane.',
      'Standalone lane — not linked to Creation Station Session Link or Beat Lab. Each 808 Lab track keeps its own preset, filters, grid, chord lock, and mixer strip (volume, pan, FX).',
      '**Clear notes** on the piano roll removes roll MIDI only; 808 synth settings and the tone grid stay on the track.',
      'SE2 transport plays the voice through the lane mixer strip when you run the session.',
    ],
  },
  {
    id: 'genoUltraSynth',
    label: 'Ultra',
    title: 'Geno Ultra Synth — Grid-style instrument lane',
    highlight: true,
    lines: [
      'Add **Geno Ultra Synth** from the track-type menu — a dedicated subtractive synth channel (separate from Synth Geno).',
      'Open the docked panel: **3 oscillators**, multi-mode **filter**, amp & filter envelopes, **2 LFOs**, and an **8-slot mod matrix**.',
      'Pick factory presets (lead, pad, bass, pluck, keys) or tweak oscillators, filter, FX, and output level.',
      'Draw melodies on the piano roll; each lane keeps its own patch, preset id, and mixer strip.',
      '**Preview C4** in the panel auditions the current patch through the lane strip.',
      '**Clear notes** wipes roll MIDI only — your Ultra patch settings stay on the track.',
      'Transport schedules the Web Audio voice through the per-track mixer strip (volume, pan, insert FX).',
    ],
  },
  {
    id: 'genoBassSynth',
    label: 'Bass',
    title: 'Geno Bass Synth — classic synth bass lane',
    highlight: true,
    lines: [
      'Add **Geno Bass Synth** from the track-type menu — a dedicated bass synth channel (lighter than Geno Ultra).',
      '55 factory bass sounds: **Mooga**, **Retro Box**, **FM / Digital**, **analog**, **sub / 808**, and **funk** groups.',
      'Warm tan **wood-grain shell** (Beat Pads style) with a focused bass panel — filter, amp, sub, and bass keyboard.',
      'Draw bass lines on the piano roll (C1–G3 register); each lane keeps its own patch and mixer strip.',
      '**Clear notes** wipes roll MIDI only — your bass patch stays on the track.',
      'Transport schedules through the same Web Audio subtractive engine as Geno Ultra, tuned for bass.',
    ],
  },
  {
    id: 'synthGeno',
    label: 'Geno',
    title: 'Synth Geno lane — chords, sound & compose',
    highlight: true,
    lines: [
      'Add **Synth Geno** from the track-type menu — a dedicated builder lane with its own Web Audio voice.',
      `**${SE2_SYNTH_GENO_BUILD_TAB_LABEL}** tab: **${SE2_SYNTH_GENO_BUILD_1_LABEL}** + **${SE2_SYNTH_GENO_BUILD_2_LABEL}** — 8-bar loop editor with chords, arp & bass; open the panel to preview and apply.`,
      '**Lock Groove Lead** (Geno Build 1 & 2) — one click creates or updates a **Groove Lead ← Synth Geno** lane with a silky lead locked to your Geno chord progression; edit on that track\'s piano roll.',
      `**${SE2_SYNTH_GENO_FUSION_NOTE_FLEX_LABEL}** tab: self-contained plugin — Sound + Prompt, SpaceWalk macros, and an **8-bar piano roll** with three sound lanes (Pad, Melody, Bass).`,
      'Each Fusion lane has its own sound picker. Click bar cells to sketch notes, **Generate loop** to fill all three lanes, then **Preview** or **Apply → Roll**.',
      'Each Synth Geno lane stores its own voice, prompts, and patch label — duplicate the track to stack another Geno part.',
      '**Clear notes** wipes piano-roll MIDI only; your patch and generator settings stay on the lane.',
      'Transport plays the generated voice through the lane mixer strip like other melodic MIDI tracks.',
      `Open **${SE2_SYNTH_GENO_FUSION_NOTE_FLEX_LABEL}** — click **?** beside **Sound** or **Prompt** for field-specific help.`,
    ],
  },
  {
    id: 'fusionSound',
    label: 'Sound',
    title: 'Fusion — Sound field (synth patch)',
    lines: [
      'The purple **Sound** box describes the **synth patch** — tone, filter, and timbre. It does **not** write notes on the roll.',
      'Try short timbre words: warm pad, pluck bell, ambient 8-bit, bright lead, soft strings.',
      'After you edit Sound, click **Generate sound** (patch only) or **Fusion** (patch + new 8-bar MIDI).',
      'Typing alone does nothing — you must click a generate button to hear changes.',
      'Use **Use on Chords** / **Use on Melody** under the patch card so Preview and Export Audio play your generated patch on that lane.',
      '**Re-roll sound** keeps your words but jitters the patch; **Random sound** fills the box with a new idea.',
    ],
  },
  {
    id: 'fusionPrompt',
    label: 'Prompt',
    title: 'Fusion — Prompt field (8-bar MIDI)',
    lines: [
      'The yellow **Prompt** box drives **8-bar MIDI** on the Fusion piano roll — chords, melody, and bass lanes.',
      'Use **genre + layout** keywords the engine recognizes: pop chords and melody, R&B chords only, gospel 8 bars, jazz chords and melody, dark minor chords only.',
      'After you edit Prompt, click **Create MIDI** (notes only) or **Fusion** (patch + notes). **Chords** only re-harmonizes the **current** loop — it does not fully restart from a new prompt.',
      'This is **local keyword matching**, not cloud AI. If your words do not match known tags, output stays close to the default **Luminous** character.',
      '**SpaceWalk** knobs and character chips (Gentle, Drift, Cinematic…) often change harmony more than free-form prose — try those when prompts feel ignored.',
      'Tap an **example chip** below the roll for prompts that parse reliably; check the summary line for detected duo (e.g. Chords + Melody).',
    ],
  },
  {
    id: 'drumGenerator',
    label: 'Drums',
    title: 'Drum Generator lane — style-matched grooves',
    highlight: true,
    lines: [
      'Add **Drum Generator** from the track-type menu — its own lane on **MIDI channel 10** with your producer kits.',
      'Pick a **Style** chip (Pop, Trap, K-pop, R&B…) after chords are on the roll.',
      '**Match cards** — pick the Geno lane + **B01/B02** build after **Apply MIDI**, then **Generate from cards** for Bank 2 grooves.',
      '**Generate drums** picks from the Trap / R&B / Beat Lab pattern library, then tiles a 4-bar loop.',
      '**Bank 2** (purple) is separate — **Gen from chords** builds today\'s grooves: Drill, Lo-Fi, Dance, and K-pop matched to your linked chord lane.',
      '**Pad sounds · 16** — after you pick a pattern, tap any pad to swap kick, snare, clap, etc. from producer kits or your sound library.',
      '**Re-roll** keeps the style but draws a new variation; **Variation** slider adds ghost notes and syncopation.',
      '**Drum pat** and **Beat Lab** load classic grids; **Bank 2** generates modern patterns without mixing into those banks.',
      '**Clear notes** wipes the roll; the lane, kit, and generator settings stay. Transport plays through the lane mixer strip.',
    ],
  },
  {
    id: 'beatPadsSe2',
    label: 'Beat Pads',
    title: 'How to use Beat Pads in Studio Editor 2',
    highlight: true,
    lines: [],
    subsections: [
      {
        title: 'What Beat Pads is (inside SE2)',
        lines: [
          '**Beat Pads** is Da Muzik Box’s drum machine **inside Studio Editor 2** — sixteen sample pads, Pattern Bank, **Lane Placements**, **VocalBox**, **Auto Drum**, **Pad Spread**, and **Match Chords** on a dedicated timeline lane with its own mixer strip.',
          'It is its own track type (not a normal MIDI piano-roll lane). Use the pads machine + 16-lane step grid. Duplicate the track to stack a second kit.',
          'Premium feature on pricing — Basic packages hide Beat Pads from the add-track menu.',
        ],
      },
      {
        title: 'VocalBox — beatbox your beat',
        lines: [
          'Open the purple **VocalBox** tab in the Beat Pads action bar. Beatbox **“boom”** (kick), **“ka”** (snare), **“ts”** (hats) — hits land on Kick / Snare / Hat / Clap pads.',
          'Set **BPM**, **quantize** (1/4–1/16), **bars**; turn on **Count** + **MTR**. Record after the **1, 2, 3, 4** count-in. Preview, nudge the hit map, merge into the step grid.',
          'Load pad samples first — fastest way to a human pocket without clicking every step.',
        ],
      },
      {
        title: 'Lane Placements — paint each drum lane',
        lines: [
          'Highlight a row on the 16-lane grid → open **Lane Placements** in the Pattern Bank sidebar.',
          'Pick **Kick / Snare / Clap / Hi-Hat / Open Hat / Rim**, then a **genre** (Trap, R&B, Drill, Lo-Fi, K-Pop, Afro, Reggae, Soul Blues, House…).',
          'Tap a **placement card** (● = hit) or **Regen**. Pattern Bank = full loops; Lane Placements = sculpt one lane at a time on CH 1–16.',
        ],
      },
      {
        title: 'Auto Drum — type a phrase',
        lines: [
          'Inside Lane Placements, type plain English: **trap hi-hat roll bpm 140**, **boom bap snare**, **afro kick** → **Go**.',
          '**Regen** tries another match. Can set BPM and swap pad sample to fit the sound.',
        ],
      },
      {
        title: 'Pad Spread — chromatic 808 roll (CH 17–32)',
        lines: [
          'Select a pad → **PAD SPREAD** → **↓16** or **↑16**. Mini chromatic roll opens; main 16 pads stay untouched.',
          'Draw hits; **2b / 4b / 8b**; preview at session BPM. **808 in key** follows matched chord roots. **Export MIDI / WAV** to another SE2 track.',
          'Lane drums on CH 1–16 + spread on CH 17+ share the same grid clock.',
        ],
      },
      {
        title: 'Match Chords — lock to harmony',
        lines: [
          'Link Beat Pads to **Progression+**, **Rhythm Edit**, **SE2 Chord Generator**, or **Synth Geno**.',
          '**Lock** follows BPM, loop bars, and song key. Style chips set **Load groove** family. **Kick key lock** tunes kick/808 to the root. **Regenerate pad** rewrites a lane to the chord rhythm.',
        ],
      },
      {
        title: 'Add & open the lane',
        lines: [
          'Track add menu → **Beat Pads**. Dock opens: pads machine on top, **16-lane step grid** underneath.',
          '**Close pads** keeps the sequencer while you watch the timeline; **Show pads** restores the full machine (kits, Pattern Bank, Lane Placements).',
          'Collapsed strip at the bottom re-expands the dock.',
        ],
      },
      {
        title: '16 pads, kits & step grid',
        lines: [
          'Tap pads to audition; paint steps on the grid (rows = pads, columns = steps; 16ths default).',
          '**Kit / Trap Kit** browser loads producer folders. **Pad FX** = drive, filter, color per pad.',
          'SE2 **Play** (Slave sync) moves the playline with the song metronome.',
        ],
      },
      {
        title: 'Pattern Bank',
        lines: [
          'Genre tabs with full preset loops — fastest complete beat. Slots **A / B** for two patterns.',
          'Load a loop, then refine with Lane Placements, VocalBox, or Auto Drum.',
        ],
      },
      {
        title: 'Sync with Studio Editor 2',
        lines: [
          '**Slave** (recommended) — SE2 Play / Pause / RTZ drives Beat Pads with chords and metronome.',
          '**Master** — Beat Pads BPM pushes the session. **Off** — local loop only.',
        ],
      },
      {
        title: 'Mixer, export & Mastering Bay',
        lines: [
          'Beat Pads has a **Mix** strip — volume, pan, mute, solo, FX.',
          '**Export loop WAV** bounces the pattern. Pad Spread can export MIDI/WAV to other tracks.',
          'When the song is balanced: **Stereo mix → Mastering Bay** (Bass X → DMB Match → Master X1 → Save New Master).',
        ],
      },
      {
        title: 'Tips',
        lines: [
          'Blue **?** beside the dock title opens VocalBox / Lane Placements / Auto Drum / Pad Spread / Match Chords highlights + **Copy for social**.',
          'This gold **How to use Beat Pads in Studio Editor 2** tab is the full walkthrough.',
          'Silent audio? Check Sync mode, mute/solo, and tap Play once to wake AudioContext.',
          '**Close pads** when you need timeline height — the sequencer stays one click away.',
        ],
      },
    ],
  },
  {
    id: 'humCapture',
    label: 'Hum / Melody',
    title: 'Hum / Melody Capture — voice to MIDI',
    highlight: true,
    lines: [
      'Add **Hum / Melody Capture** from the track-type menu — its own MIDI lane with mic, pitch scope, and melody roll.',
      '**Hum / Melody Capture** — humming, singing, whistling, or a single instrument line. Turns that audio into MIDI notes (**pitch, timing, loudness, bends**).',
      'Hit **Record** — **Cnt** plays a 1-bar count-in (1-2-3-4), then hum/sing on the downbeat. **Mtr** keeps the metronome clicking so timing stays locked.',
      '**Capture tune** — Onset / Frame + Min note. **Re-run**, then edit / **Quantize** on the melody roll. When it sounds right, hit **Apply to track** to send MIDI to this SE2 lane.',
      '**12 key pads** and **key lock** snap pitches to scale — link **Match chords** to a Progression+ / rhythm lane for context.',
      'Pick an **instrument** (piano, guitar, brass, synth…) — transport plays through this lane\'s mixer strip.',
      '**Hide** collapses the panel to a thin bar; click **Show** to expand again. **Clear notes** wipes MIDI only.',
      'This lane is Hum / Melody Capture only — no voice swap or RVC on this channel.',
    ],
  },
  {
    id: 'guitar',
    label: 'Guitar',
    title: 'Guitar lane — sampled guitars on the MIDI roll',
    highlight: true,
    lines: [
      'Add **Guitar** from the track-type menu (last item) — a dedicated lane for guitar licks and melodies.',
      '**Loop player** — pick a genre (R&B, country, funk, blues, rock), choose **4 bar** or **8 bar**, then tap a preset card to drop a full guitar part at the playhead.',
      'Melodic presets include neo-soul progressions (floating minor, Hathaway lift, Glasper cycle), blues turnarounds, and Key to the Highway-style eight-bar forms.',
      'Each loop card shows chord feel and length — matching **tone** is applied automatically when the preset calls for it.',
      '**Guitar FX** — **Drive**, **Chorus**, and **Reverb** on the lane (preview, loops, and transport).',
      'Use **Quick licks** for one-bar fills, or draw your own on the **piano roll** after inserting.',
      '**Transpose** shifts playback without re-drawing notes. **Test** previews the current tone.',
      'Transport plays through this lane\'s mixer strip — same pattern as other dedicated SE2 instrument lanes.',
    ],
  },
] as const;

export const STUDIO_EDITOR2_HELP_INTRO_STORAGE = 'da-studio-editor2-help-intro-v1';
