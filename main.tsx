import React from 'react'
import ReactDOM from 'react-dom/client'

function DevCompileShell() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 24,
        background: '#0a0a0a',
        color: '#ececf4',
        fontFamily: 'Rajdhani, system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: 22, fontWeight: 700, color: '#d4af37', margin: 0, letterSpacing: '0.12em' }}>
        D A &nbsp; M U Z I K &nbsp; B O X
      </p>
      <p style={{ fontSize: 14, color: '#7cf4c6', margin: 0 }}>Compiling in Cursor…</p>
      <p style={{ fontSize: 12, color: '#9a9ab0', maxWidth: 420, margin: 0, lineHeight: 1.5 }}>
        First dev load compiles the full studio graph. This can take several minutes on Windows — the bar
        freezing does not mean it crashed. Keep this tab open.
      </p>
      <div
        style={{
          width: 280,
          height: 6,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: '40%',
            background: 'linear-gradient(90deg, #7cf4c6, #d4af37)',
            animation: 'dmb-dev-pulse 1.8s ease-in-out infinite alternate',
          }}
        />
      </div>
      <style>{`@keyframes dmb-dev-pulse { from { transform: translateX(-30%); } to { transform: translateX(180%); } }`}</style>
    </div>
  )
}

async function boot() {
  const rootEl = document.getElementById('root')
  if (!rootEl) return

  document.getElementById('boot-splash')?.remove()

  const root = ReactDOM.createRoot(rootEl)
  root.render(<DevCompileShell />)

  const { default: BootApp, runBootPrep } = await import('./app/boot-app.tsx')
  runBootPrep()
  root.render(<BootApp />)
}

void boot()
