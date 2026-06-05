/** Vivid pad accents — ADSR Drum Machine–style color-coded lanes (808 Lab pad bank). */
export const LAB808_PAD_ACCENT_COLORS: readonly string[] = [
  '#ff6b4a',
  '#fbbf24',
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#f472b6',
  '#5eead4',
  '#fb923c',
  '#818cf8',
  '#4ade80',
  '#f87171',
  '#22d3ee',
  '#e879f9',
  '#fcd34d',
  '#94a3b8',
  '#f9a8d4',
];

export function lab808PadAccentColor(padIndex: number): string {
  return LAB808_PAD_ACCENT_COLORS[Math.max(0, Math.min(15, padIndex))] ?? '#94a3b8';
}

/** Category tint from pad label (kick, snare, hat, …). */
export function lab808PadAccentFromLabel(label: string, padIndex: number): string {
  const L = label.toLowerCase();
  if (/\bkick\b|\/kick| bd\b|^bd$|808|sub\b|bass drum/.test(L)) return '#ff6b4a';
  if (/snare|\bsd\b|clap|\bcp\b|rim|rs\b|snap/.test(L)) return '#fbbf24';
  if (/hat|hh\b|\bch\b|\boh\b|shaker|cabasa|tamb/.test(L)) return '#38bdf8';
  if (/tom|conga|perc|block/.test(L)) return '#a78bfa';
  if (/cym|crash|ride|\bcy\b/.test(L)) return '#34d399';
  if (/cow|clave|fx|bell|maraca/.test(L)) return '#5eead4';
  return lab808PadAccentColor(padIndex);
}

export function lab808PadSurface(accent: string, lit: boolean): string {
  const mix = lit ? 78 : 58;
  return `linear-gradient(165deg, color-mix(in srgb, ${accent} ${mix}%, #1c1c28) 0%, #12121a 100%)`;
}

export function lab808PadBorder(accent: string, selected: boolean): string {
  if (selected) return 'rgba(124, 244, 198, 0.9)';
  return `color-mix(in srgb, ${accent} 72%, #3f3f46)`;
}
