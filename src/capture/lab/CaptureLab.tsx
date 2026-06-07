import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { engines, faceCounts } from '../engines'
import type { DieValue, RecognizeResult } from '../engines'
import './CaptureLab.css'

/** Cap the working canvas width for perf; the overlay scales back up to display size. */
const MAX_WIDTH = 640
const FACES: DieValue[] = [1, 2, 3, 4, 5, 6]

/** Unicode die faces, just for the editable grid labels. */
const FACE_GLYPH: Record<DieValue, string> = {
  1: '⚀',
  2: '⚁',
  3: '⚂',
  4: '⚃',
  5: '⚄',
  6: '⚅',
}

type Counts = Record<DieValue, number>
const EMPTY_COUNTS: Counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }

export function CaptureLab(): JSX.Element {
  // Default engine = the benchmark winner.
  const [engineKey, setEngineKey] = useState('handrolled')
  const engine = engines.find((e) => e.key === engineKey) ?? engines[0]

  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RecognizeResult | null>(null)
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [hasImage, setHasImage] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  // Off-screen working canvas: the downscaled source the engine actually reads.
  const workCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  // On-screen display canvas: source image + detection overlay, drawn at work size.
  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // --- camera lifecycle ----------------------------------------------------
  // Keep the stream in a ref (not state) so cleanup never depends on a stale render.
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOn(false)
  }, [])

  // Always stop the camera when the component unmounts (back button, route change…).
  useEffect(() => stopCamera, [stopCamera])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      setCameraOn(true)
      // The <video> mounts in the same render; attach on the next tick.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
      })
    } catch {
      // Permission denied / no camera: fall back to upload with a friendly note.
      setCameraError('Camera unavailable or permission denied. Use "Upload photo" instead.')
      setCameraOn(false)
    }
  }, [])

  // --- drawing + recognition ----------------------------------------------
  /** Draw a source (image/video) into the work canvas at <=MAX_WIDTH, preserving aspect. */
  const drawToWork = useCallback((src: HTMLImageElement | HTMLVideoElement, sw: number, sh: number) => {
    const scale = Math.min(1, MAX_WIDTH / sw)
    const w = Math.round(sw * scale)
    const h = Math.round(sh * scale)
    const work = workCanvasRef.current
    work.width = w
    work.height = h
    work.getContext('2d')!.drawImage(src, 0, 0, w, h)
  }, [])

  /** Run the active engine on the work canvas and seed the editable grid. */
  const runRecognition = useCallback(async () => {
    const work = workCanvasRef.current
    if (!work.width) return
    setRunning(true)
    try {
      await engine.load()
      const res = await engine.recognize(work)
      setResult(res)
      setCounts(faceCounts(res.dice) as Counts)
      drawOverlay(res)
    } finally {
      setRunning(false)
    }
    // drawOverlay is defined below and is stable enough for this experiment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  /** Paint the work image plus each detection bbox onto the display canvas. */
  const drawOverlay = useCallback((res: RecognizeResult | null) => {
    const display = displayCanvasRef.current
    const work = workCanvasRef.current
    if (!display || !work.width) return
    // Display canvas matches the work canvas 1:1, so bbox pixel coords map directly.
    display.width = work.width
    display.height = work.height
    const ctx = display.getContext('2d')!
    ctx.drawImage(work, 0, 0)
    if (!res) return
    ctx.lineWidth = 2
    ctx.font = 'bold 16px system-ui, sans-serif'
    ctx.textBaseline = 'top'
    for (const d of res.dice) {
      if (!d.bbox) continue
      const [x, y, w, h] = d.bbox
      // Canvas can't read CSS vars, so the palette colors are inlined here (--accent / --good).
      ctx.strokeStyle = '#3fb8af'
      ctx.strokeRect(x, y, w, h)
      const label = String(d.value)
      const tw = ctx.measureText(label).width
      ctx.fillStyle = '#4fb477'
      ctx.fillRect(x, y, tw + 8, 20)
      ctx.fillStyle = '#0e1419'
      ctx.fillText(label, x + 4, y + 2)
    }
  }, [])

  // --- input handlers ------------------------------------------------------
  const captureFrame = useCallback(async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    drawToWork(video, video.videoWidth, video.videoHeight)
    setHasImage(true)
    stopCamera() // freeze the shot; no need to keep the camera live
    await runRecognition()
  }, [drawToWork, runRecognition, stopCamera])

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const img = new Image()
      img.onload = async () => {
        drawToWork(img, img.naturalWidth, img.naturalHeight)
        setHasImage(true)
        URL.revokeObjectURL(img.src)
        await runRecognition()
      }
      img.src = URL.createObjectURL(file)
      // Reset so picking the same file again re-fires onChange.
      e.target.value = ''
    },
    [drawToWork, runRecognition],
  )

  // Re-run when the engine changes (only if we already have an image).
  useEffect(() => {
    if (hasImage) void runRecognition()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineKey])

  // --- editable grid -------------------------------------------------------
  const bump = (face: DieValue, delta: number) =>
    setCounts((c) => ({ ...c, [face]: Math.max(0, c[face] + delta) }))

  const total = FACES.reduce((s, f) => s + counts[f], 0)

  return (
    <div className="lab">
      <header className="lab-head">
        <h1>Dice Capture Lab</h1>
        <p className="muted">
          Isolated experiment, not wired into the app. Capture or upload a photo of your dice; the
          active engine reads the faces, and you correct any miscounts below (or enter dice by hand
          if detection is off). In the app this would fill your held dice.
        </p>
      </header>

      {/* Engine selector */}
      <section className="lab-section">
        <div className="lab-label">Engine</div>
        <div className="engine-row">
          {engines.map((e) => (
            <button
              key={e.key}
              className={e.key === engineKey ? 'engine-tab active' : 'engine-tab'}
              onClick={() => setEngineKey(e.key)}
            >
              {e.name}
            </button>
          ))}
        </div>
      </section>

      {/* Input controls */}
      <section className="lab-section">
        <div className="input-row">
          {!cameraOn ? (
            <button onClick={startCamera}>Use camera</button>
          ) : (
            <button onClick={captureFrame} className="primary">
              Capture
            </button>
          )}
          <label className="upload-btn">
            Upload photo
            <input type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
          </label>
          {cameraOn && (
            <button onClick={stopCamera} className="ghost">
              Cancel
            </button>
          )}
        </div>
        {cameraError && <p className="lab-error">{cameraError}</p>}
      </section>

      {/* Live camera preview */}
      {cameraOn && (
        <section className="lab-section">
          <video ref={videoRef} className="media" playsInline muted />
        </section>
      )}

      {/* Result image + overlay */}
      <section className="lab-section">
        <div className="canvas-wrap">
          <canvas ref={displayCanvasRef} className="media" />
          {!hasImage && !cameraOn && (
            <div className="canvas-empty muted">No image yet — capture or upload one.</div>
          )}
          {running && <div className="canvas-spinner">Reading dice…</div>}
        </div>
        {result && (
          <p className="muted lab-meta">
            {engine.name} · {result.dice.length} die/dice detected · {result.ms.toFixed(1)} ms
          </p>
        )}
      </section>

      {/* Editable face-count grid = manual correction / manual entry */}
      <section className="lab-section">
        <div className="lab-label">
          Your dice <span className="muted">(correct the auto-count, or enter by hand)</span>
        </div>
        <div className="dice-grid">
          {FACES.map((face) => (
            <div key={face} className="die-cell">
              <div className="die-face">{FACE_GLYPH[face]}</div>
              <div className="die-stepper">
                <button onClick={() => bump(face, -1)} disabled={counts[face] === 0} aria-label={`fewer ${face}s`}>
                  −
                </button>
                <span className="die-count">{counts[face]}</span>
                <button onClick={() => bump(face, 1)} aria-label={`more ${face}s`}>
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="lab-total">
          Total dice: <strong>{total}</strong>
        </p>
      </section>
    </div>
  )
}
