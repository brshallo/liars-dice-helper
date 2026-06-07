/**
 * Pip classification + clustering pips into dice.
 *
 * Two stages:
 *  1. classifyPips — keep blobs that look like pips (small, round-ish, solid) and
 *     reject the big die-face/background blobs and tiny speckle noise.
 *  2. clusterPips — union-find group of pip centroids that are close together (within
 *     roughly one die width) so each group is one die; its value is the pip count.
 */

import type { Blob } from './components'

// ---- Tunable parameters (kept named so they're easy to sweep in the benchmark). ----

/** A pip's bbox aspect ratio must be near square. */
const MAX_PIP_ASPECT = 2.2
/** A pip is a filled disc; reject hollow/ragged blobs below this fill ratio. */
const MIN_PIP_FILL = 0.45
/** Reject blobs whose area strays too far from the median pip area (×). */
const PIP_AREA_LO = 0.3
const PIP_AREA_HI = 3.0
/**
 * Absolute floor on pip area (px). Real pips on a capture-resolution photo are tens of px
 * across (area in the hundreds); even after a 3x3 denoise, residual speckle that survives
 * is a handful of px. 16 px (~a 4-diameter disc) is comfortably below any real pip yet
 * well above leftover noise. This is the primary absolute speckle gate.
 */
const MIN_PIP_AREA = 16
/** Absolute floor on pip diameter (px) — a real pip is never ~1-2 px wide. */
const MIN_PIP_DIAMETER = 4
/**
 * Two pips belong to the same die if their centroids are within this multiple of the
 * typical pip diameter. On a standard die the diagonal between the two farthest pips
 * (a "6" or "2") is roughly 3–4 pip-diameters, so this is generous but still well under
 * the gap to a neighbouring die.
 */
const SAME_DIE_DIAMETERS = 4.5
/** A standalone die can have at most 6 pips; clamp anything larger. */
const MAX_PIPS_PER_DIE = 6
/**
 * A single-pip cluster (a "1") is the most dangerous false positive: any lone surviving
 * speckle blob masquerades as a die. We only trust a 1-pip die if that pip is a clean,
 * solid, sufficiently large disc — well above the bare classify floor.
 */
const SINGLE_PIP_MIN_AREA = 25
const SINGLE_PIP_MIN_FILL = 0.6
/**
 * Footprint sanity for multi-pip dice: the farthest-apart pips on a real die (a "6"/"2"
 * diagonal) give a bbox ~4 pip-diameters across. If a cluster's bbox is meaningfully
 * larger than that relative to its pip size, it isn't a single die's pip pattern (it's
 * scattered speckle that merely fell within the union-find radius). In pip-diameters.
 */
const MAX_DIE_SPAN_DIAMETERS = 5

export interface PipBlob extends Blob {
  /** Effective diameter used for spacing math (mean of bbox side lengths). */
  diameter: number
}

export interface DieCluster {
  value: 1 | 2 | 3 | 4 | 5 | 6
  bbox: [number, number, number, number]
  pips: PipBlob[]
}

/**
 * Filter blobs down to plausible pips. The area band is set relative to the *median*
 * candidate area, which auto-scales to the photo's resolution / die size.
 */
export function classifyPips(blobs: Blob[]): PipBlob[] {
  // First pass: shape gate (aspect + fill + absolute floor). This removes the giant
  // die-face and background components before we estimate a median size.
  const shaped = blobs.filter((b) => {
    const [, , w, h] = b.bbox
    if (b.area < MIN_PIP_AREA) return false
    if ((w + h) / 2 < MIN_PIP_DIAMETER) return false
    const aspect = Math.max(w, h) / Math.max(1, Math.min(w, h))
    if (aspect > MAX_PIP_ASPECT) return false
    if (b.fillRatio < MIN_PIP_FILL) return false
    return true
  })
  if (shaped.length === 0) return []

  // Median area of the shape-passing blobs → robust scale reference.
  const areas = shaped.map((b) => b.area).sort((a, b) => a - b)
  const medianArea = areas[(areas.length / 2) | 0]
  const lo = medianArea * PIP_AREA_LO
  const hi = medianArea * PIP_AREA_HI

  return shaped
    .filter((b) => b.area >= lo && b.area <= hi)
    .map((b) => {
      const [, , w, h] = b.bbox
      return { ...b, diameter: (w + h) / 2 }
    })
}

