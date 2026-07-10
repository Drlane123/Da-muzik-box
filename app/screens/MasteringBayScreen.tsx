'use client';

import '@/app/styles/mastering-bay.css';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { consumePendingMasteringBayImport } from '@/app/lib/masteringBay/masteringBayPendingImport';

import { MasteringBayExportModal } from '@/app/components/masteringBay/MasteringBayExportModal';
import { MasteringBayPresetBar } from '@/app/components/masteringBay/MasteringBayPresetBar';
import type { MasteringBaySourcePreview } from '@/app/components/masteringBay/MasteringBayMiniWaveStrip';
import { MasterVuMeterSidebar } from '@/app/components/masteringBay/MasterVuMeterSidebar';
import { MasterMeterSuite } from '@/app/components/masteringBay/MasterMeterSuite';
import { MasteringBaySourceTrack } from '@/app/components/masteringBay/MasteringBaySourceTrack';
import { MasteringRackChain } from '@/app/components/masteringBay/MasteringRackChain';
import { useMasteringBayEngine } from '@/app/hooks/useMasteringBayEngine';
import { processLiveFromNugen } from '@/app/lib/masteringBay/masteringBayProcessLive';
import {
  DA_MUZIK_BOX_PRESETS,
  DEFAULT_RACK_STATE,
  normalizeRackState,
  type DeNoiseState,
  type MasteringBayPreset,
  type MasteringBayRackState,
} from '@/app/lib/masteringBay/masteringBayPresets';
import type { MasteringBaySourcePayload } from '@/app/lib/masteringBay/masteringBaySourceTrack';

export default function MasteringBayScreen({
  onExport: _onExport,
}: {
  onExport: (dest: string) => void;
}) {
  const [rackState, setRackState] = useState<MasteringBayRackState>(() => structuredClone(DEFAULT_RACK_STATE));
  const [activePresetId, setActivePresetId] = useState(DA_MUZIK_BOX_PRESETS[0].id);
  const [sourcePreview, setSourcePreview] = useState<MasteringBaySourcePreview | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingSe2Import, setPendingSe2Import] = useState<MasteringBaySourcePayload | null>(null);

  const applyPreset = useCallback((preset: MasteringBayPreset) => {
    setRackState(normalizeRackState(preset.state));
    setActivePresetId(preset.id);
  }, []);

  const onDeNoiseChange = useCallback((patch: Partial<DeNoiseState>) => {
    setRackState((prev) => ({
      ...prev,
      deNoise: { ...prev.deNoise, ...patch },
    }));
  }, []);

  const {
    multiSnap,
    nugenSnap,
    transport,
    onSourceLoaded,
    onSourceCleared,
    onSeek,
    onScrubActive,
    syncClipEdit,
    onResetMeters,
  } = useMasteringBayEngine(rackState);

  useEffect(() => {
    const pending = consumePendingMasteringBayImport();
    if (pending) setPendingSe2Import(pending);
  }, []);

  const processLive = useMemo(() => processLiveFromNugen(nugenSnap), [nugenSnap]);

  return (
    <div className="mastering-bay">
      {/* Thin walnut lip via padding (Geno Ultra 5th) — stays on bay edges, never overlays scroll. */}
      <div className="mastering-bay__wood-inner">
        <header className="mastering-bay__topbar">
          <div className="mastering-bay__topbar-left">
            <h1 className="mastering-bay__topbar-title">Mastering Bay</h1>
            <div className="mastering-bay__topbar-sub">Meters up top · racks mid · stereo source along the bottom</div>
          </div>
          <div className="mastering-bay__brand-mark" aria-label="The Muzik Box Mastering">
            The Muzik Box Mastering
          </div>
          <div className="mb-rack__transport-hint">In → BASS X → DMB MATCH → MASTER X1 → Out · De-Noise optional</div>
        </header>

        <MasteringBayPresetBar
          activePresetId={activePresetId}
          rackState={rackState}
          onSelectPreset={applyPreset}
          transport={transport}
          sourcePreview={sourcePreview}
          onSeek={onSeek}
          onDeNoiseChange={onDeNoiseChange}
          processLive={processLive}
          onSaveNewMaster={() => setExportOpen(true)}
        />

        <MasteringBayExportModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          clipEdit={sourcePreview?.clipEdit ?? null}
          rackState={rackState}
        />

        <div className="mastering-bay__workspace">
          <div className="mastering-bay__rack-stack">
            <div className="mb-rack" role="region" aria-label="Mastering rack">
              <div className="mb-rack__main">
                <div className="mb-rack__chassis">
                  <div className="mb-rack__rack-bar">
                    <span className="mb-rack__title">DA-MUZIK BOX MASTERING RACK</span>
                    <span className="mb-rack__slots-count">Meters top · chain row pinned bottom</span>
                  </div>

                  <div className="mb-rack__meter-deck">
                    <MasterMeterSuite variant="top" multiSnap={multiSnap} />
                  </div>

                  <div className="mb-rack__chain-deck">
                    <MasteringRackChain
                      rackState={rackState}
                      onRackChange={setRackState}
                      live={processLive}
                    />
                  </div>

                  <MasteringBaySourceTrack
                    transport={transport}
                    onSourceLoaded={onSourceLoaded}
                    onSourceCleared={onSourceCleared}
                    onPreviewChange={setSourcePreview}
                    onSeek={onSeek}
                    onScrubActive={onScrubActive}
                    syncClipEdit={syncClipEdit}
                    initialSourcePayload={pendingSe2Import}
                    onInitialSourceConsumed={() => setPendingSe2Import(null)}
                  />
                </div>

                <MasterVuMeterSidebar snap={nugenSnap} onResetMeters={onResetMeters} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
