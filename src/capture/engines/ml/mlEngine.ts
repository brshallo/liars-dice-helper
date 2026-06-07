import type { DiceEngine, RecognizeResult } from '../types'

/**
 * ML object-detection arm of the engine bake-off.
 *
 * VERDICT: not viable this session. After researching the available offline,
 * in-browser-loadable dice models (see FINDINGS.md), none could be integrated as a
 * *trustworthy* dice-face reader within the timebox: the closest MIT-licensed
 * candidate (skovy's tfjs-tflite dice model) is reported by its own author to
 * classify faces poorly, and Roboflow Universe models gate weights behind an API
 * key / hosted inference, which would break the client-side-only constraint.
 *
 * Rather than ship a fake or known-bad model, this is an honest STUB that still
 * satisfies the DiceEngine contract so the harness can list the arm. `load()`
 * records unavailability on an internal flag instead of throwing, and `recognize()`
 * returns no detections. Swap in a real model + preprocess/infer/decode pipeline
 * once a validated, hostable model exists (see FINDINGS.md "what it would take").
 */

let available = false

export const mlEngine: DiceEngine = {
  key: 'ml',
  name: 'ML (unavailable)',
  // No model is downloaded — nothing ships. Keep this honest at 0 until a real
  // model is wired up (then set it to the actual on-the-wire model size).
  approxBytes: 0,

  async load(): Promise<void> {
    // No model to fetch/init. We deliberately do NOT throw: the orchestrator wants
    // the arm listed, just flagged unavailable. A real impl would fetch the model
    // here and set `available = true` only on success.
    available = false
  },

  async recognize(): Promise<RecognizeResult> {
    if (!available) return { dice: [], ms: 0 }
    // Unreachable today; placeholder for the real preprocess -> infer -> decode path.
    return { dice: [], ms: 0 }
  },
}
