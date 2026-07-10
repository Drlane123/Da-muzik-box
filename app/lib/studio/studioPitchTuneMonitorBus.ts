/** @deprecated Import from studioTrackAnalyserBus — kept for existing imports. */
export {
  bindStudioPitchMonitorEngineAnalyser,
  connectStudioPitchMonitorTap,
  connectStudioVocoderMonitorTap,
  disconnectStudioVocoderMonitorTap,
  getStudioPitchMonitorActiveTrack,
  getStudioPitchMonitorAnalyser,
  getStudioVocoderMonitorAnalyser,
  registerStudioPitchMonitorAnalyser,
  registerStudioPitchMonitorResync,
  retapStudioPitchMonitorSource,
  retapAllStudioPitchMonitorSources,
  setStudioPitchMonitorActiveTrack,
  setStudioPitchMonitorRouteListener,
  studioPitchMonitorUsesEngineTap,
} from '@/app/lib/studio/studioTrackAnalyserBus';

export type { StudioTrackMeterSnapshot } from '@/app/lib/studio/studioTrackAnalyserBus';
