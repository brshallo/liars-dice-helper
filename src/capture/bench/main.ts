import { engines } from '../engines'
import { CONDITION_NAMES, generateSample } from './synth'

// Separate entry: runs the engine bake-off in the browser. Until all engines land,
// this previews the synthetic generator (one labelled sample per condition) so the
// ground-truth images can be eyeballed. Full results table comes with the engines.
const root = document.getElementById('bench-root')!
root.style.cssText = 'font-family:system-ui;max-width:1000px;margin:24px auto;padding:0 16px;color:#111'

const header = document.createElement('div')
header.innerHTML = `
  <h1>Dice Engine Benchmark</h1>
  <p style="color:#555">Engines registered: ${engines.map((e) => e.name).join(', ')}.
  Synthetic ground-truth preview below (one sample per condition).</p>
`
root.appendChild(header)

const gallery = document.createElement('div')
gallery.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px'
root.appendChild(gallery)

CONDITION_NAMES.forEach((name, ci) => {
  const sample = generateSample(ci, (ci + 1) * 100003)
  const cell = document.createElement('figure')
  cell.style.cssText = 'margin:0;border:1px solid #ccc;border-radius:8px;padding:8px;background:#fafafa'
  sample.canvas.style.cssText = 'width:100%;height:auto;border-radius:4px;display:block'
  const cap = document.createElement('figcaption')
  cap.style.cssText = 'margin-top:6px;font-size:13px;color:#333'
  cap.textContent = `${name} — labels: [${sample.labels.join(', ')}]`
  cell.appendChild(sample.canvas)
  cell.appendChild(cap)
  gallery.appendChild(cell)
})
