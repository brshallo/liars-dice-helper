import type { JSX } from 'react'

/**
 * Shell for the live capture lab. The full UI (camera + upload + detection overlay +
 * manual-correction grid) is filled in once the engines and synthetic generator land.
 */
export function CaptureLab(): JSX.Element {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 20 }}>
      <h1>Dice Capture Lab</h1>
      <p className="muted">
        Isolated experiment — not part of the app. Point a camera or upload a photo of your dice and
        compare how each recognition engine reads them.
      </p>
    </div>
  )
}
