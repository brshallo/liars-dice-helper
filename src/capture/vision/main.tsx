import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { VisionCapture } from './VisionCapture'

// Separate entry: this mounts the Claude-vision experiment ONLY. The main app never imports it.
createRoot(document.getElementById('vision-root')!).render(
  <StrictMode>
    <VisionCapture />
  </StrictMode>,
)
