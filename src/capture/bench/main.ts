import { engines } from '../engines'

// Separate entry: runs the engine bake-off in the browser and renders a results
// table to the DOM. Filled in fully once synth.ts and the real engines land; for now
// it proves the harness wiring and lists the registered engines.
const root = document.getElementById('bench-root')!
root.innerHTML = `
  <div style="font-family:system-ui;max-width:900px;margin:24px auto;padding:0 16px">
    <h1>Dice Engine Benchmark</h1>
    <p style="color:#666">Registered engines: ${engines.map((e) => e.name).join(', ')}</p>
    <p style="color:#666">Benchmark harness pending synthetic generator + engines.</p>
  </div>
`
