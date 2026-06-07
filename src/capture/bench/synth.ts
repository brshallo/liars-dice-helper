import type { DieValue } from '../engines/types'

/**
 * Synthetic, labelled dice-image generator. Because it places every pip itself, the
 * ground-truth face values are known exactly — which is what lets the benchmark
 * measure accuracy automatically without hand-labelled photos. Conditions are
 * deliberately adversarial (colour, polarity, lighting, glare, shadow, rotation,
 * blur, noise) so the bake-off surfaces where each engine breaks.
 *
 * Caveat: synthetic != real. Real glare/optics/colours are messier; the live lab and
 * the drop-in samples/ folder are how real dice become the real benchmark later.
 */

export interface SynthSample {
  canvas: HTMLCanvasElement
  labels: DieValue[] // ground truth (order is not meaningful — compared as a multiset)
  condition: string
  seed: number
}

/** Tiny deterministic PRNG so a seed always reproduces the same image. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = (r: () => number, lo: number, hi: number) => lo + r() * (hi - lo)
const pick = <T>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length) % xs.length]

/** Pip layout per face on a unit (0..1) die square — standard western dice. */
const PIPS: Record<DieValue, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.5], [0.73, 0.5], [0.27, 0.73], [0.73, 0.73]],
}

interface DieStyle {
  dieColor: string
  pipColor: string
  shadow: boolean
  glare: boolean
}

