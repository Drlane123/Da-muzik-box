import { notifyGenoBuildSessionChanged } from '@/app/lib/studio/genoBuildSessionNotify';
import type {
  Se2SynthGenoChordPluginState,
  Se2SynthGenoPluginDraft,
  Se2SynthGenoPluginPartSeeds,
} from '@/app/lib/studio/se2SynthGenoChordPlugin';

export type Se2SynthGenoPluginSession = {
  state: Se2SynthGenoChordPluginState;
  draft: Se2SynthGenoPluginDraft | null;
  partSeeds: Se2SynthGenoPluginPartSeeds;
  selectedBar: number | null;
};

const sessions = new Map<number, Se2SynthGenoPluginSession>();

export function readSe2SynthGenoPluginSession(
  trackIndex: number,
): Se2SynthGenoPluginSession | undefined {
  return sessions.get(trackIndex);
}

export function writeSe2SynthGenoPluginSession(
  trackIndex: number,
  session: Se2SynthGenoPluginSession,
): void {
  sessions.set(trackIndex, session);
  notifyGenoBuildSessionChanged();
}
