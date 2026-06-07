import type { DiceEngine, RecognizeResult } from './types'

/**
 * Baseline "engine": no auto-detection at all — the user enters dice by hand. It's
 * the control in the benchmark (its accuracy is the floor) and proves the harness
 * works before the real engines land. In the live lab it represents pure manual entry.
 */
export const manualEngine: DiceEngine = {
  key: 'manual',
  name: 'Manual (no detection)',
  approxBytes: 0,
  async load() {},
  async recognize(): Promise<RecognizeResult> {
    return { dice: [], ms: 0 }
  },
}
