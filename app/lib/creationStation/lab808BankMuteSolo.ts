/** 808 Lab — Kick/Bass vs Drum Kits mute/solo (volume faders stay unchanged). */

export type Lab808OutputBank = 'tone' | 'drums';

export function lab808BankAudible(
  bank: Lab808OutputBank,
  toneMuted: boolean,
  drumMuted: boolean,
  toneSolo: boolean,
  drumSolo: boolean,
): boolean {
  const anySolo = toneSolo || drumSolo;
  const muted = bank === 'tone' ? toneMuted : drumMuted;
  const solo = bank === 'tone' ? toneSolo : drumSolo;
  if (muted) return false;
  if (anySolo) return solo;
  return true;
}

export function lab808EffectiveLevel(baseLevel: number, audible: boolean): number {
  return audible ? baseLevel : 0;
}
