import { ReactNode } from 'react';

interface PlaceholderScreenProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  accentColor?: string;
  onExportToStudio?: () => void;
  onExportToArranger?: () => void;
}

export default function PlaceholderScreen({
  title,
  subtitle,
  icon,
  accentColor = '#D500F9',
  onExportToStudio,
  onExportToArranger,
}: PlaceholderScreenProps) {
  return (
    <div
      className="flex flex-col h-full w-full"
      style={{ background: '#2a2a2a', color: '#ccc' }}
    >
      {/* Screen header */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: '1px solid #2c2c2c', background: '#2c2c2c' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${accentColor}22`, color: accentColor }}
          >
            {icon}
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: '#fff' }}>{title}</h2>
            <p className="text-xs" style={{ color: '#555' }}>{subtitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {onExportToStudio && (
            <button
              onClick={onExportToStudio}
              className="px-3 py-1.5 rounded text-xs font-semibold transition-colors"
              style={{ background: '#1a1a2a', color: '#00E5FF', border: '1px solid #00E5FF55' }}
            >
              → Studio Editor
            </button>
          )}
          {onExportToArranger && (
            <button
              onClick={onExportToArranger}
              className="px-3 py-1.5 rounded text-xs font-semibold transition-colors"
              style={{ background: '#2c2c2c', color: '#D500F9', border: '1px solid #D500F955' }}
            >
              → Arranger
            </button>
          )}
        </div>
      </div>

      {/* Coming soon body */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{ background: `${accentColor}15`, color: accentColor }}
        >
          <span style={{ fontSize: 36 }}>{icon}</span>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold mb-1" style={{ color: '#fff' }}>{title}</h3>
          <p className="text-sm" style={{ color: '#555' }}>{subtitle}</p>
          <p className="text-xs mt-3" style={{ color: '#333' }}>
            This module will be implemented in a future task.
          </p>
        </div>

        {/* Decorative grid lines */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-5">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-full"
              style={{
                top: `${(i / 20) * 100}%`,
                height: 1,
                background: accentColor,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
