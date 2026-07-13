import { Sparkles } from 'lucide-react';

import AiMusicMatchTab from '@/app/components/aiMusicMatch/AiMusicMatchTab';

const MINT = '#7cf4c6';

/** Standalone Music Match module — separate from AI Song Generator. */
export default function AiMusicMatchScreen({
  onOpenGrooveLab,
  onExportStudio,
}: {
  onOpenGrooveLab: () => void;
  onExportStudio: (payload: import('@/app/lib/aiMusicMatch/aiMusicMatchStudioExport').PendingAiMatchStudioImport) => void;
}) {
  return (
    <div className="flex flex-col h-full" style={{ background: '#16161c', color: '#ccc' }}>
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0 flex-wrap gap-3"
        style={{ borderBottom: '1px solid #0d0d14', background: '#0d0d14' }}
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
            <p className="text-xs" style={{ color: '#7a7a88' }}>
              Vocal stem in → key detect → chord roll + bass → Studio Editor 2
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 min-h-0 w-full">
        <AiMusicMatchTab onOpenGrooveLab={onOpenGrooveLab} onExportStudio={onExportStudio} />
      </div>
    </div>
  );
}
