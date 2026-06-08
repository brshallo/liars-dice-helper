import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { engines, faceCounts } from '../engines'
import { twostageEngine } from '../engines/twostage'
import type { DieValue, DiceEngine, RecognizeResult } from '../engines'
import './CaptureLab.css'

const MAX_WIDTH = 640
const FACES: DieValue[] = [1, 2, 3, 4, 5, 6]
const FACE_GLYPH: Record<DieValue, string> = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' }

type Counts = Record<DieValue, number>
const EMPTY_COUNTS: Counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }

// Multi-frame fusion: dice are static while the camera moves, so we look for a stable
// CONSENSUS over the recent frames rather than trusting a single (possibly bad) frame.
const BUFFER = 15 // frames remembered
const STABLE_NEED = 9 // identical reads needed in the buffer to auto-finish

/** The selectable engines (two-stage CNN first — the one this flow is built around). */
const LAB_ENGINES: DiceEngine[] = [twostageEngine, ...engines.filter((e) => e.key !== 'manual')]

const signature = (dice: { value: DieValue }[]) =>
  dice
    .map((d) => d.value)
    .sort((a, b) => a - b)
    .join(',')

const countsFromSig = (sig: string): Counts => {
  const c = { ...EMPTY_COUNTS }
  if (sig) for (const v of sig.split(',')) c[Number(v) as DieValue]++
  return c
}

