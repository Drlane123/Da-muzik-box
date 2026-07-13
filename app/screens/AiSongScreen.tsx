import { Music } from 'lucide-react';

const ACCENT = '#D500F9';

/** Placeholder shell — custom generator in development for The Muzik Box. */
export default function AiSongScreen({
  onExport: _onExport,
}: {
  onExport: (dest: string, blob?: Blob) => void;
}) {
  return (
    <div className="flex flex-col h-full" style={{ background: '#2a2a2a', color: '#ccc' }}>
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0 flex-wrap gap-3"
        style={{ borderBottom: '1px solid #2c2c2c', background: '#2c2c2c' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            <Music size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: '#fff' }}>
              AI Music/Song Generator
            </h2>
            <p className="text-xs" style={{ color: '#555' }}>
              Coming soon
            </p>
          </div>
        </div>
        <span
          className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded"
          style={{ color: ACCENT, background: `${ACCENT}12`, border: `1px solid ${ACCENT}33` }}
        >
          Coming soon
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-12 text-center min-h-0">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}33` }}
        >
          <Music size={28} />
        </div>
        <div className="max-w-md flex flex-col gap-3">
          <p className="text-sm font-bold" style={{ color: '#eee' }}>
            AI music/song generator is coming soon
          </p>
          <p className="text-xs leading-relaxed" style={{ color: '#999' }}>
            Stay tuned.
          </p>
          <p className="text-xs leading-relaxed" style={{ color: '#777' }}>
            Custom generators are being built and designed just for the Muzik Box.
          </p>
        </div>
      </div>
    </div>
  );
}
