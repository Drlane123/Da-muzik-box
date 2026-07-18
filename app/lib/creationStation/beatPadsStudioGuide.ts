/**
 * Beat Pads studio guide — SE2 dock help (?).
 * Highlighted: VocalBox, Lane Placements, Auto Drum, Pad Spread, Match Chords.
 */

export type BeatPadsGuideBlock = {
  heading: string;
  body: string;
};

export type BeatPadsGuideSection = {
  id: string;
  title: string;
  badge?: string;
  blocks: BeatPadsGuideBlock[];
};

/** One short post — copy from the blue ? help modal. */
export const BEAT_PADS_SOCIAL_BLURB = `Da Muzik Box Beat Pads lives inside Studio Editor 2 — a full 16-pad drum machine on your song timeline. VocalBox: beatbox boom/ka/ts on a count-in and hits land on kick, snare & hats. Lane Placements paints Trap, R&B, Drill, Afro grooves one lane at a time. Auto Drum builds from plain English (“trap hi-hat roll 140”). Pad Spread turns one 808 into a chromatic roll. Match Chords locks the pocket to your progression. Pattern Bank, Slave sync to SE2, then Stereo mix → Mastering Bay when the song is ready.`;

export const BEAT_PADS_STUDIO_GUIDE = {
  title: 'Beat Pads — inside Studio Editor 2',
  subtitle:
    'VocalBox · Lane Placements · Auto Drum · Pad Spread · Match Chords are the power moves. Pattern Bank and SE2 sync support them.',
  socialBlurb: BEAT_PADS_SOCIAL_BLURB,
  highlights: [
    {
      id: 'vocalBox',
      title: 'VocalBox',
      badge: '★ HIGHLIGHT',
      blocks: [
        {
          heading: 'What it is',
          body:
            'VocalBox turns your mouth into the drummer. Open the purple VocalBox tab in the Beat Pads action bar, beatbox into the mic — “boom” for kick, “ka” for snare, “ts” for hats — and it detects every hit and lays them on a grid mapped to your Kick / Snare / Hat / Clap pads.',
        },
        {
          heading: 'What it offers',
          body:
            'BPM, quantize (1/4 down to 1/16), 1–2 bar takes, count-in (“1, 2, 3, 4”), metronome, and a visual hit map so you can see and nudge timing before you commit. Preview plays the take back through your real pad samples.',
        },
        {
          heading: 'How to use it',
          body:
            '1) Load samples on kick / snare / hat / clap pads. 2) Open VocalBox. 3) Set BPM, quantize, bars; turn on Count + MTR. 4) Record — beatbox right on the first click after count-in. 5) Preview, tweak the grid, merge into Beat Pads.',
        },
        {
          heading: 'Why it matters',
          body:
            'Fastest path to a human pocket — perform the feel instead of clicking every step. Works alongside Lane Placements and Auto Drum on the same Beat Pads lane.',
        },
      ],
    },
    {
      id: 'lanePlacements',
      title: 'Lane Placements',
      badge: '★ HIGHLIGHT',
      blocks: [
        {
          heading: 'What it is',
          body:
            'Lane Placements paints real drum patterns onto individual sequencer rows — one lane at a time. Highlight a pad row on the 16-lane grid, open Lane Placements in the Pattern Bank sidebar, and drop genre grooves onto that lane only.',
        },
        {
          heading: 'What it offers',
          body:
            'Drum types: Kick, Snare, Clap, Hi-Hat, Open Hat, Rim. Genres: Trap, R&B, Pop, Drill, Lo-Fi, K-Pop, Soul Blues, Afro, Reggae, House, and more. Each card is a proven 16-step groove (● = hit). Regen rolls another pattern in the same family.',
        },
        {
          heading: 'How to use it',
          body:
            '1) Click a lane on the step grid. 2) Pick drum type. 3) Pick genre. 4) Tap a placement card — or use Auto Drum with a phrase. Pattern Bank loads full loops; Lane Placements sculpts kicks, snares, and hats independently on CH 1–16.',
        },
        {
          heading: 'Why it matters',
          body:
            'Program like a real drummer — swap only the kick or only the hats without wiping the whole beat. This is the main kit on CH 1–16.',
        },
      ],
    },
    {
      id: 'autoDrum',
      title: 'Auto Drum',
      badge: '★ HIGHLIGHT',
      blocks: [
        {
          heading: 'What it is',
          body:
            'Auto Drum is the type-a-phrase builder inside Lane Placements. Describe the drum and the vibe in plain English and it drops a matching 16-step pattern on the selected lane.',
        },
        {
          heading: 'What it offers',
          body:
            'Understands drum type, genre, and tempo from words — “trap hi-hat roll bpm 140”, “boom bap snare”, “afro kick”. Can swap the pad sample to fit and set BPM when you name one. Regen serves another match for the same phrase.',
        },
        {
          heading: 'How to use it',
          body:
            '1) Click the lane on the grid. 2) Type the prompt (sound + genre). 3) Hit Go. 4) Tap Regen for another feel. Pair with VocalBox or hand-painted steps on other lanes.',
        },
        {
          heading: 'Why it matters',
          body:
            'Describe what you hear and get drums instantly — then refine with Lane Placements or VocalBox.',
        },
      ],
    },
    {
      id: 'padSpread',
      title: 'Pad Spread',
      badge: '★ HIGHLIGHT',
      blocks: [
        {
          heading: 'What it is',
          body:
            'Pad Spread is an 808-style chromatic pitch tool on mixer CH 17–32. Load any one-shot (808, kick, clap, vocal chop), tap PAD SPREAD ↓16 or ↑16 in the pad FX bar, and draw on a mini pitch roll — your main 16 pads stay untouched.',
        },
        {
          heading: 'What it offers',
          body:
            'One sample becomes a chromatic scale: each row one semitone. 2 / 4 / 8 bar loops, preview at session BPM, export MIDI or WAV to another SE2 track. Optional 808 in key follows matched chord roots bar-by-bar.',
        },
        {
          heading: 'How to use it',
          body:
            '1) Load a hit and select that pad. 2) PAD SPREAD → ↓16 or ↑16. 3) Draw the pattern. 4) Preview. 5) Export or play with Beat Pads transport — lane drums on CH 1–16, spread on CH 17+.',
        },
        {
          heading: '808 in key',
          body:
            'Turn on 808 in key when Match Chords (or a harmony link) is active so spread roots follow the progression. Regenerate spread roots to try another octave.',
        },
      ],
    },
    {
      id: 'matchChords',
      title: 'Match Chords',
      badge: '★ HIGHLIGHT',
      blocks: [
        {
          heading: 'What it is',
          body:
            'Match Chords links Beat Pads to harmony on the session — Progression+, Rhythm Edit, SE2 Chord Generator, or Synth Geno — so tempo, key, loop bars, and groove family follow the chart you built.',
        },
        {
          heading: 'What it offers',
          body:
            'Lock follows the linked lane. Style chips (Pop, Trap, R&B…) set which groove family Load groove uses. Kick key lock tunes kick/808 to the session root. Regenerate pad rewrites one lane to the linked chord rhythm.',
        },
        {
          heading: 'How to use it',
          body:
            '1) Put chords on Geno, Chord Generator, or Progression+. 2) On Beat Pads, pick that lane in Match Chords. 3) Lock + Load groove (or Lane Placements / VocalBox). 4) Keep Sync to SE2 on Slave so Play drives drums with the song.',
        },
        {
          heading: 'Why it matters',
          body:
            'Drums stay in the pocket with your harmony — then Mix the song and send Stereo mix → Mastering Bay when you are ready to finish.',
        },
      ],
    },
  ] as const satisfies readonly BeatPadsGuideSection[],
  sections: [
    {
      id: 'overview',
      title: 'Beat Pads overview',
      blocks: [
        {
          heading: 'Inside Studio Editor 2',
          body:
            'Beat Pads is a dedicated SE2 track type — a full drum machine on your arrangement timeline with its own mixer strip. Add it from the track-type menu (+ Beat Pads). It is not a generic MIDI piano-roll lane; use the pads machine and 16-lane step grid.',
        },
        {
          heading: 'Pads & kits',
          body:
            'Tap pads to audition. Load Trap Kit / producer folders (808s, kicks, snares, claps, hats). Each pad holds its own sample and FX. Kit saves store all 16 pads together. Duplicate the Beat Pads track to stack a second kit.',
        },
        {
          heading: 'Step grid',
          body:
            'Rows = pads/lanes. Columns = steps (16ths default; 32nds available). Click to toggle, drag to paint. SE2 Play (when Slave sync is on) moves the playline and triggers hits with the song metronome.',
        },
        {
          heading: 'Pattern Bank',
          body:
            'Genre tabs with full preset loops — fastest complete beat. Slots A/B flip between two patterns. Start here, then refine with Lane Placements, VocalBox, or Auto Drum.',
        },
        {
          heading: 'Sync & export',
          body:
            'Sync to SE2: Slave (follow session — recommended), Master (push BPM), or Off (local loop). Export loop WAV; Pad Spread MIDI/WAV to other tracks. When the arrangement is done: Stereo mix → Mastering Bay (Bass X → DMB Match → Master X1).',
        },
      ],
    },
  ] as const satisfies readonly BeatPadsGuideSection[],
} as const;