export function CaptureLab(): JSX.Element {
  const [engineKey, setEngineKey] = useState('twostage')
  const engine = LAB_ENGINES.find((e) => e.key === engineKey) ?? LAB_ENGINES[0]
  const engineRef = useRef<DiceEngine>(engine)
  useEffect(() => {
    engineRef.current = engine
  }, [engine])

  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RecognizeResult | null>(null)
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [hasImage, setHasImage] = useState(false)

  // Live-scan state
  const [guidance, setGuidance] = useState('')
  const [stability, setStability] = useState(0)
  const scanningRef = useRef(false)
  const bufferRef = useRef<string[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const workCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // --- drawing helpers -----------------------------------------------------
  const drawToWork = useCallback((src: HTMLImageElement | HTMLVideoElement, sw: number, sh: number) => {
    const scale = Math.min(1, MAX_WIDTH / sw)
    const work = workCanvasRef.current
    work.width = Math.round(sw * scale)
    work.height = Math.round(sh * scale)
    work.getContext('2d')!.drawImage(src, 0, 0, work.width, work.height)
  }, [])

  const drawOverlay = useCallback((res: RecognizeResult | null) => {
    const display = displayCanvasRef.current
    const work = workCanvasRef.current
    if (!display || !work.width) return
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

  // --- camera + live scan --------------------------------------------------
  const stopScan = useCallback(() => {
    scanningRef.current = false
  }, [])

  const stopCamera = useCallback(() => {
    stopScan()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOn(false)
  }, [stopScan])

  useEffect(() => stopCamera, [stopCamera])

  /** Commit a fused result: set the grid, freeze the last frame, stop the camera. */
  const finishScan = useCallback(
    (sig: string, lastRes: RecognizeResult | null) => {
      stopScan()
      setCounts(countsFromSig(sig))
      if (lastRes) setResult(lastRes)
      setHasImage(true)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setCameraOn(false)
      setGuidance('Got it — check the count below.')
    },
    [stopScan],
  )

  const scanLoop = useCallback(async () => {
    if (!scanningRef.current) return
    const video = videoRef.current
    if (video && video.videoWidth) {
      try {
        drawToWork(video, video.videoWidth, video.videoHeight)
        const res = await engineRef.current.recognize(workCanvasRef.current)
        drawOverlay(res)
        setResult(res)

        // Fusion: track the consensus signature over the recent frames.
        const buf = bufferRef.current
        buf.push(signature(res.dice))
        if (buf.length > BUFFER) buf.shift()
        const tally = new Map<string, number>()
        for (const s of buf) tally.set(s, (tally.get(s) ?? 0) + 1)
        let topSig = ''
        let topCount = 0
        for (const [s, n] of tally) if (n > topCount) ((topSig = s), (topCount = n))
        setStability(topCount / BUFFER)

        if (buf.length < BUFFER) {
          setGuidance('Scanning… hold the camera over your dice.')
        } else if (topSig === '') {
          setGuidance('No dice detected — move closer, better light, plainer surface.')
        } else if (topCount >= STABLE_NEED) {
          finishScan(topSig, res)
          return
        } else {
          setGuidance('Hold steady & spread the dice apart…')
        }
      } catch {
        /* a dropped frame is fine; keep scanning */
      }
    }
    if (scanningRef.current) setTimeout(scanLoop, 110)
  }, [drawToWork, drawOverlay, finishScan])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setCameraOn(true)
      setHasImage(false)
      bufferRef.current = []
      setStability(0)
      setGuidance('Starting camera…')
      requestAnimationFrame(async () => {
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
        await engineRef.current.load()
        scanningRef.current = true
        void scanLoop()
      })
    } catch {
      setCameraError('Camera unavailable or permission denied. Use "Upload photo" instead.')
      setCameraOn(false)
    }
  }, [scanLoop])

  // --- single-shot upload path (still useful for testing) ------------------
  const runOnce = useCallback(async () => {
    const work = workCanvasRef.current
    if (!work.width) return
    setRunning(true)
    try {
      await engineRef.current.load()
      const res = await engineRef.current.recognize(work)
      setResult(res)
      setCounts(faceCounts(res.dice) as Counts)
      drawOverlay(res)
    } finally {
      setRunning(false)
    }
  }, [drawOverlay])

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      stopCamera()
      const img = new Image()
      img.onload = async () => {
        drawToWork(img, img.naturalWidth, img.naturalHeight)
        setHasImage(true)
        URL.revokeObjectURL(img.src)
        await runOnce()
      }
      img.src = URL.createObjectURL(file)
      e.target.value = ''
    },
    [drawToWork, runOnce, stopCamera],
  )

  // --- editable grid -------------------------------------------------------
  const bump = (face: DieValue, delta: number) =>
    setCounts((c) => ({ ...c, [face]: Math.max(0, c[face] + delta) }))
  const total = FACES.reduce((s, f) => s + counts[f], 0)

  return (
    <div className="lab">
      <header className="lab-head">
        <h1>Dice Capture Lab</h1>
        <p className="muted">
          Point the camera at your dice — it reads continuously, guides you, and fuses many frames so
          a single bad angle doesn&apos;t matter. It auto-finishes on a stable read; fix any miscount
          below.
        </p>
      </header>

      <section className="lab-section">
        <div className="lab-label">Engine</div>
        <div className="engine-row">
          {LAB_ENGINES.map((e) => (
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

      <section className="lab-section">
        <div className="input-row">
          {!cameraOn ? (
            <button onClick={startCamera} className="primary">
              Scan with camera
            </button>
          ) : (
            <button onClick={() => finishScan(signature(result?.dice ?? []), result)} className="primary">
              Use this read
            </button>
          )}
          <label className="upload-btn">
            Upload photo
            <input type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
          </label>
          {cameraOn && (
            <button onClick={stopCamera} className="ghost">
              Stop
            </button>
          )}
        </div>
        {cameraError && <p className="lab-error">{cameraError}</p>}
      </section>

      {/* Live scan guidance + stability meter */}
      {cameraOn && (
        <section className="lab-section">
          <video ref={videoRef} className="media hidden-video" playsInline muted />
          <div className="scan-guidance">{guidance}</div>
          <div className="scan-meter" aria-label="read stability">
            <div className="scan-meter-fill" style={{ width: `${Math.round(stability * 100)}%` }} />
          </div>
        </section>
      )}

      <section className="lab-section">
        <div className="canvas-wrap">
          <canvas ref={displayCanvasRef} className="media" />
          {!hasImage && !cameraOn && (
            <div className="canvas-empty muted">No image yet — scan or upload.</div>
          )}
          {running && <div className="canvas-spinner">Reading dice…</div>}
        </div>
        {result && !cameraOn && (
          <p className="muted lab-meta">
            {engine.name} · {result.dice.length} die/dice · {result.ms.toFixed(0)} ms/frame
          </p>
        )}
      </section>

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
