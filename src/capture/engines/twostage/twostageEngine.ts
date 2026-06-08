import type { DiceEngine, RecognizeResult } from '../types'
import { toCanvas } from '../util'
import { handrolledEngine } from '../handrolled'
import { dedupe, findDice, type DieBox } from './locate'
import { classifyBoxes, loadClassifier } from './classifier'

/** Boxes the classifier reads with less confidence than this are dropped as non-dice. */
const MIN_CONFIDENCE = 0.5

/**
 * Two-stage recognizer: a classic-CV die LOCALIZER finds die boxes, then a tiny TF.js
 * CNN reads each die's TOP FACE (robust to angle, unlike pip-counting). Lazy-loads the
 * model; only used in the capture lab/benchmark, never the main app.
 */
export const twostageEngine: DiceEngine = {
  key: 'twostage',
  name: 'Two-stage (CV locate + CNN classify)',
  approxBytes: 3_400_000, // ~370KB model + TF.js wasm/runtime

  async load(): Promise<void> {
    await loadClassifier()
  },

  async recognize(src): Promise<RecognizeResult> {
    const canvas = toCanvas(src)
    const t0 = performance.now()
    // Candidate boxes from two localizers (union for recall): hand-rolled's pip-cluster
    // boxes + Otsu solid-body boxes. The CNN then reads each and rejects non-dice.
    const hr = await handrolledEngine.recognize(canvas)
    const hrBoxes: DieBox[] = hr.dice
      .filter((d) => d.bbox)
      .map((d) => ({ x: d.bbox![0], y: d.bbox![1], w: d.bbox![2], h: d.bbox![3] }))
    const boxes = dedupe([...hrBoxes, ...findDice(canvas)])
    const reads = await classifyBoxes(canvas, boxes)
    const dice = boxes
      .map((b, i) => ({ read: reads[i], bbox: [b.x, b.y, b.w, b.h] as [number, number, number, number] }))
      // Drop boxes the classifier calls background (value null) or reads with low confidence.
      .filter((d) => d.read.value !== null && d.read.confidence >= MIN_CONFIDENCE)
      .map((d) => ({ value: d.read.value!, bbox: d.bbox, confidence: d.read.confidence }))
    return { dice, ms: performance.now() - t0 }
  },
}
