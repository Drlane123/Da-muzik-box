/**
 * ONNX-backed chord suggester — placeholder.
 *
 * When you're ready to ship the real AI brain from
 * https://github.com/PetrIvan/chord-seq-ai-app (MIT-licensed), this file
 * is where it lives. The {@link ChordSuggester} interface is already
 * stable, so wiring it up is purely additive — nothing in the Chord
 * Builder UI or call sites needs to change.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Integration checklist (do this when you flip the switch):
 *
 *   1. Add `onnxruntime-web` to `package.json`:
 *        bun add onnxruntime-web
 *
 *   2. Copy the ONNX model files out of the upstream repo's
 *      `public/models` directory into our `public/models/chord-seq-ai/`:
 *        - rnn.onnx
 *        - transformer_s.onnx
 *        - transformer_m.onnx
 *        - transformer_l.onnx
 *        - cond_transformer_s.onnx
 *        - cond_transformer_m.onnx
 *        - cond_transformer_l.onnx
 *      Keep the upstream MIT LICENSE + a NOTICE pointing at the source
 *      repo in the same folder (or `THIRD_PARTY_LICENSES.md` at root).
 *
 *   3. Port their token vocabulary into a TypeScript table. The upstream
 *      app keeps it in `src/models/chord_tokens.ts` (or similar). The
 *      vocabulary maps token-ID ↔ chord-symbol; we need to translate
 *      between OUR `ChordSymbol` (Roman numeral) and their token IDs
 *      before/after inference. A reusable adapter goes in this file —
 *      `romanToTokenId` / `tokenIdToRoman`.
 *
 *   4. Create a Web Worker (e.g. `chordSuggesterWorker.ts`) that owns the
 *      `ort.InferenceSession`. Communication shape:
 *        - Main thread → worker: { id, modelVariant, tokens, topK,
 *          temperature, genre?, decade? }
 *        - Worker → main thread: { id, suggestions: { chord, confidence,
 *          rationale }[] }
 *      Keep the session alive across calls so the model stays warm.
 *
 *   5. Implement `makeOnnxSuggester(id: ChordSuggesterId)` below — it
 *      returns a {@link ChordSuggester} that:
 *        - Lazily spins up the worker on the first `suggest()` call
 *        - Translates our Roman-numeral context → token IDs
 *        - Posts to the worker, awaits the response
 *        - Translates token IDs back → Roman numerals, applying any
 *          out-of-mode filtering against `getModePads(mode)` so the
 *          model can't recommend chords that aren't valid in the active
 *          mode.
 *
 *   6. Update {@link CHORD_SUGGESTER_BACKENDS} in `chordSuggester.ts`:
 *      flip `isAvailable: true` for whichever models you've bundled.
 *
 *   7. Update the switch statement in `getChordSuggester()` to import
 *      this module + call `makeOnnxSuggester(id)`.
 *
 *   8. (Optional polish) Save the user's last-used backend ID to
 *      localStorage so the picker remembers their preference across
 *      sessions.
 *
 * That's it — the picker dropdown, confidence bars, Suggest Next button,
 * AI Suggestions strip, and Auto-Generate Song flow all already speak the
 * {@link ChordSuggester} contract and pick this up for free.
 *
 * ─────────────────────────────────────────────────────────────────────
 *
 * Reference: ChordSeqAI architecture details
 *   https://chordseqai.com/wiki/technical/architecture
 *   https://chordseqai.com/wiki/technical/models
 */

import type { ChordSuggester, ChordSuggesterId } from './chordSuggester';

/**
 * Factory for an ONNX-backed suggester. Returns `null` today — the wiring
 * lives here only as a clearly-labelled future hook. When the model files
 * land in `public/models/chord-seq-ai/`, replace the body of this function
 * with the worker-driven implementation described in the checklist above.
 */
export function makeOnnxSuggester(
  _id: ChordSuggesterId,
): ChordSuggester | null {
  return null;
}