/** Plain-text for one guide section. */
export function beatPadsGuideSectionPlainText(section: BeatPadsGuideSection): string {
  const lines: string[] = [
    section.badge ? `${section.badge} ${section.title}` : section.title,
    '',
  ];
  for (const b of section.blocks) {
    lines.push(`${b.heading}`);
    lines.push(b.body);
    lines.push('');
  }
  return lines.join('\n').trim();
}

/** Plain-text export — social blurb + every section (copy everything). */
export function beatPadsStudioGuidePlainText(): string {
  const lines: string[] = [
    BEAT_PADS_STUDIO_GUIDE.title,
    BEAT_PADS_STUDIO_GUIDE.subtitle,
    '',
    '══════════════════════════════════════',
    'COPY FOR SOCIAL',
    '══════════════════════════════════════',
    BEAT_PADS_SOCIAL_BLURB,
    '',
  ];
  for (const sec of BEAT_PADS_STUDIO_GUIDE.highlights) {
    lines.push('══════════════════════════════════════');
    lines.push(sec.badge ? `${sec.badge}  ${sec.title.toUpperCase()}` : sec.title.toUpperCase());
    lines.push('══════════════════════════════════════');
    for (const b of sec.blocks) {
      lines.push('');
      lines.push(b.heading);
      lines.push(b.body);
    }
    lines.push('');
  }
  for (const sec of BEAT_PADS_STUDIO_GUIDE.sections) {
    lines.push('══════════════════════════════════════');
    lines.push(sec.title.toUpperCase());
    lines.push('══════════════════════════════════════');
    for (const b of sec.blocks) {
      lines.push('');
      lines.push(b.heading);
      lines.push(b.body);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}
