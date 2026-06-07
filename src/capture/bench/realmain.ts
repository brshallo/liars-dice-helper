import { handrolledEngine } from '../engines/handrolled'
import { opencvEngine } from '../engines/opencv'
import type { DieDetection, DieValue } from '../engines/types'
import { scoreDice } from './runner'

// Real-photo bench: runs the engines over the drop-in sample photos and overlays the
// detections, so we can see how the lightweight detector copes with messy real shots
// (angled dice showing side-face pips, glare, dim light) vs the synthetic suite.

const urls = import.meta.glob('./samples/*.{jpg,jpeg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

// Ground truth = the TOP face of each die (what matters in the game), hand-labelled.
// null = not confidently labelled (used for visual / count inspection only).
const LABELS: Record<string, DieValue[] | null> = {
  'IMG_20211119_171951.jpg': [2, 1, 5, 6, 6, 5, 4],
  'IMG_20211119_172031.jpg': [1, 4, 3, 4],
  'IMG_20211119_172109.jpg': [1, 3, 1, 2, 4, 1, 2],
  'IMG_20211119_172316.jpg': null,
  'IMG_20211119_172431.jpg': [2, 3, 1],
  'IMG_20211119_172658.jpg': [5, 2],
  'dice1.jpg': null,
  'dice3.jpg': [5, 5],
}

const MAXW = 720

const root = document.getElementById('real-root')!
root.style.cssText = 'font-family:system-ui;max-width:1100px;margin:20px auto;padding:0 16px 60px;color:#111'

function loadCanvas(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAXW / img.naturalWidth)
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0, w, h)
      resolve(c)
    }
    img.onerror = reject
    img.src = url
  })
}

function overlay(src: HTMLCanvasElement, dice: DieDetection[]): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  ctx.lineWidth = 2
  ctx.font = 'bold 15px system-ui'
  ctx.textBaseline = 'top'
  for (const d of dice) {
    if (!d.bbox) continue
    const [x, y, w, h] = d.bbox
    ctx.strokeStyle = '#e8552f'
    ctx.strokeRect(x, y, w, h)
    ctx.fillStyle = '#e8552f'
    ctx.fillRect(x, y, 17, 17)
    ctx.fillStyle = '#fff'
    ctx.fillText(String(d.value), x + 3, y + 1)
  }
  return c
}

const sorted = (vs: number[]) => [...vs].sort((a, b) => a - b).join(', ')

async function run() {
  root.innerHTML = '<h1>Real-photo recognition test</h1><p style="color:#666">Loading OpenCV…</p>'
  await opencvEngine.load().catch(() => {})
  root.innerHTML = '<h1>Real-photo recognition test</h1>'

  const totals = { trueDice: 0, matched: 0, extra: 0, labelledImgs: 0, exactImgs: 0 }

  for (const [path, url] of Object.entries(urls)) {
    const name = path.split('/').pop()!
    const truth = LABELS[name] ?? null
    const canvas = await loadCanvas(url)
    const hr = await handrolledEngine.recognize(canvas)
    const ov = await opencvEngine.recognize(canvas)

    const card = document.createElement('figure')
    card.style.cssText =
      'margin:0 0 18px;border:1px solid #ddd;border-radius:8px;padding:10px;display:grid;grid-template-columns:1fr 280px;gap:14px;align-items:start;background:#fafafa'

    const ovCanvas = overlay(canvas, hr.dice)
    ovCanvas.style.cssText = 'width:100%;height:auto;border-radius:4px'
    card.appendChild(ovCanvas)

    const hrVals = hr.dice.map((d) => d.value)
    const info = document.createElement('figcaption')
    info.style.cssText = 'font-size:13px;line-height:1.6'
    let scoreLine = ''
    if (truth) {
      const s = scoreDice(hr.dice, truth)
      totals.trueDice += s.trueTotal
      totals.matched += s.matched
      totals.extra += s.extra
      totals.labelledImgs++
      if (s.exact) totals.exactImgs++
      scoreLine = `<b>matched ${s.matched}/${s.trueTotal}</b>, extra ${s.extra}${s.exact ? ' — EXACT' : ''}`
    }
    info.innerHTML = `
      <b>${name}</b><br>
      <span style="color:#b00">Hand-rolled overlay (boxes = detected dice)</span><br><br>
      truth (top faces): <code>${truth ? sorted(truth) : '—'}</code><br>
      hand-rolled: <code>${sorted(hrVals)}</code> <span style="color:#888">(${hrVals.length} dice)</span><br>
      ${scoreLine}<br><br>
      <span style="color:#888">OpenCV: ${ov.dice.length} dice — <code>${sorted(ov.dice.map((d) => d.value))}</code></span>
    `
    card.appendChild(info)
    root.appendChild(card)
  }

  const summary = document.createElement('div')
  summary.style.cssText = 'margin-top:10px;padding:12px;border:2px solid #333;border-radius:8px;font-size:15px'
  const perDie = totals.trueDice ? ((totals.matched / totals.trueDice) * 100).toFixed(0) : '—'
  summary.innerHTML = `<b>Hand-rolled on labelled real photos:</b> per-die ${perDie}% (${totals.matched}/${totals.trueDice}),
    exact images ${totals.exactImgs}/${totals.labelledImgs}, extra/false dice ${totals.extra} total.`
  root.insertBefore(summary, root.children[1])
  ;(window as unknown as { __REAL__: unknown }).__REAL__ = totals
}

run()
