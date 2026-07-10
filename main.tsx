import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/app.tsx'
import './app/globals.css'
import './app/styles/touch.css'
import './app/styles/da-muzik-boot-splash.css'
import { applyBeatLabFactoryDefaultsIfNeeded } from './app/lib/creationStation/beatLabFactoryDefaults'
import {
  applySe2FactoryDefaultsIfNeeded,
  forceApplySe2FactoryDefaults,
} from './app/lib/studio/se2FactoryDefaults'
import {
  applySe2OwnerStartupTemplateToSession,
  maybeCaptureExistingSessionAsOwnerStartup,
} from './app/lib/studio/se2OwnerStartupTemplate'
import { registerDaMuzikBoxPwa } from './app/lib/pwa/registerAppPwa'

applyBeatLabFactoryDefaultsIfNeeded()
maybeCaptureExistingSessionAsOwnerStartup()
applySe2FactoryDefaultsIfNeeded()
applySe2OwnerStartupTemplateToSession()

if (typeof window !== 'undefined') {
  void registerDaMuzikBoxPwa()
  ;(window as unknown as { __dmbResetSe2ToFactory?: () => void }).__dmbResetSe2ToFactory = () => {
    forceApplySe2FactoryDefaults()
    window.location.reload()
  }
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            background: '#050508',
            color: '#ececf4',
            fontFamily: 'Rajdhani, system-ui, sans-serif',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 700, color: '#7cf4c6', margin: 0 }}>
            Da Music Box could not start
          </p>
          <p style={{ fontSize: 12, color: '#9a9ab0', maxWidth: 420, margin: 0, lineHeight: 1.5 }}>
            Try a hard refresh (Ctrl+Shift+R). If this keeps happening, note the error below.
          </p>
          <pre
            style={{
              fontSize: 10,
              color: '#6a6a78',
              maxWidth: 520,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid rgba(124,244,198,0.45)',
              background: 'rgba(124,244,198,0.12)',
              color: '#7cf4c6',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
)