/** Union-find (disjoint set) for grouping pips. */
class DSU {
  private parent: number[]
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i)
  }
  find(i: number): number {
    // Path compression keeps repeated finds near O(1).
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]]
      i = this.parent[i]
    }
    return i
  }
  union(a: number, b: number): void {
    this.parent[this.find(a)] = this.find(b)
  }
}

/**
 * Cluster pips into dice. The proximity threshold is derived from the median pip
 * diameter so it scales with the image. Returns one DieCluster per group, value =
 * pip count clamped to 1..6.
 */
export function clusterPips(pips: PipBlob[]): DieCluster[] {
  if (pips.length === 0) return []

  const diams = pips.map((p) => p.diameter).sort((a, b) => a - b)
  const medianDiameter = diams[(diams.length / 2) | 0]
  const maxDist = medianDiameter * SAME_DIE_DIAMETERS
  const maxDistSq = maxDist * maxDist

  const dsu = new DSU(pips.length)
  for (let i = 0; i < pips.length; i++) {
    for (let j = i + 1; j < pips.length; j++) {
      const dx = pips[i].cx - pips[j].cx
      const dy = pips[i].cy - pips[j].cy
      if (dx * dx + dy * dy <= maxDistSq) dsu.union(i, j)
    }
  }

  const groups = new Map<number, PipBlob[]>()
  for (let i = 0; i < pips.length; i++) {
    const root = dsu.find(i)
    const arr = groups.get(root)
    if (arr) arr.push(pips[i])
    else groups.set(root, [pips[i]])
  }

  const clusters: DieCluster[] = []
  for (const members of groups.values()) {
    const count = Math.min(members.length, MAX_PIPS_PER_DIE) as 1 | 2 | 3 | 4 | 5 | 6
    clusters.push({ value: count, bbox: unionBbox(members), pips: members })
  }
  // Stable-ish order: top-to-bottom, left-to-right by cluster centroid.
  clusters.sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0])
  return clusters
}

/**
 * Drop clusters that aren't plausible dice. Two guards, both aimed at noise:
 *  - A lone single pip must be a clean, solid, large-enough disc (else it's a speckle).
 *  - A cluster's bbox must fit within a plausible die footprint for its pip size (else
 *    its pips are scattered noise that merely fell within the clustering radius).
 * Run after clustering so the per-cluster pip size is available for the span check.
 */
export function filterClusters(clusters: DieCluster[]): DieCluster[] {
  return clusters.filter((c) => {
    const meanDiam = c.pips.reduce((s, p) => s + p.diameter, 0) / c.pips.length

    if (c.pips.length === 1) {
      const p = c.pips[0]
      if (p.area < SINGLE_PIP_MIN_AREA) return false
      if (p.fillRatio < SINGLE_PIP_MIN_FILL) return false
      return true
    }

    const [, , w, h] = c.bbox
    const maxSpan = meanDiam * MAX_DIE_SPAN_DIAMETERS
    if (Math.max(w, h) > maxSpan) return false
    return true
  })
}

function unionBbox(members: PipBlob[]): [number, number, number, number] {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const m of members) {
    const [x, y, w, h] = m.bbox
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x + w > maxX) maxX = x + w
    if (y + h > maxY) maxY = y + h
  }
  return [minX, minY, maxX - minX, maxY - minY]
}

/**
 * Score how plausible a set of clusters is, used to pick between the two threshold
 * polarities. Higher is better. Rewards clusters with 1..6 pips and consistent pip
 * sizes; penalises clusters that exceed 6 pips (over-merged / noise).
 */
export function scoreClusters(clusters: DieCluster[]): number {
  if (clusters.length === 0) return -Infinity
  let score = 0
  const allDiams: number[] = []
  for (const c of clusters) {
    const n = c.pips.length
    if (n >= 1 && n <= 6) score += 1
    else score -= 1 // a group with >6 pips is almost certainly noise/merge
    for (const p of c.pips) allDiams.push(p.diameter)
  }
  // Reward low relative spread of pip diameters (consistent pips → real dice).
  const mean = allDiams.reduce((s, d) => s + d, 0) / allDiams.length
  const variance = allDiams.reduce((s, d) => s + (d - mean) ** 2, 0) / allDiams.length
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1
  score -= cv // smaller coefficient of variation → higher score
  return score
}
