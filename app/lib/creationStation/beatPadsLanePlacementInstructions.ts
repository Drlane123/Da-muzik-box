/** Lane Placements + Pick Placement — help copy for Beat Pads sidebar. */

export const BEAT_PADS_LANE_PLACEMENT_HELP = {
  title: 'Lane Placements',
  tagline: 'Paint genre-specific grooves on one sequencer lane at a time.',
  sections: [
    {
      heading: 'Start on the grid',
      body:
        'Click a lane on the 16-row step grid first — Lane Placements always edits the highlighted row. Kick, snare, hats, and FX each get their own pattern on that lane only (CH 1–16).',
    },
    {
      heading: 'Drum type · Genre · Regen',
      body:
        'Pick Kick, Snare, Clap, Hi-Hat, Open Hat, or Rim. Genre filters the list — Trap, R&B, K-Pop, Drill, Lo-Fi, Soul Blues, Afro, Reggae, House, and more. Regen rolls a fresh pattern for that drum type and genre on the active lane.',
    },
    {
      heading: 'Pick placement — tap to paint',
      body:
        'Scroll Pick placement and tap any row. The green dot line is the 16-step pattern (● = hit, · = rest). The active card shows a mint edge. Each placement is a real groove for that genre — trap bounce kicks, R&B shuffle snares, drill hats, etc.',
    },
    {
      heading: 'Auto Drum — type & Go',
      body:
        'Describe the groove in plain words: trap snare roll, techno four floor kick, hip hop boom bap snare, lo-fi dusty clap, rim perc tick. Genre in your phrase can switch the dropdown. Regen beside Go tries another match. Enter runs Go.',
    },
    {
      heading: 'Lane Placements vs Pattern Bank',
      body:
        'Pattern Bank loads full multi-lane loops fast. Lane Placements is for sculpting one drum at a time — swap only the kick, only the snare, or only the hats without touching the rest of the beat.',
    },
  ],
} as const;
