'use client';

import { MultiMeterPanel } from '@/app/components/masteringBay/MultiMeterPanel';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { BarChart3, Clock, Ear, Waves } from 'lucide-react';

type MeterTab = 'analyzer' | 'soundfield' | 'history' | 'intelligibility' | 'spectrogram';

const METER_TABS: { id: MeterTab; label: string; icon: ReactNode }[] = [
  { id: 'analyzer', label: 'MultiMeter', icon: <BarChart3 size={13} /> },
  { id: 'soundfield', label: 'Sound Field', icon: <Waves size={13} /> },
  { id: 'history', label: 'History', icon: <Clock size={13} /> },
  { id: 'intelligibility', label: 'Intelligibility', icon: <Ear size={13} /> },
  { id: 'spectrogram', label: 'Spectrogram', icon: <BarChart3 size={13} /> },
];

import type { MultiMeterSnap } from '@/app/lib/masteringBay/masteringBayMeterIdle';

type Props = {
  variant?: 'top' | 'full';
  multiSnap?: MultiMeterSnap;
};

export function MasterMeterSuite({ variant = 'full', multiSnap }: Props) {
  const [activeTab, setActiveTab] = useState<MeterTab>('analyzer');
  const isTop = variant === 'top';

  const gridClass = useMemo(() => {
    if (isTop || activeTab === 'analyzer') return 'mb-meters__grid--multimeter';
    return 'mb-meters__grid--single';
  }, [activeTab, isTop]);

  if (isTop) {
    return (
      <div className="mb-meters mb-meters--top mb-meters--multimeter-deck">
        <MultiMeterPanel snap={multiSnap} />
      </div>
    );
  }

  return (
    <div className="mb-meters">
      <div className="mb-meters__tabbar">
        {METER_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`mb-meters__tab${activeTab === t.id ? ' mb-meters__tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className={`mb-meters__grid ${gridClass}`}>
        {(activeTab === 'analyzer') && (
          <section className="mb-meters__panel mb-meters__panel--multimeter">
            <MultiMeterPanel snap={multiSnap} />
          </section>
        )}

        {activeTab === 'intelligibility' && (
          <section className="mb-meters__panel mb-meters__panel--placeholder">
            <span>Intelligibility — coming soon</span>
          </section>
        )}
        {activeTab === 'soundfield' && (
          <section className="mb-meters__panel mb-meters__panel--placeholder">
            <span>Sound Field — coming soon</span>
          </section>
        )}
        {activeTab === 'history' && (
          <section className="mb-meters__panel mb-meters__panel--placeholder">
            <span>Loudness history — coming soon</span>
          </section>
        )}
        {activeTab === 'spectrogram' && (
          <section className="mb-meters__panel mb-meters__panel--placeholder">
            <span>Spectrogram — coming soon</span>
          </section>
        )}
      </div>
    </div>
  );
}
