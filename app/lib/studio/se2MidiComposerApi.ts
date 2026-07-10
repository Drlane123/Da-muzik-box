import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  newProgressionStepId,
  type GrooveProgressionStep,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import type { Se2ChordGenieAiMidiProvider } from '@/app/lib/studio/se2ChordGenieAiMidi';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';

export type Se2MidiComposerLlmPayload = {
  summary: string;
  chords?: { label: string; beats?: number }[] | null;
  notes?: { pitch: number; startBeat: number; durationBeats: number; velocity?: number }[] | null;
};

export type Se2MidiComposerApiRequest = {
  provider: Se2ChordGenieAiMidiProvider;
  model: string;
  apiKey: string;
  customEndpoint?: string;
  prompt: string;
  systemContext: string;
};

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return null;
}

export function parseSe2MidiComposerLlmPayload(raw: string): Se2MidiComposerLlmPayload | { error: string } {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return { error: 'Model did not return JSON.' };
  try {
    const parsed = JSON.parse(jsonText) as Partial<Se2MidiComposerLlmPayload>;
    if (!parsed || typeof parsed.summary !== 'string') {
      return { error: 'JSON missing summary field.' };
    }
    return {
      summary: parsed.summary.trim(),
      chords: Array.isArray(parsed.chords) ? parsed.chords : null,
      notes: Array.isArray(parsed.notes) ? parsed.notes : null,
    };
  } catch {
    return { error: 'Could not parse model JSON.' };
  }
}

function clampNote(n: {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity?: number;
}): StudioEditor2GenNote {
  return {
    pitch: Math.max(0, Math.min(127, Math.round(n.pitch))),
    startBeat: Math.max(0, n.startBeat),
    durationBeats: Math.max(0.25, n.durationBeats),
    velocity: Math.max(1, Math.min(127, Math.round(n.velocity ?? 88))),
  };
}

export function se2MidiComposerPayloadToNotes(
  payload: Se2MidiComposerLlmPayload,
): StudioEditor2GenNote[] {
  if (!payload.notes?.length) return [];
  return payload.notes.map(clampNote).sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

export function se2MidiComposerPayloadToSteps(
  payload: Se2MidiComposerLlmPayload,
  beatsPerBar: number,
): GrooveProgressionStep[] {
  if (!payload.chords?.length) return [];
  return payload.chords
    .filter((c) => c.label?.trim())
    .map((c) => ({
      id: newProgressionStepId(),
      label: c.label.trim(),
      beats: Math.max(0.25, c.beats ?? beatsPerBar),
      rest: false,
    }));
}

async function callOpenAiCompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  systemContext: string,
  prompt: string,
): Promise<string> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.65,
      messages: [
        { role: 'system', content: systemContext },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty model response.');
  return text;
}

async function callGemini(
  apiKey: string,
  model: string,
  systemContext: string,
  prompt: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemContext}\n\nUser prompt:\n${prompt}` }],
        },
      ],
      generationConfig: { temperature: 0.65 },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Empty Gemini response.');
  return text;
}

export function buildSe2MidiComposerSystemContext(opts: {
  keyName: string;
  scale: string;
  genreLabel: string;
  midiType: string;
  genBars: number;
  beatsPerBar: number;
  noteGridLabel: string;
  keyMode: ChordMode;
}): string {
  return [
    'You are SE2 MIDI Composer inside Da Music Box.',
    'Return ONLY valid JSON — no markdown outside a code block.',
    'Shape:',
    '{"summary":"one sentence","chords":[{"label":"Am7","beats":4}]|null,"notes":[{"pitch":60,"startBeat":0,"durationBeats":0.5,"velocity":90}]|null}',
    `Key: ${opts.keyName} ${opts.scale} (${opts.keyMode}).`,
    `Genre: ${opts.genreLabel}. Type: ${opts.midiType}. Length: ${opts.genBars} bars (${opts.beatsPerBar} beats/bar).`,
    `Note grid preference: ${opts.noteGridLabel}.`,
    'For chord type return chords array. For melody/bass/lead return notes array. For full return both.',
    'Chord labels use standard symbols (Am7, Fmaj7, G7). Notes use MIDI pitch 0-127.',
  ].join('\n');
}

export async function se2MidiComposerCallProvider(
  req: Se2MidiComposerApiRequest,
): Promise<Se2MidiComposerLlmPayload | { error: string }> {
  if (!req.apiKey.trim() && req.provider !== 'custom') {
    return { error: 'Add your API key in Settings.' };
  }
  try {
    let raw = '';
    if (req.provider === 'gemini') {
      raw = await callGemini(req.apiKey, req.model, req.systemContext, req.prompt);
    } else if (req.provider === 'openai') {
      raw = await callOpenAiCompatible(
        'https://api.openai.com/v1/chat/completions',
        req.apiKey,
        req.model,
        req.systemContext,
        req.prompt,
      );
    } else if (req.provider === 'grok') {
      raw = await callOpenAiCompatible(
        'https://api.x.ai/v1/chat/completions',
        req.apiKey,
        req.model,
        req.systemContext,
        req.prompt,
      );
    } else if (req.provider === 'custom') {
      const endpoint = (req.customEndpoint ?? '').trim();
      if (!endpoint) return { error: 'Set a custom API endpoint in Settings.' };
      raw = await callOpenAiCompatible(
        endpoint,
        req.apiKey,
        req.model,
        req.systemContext,
        req.prompt,
      );
    } else {
      return { error: 'Da Music Box engine runs locally — pick Gemini, OpenAI, Grok, or Custom for cloud.' };
    }
    return parseSe2MidiComposerLlmPayload(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg || 'Provider request failed.' };
  }
}
