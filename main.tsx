import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/app.tsx'
import './app/globals.css'
import './app/styles/touch.css'
import { applyBeatLabFactoryDefaultsIfNeeded } from './app/lib/creationStation/beatLabFactoryDefaults'

applyBeatLabFactoryDefaultsIfNeeded()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)