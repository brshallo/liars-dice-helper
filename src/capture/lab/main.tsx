import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { CaptureLab } from './CaptureLab'

// Separate entry: this mounts the experiment ONLY. The main app never imports it.
createRoot(document.getElementById('lab-root')!).render(
  <StrictMode>
    <CaptureLab />
  </StrictMode>,
)
