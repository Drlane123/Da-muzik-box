export type GenoLiveArpPattern = 'up' | 'down' | 'up-down' | 'root' | 'chord';
export type GenoLiveArpRate = '4th' | '8th' | '16th' | 'triplet8';

/** Live Chord arp sits under full chord + bass stacks — nudge level in preview/export. */
export const GENO_LIVE_ARP_PREVIEW_MELODY_GAIN = 0.9;
/** Base MIDI velocity for generated arp hits (chords/bass use higher stacks). */
export const GENO_LIVE_ARP_VEL_BASE = 62;
