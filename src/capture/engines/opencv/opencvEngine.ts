/**
 * OpenCV (wasm) dice-recognition engine.
 *
 * Strategy: we deliberately do NOT rely on detecting clean die boundaries (hard across
 * arbitrary die colours / glare / shadows). Instead we detect *pips* — the small, round,
 * high-contrast blobs — then cluster them spatially. Each spatial cluster is one die and
 * the cluster size is its face value. Because some dice are dark-pips-on-light and others
 * light-pips-on-dark, we run BOTH threshold polarities and keep whichever yields the more
 * self-consistent set of pip clusters.
 *
 * All Mats are explicitly .delete()'d — emscripten wasm heap is not GC'd.
 */

// Default export is the emscripten `cv` Module (runtime); named members are the typed API.
import cv from '@techstark/opencv-js'
import type { DiceEngine, DieDetection, DieValue, RecognizeResult } from '../types'
import { toImageData } from '../util'

// ----------------------------------------------------------------------------
// Tunable constants — adjust these from the benchmark if recognition is off.
// ----------------------------------------------------------------------------

/** Gaussian blur kernel (odd). Light denoise so thresholding/contours are stable. */
const BLUR_KSIZE = 3
/** adaptiveThreshold neighbourhood (odd). Big enough to span a pip, small enough to
 *  stay local to one die so lighting gradients across the table don't matter. */
const ADAPTIVE_BLOCK_SIZE = 25
/** adaptiveThreshold bias (subtracted from local mean). Higher => fewer, cleaner blobs. */
const ADAPTIVE_C = 7

/** A pip's area, as a fraction of the whole image area. Pips are small; reject anything
 *  outside this band (kills both noise specks and large die/background regions). */
const MIN_PIP_AREA_FRAC = 0.00008
const MAX_PIP_AREA_FRAC = 0.02
/** Circularity = 4*pi*area / perimeter^2; 1.0 is a perfect circle. Pips are round. */
const MIN_CIRCULARITY = 0.6
/** After estimating the median pip radius, reject blobs whose radius is outside
 *  [median/RADIUS_TOL, median*RADIUS_TOL] — pips on a table are near-uniform in size. */
const RADIUS_TOL = 1.8

/** Spatial clustering: two pips belong to the same die if their centres are within
 *  CLUSTER_RADIUS_MULT * medianPipRadius of each other (single-link). A standard die
 *  face spans ~6-8 pip radii corner-to-corner, so this groups one die's pips together
 *  without merging adjacent dice. */
const CLUSTER_RADIUS_MULT = 7
/** A die has 1..6 pips; clusters larger than this are merged-dice artefacts — clamp. */
const MAX_PIPS_PER_DIE = 6

// ----------------------------------------------------------------------------

interface Blob {
  cx: number
  cy: number
  r: number // equivalent radius from area
}

interface Cluster {
  blobs: Blob[]
}

let loaded: Promise<void> | null = null

/** Resolve once the wasm runtime is initialised. Cached so repeat load() calls no-op. */
function ensureLoaded(): Promise<void> {
  if (loaded) return loaded
  loaded = new Promise<void>((resolve) => {
    // emscripten sets this flag true *after* onRuntimeInitialized fires. If wasm is
    // already up (e.g. another engine loaded it), resolve immediately.
    const mod = cv as unknown as {
      onRuntimeInitialized?: () => void
      Mat?: unknown
    }
    if (mod.Mat) {
      resolve()
      return
    }
    mod.onRuntimeInitialized = () => resolve()
  })
  return loaded
}

/** Median of a numeric array (non-mutating). */
function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Run one threshold polarity and return the pip blobs it finds.
 * `invert` chooses THRESH_BINARY_INV (true) vs THRESH_BINARY (false).
 */
function detectBlobs(gray: typeof cv.Mat.prototype, invert: boolean, imgArea: number): Blob[] {
  const bin = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  const blobs: Blob[] = []
  try {
    cv.adaptiveThreshold(
      gray,
      bin,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      invert ? cv.THRESH_BINARY_INV : cv.THRESH_BINARY,
      ADAPTIVE_BLOCK_SIZE,
      ADAPTIVE_C,
    )
    // RETR_LIST returns ALL contours (not just outermost). Critical: a die's edge
    // forms a white ring around its pips after thresholding, so RETR_EXTERNAL would
    // return only that die-sized ring and treat the pips as interior holes. RETR_LIST
    // surfaces the pips too; the area filter then drops the big rings and keeps pips.
    cv.findContours(bin, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

    const minArea = imgArea * MIN_PIP_AREA_FRAC
    const maxArea = imgArea * MAX_PIP_AREA_FRAC

    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i)
      try {
        const area = cv.contourArea(c, false)
        if (area < minArea || area > maxArea) continue
        const perim = cv.arcLength(c, true)
        if (perim <= 0) continue
        const circularity = (4 * Math.PI * area) / (perim * perim)
        if (circularity < MIN_CIRCULARITY) continue
        const m = cv.moments(c, false)
        if (m.m00 === 0) continue
        blobs.push({
          cx: m.m10 / m.m00,
          cy: m.m01 / m.m00,
          r: Math.sqrt(area / Math.PI), // equivalent-circle radius
        })
      } finally {
        c.delete()
      }
    }
  } finally {
    bin.delete()
    contours.delete()
    hierarchy.delete()
  }

  // Reject size outliers: real pips on one table are near-uniform in radius.
  if (blobs.length >= 3) {
    const medR = median(blobs.map((b) => b.r))
    if (medR > 0) {
      return blobs.filter((b) => b.r >= medR / RADIUS_TOL && b.r <= medR * RADIUS_TOL)
    }
  }
  return blobs
}

