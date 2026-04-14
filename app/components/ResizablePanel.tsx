/**
 * ResizablePanel — edge-drag vertical resize for panels
 * Drag the bottom handle to resize. Double-click to reset to default.
 */
import { useRef, useCallback } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  height: number;      // current height in px; 0 = auto (use minH)
  minH?: number;
  maxH?: number;
  defaultH?: number;
  onResize: (h: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function ResizablePanel({
  children, height, minH = 120, maxH = 1200, defaultH = 0, onResize, className, style,
}: ResizablePanelProps) {
  const startYRef = useRef(0);
  const startHRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startYRef.current = e.clientY;
    startHRef.current = panelRef.current?.getBoundingClientRect().height ?? (height || minH);

    function onMove(ev: MouseEvent) {
      const delta = ev.clientY - startYRef.current;
      const newH = Math.max(minH, Math.min(maxH, startHRef.current + delta));
      onResize(newH);
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [height, minH, maxH, onResize]);

  return (
    <div
      ref={panelRef}
      className={className}
      style={{ ...style, height: height > 0 ? height : undefined, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {children}

      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        onDoubleClick={() => onResize(defaultH)}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 6,
          cursor: 'ns-resize', background: 'transparent', zIndex: 30,
          borderBottom: '2px solid #2a2a2a',
        }}
        title="Drag to resize · Double-click to reset"
      >
        {/* Visible grip dots */}
        <div style={{ position: 'absolute', top: 1, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 3 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#333' }} />)}
        </div>
      </div>
    </div>
  );
}
