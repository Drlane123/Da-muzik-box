import { lazy, Suspense } from 'react';
import { Sparkles } from 'lucide-react';

const MINT = '#7cf4c6';

const AiMusicMatchTab = lazy(() => import('@/app/components/aiMusicMatch/AiMusicMatchTab'));

function MatchTabFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <div
        className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: `${MINT}44`, borderTopColor: MINT }}
      />
      <p className="text-sm font-bold" style={{ color: '#ccc' }}>
        Opening AI Music Match…
      </p>
      <p className="text-[11px] max-w-sm leading-relaxed" style={{ color: '#666' }}>
        First open in dev mode compiles this module once (often 30–90s). After that it opens instantly.
        For immediate load, run <code className="text-[#888]">npm run build</code> then{' '}
        <code className="text-[#888]">npm run preview</code>.
      </p>
    </div>
  );
}

/** Standalone Music Match module — separate from AI Song Generator. */
export default function AiMusicMatchScreen({
  onOpenGrooveLab,
  onExportStudio,
}: {
  onOpenGrooveLab: () => void;
  onExportStudio: (payload: import('@/app/lib/aiMusicMatch/aiMusicMatchStudioExport').PendingAiMatchStudioImport) => void;
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
            style={{ background: 'rgba(124, 244, 198, 0.15)', color: MINT }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: '#fff' }}>
              AI Music Match
            </h2>
            <p className="text-xs" style={{ color: '#555' }}>
              Vocal stem in → key detect → chord roll + bass → Studio Editor 2
            </p>
          </div>
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded" style={{ color: MINT, background: `${MINT}15`, border: `1px solid ${MINT}33` }}>
          Shell OK
        </span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 min-h-0 w-full">
        <Suspense fallback={<MatchTabFallback />}>
          <AiMusicMatchTab onOpenGrooveLab={onOpenGrooveLab} onExportStudio={onExportStudio} />
        </Suspense>
      </div>
    </div>
  );
}
