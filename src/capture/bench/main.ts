import { engines } from '../engines'
import type { DieValue } from '../engines/types'
import { CONDITION_NAMES, generateSuite, type SynthSample } from './synth'
import { aggregate, scoreDice, type EngineReport, type SampleRun } from './runner'

// Separate entry: runs the engine bake-off in the browser over the synthetic suite,
// renders accuracy + speed tables, and exposes results on window.__BENCH__ so the
// Playwright harness can read exact numbers. Re-runnable; size knob for suite size.

const root = document.getElementById('bench-root')!
root.style.cssText =
  'font-family:system-ui;max-width:1040px;margin:24px auto;padding:0 16px 64px;color:#15202b'

interface ExampleRead {
  sample: SynthSample
  preds: Record<string, DieValue[]>
}

function acc(v: number): string {
  return `${(v * 100).toFixed(0)}%`
}
function accColor(v: number): string {
  const h = Math.max(0, Math.min(1, v)) * 130
  return `hsl(${h},70%,82%)`
}
function fmtBytes(n: number): string {
  if (n <= 0) return '—'
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} KB`
  return `${n} B`
}

async function run(perCondition: number) {
  render(`<p>Generating ${perCondition * CONDITION_NAMES.length} synthetic images…</p>`)
  const suite = generateSuite(perCondition)
  const reports: EngineReport[] = []
  const examples: ExampleRead[] = CONDITION_NAMES.map((c) => ({
    sample: suite.find((s) => s.condition === c)!,
    preds: {},
  }))

  for (const engine of engines) {
    render(`<p>Running <b>${engine.name}</b> over ${suite.length} images…</p>`)
    const t0 = performance.now()
    let error: string | undefined
    try {
      await engine.load()
    } catch (e) {
      error = `load failed: ${(e as Error).message}`
    }
    const loadMs = performance.now() - t0

    const runs: SampleRun[] = []
    for (const sample of suite) {
      let preds: DieValue[] = []
      let ms = 0
      try {
        const res = await engine.recognize(sample.canvas)
        preds = res.dice.map((d) => d.value)
        ms = res.ms
      } catch {
        /* treat a thrown recognize as an empty read */
      }
      runs.push({ condition: sample.condition, score: scoreDice(preds.map((value) => ({ value })), sample.labels), ms })
      const ex = examples.find((e) => e.sample === sample)
      if (ex) ex.preds[engine.key] = preds
    }
    reports.push(aggregate({ key: engine.key, name: engine.name, approxBytes: engine.approxBytes, loadMs, error }, runs))
  }

  // Expose for Playwright extraction.
  ;(window as unknown as { __BENCH__: unknown }).__BENCH__ = { perCondition, reports }
  renderResults(reports, examples)
}

function renderResults(reports: EngineReport[], examples: ExampleRead[]) {
  const ranked = [...reports].sort((a, b) => b.perDieAcc - a.perDieAcc)

  const main = `
    <h1>Dice Engine Benchmark</h1>
    <p style="color:#555">Synthetic suite, ${reports[0] ? Object.values(reports[0].byCondition).reduce((s, c) => s + c.n, 0) : 0} images.
      Per-die accuracy = correctly-read dice / all dice; exact = whole image read perfectly.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <thead><tr style="text-align:left;border-bottom:2px solid #ccc">
        <th style="padding:6px">Engine</th><th>Per-die acc</th><th>Exact-image</th>
        <th>Extra/img</th><th>Mean ms</th><th>p95 ms</th><th>Load ms</th><th>Size</th>
      </tr></thead>
      <tbody>
        ${ranked
          .map(
            (r) => `<tr style="border-bottom:1px solid #eee">
          <td style="padding:6px"><b>${r.name}</b>${r.error ? ` <span style="color:#c00">(${r.error})</span>` : ''}</td>
          <td style="background:${accColor(r.perDieAcc)};padding:6px;font-weight:600">${acc(r.perDieAcc)}</td>
          <td style="background:${accColor(r.exactRate)};padding:6px">${acc(r.exactRate)}</td>
          <td style="padding:6px">${r.extraPerImage.toFixed(2)}</td>
          <td style="padding:6px">${r.meanMs.toFixed(1)}</td>
          <td style="padding:6px">${r.p95Ms.toFixed(1)}</td>
          <td style="padding:6px">${r.loadMs.toFixed(0)}</td>
          <td style="padding:6px">${fmtBytes(r.approxBytes)}</td>
        </tr>`,
          )
          .join('')}
      </tbody>
    </table>`

  const byCond = `
    <h2 style="margin-top:28px">Per-die accuracy by condition</h2>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead><tr style="text-align:left;border-bottom:2px solid #ccc">
        <th style="padding:6px">Engine</th>${CONDITION_NAMES.map((c) => `<th style="padding:6px">${c}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${ranked
          .map(
            (r) => `<tr style="border-bottom:1px solid #eee"><td style="padding:6px"><b>${r.name}</b></td>${CONDITION_NAMES.map(
              (c) => {
                const v = r.byCondition[c]?.perDieAcc ?? 0
                return `<td style="background:${accColor(v)};padding:6px;text-align:center">${acc(v)}</td>`
              },
            ).join('')}</tr>`,
          )
          .join('')}
      </tbody>
    </table>`

  render(main + byCond)
  renderExamples(examples)
}

function renderExamples(examples: ExampleRead[]) {
  const section = document.createElement('div')
  section.innerHTML = '<h2 style="margin-top:28px">Example reads (first image per condition)</h2>'
  const grid = document.createElement('div')
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px'
  for (const ex of examples) {
    const cell = document.createElement('figure')
    cell.style.cssText = 'margin:0;border:1px solid #ddd;border-radius:8px;padding:8px;background:#fafafa;font-size:12px'
    ex.sample.canvas.style.cssText = 'width:100%;height:auto;border-radius:4px;display:block'
    cell.appendChild(ex.sample.canvas)
    const lines = [`<b>${ex.sample.condition}</b> — truth [${ex.sample.labels.join(', ')}]`]
    for (const engine of engines) {
      if (engine.key === 'manual') continue
      const p = ex.preds[engine.key]
      lines.push(`${engine.name}: [${(p ?? []).join(', ')}]`)
    }
    const cap = document.createElement('figcaption')
    cap.style.cssText = 'margin-top:6px;line-height:1.5'
    cap.innerHTML = lines.join('<br>')
    cell.appendChild(cap)
    grid.appendChild(cell)
  }
  section.appendChild(grid)
  root.appendChild(section)
}

function render(html: string) {
  root.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
      <button id="rerun" style="padding:6px 12px">Re-run</button>
      <label>images/condition: <input id="per" type="number" min="2" max="40" value="${PER}" style="width:60px"></label>
    </div>${html}`
  document.getElementById('rerun')!.addEventListener('click', () => {
    PER = Math.max(2, Math.min(40, Number((document.getElementById('per') as HTMLInputElement).value) || PER))
    run(PER)
  })
}

let PER = 8
run(PER)