/** Single-link spatial clustering of pip centroids within `linkDist`. */
function clusterBlobs(blobs: Blob[], linkDist: number): Cluster[] {
  const n = blobs.length
  const visited = new Array<boolean>(n).fill(false)
  const clusters: Cluster[] = []
  const link2 = linkDist * linkDist

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue
    // Flood-fill all blobs reachable from i via the proximity graph.
    const stack = [i]
    visited[i] = true
    const group: Blob[] = []
    while (stack.length) {
      const cur = stack.pop()!
      group.push(blobs[cur])
      for (let j = 0; j < n; j++) {
        if (visited[j]) continue
        const dx = blobs[cur].cx - blobs[j].cx
        const dy = blobs[cur].cy - blobs[j].cy
        if (dx * dx + dy * dy <= link2) {
          visited[j] = true
          stack.push(j)
        }
      }
    }
    clusters.push({ blobs: group })
  }
  return clusters
}

/** Consistency score for a candidate clustering — higher is better. Rewards clusters
 *  with plausible pip counts (1..6) and uniform pip sizes within each die. */
function scoreClusters(clusters: Cluster[]): number {
  if (clusters.length === 0) return -Infinity
  let score = 0
  for (const cl of clusters) {
    const k = cl.blobs.length
    // Plausible face => reward; overfull clusters (merged dice / noise) => penalise.
    score += k >= 1 && k <= MAX_PIPS_PER_DIE ? 1 : -1
    // Penalise radius spread within a die (well-formed faces have uniform pips).
    if (k > 1) {
      const medR = median(cl.blobs.map((b) => b.r))
      if (medR > 0) {
        const spread =
          cl.blobs.reduce((s, b) => s + Math.abs(b.r - medR), 0) / (k * medR)
        score -= spread
      }
    }
  }
  return score
}

function clustersToDetections(clusters: Cluster[]): DieDetection[] {
  const dice: DieDetection[] = []
  for (const cl of clusters) {
    const k = cl.blobs.length
    if (k < 1) continue
    const value = Math.min(k, MAX_PIPS_PER_DIE) as DieValue
    // bbox padded by ~one pip radius so the box encloses the whole face, not just centres.
    const pad = median(cl.blobs.map((b) => b.r)) * 1.5
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const b of cl.blobs) {
      minX = Math.min(minX, b.cx)
      minY = Math.min(minY, b.cy)
      maxX = Math.max(maxX, b.cx)
      maxY = Math.max(maxY, b.cy)
    }
    const x = Math.max(0, minX - pad)
    const y = Math.max(0, minY - pad)
    dice.push({
      value,
      bbox: [Math.round(x), Math.round(y), Math.round(maxX - minX + 2 * pad), Math.round(maxY - minY + 2 * pad)],
      // Lower confidence when we had to clamp an over-full cluster.
      confidence: k <= MAX_PIPS_PER_DIE ? 0.9 : 0.5,
    })
  }
  return dice
}

export const opencvEngine: DiceEngine = {
  key: 'opencv',
  name: 'OpenCV (wasm) pip-clustering',
  approxBytes: 8_000_000,

  async load(): Promise<void> {
    await ensureLoaded()
  },

  async recognize(src: HTMLCanvasElement | ImageData): Promise<RecognizeResult> {
    await ensureLoaded()

    const imageData = toImageData(src)
    const t0 = performance.now()

    const rgba = cv.matFromImageData(imageData)
    const gray = new cv.Mat()
    const blurred = new cv.Mat()
    try {
      cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY)
      cv.GaussianBlur(gray, blurred, new cv.Size(BLUR_KSIZE, BLUR_KSIZE), 0)

      const imgArea = imageData.width * imageData.height
      const linkScale = CLUSTER_RADIUS_MULT

      // Try both polarities; pick the clustering with the better consistency score.
      let best: { clusters: Cluster[]; score: number } | null = null
      for (const invert of [false, true]) {
        const blobs = detectBlobs(blurred, invert, imgArea)
        if (blobs.length === 0) continue
        const medR = median(blobs.map((b) => b.r))
        const linkDist = medR * linkScale
        const clusters = clusterBlobs(blobs, linkDist)
        const score = scoreClusters(clusters)
        if (!best || score > best.score) best = { clusters, score }
      }

      const dice = best ? clustersToDetections(best.clusters) : []
      const ms = performance.now() - t0
      return { dice, ms }
    } finally {
      rgba.delete()
      gray.delete()
      blurred.delete()
    }
  },
}
