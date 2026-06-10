import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GameProvider } from './state/GameContext'

// Theme support: `?theme=<name>` sets a data-theme attribute that a [data-theme]
// block can hook (see themes.css on the themes branch). With no param we leave the
// DOM untouched, so the default "Classic" look is byte-for-byte unchanged.
// Themes whose identity depends on a web font get that font lazily injected here —
// only when active — so the default app makes no font network request.
const THEME_FONTS: Record<string, string> = {
  khan: 'Lato:wght@400;700',
  wikipedia: 'Lora:wght@400;600;700',
  terminal: 'JetBrains+Mono:wght@400;700',
  casino: 'Poppins:wght@400;600;700',
  sepia: 'Libre+Baskerville:wght@400;700',
}

const theme = new URLSearchParams(window.location.search).get('theme') || 'classic'
if (theme !== 'classic') {
  document.documentElement.setAttribute('data-theme', theme)
  const family = THEME_FONTS[theme]
  if (family) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`
    document.head.appendChild(link)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </StrictMode>,
)