/** Draw one die centred at (cx,cy), rotated, with pips for `value`. */
function drawDie(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  angleDeg: number,
  value: DieValue,
  style: DieStyle,
) {
  const s = size
  if (style.shadow) {
    ctx.save()
    ctx.translate(cx + s * 0.06, cy + s * 0.1)
    ctx.filter = 'blur(6px)'
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    roundRect(ctx, -s / 2, -s / 2, s, s, s * 0.18)
    ctx.fill()
    ctx.restore()
  }

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((angleDeg * Math.PI) / 180)

  // Die body
  ctx.fillStyle = style.dieColor
  roundRect(ctx, -s / 2, -s / 2, s, s, s * 0.18)
  ctx.fill()

  // Pips
  const pr = s * 0.085
  ctx.fillStyle = style.pipColor
  for (const [px, py] of PIPS[value]) {
    ctx.beginPath()
    ctx.arc((px - 0.5) * s, (py - 0.5) * s, pr, 0, Math.PI * 2)
    ctx.fill()
  }

  // Specular glare: a bright translucent blob across a corner
  if (style.glare) {
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createRadialGradient(-s * 0.2, -s * 0.2, 1, -s * 0.2, -s * 0.2, s * 0.7)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    roundRect(ctx, -s / 2, -s / 2, s, s, s * 0.18)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Dice palettes as [dieColor, pipColor] — both polarities (dark-on-light, light-on-dark).
const PALETTES: [string, string][] = [
  ['#f3efe6', '#1c1c1c'], // ivory / black
  ['#ffffff', '#202020'], // white / black
  ['#c0352b', '#f5f5f5'], // red / white
  ['#1f4fa8', '#f0f4ff'], // blue / white
  ['#2f9e44', '#f3fff3'], // green / white
  ['#222222', '#f0f0f0'], // black / white
  ['#e8b53b', '#241a00'], // yellow / dark
]

const BACKGROUNDS = ['#7a7f87', '#3a4750', '#9c8f7a', '#d8d2c6', '#20262b']

interface ConditionDef {
  name: string
  build: (r: () => number) => {
    bg: string
    dieCount: number
    palette: [string, string]
    angle: () => number
    shadow: boolean
    glare: boolean
    blurPx: number
    noise: number // 0..1 strength
    lighting: number // 0..1 gradient strength
  }
}

// Each condition isolates/stacks a stressor so the report can attribute failures.
const CONDITIONS: ConditionDef[] = [
  {
    name: 'clean',
    build: (r) => ({ bg: pick(r, BACKGROUNDS), dieCount: 1 + Math.floor(r() * 5), palette: PALETTES[0], angle: () => 0, shadow: false, glare: false, blurPx: 0, noise: 0, lighting: 0 }),
  },
  {
    name: 'colours',
    build: (r) => ({ bg: pick(r, BACKGROUNDS), dieCount: 1 + Math.floor(r() * 5), palette: pick(r, PALETTES), angle: () => 0, shadow: false, glare: false, blurPx: 0, noise: 0, lighting: 0.1 }),
  },
  {
    name: 'rotation',
    build: (r) => ({ bg: pick(r, BACKGROUNDS), dieCount: 1 + Math.floor(r() * 5), palette: pick(r, PALETTES), angle: () => rand(r, -35, 35), shadow: false, glare: false, blurPx: 0, noise: 0, lighting: 0.1 }),
  },
  {
    name: 'lighting',
    build: (r) => ({ bg: pick(r, BACKGROUNDS), dieCount: 1 + Math.floor(r() * 5), palette: pick(r, PALETTES), angle: () => rand(r, -20, 20), shadow: true, glare: false, blurPx: 0, noise: 0, lighting: rand(r, 0.4, 0.75) }),
  },
  {
    name: 'glare',
    build: (r) => ({ bg: pick(r, BACKGROUNDS), dieCount: 1 + Math.floor(r() * 5), palette: pick(r, PALETTES), angle: () => rand(r, -20, 20), shadow: true, glare: true, blurPx: 0, noise: 0, lighting: 0.3 }),
  },
  {
    name: 'blur',
    build: (r) => ({ bg: pick(r, BACKGROUNDS), dieCount: 1 + Math.floor(r() * 5), palette: pick(r, PALETTES), angle: () => rand(r, -20, 20), shadow: true, glare: false, blurPx: rand(r, 1.5, 3.5), noise: 0, lighting: 0.2 }),
  },
  {
    name: 'noise',
    build: (r) => ({ bg: pick(r, BACKGROUNDS), dieCount: 1 + Math.floor(r() * 5), palette: pick(r, PALETTES), angle: () => rand(r, -20, 20), shadow: true, glare: false, blurPx: 0, noise: rand(r, 0.08, 0.2), lighting: 0.2 }),
  },
  {
    name: 'messy', // everything at once
    build: (r) => ({ bg: pick(r, BACKGROUNDS), dieCount: 1 + Math.floor(r() * 5), palette: pick(r, PALETTES), angle: () => rand(r, -35, 35), shadow: true, glare: true, blurPx: rand(r, 1, 2.5), noise: rand(r, 0.05, 0.12), lighting: rand(r, 0.3, 0.6) }),
  },
]

const W = 560
const H = 420

/** Generate one labelled sample for a given condition + seed. */
export function generateSample(conditionIndex: number, seed: number): SynthSample {
  const r = mulberry32(seed)
  const cond = CONDITIONS[conditionIndex % CONDITIONS.length]
  const cfg = cond.build(r)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = cfg.bg
  ctx.fillRect(0, 0, W, H)

  // Place non-overlapping dice
  const size = rand(r, 78, 104)
  const labels: DieValue[] = []
  const placed: [number, number][] = []
  let tries = 0
  while (placed.length < cfg.dieCount && tries < 400) {
    tries++
    const cx = rand(r, size, W - size)
    const cy = rand(r, size, H - size)
    if (placed.every(([x, y]) => Math.hypot(x - cx, y - cy) > size * 1.35)) {
      placed.push([cx, cy])
      const value = (1 + Math.floor(r() * 6)) as DieValue
      labels.push(value)
      drawDie(ctx, cx, cy, size, cfg.angle(), value, {
        dieColor: cfg.palette[0],
        pipColor: cfg.palette[1],
        shadow: cfg.shadow,
        glare: cfg.glare,
      })
    }
  }

  // Lighting gradient (multiply a directional shade over the scene)
  if (cfg.lighting > 0) {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, `rgba(255,255,255,${cfg.lighting})`)
    g.addColorStop(0.5, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(0,0,0,${cfg.lighting})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  // Pixel noise
  if (cfg.noise > 0) addNoise(ctx, cfg.noise, r)

  // Defocus/motion blur as a final pass via an offscreen copy
  if (cfg.blurPx > 0) {
    const blurred = document.createElement('canvas')
    blurred.width = W
    blurred.height = H
    const bctx = blurred.getContext('2d')!
    bctx.filter = `blur(${cfg.blurPx}px)`
    bctx.drawImage(canvas, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(blurred, 0, 0)
  }

  return { canvas, labels, condition: cond.name, seed }
}

function addNoise(ctx: CanvasRenderingContext2D, strength: number, r: () => number) {
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  const amp = strength * 255
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 2 * amp
    d[i] = clamp8(d[i] + n)
    d[i + 1] = clamp8(d[i + 1] + n)
    d[i + 2] = clamp8(d[i + 2] + n)
  }
  ctx.putImageData(img, 0, 0)
}

const clamp8 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

export const CONDITION_NAMES = CONDITIONS.map((c) => c.name)

/**
 * Build a fixed, reproducible suite: `perCondition` samples for every condition.
 * Same inputs -> same images every run, so engine scores are comparable over time.
 */
export function generateSuite(perCondition = 12): SynthSample[] {
  const out: SynthSample[] = []
  for (let ci = 0; ci < CONDITIONS.length; ci++) {
    for (let i = 0; i < perCondition; i++) {
      // Distinct, stable seed per (condition, index).
      out.push(generateSample(ci, (ci + 1) * 100003 + i * 7919))
    }
  }
  return out
}
