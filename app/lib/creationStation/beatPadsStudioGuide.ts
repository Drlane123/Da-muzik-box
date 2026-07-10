/**
 * Beat Pads studio guide — Lane Placements & Pad Spread highlighted for SE2 dock help (?).
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
export const BEAT_PADS_SOCIAL_BLURB = `Da Music Box Beat Pads: 16 pads + step sequencer inside Studio Editor 2. VocalBox lets you beatbox a beat with your mouth — boom/ka/ts on a count-in and it lands real kicks, snares & hats on the grid. Lane Placements paints genre drum patterns row-by-row (Trap, R&B, Drill, Afro & more), and Auto Drum builds a groove from a plain-English phrase like "trap hi-hat roll 140". Pad Spread turns one 808 into a 16-pitch chromatic roll on CH 17. Pattern Bank, match chords, sync to SE2 transport. Make drums by mouth, by phrase, or by hand — without leaving the session.`;

export const BEAT_PADS_STUDIO_GUIDE = {
  title: 'Beat Pads — full guide',
  subtitle: 'VocalBox, Lane Placements, Auto Drum & Pad Spread are the power moves. Everything else supports them.',
  socialBlurb: BEAT_PADS_SOCIAL_BLURB,
  /** Featured first — Lane Placements & Pad Spread. */
  highlights: [
    {
      id: 'lanePlacements',
      title: 'Lane Placements',
      badge: '★ HIGHLIGHT',
      blocks: [
        {
          heading: 'What it is',
          body:
            'Lane Placements is how you paint real drum patterns onto individual sequencer rows — one lane at a time. Highlight a pad row on the 16-lane grid, open Lane Placements in the Pattern Bank sidebar, and drop genre-specific kicks, snares, claps, hats, rims, and FX onto that lane only.',
        },
        {
          heading: 'What it offers',
          body:
            'Dozens of genres: Trap, R&B, Pop, Drill, Lo-Fi, K-Pop, Soul Blues, Afro, Reggae, House, and more. Each placement is a proven 16-step groove (● = hit, · = rest) built for that drum type. Kick placements sit low on the grid; snares and claps in the middle; hats and percussion up top — but you choose the lane.',
        },
        {
          heading: 'How to use it',
          body:
            '1) Click a lane on the step grid. 2) Pick drum type — Kick, Snare, Clap, Hi-Hat, Open Hat, Rim. 3) Pick Genre. 4) Tap a card under Pick placement or hit Regen for a surprise. Auto Drum: type a phrase (“trap snare roll bpm 140”) and Go.',
        },
        {
          heading: 'Why it matters',
          body:
            'Pattern Bank loads full loops fast; Lane Placements lets you sculpt lane-by-lane like a real drum programmer. Swap only the kick, only the snare, or only the hats without touching the rest of the beat. This is CH 1–16 — your main drum kit.',
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
            'Pad Spread is an 808-style chromatic pitch tool on mixer CH 17–32. Load any one-shot on a pad (808, kick, clap, vocal chop). Tap PAD SPREAD ↓16 or ↑16 in the pad FX bar. A mini pitch roll opens — 16 rows, each row one semitone from the last. Your 16 sampler pads are never replaced.',
        },
        {
          heading: 'What it offers',
          body:
            'One sample becomes a full chromatic scale: row 1 = original pitch, each row steps down (↓16) or up (↑16). Draw hits in the mini roll like a piano roll. Pick 2, 4, or 8 bar loop. Play previews at session BPM. Export MIDI or WAV to any SE2 track when locked in.',
        },
        {
          heading: 'How to use it',
          body:
            '1) Load a hit on a pad and select that pad. 2) PAD SPREAD → ↓16 or ↑16. 3) Draw your pattern in the roll. 4) Play inside the roll to preview. 5) Export to a regular track or play Beat Pads transport — spread hits on CH 17+ while lane-placement drums play on CH 1–16.',
        },
        {
          heading: '808 in key (optional)',
          body:
            'Turn on 808 in key to follow chord roots from a matched harmony lane bar-by-bar. Regenerate spread roots to try another octave. Match chords strip links Beat Pads to your progression lane for tempo, key, and groove family.',
        },
      ],
    },
    {
      id: 'vocalBox',
      title: 'VocalBox',
      badge: '★ HIGHLIGHT',
      blocks: [
        {
          heading: 'What it is',
          body:
            'VocalBox lets you build a beat with your mouth. Open it from the purple VocalBox tab in the Beat Pads action bar, beatbox into the mic — "boom" for kick, "ka" for snare, "ts" for hats — and it listens to your take, detects every hit, and lays them onto a drum grid mapped to your pads.',
        },
        {
          heading: 'What it offers',
          body:
            'Turns mouth percussion into real, placed drum hits on Kick, Snare, Hat, and Clap lanes. Set BPM, quantize (1/4 down to 1/16), and bars. A full count-in ("1, 2, 3, 4") drops you onto the metronome, and a visual grid shows exactly where each hit landed so you can see and nudge your timing before you commit. Preview plays the take back through your pads.',
        },
        {
          heading: 'How to use it',
          body:
            '1) Load samples on your kick / snare / hat / clap pads. 2) Open VocalBox. 3) Set BPM, quantize (1/16), and bars, and turn on Count (pre-count) + MTR (metronome). 4) Hit Record — after the "1, 2, 3, 4" count-in, beatbox right on the first metronome click. 5) Preview, tweak hits on the grid, then send the pattern to your Beat Pads.',
        },
        {
          heading: 'Why it matters',
          body:
            'It is the fastest way to a human, natural groove — perform the beat with your voice instead of clicking steps one at a time. Great for sketching a feel the moment you hear it in your head.',
        },
      ],
    },
  ] as const satisfies readonly BeatPadsGuideSection[],
  /** Rest of Beat Pads — after the two highlights. */
  sections: [
    {
      id: 'overview',
      title: 'Beat Pads overview',
      blocks: [
        {
          heading: 'The machine',
          body:
            'Beat Pads is a full drum machine inside Studio Editor 2 and Beat Lab: 16 sample pads, producer kits, per-pad FX, a 16-lane step sequencer, Pattern Bank, Lane Placements, Pad Spread, and session export. It is its own track type — the groove lives on the Beat Pads lane until you bounce or spread elsewhere.',
        },
        {
          heading: 'Pads & kits',
          body:
            'Tap pads to audition. Load Trap Kit folders (808s, kicks, snares, claps, hats). Each pad holds its own sample and FX. Kit saves store all 16 pads together.',
        },
        {
          heading: 'Step grid',
          body:
            'Rows = pads/lanes. Columns = steps across the loop (16ths default). Click to toggle, drag to paint. Transport Play moves the playline and triggers hits in time.',
        },
        {
          heading: 'Pattern Bank',
          body:
            'Genre tabs with full preset loops — fastest way to a complete beat. Slots A/B flip between two patterns. Great starting point before Lane Placements fine-tuning.',
        },
        {
          heading: 'Sync & export',
          body:
            'Sync to SE2: Slave (follow session), Master (push BPM), or Off (local loop). Export loop WAV, spread MIDI/WAV to other tracks. Mixer strip per Beat Pads lane in Mix view.',
        },
      ],
    },
    {
      id: 'autoDrum',
      title: 'Auto Drum',
      blocks: [
        {
          heading: 'What it is',
          body:
            'Auto Drum is the type-a-phrase groove builder inside Lane Placements. Describe the drum and the vibe in plain English and it drops a matching pattern onto the selected lane — no scrolling through placement cards.',
        },
        {
          heading: 'What it offers',
          body:
            'It understands the drum type, genre, and even tempo from your words — "trap hi-hat roll bpm 140", "boom bap snare", "afro kick". It picks a matching 16-step placement, can swap the pad sample to fit the sound, and sets BPM when you name one. Regen serves up a different match for the same phrase.',
        },
        {
          heading: 'How to use it',
          body:
            '1) Click the lane you want on the step grid. 2) Type your prompt in the Auto Drum box — the sound plus the genre. 3) Hit Go. It places the groove and shows a short one-line result (e.g. "Auto Drum: Trap Kick"). 4) Tap Regen to try another feel.',
        },
        {
          heading: 'Why it matters',
          body:
            'Describe what you hear and get drums instantly. It pairs with Lane Placements and VocalBox so you can build the same beat by phrase, by hand, or by mouth — whatever is fastest in the moment.',
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
