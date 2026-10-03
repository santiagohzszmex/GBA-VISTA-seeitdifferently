import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './appearance.css'
import { AppearanceProvider } from './context/AppearanceContext'
import { applyAppearance, readAppearance } from './utils/appearance'

applyAppearance(readAppearance())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppearanceProvider><App /></AppearanceProvider>
  </React.StrictMode>,
)
