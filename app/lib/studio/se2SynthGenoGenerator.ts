/**
 * Synth Geno — local prompt/tag → patch generator (PhenoType-style, no cloud).
 */
import {
  roleLabel,
  se2SynthGenoVoiceFromRole,
  SE2_SYNTH_GENO_RANDOM_PROMPTS,
} from '@/app/lib/studio/se2SynthGenoPresets';
import type {
  Se2SynthGenoGenerateResult,
  Se2SynthGenoRole,
  Se2SynthGenoVoiceParams,
} from '@/app/lib/studio/se2SynthGenoTypes';

type TagRule = {
  tags: string[];
  apply: (v: Se2SynthGenoVoiceParams, neg: boolean) => void;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tokenizePrompt(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function promptHas(tokens: string[], ...phrases: string[]): boolean {
  const joined = tokens.join(' ');
  return phrases.some((p) => joined.includes(p));
}

function detectRole(tokens: string[]): Se2SynthGenoRole {
  if (
    promptHas(tokens, 'pad', 'ambient', 'atmosphere', 'atmospheric', 'drone', 'wash', 'strings')
  ) {
    return 'pad';
  }
  if (promptHas(tokens, 'bass', 'sub', '808', 'low end', 'woofer')) return 'bass';
  if (promptHas(tokens, 'pluck', 'plucked', 'guitar', 'harp', 'marimba', 'mallet')) return 'pluck';
  if (
    promptHas(tokens, 'lead', 'solo', 'supersaw', 'saw lead', 'hook', 'melody', 'synth lead')
  ) {
    return 'lead';
  }
  if (promptHas(tokens, 'brass', 'horn', 'trumpet', 'trombone')) return 'brass';
  if (promptHas(tokens, 'bell', 'chime', 'glass', 'mallet bell', 'celeste')) return 'bell';
  if (promptHas(tokens, 'fx', 'effect', 'noise', 'riser', 'sweep', 'texture', 'weird')) {
    return 'fx';
  }
  if (promptHas(tokens, 'piano', 'keys', 'rhodes', 'organ', 'electric piano', 'epiano')) {
    return 'keys';
  }
  return 'keys';
}

function buildLabel(role: Se2SynthGenoRole, tokens: string[], matched: string[]): string {
  const adjectives = [
    'warm',
    'bright',
    'dark',
    'soft',
    'hard',
    'wide',
    'deep',
    'shimmer',
    'gritty',
    'analog',
    'digital',
    'lofi',
    'cinematic',
  ];
  const adj = adjectives.find((a) => tokens.includes(a) || matched.includes(a));
  const roleWord = role === 'fx' ? 'FX' : role.charAt(0).toUpperCase() + role.slice(1);
  return adj ? `${adj.charAt(0).toUpperCase()}${adj.slice(1)} ${roleWord}` : roleLabel(role);
}

const TAG_RULES: TagRule[] = [
  {
    tags: ['slow', 'long', 'soft', 'gentle', 'smooth'],
    apply: (v, neg) => {
      if (neg) {
        v.ampAttackMs = clamp(v.ampAttackMs * 0.35, 1, 800);
        v.ampReleaseMs = clamp(v.ampReleaseMs * 0.45, 40, 1200);
      } else {
        v.ampAttackMs = clamp(v.ampAttackMs * 2.2, 40, 1200);
        v.ampReleaseMs = clamp(v.ampReleaseMs * 1.8, 80, 1800);
        v.ampSustain = clamp(v.ampSustain + 0.12, 0, 1);
      }
    },
  },
  {
    tags: ['fast', 'short', 'stab', 'pluck', 'snappy', 'tight', 'perc'],
    apply: (v, neg) => {
      if (neg) {
        v.ampAttackMs = clamp(v.ampAttackMs * 2, 2, 400);
        v.ampDecayMs = clamp(v.ampDecayMs * 1.6, 40, 800);
      } else {
        v.ampAttackMs = clamp(v.ampAttackMs * 0.15, 0.5, 20);
        v.ampDecayMs = clamp(v.ampDecayMs * 0.55, 40, 400);
        v.ampSustain = clamp(v.ampSustain * 0.45, 0, 0.5);
        v.ampReleaseMs = clamp(v.ampReleaseMs * 0.5, 40, 400);
      }
    },
  },
  {
    tags: ['bright', 'sharp', 'harsh', 'cutting'],
    apply: (v, neg) => {
      if (neg) v.filterCutoffHz = clamp(v.filterCutoffHz * 0.55, 80, 16000);
      else v.filterCutoffHz = clamp(v.filterCutoffHz * 1.45, 200, 16000);
    },
  },
  {
    tags: ['dark', 'muffled', 'dull', 'muddy', 'warm'],
    apply: (v, neg) => {
      if (neg) v.filterCutoffHz = clamp(v.filterCutoffHz * 1.35, 200, 16000);
      else v.filterCutoffHz = clamp(v.filterCutoffHz * 0.62, 80, 8000);
    },
  },
  {
    tags: ['wide', 'supersaw', 'unison', 'thick', 'fat', 'massive'],
    apply: (v, neg) => {
      if (neg) {
        v.unisonVoices = 1;
        v.unisonDetuneCents = clamp(v.unisonDetuneCents * 0.4, 0, 40);
      } else {
        v.unisonVoices = clamp(Math.max(v.unisonVoices, 3), 2, 6);
        v.unisonDetuneCents = clamp(v.unisonDetuneCents + 10, 4, 40);
        v.chorusMix = clamp(v.chorusMix + 0.12, 0, 0.55);
      }
    },
  },
  {
    tags: ['mono', 'single', 'focused'],
    apply: (v, neg) => {
      if (!neg) {
        v.unisonVoices = 1;
        v.unisonDetuneCents = 0;
      }
    },
  },
  {
    tags: ['reverb', 'space', 'hall', 'room', 'drenched'],
    apply: (v, neg) => {
      if (neg) v.reverbMix = clamp(v.reverbMix * 0.15, 0, 0.8);
      else v.reverbMix = clamp(v.reverbMix + 0.28, 0, 0.72);
    },
  },
  {
    tags: ['delay', 'echo'],
    apply: (v, neg) => {
      if (neg) v.delayMix = 0;
      else v.delayMix = clamp(v.delayMix + 0.22, 0, 0.55);
    },
  },
  {
    tags: ['chorus', 'shimmer', 'detune'],
    apply: (v, neg) => {
      if (neg) v.chorusMix = clamp(v.chorusMix * 0.2, 0, 0.6);
      else v.chorusMix = clamp(v.chorusMix + 0.2, 0, 0.55);
    },
  },
  {
    tags: ['distort', 'distortion', 'grit', 'gritty', 'drive', 'crunch', 'acid'],
    apply: (v, neg) => {
      if (neg) {
        v.distortion = clamp(v.distortion * 0.2, 0, 1);
        v.filterDrive = clamp(v.filterDrive * 0.5, 0, 1);
      } else {
        v.distortion = clamp(v.distortion + 0.35, 0, 0.85);
        v.filterDrive = clamp(v.filterDrive + 0.25, 0, 1);
        v.filterResonanceQ = clamp(v.filterResonanceQ + 0.6, 0.2, 12);
      }
    },
  },
  {
    tags: ['808', 'sub', 'deep', 'low', 'bass heavy'],
    apply: (v, neg) => {
      if (neg) v.subLevel = clamp(v.subLevel * 0.3, 0, 1);
      else {
        v.role = 'bass';
        v.subLevel = clamp(v.subLevel + 0.35, 0, 0.9);
        v.filterCutoffHz = clamp(v.filterCutoffHz * 0.45, 60, 1200);
        v.osc1Wave = 'sine';
      }
    },
  },
  {
    tags: ['saw', 'supersaw'],
    apply: (v, neg) => {
      if (!neg) {
        v.osc1Wave = 'saw';
        v.osc2Wave = 'saw';
      }
    },
  },
  {
    tags: ['square', 'chip', '8bit', 'retro'],
    apply: (v, neg) => {
      if (!neg) {
        v.osc1Wave = 'square';
        v.filterCutoffHz = clamp(v.filterCutoffHz * 0.85, 200, 12000);
      }
    },
  },
  {
    tags: ['sine', 'pure', 'clean'],
    apply: (v, neg) => {
      if (!neg) {
        v.osc1Wave = 'sine';
        v.distortion = clamp(v.distortion * 0.35, 0, 0.4);
      }
    },
  },
  {
    tags: ['noise', 'hiss', 'breathy'],
    apply: (v, neg) => {
      if (neg) v.noiseLevel = 0;
      else v.noiseLevel = clamp(v.noiseLevel + 0.25, 0, 0.65);
    },
  },
  {
    tags: ['resonant', 'squelt', 'squelch', 'filter'],
    apply: (v, neg) => {
      if (neg) v.filterResonanceQ = clamp(v.filterResonanceQ * 0.6, 0.2, 8);
      else v.filterResonanceQ = clamp(v.filterResonanceQ + 1.2, 0.3, 14);
    },
  },
  {
    tags: ['lofi', 'dusty', 'tape', 'vintage', 'analog'],
    apply: (v, neg) => {
      if (!neg) {
        v.filterCutoffHz = clamp(v.filterCutoffHz * 0.75, 120, 6000);
        v.noiseLevel = clamp(v.noiseLevel + 0.08, 0, 0.35);
        v.chorusMix = clamp(v.chorusMix + 0.06, 0, 0.4);
      }
    },
  },
];

function applyTagRules(voice: Se2SynthGenoVoiceParams, tokens: string[]): string[] {
  const matched: string[] = [];
  const negated = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === 'no' || tokens[i] === 'not' || tokens[i] === 'without') {
      const next = tokens[i + 1];
      if (next) negated.add(next);
    }
  }

  for (const rule of TAG_RULES) {
    const hit = rule.tags.some((tag) => tokens.includes(tag));
    if (!hit) continue;
    const neg = rule.tags.some((tag) => negated.has(tag));
    rule.apply(voice, neg);
    matched.push(neg ? `no ${rule.tags[0]}` : rule.tags[0]!);
  }
  return matched;
}

