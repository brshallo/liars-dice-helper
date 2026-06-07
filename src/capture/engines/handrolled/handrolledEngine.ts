/**
 * Hand-rolled, zero-dependency dice recognition.
 *
 * Pipeline (all pure TS, see the sibling modules):
 *   grayscale → adaptive threshold (integral image) → connected components →
 *   classify pips → cluster pips into dice → pick the better threshold polarity.
 *
 * Pips can be darker than the die face (dark pips on a light die) or lighter (white
 * pips on a black die), so we run the whole pipeline for BOTH polarities and keep the
 * result that scores better (more clusters of 1..6 with consistent pip sizes).
 */

import { toImageData, toGray } from '../util'
import type { DiceEngine, DieDetection, RecognizeResult } from '../types'
import { adaptiveThreshold, type GrayImage, type Polarity } from './threshold'
import { connectedComponents } from './components'
import { classifyPips, clusterPips, filterClusters, scoreClusters, type DieCluster } from './pips'

/** Run the detection pipeline for a single polarity. Pure — easy to unit-test. */
export function detectForPolarity(gray: GrayImage, polarity: Polarity): DieCluster[] {
  const mask = adaptiveThreshold(gray, polarity)
  const blobs = connectedComponents(mask)
  const pips = classifyPips(blobs)
  // filterClusters drops noise-shaped dice (lone speckle, implausible footprints).
  return filterClusters(clusterPips(pips))
}

/**
 * Full detection: try both polarities, return the higher-scoring clusters.
 *
 * Note on denoising: we deliberately do NOT pre-blur. Speckle is defeated downstream by
 * the absolute pip-size floor + median-relative area band + single-pip guard (see pips.ts).
 * A box blur over a dense salt-and-pepper field is actually counter-productive — it merges
 * adjacent speckle into pip-sized clumps that then pass the size gate and drag the median
 * pip size down, rejecting the real pips. boxBlur() stays available in threshold.ts for
 * callers that have sparse high-frequency noise, but it is off the default path.
 */
export function detectDice(gray: GrayImage): DieCluster[] {
  const darker = detectForPolarity(gray, 'darker')
  const lighter = detectForPolarity(gray, 'lighter')
  return scoreClusters(lighter) > scoreClusters(darker) ? lighter : darker
}

function clustersToDetections(clusters: DieCluster[]): DieDetection[] {
  return clusters.map((c) => ({
    value: c.value,
    bbox: c.bbox,
    // Confidence is a soft proxy: a die showing 1..6 with several pips reads cleaner.
    confidence: c.pips.length >= 1 && c.pips.length <= 6 ? 0.6 : 0.3,
  }))
}

export const handrolledEngine: DiceEngine = {
  key: 'handrolled',
  name: 'Hand-rolled (pure TS)',
  approxBytes: 0,
  async load() {
    /* no-op: nothing to download or compile. */
  },
  async recognize(src: HTMLCanvasElement | ImageData): Promise<RecognizeResult> {
    const t0 = performance.now()
    const gray = toGray(toImageData(src))
    const clusters = detectDice(gray)
    const dice = clustersToDetections(clusters)
    const ms = performance.now() - t0
    return { dice, ms }
  },
}
