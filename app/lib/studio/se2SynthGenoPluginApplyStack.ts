/**
 * Build Synth Geno stack parts for piano-roll apply (Chord Generator + Live Chord).
 */
import type { Se2SynthGenoPluginDraft, Se2SynthGenoPluginSoundSelection } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import type { GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { Se2SynthGenoStackPart } from '@/app/lib/studio/se2SynthGenoCompose';
import {
  genoApplyBassSlideExport,
  genoApplyChordGlideExport,
} from '@/app/lib/studio/se2SynthGenoExportGlide';
import { se2SynthGenoLockNotesToKey, type Se2ComposeResolvedKey } from '@/app/lib/studio/se2SynthGenoKeyLock';
import { genoLockPluginMelodyNotesToHarmony } from '@/app/lib/studio/se2SynthGenoMelodyEngine';
import { genoNormalizePluginFillerNotes, genoWarmNormalizeLiveChordNotes, genoNormalizePartNotes, genoNormalizePluginMelodyNotes } from '@/app/lib/studio/se2SynthGenoRanges';
import { genoFillerQuantStep } from '@/app/lib/studio/se2SynthGenoFillerEngine';
import { se2SynthGenoSynthRoleForPluginPart } from '@/app/lib/studio/se2SynthGenoPresets';
import { se2SynthGenoSoundBankEntry } from '@/app/lib/studio/se2SynthGenoSoundBank';

export type Se2SynthGenoPluginApplyStackOpts = {
  draft: Se2SynthGenoPluginDraft;
  sounds: Se2SynthGenoPluginSoundSelection;
  resolvedKey: Se2ComposeResolvedKey;
  beatsPerBar: number;
  bassGlide?: boolean;
  chordGlide?: boolean;
  bpm?: number;
  enableChords?: boolean;
  /** Melody / arp lane */
  enableMelody?: boolean;
  enableBass?: boolean;
  enableFiller?: boolean;
  fillerQuant?: import('@/app/lib/studio/se2SynthGenoFillerEngine').GenoFillerQuant;
  barChordSpecs?: readonly GenoBarChordSpec[];
};

export function se2SynthGenoBuildPluginApplyStack(
  opts: Se2SynthGenoPluginApplyStackOpts,
): Se2SynthGenoStackPart[] {
  const {
    draft,
    sounds,
    resolvedKey,
    beatsPerBar,
    bassGlide = false,
    chordGlide = false,
    bpm = 120,
    enableChords = true,
    enableMelody = true,
    enableBass = true,
    enableFiller = false,
    fillerQuant = '8th',
    barChordSpecs,
  } = opts;

  const stack: Se2SynthGenoStackPart[] = [];
  const melodyPatch = se2SynthGenoSoundBankEntry('melody', sounds.melodyBankId);
  const bassPatch = se2SynthGenoSoundBankEntry('bass', sounds.bassBankId);

  if (enableChords && draft.chordNotes.length > 0) {
    let chordNotes = genoWarmNormalizeLiveChordNotes(draft.chordNotes);
    if (chordGlide) {
      chordNotes = genoApplyChordGlideExport(chordNotes, { bpm });
    }
    stack.push({
      role: 'chords',
      label: 'Chords',
      notes: chordNotes,
      trackKind: 'synthGeno',
      synthGenoRole: se2SynthGenoSynthRoleForPluginPart('chords'),
      synthGenoBankId: sounds.accordBankId,
    });
  }
  if (enableMelody && draft.melodyNotes.length > 0) {
    stack.push({
      role: 'melody',
      label: melodyPatch?.label ?? 'Melody',
      notes: genoNormalizePluginMelodyNotes(
        genoLockPluginMelodyNotesToHarmony(
          draft.melodyNotes,
          draft.harmony,
          beatsPerBar,
          barChordSpecs,
        ),
        beatsPerBar,
        draft.bars,
        barChordSpecs,
      ),
      trackKind: 'synthGeno',
      synthGenoRole: se2SynthGenoSynthRoleForPluginPart('melody'),
      synthGenoBankId: sounds.melodyBankId,
    });
  }
  if (enableBass && draft.bassNotes.length > 0) {
    const locked = genoNormalizePartNotes(
      se2SynthGenoLockNotesToKey(draft.bassNotes, resolvedKey, 'bass'),
      'bass',
    );
    const bassNotes = bassGlide ? genoApplyBassSlideExport(locked, { bpm }) : locked;
    stack.push({
      role: 'bass',
      label: bassPatch?.label ?? 'Bass',
      notes: bassNotes,
      trackKind: 'synthGeno',
      synthGenoRole: se2SynthGenoSynthRoleForPluginPart('bass'),
      synthGenoBankId: sounds.bassBankId,
    });
  }
  if (enableFiller && (draft.fillerNotes?.length ?? 0) > 0) {
    const fillerPatch = se2SynthGenoSoundBankEntry('melody', sounds.fillerBankId);
    stack.push({
      role: 'melody',
      label: fillerPatch?.label ?? 'Note Filler',
      notes: genoNormalizePluginFillerNotes(
        draft.fillerNotes,
        beatsPerBar,
        draft.bars,
        genoFillerQuantStep(fillerQuant, beatsPerBar),
      ),
      trackKind: 'synthGeno',
      synthGenoRole: se2SynthGenoSynthRoleForPluginPart('melody'),
      synthGenoBankId: sounds.fillerBankId,
    });
  }
  return stack;
}
