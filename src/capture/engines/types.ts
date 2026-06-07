/**
 * Common contract for every dice-recognition engine, so the lab and the benchmark
 * can treat OpenCV / hand-rolled / ML interchangeably. Kept independent of the main
 * app (its own DieValue type) to reinforce that capture is an isolated experiment.
 */

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6

export interface DieDetection {
  value: DieValue
  /** Pixel box [x, y, w, h] if the engine localises dice; optional for overlays. */
  bbox?: [number, number, number, number]
  /** 0..1 if the engine reports one; optional. */
  confidence?: number
}

export interface RecognizeResult {
  dice: DieDetection[]
  /** Inference time only (ms); excludes one-time load(). */
  ms: number
}

export interface DiceEngine {
  /** Short stable id used in tables/keys. */
  readonly key: string
  /** Human label for display. */
  readonly name: string
  /** Approx download cost (bytes) for the engine's lib/model, for the size column. */
  readonly approxBytes: number
  /** One-time setup (load wasm/model). Safe to call repeatedly; should no-op after first. */
  load(): Promise<void>
  recognize(src: HTMLCanvasElement | ImageData): Promise<RecognizeResult>
}

/** Tally detected dice into face counts — what the app's SET_HELD ultimately needs. */
export function faceCounts(dice: DieDetection[]): Record<DieValue, number> {
  const counts: Record<DieValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  for (const d of dice) counts[d.value]++
  return counts
}