function jitterVoice(voice: Se2SynthGenoVoiceParams, rng: () => number): void {
  voice.filterCutoffHz = clamp(voice.filterCutoffHz * (0.88 + rng() * 0.24), 80, 16000);
  voice.filterResonanceQ = clamp(voice.filterResonanceQ * (0.85 + rng() * 0.3), 0.2, 14);
  voice.ampAttackMs = clamp(voice.ampAttackMs * (0.82 + rng() * 0.36), 0.5, 1400);
  voice.ampDecayMs = clamp(voice.ampDecayMs * (0.82 + rng() * 0.36), 20, 1400);
  voice.ampReleaseMs = clamp(voice.ampReleaseMs * (0.82 + rng() * 0.36), 30, 1800);
  voice.osc1Level = clamp(voice.osc1Level * (0.9 + rng() * 0.2), 0.05, 1);
  voice.osc2Level = clamp(voice.osc2Level * (0.85 + rng() * 0.3), 0, 1);
  if (rng() > 0.55 && voice.unisonVoices < 5) {
    voice.unisonVoices = clamp(voice.unisonVoices + 1, 1, 6);
  }
}

export function se2SynthGenoRandomPrompt(seed = Date.now()): string {
  const rng = mulberry32(seed);
  const pick = SE2_SYNTH_GENO_RANDOM_PROMPTS[Math.floor(rng() * SE2_SYNTH_GENO_RANDOM_PROMPTS.length)]!;
  return pick;
}

