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
      'Transport **Record** (mic button) marks a recording session and starts playback — arm tracks first.',
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
      '**Chord lock** — follow **song key**, a chosen **key**, or a harmony **track** (Progression+, Rhythm Edit, Synth Geno, Glide Bass, Groove Lead, Geno Ultra, Chord Genie…).',
      '**Root scope** dial shows the active key and progression roots; pick a root to highlight it on the grid.',
      '**Generate roots** writes harmony roots onto the **tone grid**; **Regenerate** keeps the same roots but rolls a new trap pocket pattern.',
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
        title: 'Lane Placements — paint each drum lane',
        lines: [
          '**Lane Placements** is the lane-by-lane drum painter — highlight a row on the 16-lane grid, then open Lane Placements in the Pattern Bank sidebar.',
          'Pick **Kick**, **Snare**, **Clap**, **Hi-Hat**, **Open Hat**, or **Rim** — then choose a **genre** (Trap, R&B, Drill, Lo-Fi, K-Pop, Afro, Reggae, Soul Blues, and more).',
          'Tap a **Pick placement** card to paint that groove on the highlighted lane only — the dot line shows the 16-step pattern (● = hit).',
          '**Regen** rolls a new pattern for the same drum type and genre. **Auto Drum** accepts plain phrases: trap snare roll, 808 long kick bpm 97, rnb shuffle kick.',
          'Pattern Bank loads full loops; Lane Placements lets you sculpt kicks, snares, and hats independently on CH 1–16.',
        ],
      },
      {
        title: 'Pad Spread — 808 chromatic roll (CH 17)',
        lines: [
          '**Pad Spread** takes one sample (808, kick, clap) and opens a **mini chromatic pitch roll** on mixer **CH 17–32** — your 16 pads stay untouched.',
          'In pad FX, tap **PAD SPREAD** then **↓16** (chromatic down) or **↑16** (chromatic up). Row 1 = original pitch; each row steps one semitone.',
          'Draw hits in the spread roll. Pick **2b / 4b / 8b** loop, then **Play** inside the roll to preview at session BPM.',
          '**808 in key** follows matched chord roots bar-by-bar. **Export MIDI** or **Export WAV** sends the spread to another SE2 track when locked in.',
          'Beat Pads transport plays lane-placement drums on CH 1–16 and spread hits on CH 17+ on the same grid clock.',
        ],
      },
      {
        title: 'VocalBox — beatbox your beat with your mouth',
        lines: [
          '**VocalBox** turns mouth percussion into placed drum hits — open it from the purple **VocalBox** tab in the Beat Pads action bar.',
          'Beatbox into the mic: **“boom”** for kick, **“ka”** for snare, **“ts”** for hats. VocalBox listens to the take, detects each hit, and lays it on a drum grid mapped to your **Kick / Snare / Hat / Clap** pads.',
          'Set **BPM**, **quantize** (1/4 down to 1/16), and **bars**; turn on **Count** (pre-count) and **MTR** (metronome). A full **“1, 2, 3, 4”** count-in drops you onto the first metronome click — record right on the one.',
          'A visual grid shows exactly where every hit landed so you can see your timing and nudge hits before you commit. **Preview** plays the take back through your pads.',
          'Load samples on your kick/snare/hat/clap pads first, then perform the groove — it is the fastest way to a natural, human feel without clicking steps one at a time.',
        ],
      },
      {
        title: 'What Beat Pads is',
        lines: [
          'Beat Pads is a full drum machine inside Studio Editor 2 — 16 sample pads, producer kits, pad FX, a step sequencer, Pattern Bank, Lane Placements, Auto Drum, VocalBox, and Pad Spread.',
          'It is its own track type (not a normal MIDI piano-roll lane). Your groove lives on the Beat Pads lane until you export or spread it elsewhere.',
          'Each Beat Pads track keeps its own pattern, pad samples, kit, mixer strip, and harmony link — duplicate the track to stack a second kit.',
        ],
      },
      {
        title: 'Add & open the lane',
        lines: [
          'Click **+ MIDI** (or the track add menu) and choose **Beat Pads** — a dedicated lane appears with mint/teal accent chrome.',
          'The dock opens at the bottom of the workspace: **pads machine** on top (when open) and the **16-lane step grid** always underneath.',
          '**Close pads** hides the 4×4 pad surface and kit browser but keeps the step sequencer visible so you can still edit while viewing the timeline.',
          '**Show pads** brings the full machine back (pads, Trap Kit browser, Pattern Bank sidebar, Lane Placements).',
          'Click the thin collapsed strip at the bottom if the whole dock was minimized — it expands the Beat Pads panel again.',
        ],
      },
      {
        title: '16 pads & kits',
        lines: [
          'Tap any pad to audition; hold or click cells on the step grid to place hits on that lane (row).',
          'Use the **Kit** / **Trap Kit** browser to load producer folders (808s, kicks, snares, claps, hats…) onto individual pads.',
          'Each pad can hold its own sample; swaps are saved per Beat Pads track.',
          'Open **Pad FX** on a pad for per-pad drive, filter, and send-style color — great for tuning kicks and snares in the mix.',
          'Default layout: low rows are kicks/808s, mid rows snares/claps, top rows hats and percussion (labels on each sequencer row).',
        ],
      },
      {
        title: 'Step sequencer grid',
        lines: [
          'The grid is your pattern: **rows = pads/lanes**, **columns = steps** across the loop (16th notes by default).',
          'Click a cell to toggle a hit; drag to paint; use loop length and steps-per-bar controls to resize the pattern.',
          'Transport **Play** in SE2 (when synced) moves the playline across the grid and triggers audio in time with the session metronome.',
          'Loop length (bars) is set inside Beat Pads — it does not have to match the SE2 ruler loop unless you lock harmony sync.',
        ],
      },
      {
        title: 'Pattern Bank (left sidebar)',
        lines: [
          'Open the **Pattern Bank** box beside the pads — genre tabs (Trap, R&B, Pop, Drill, Lo-Fi, etc.) with full preset loops.',
          'Tap a preset card to load that groove into the step grid; kits can auto-load matching samples when enabled.',
          'Slots **A** / **B** let you keep two patterns handy and flip between them while writing.',
          'Pattern Bank is the fastest way to get a full beat, then tweak individual lanes and swap pad sounds.',
        ],
      },
      {
        title: 'Lane Placements (Kick, Snare, …)',
        lines: [
          'See **Lane Placements — paint each drum lane** at the top of this guide for the full walkthrough.',
          'Below Pattern Bank in the sidebar: pick drum type, genre, then a placement card or Regen.',
        ],
      },
      {
        title: 'Match chords strip',
        lines: [
          'The **Match chords** bar links Beat Pads to a Progression+, Rhythm Edit, or Synth Geno lane on your session.',
          'Pick a harmony lane from the dropdown; **Lock** follows that lane’s BPM, loop bars, and song key when you sync.',
          '**Sync** pulls tempo/key/loop from the linked lane once; style chips (Pop, Trap, R&B…) set which groove family **Load groove** uses.',
          '**Load groove** fills the grid with a style-matched pattern from the pattern library — great after chords are on the roll.',
          '**Kick key lock** tunes your kick/808 pad to the session key root (shown as key badge); unlock to hear the raw sample pitch.',
          '**Regenerate pad** rewrites one pad lane (usually kick) to follow the linked chord lane’s rhythm and harmony.',
        ],
      },
      {
        title: 'Sync with Studio Editor 2 transport',
        lines: [
          'In the dock header, **Sync to SE2** links Beat Pads to the main transport (mint sync buttons: Off / Master / Slave).',
          '**Slave** (Beat Pads follows SE2) — recommended: SE2 **Play / Pause / RTZ** drives the grid playline and your pattern audio together with chords and metronome.',
          '**Master** — Beat Pads BPM pushes the session tempo (use when the drum loop is the timing reference).',
          '**Off** — Beat Pads uses its own local loop; SE2 Play does not trigger the pattern until you sync again.',
          'When synced, SE2 **BPM** matches other lanes; your **grid bar count** can still differ from the SE2 loop braces unless harmony lock copies loop length.',
        ],
      },
      {
        title: 'Mixer & session workflow',
        lines: [
          'Each Beat Pads lane has a mixer strip in **Mix** view — volume, pan, mute, solo, and FX like other tracks.',
          'Transport schedules Beat Pads audio through that strip while synced; metronome and loop wrap use the same SE2 clock.',
          'Typical workflow: add chords on Geno or Rhythm Edit → add Beat Pads → **Match chords** + **Load groove** → tweak lanes → sync → Play full arrangement.',
          'The piano roll for a Beat Pads track is not the main editor — use the step grid and pads machine instead.',
        ],
      },
      {
        title: 'Export & spread',
        lines: [
          '**Export loop WAV** bounces the current pattern to a file or new audio track (rendered with your pad sounds and FX).',
          '**Pad Spread** (see top of this guide) exports chromatic 808/MIDI/WAV from the mini roll to other SE2 tracks.',
          'Spread targets are chosen from other tracks in the session; useful when you want drums on the timeline as clips or MIDI.',
        ],
      },
      {
        title: 'Tips',
        lines: [
          'Click the **blue ?** beside the dock title for VocalBox, Lane Placements, Auto Drum & Pad Spread highlights and a **Copy for social** post.',
          'Click the gold **How to use Beat Pads in Studio Editor 2** link for this full tabbed guide.',
          'If audio is silent, check SE2 sync mode, mixer mute/solo, and that the AudioContext is running (tap Play once).',
          'Use **Close pads** when you need more timeline height; the sequencer stays one click away.',
        ],
      },
    ],
  },
  {
    id: 'humCapture',
    label: 'Hum',
    title: 'Hum Capture lane — melody from your voice',
    highlight: true,
    lines: [
      'Add **Hum Capture** from the track-type menu — its own MIDI lane with mic, pitch scope, and melody roll.',
      'Hum or sing into the mic; notes land on the **melody roll** and sync to the piano roll below.',
      '**12 key pads** and **key lock** snap pitches to scale — link **Match chords** to a Progression+ / rhythm lane for context.',
      'Pick an **instrument** (piano, guitar, brass, synth…) — transport plays through this lane\'s mixer strip.',
      '**Hide** collapses the panel to a thin bar; click **Show** to expand again. **Clear notes** wipes MIDI only.',
      'This lane is Vocal Lab Hum Capture only — no voice swap or RVC on this channel.',
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
