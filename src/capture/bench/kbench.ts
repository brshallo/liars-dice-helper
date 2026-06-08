import { handrolledEngine } from '../engines/handrolled'
import { twostageEngine } from '../engines/twostage'
import type { DiceEngine, DieDetection, DieValue } from '../engines/types'
import { scoreDice } from './runner'

// Quantitative benchmark over the Kaggle d6-dice set (real photos, YOLO labels where
// class 0..5 = face 1..6). The point: see how the engines do on REAL angled photos vs
// the synthetic flat-dice suite. Loads from /data/d6-dice (gitignored, see SOURCE.md).

const imgUrls = import.meta.glob('/data/d6-dice/Images/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>
const annRaw = import.meta.glob('/data/d6-dice/Annotations/*.txt', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const baseName = (p: string) => p.split('/').pop()!.replace(/\.(jpg|txt)$/, '')

const truthByName: Record<string, DieValue[]> = {}
for (const [p, text] of Object.entries(annRaw)) {
  truthByName[baseName(p)] = text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => (parseInt(line.trim().split(/\s+/)[0], 10) + 1) as DieValue)
}
const items = Object.entries(imgUrls)
  .map(([p, url]) => ({ name: baseName(p), url, truth: truthByName[baseName(p)] }))
  .filter((it) => it.truth && it.truth.length > 0)

const MAXW = 720

const root = document.getElementById('kbench-root')!
root.style.cssText = 'font-family:system-ui;max-width:1000px;margin:20px auto;padding:0 16px 60px;color:#111'

function loadCanvas(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAXW / img.naturalWidth)
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * scale)
      c.height = Math.round(img.naturalHeight * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      resolve(c)
    }
    img.onerror = reject
    img.src = url
  })
}

interface Agg {
  images: number
  trueTotal: number
  matched: number
  extra: number
  exact: number
  predTotal: number
  ms: number
}
const emptyAgg = (): Agg => ({ images: 0, trueTotal: 0, matched: 0, extra: 0, exact: 0, predTotal: 0, ms: 0 })

function accumulate(a: Agg, dice: DieDetection[], truth: DieValue[], ms: number) {
  const s = scoreDice(dice, truth)
  a.images++
  a.trueTotal += s.trueTotal
  a.matched += s.matched
  a.extra += s.extra
  a.exact += s.exact ? 1 : 0
  a.predTotal += dice.length
  a.ms += ms
}

const pct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(0) + '%' : '—')

function overlay(src: HTMLCanvasElement, dice: DieDetection[]): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  ctx.lineWidth = 2
  ctx.font = 'bold 14px system-ui'
  ctx.textBaseline = 'top'
  for (const d of dice) {
    if (!d.bbox) continue
    const [x, y, w, h] = d.bbox
    ctx.strokeStyle = '#e8552f'
    ctx.strokeRect(x, y, w, h)
    ctx.fillStyle = '#e8552f'
    ctx.fillRect(x, y, 16, 16)
    ctx.fillStyle = '#fff'
    ctx.fillText(String(d.value), x + 3, y + 1)
  }
  return c
}

async function timed(engine: DiceEngine, c: HTMLCanvasElement) {
  const r = await engine.recognize(c)
  return r
}

async function run() {
  root.innerHTML = `<h1>Kaggle d6-dice — real-photo benchmark</h1><p>Loading model + ${items.length} images…</p>`
  await twostageEngine.load().catch(() => {})

  const hr = emptyAgg()
  const ts = emptyAgg()
  const examples: { c: HTMLCanvasElement; dice: DieDetection[]; truth: DieValue[]; name: string }[] = []

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const c = await loadCanvas(it.url)
    const r = await timed(handrolledEngine, c)
    accumulate(hr, r.dice, it.truth, r.ms)
    const rt = await timed(twostageEngine, c)
    accumulate(ts, rt.dice, it.truth, rt.ms)
    if (examples.length < 6) examples.push({ c, dice: rt.dice, truth: it.truth, name: it.name })
    if (i % 10 === 0) root.firstChild!.nextSibling!.textContent = `Processed ${i}/${items.length}…`
  }

  const summarize = (a: Agg, label: string) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px"><b>${label}</b></td>
      <td style="padding:6px">${pct(a.matched, a.trueTotal)} <span style="color:#999">(${a.matched}/${a.trueTotal})</span></td>
      <td style="padding:6px">${pct(a.exact, a.images)}</td>
      <td style="padding:6px">${(a.extra / a.images).toFixed(1)}</td>
      <td style="padding:6px">${(a.predTotal / a.images).toFixed(1)} vs ${(a.trueTotal / a.images).toFixed(1)}</td>
      <td style="padding:6px">${(a.ms / a.images).toFixed(0)} ms</td>
    </tr>`

  root.innerHTML = `
    <h1>Kaggle d6-dice — real-photo benchmark</h1>
    <p style="color:#555">${hr.images} labelled images. Ground truth = each die's top face.
    "Pred vs true count" exposes over/under-counting (e.g. side-face pips).</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <thead><tr style="text-align:left;border-bottom:2px solid #ccc">
        <th style="padding:6px">Engine</th><th>Per-die acc</th><th>Exact-image</th>
        <th>Extra/img</th><th>Avg dice pred vs true</th><th>Mean ms</th>
      </tr></thead>
      <tbody>
        ${summarize(ts, 'Two-stage (CV + CNN)')}
        ${summarize(hr, 'Hand-rolled (pip count)')}
      </tbody>
    </table>
    <h2 style="margin-top:24px">Example reads (two-stage overlay)</h2>
    <div id="kbench-examples" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px"></div>`

  const grid = document.getElementById('kbench-examples')!
  for (const ex of examples) {
    const fig = document.createElement('figure')
    fig.style.cssText = 'margin:0;border:1px solid #ddd;border-radius:8px;padding:8px;background:#fafafa;font-size:12px'
    const ov = overlay(ex.c, ex.dice)
    ov.style.cssText = 'width:100%;height:auto;border-radius:4px'
    fig.appendChild(ov)
    const cap = document.createElement('figcaption')
    cap.style.cssText = 'margin-top:6px;line-height:1.5'
    const sortNums = (v: number[]) => [...v].sort((a, b) => a - b).join(',')
    cap.innerHTML = `truth: <code>${sortNums(ex.truth)}</code> (${ex.truth.length})<br>read: <code>${sortNums(ex.dice.map((d) => d.value))}</code> (${ex.dice.length})`
    fig.appendChild(cap)
    grid.appendChild(fig)
  }

  const summary = (a: Agg) => ({ perDie: a.matched / a.trueTotal, exact: a.exact / a.images, extraPerImg: a.extra / a.images, avgPred: a.predTotal / a.images, avgTrue: a.trueTotal / a.images, images: a.images })
  ;(window as unknown as { __KBENCH__: unknown }).__KBENCH__ = { twostage: summary(ts), hr: summary(hr) }
}

run()