function hashPrompt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Generate a tweakable patch from plain-language prompt (local — no network). */
export function se2SynthGenoGenerateFromPrompt(
  prompt: string,
  opts?: { seed?: number; reroll?: boolean },
): Se2SynthGenoGenerateResult {
  const trimmed = prompt.trim();
  const promptUsed = trimmed || se2SynthGenoRandomPrompt(opts?.seed ?? Date.now());
  const tokens = tokenizePrompt(promptUsed);
  const role = detectRole(tokens);
  const voice = se2SynthGenoVoiceFromRole(role);
  const matchedTags = applyTagRules(voice, tokens);
  voice.label = buildLabel(role, tokens, matchedTags);

  const seed = (opts?.seed ?? hashPrompt(promptUsed)) ^ (opts?.reroll ? 0x9e3779b9 : 0);
  if (opts?.reroll || seed !== 0) {
    jitterVoice(voice, mulberry32(seed));
    if (opts?.reroll) voice.label = `${voice.label} · v${(seed % 997) + 1}`;
  }

  return { voice, matchedTags, promptUsed };
}

export function se2SynthGenoVoiceSummary(v: Se2SynthGenoVoiceParams): string {
  return `${v.label} · ${v.osc1Wave}/${v.osc2Wave} · ${Math.round(v.filterCutoffHz)} Hz`;
}
