import type { DieDetection, DieValue } from '../engines/types'

/** Multiset of face values, as counts per face 1..6. */
function counts(values: DieValue[]): Record<DieValue, number> {
  const c: Record<DieValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  for (const v of values) c[v]++
  return c
}

export interface SampleScore {
  /** True dice in the image. */
  trueTotal: number
  /** Dice whose face value was matched (multiset intersection of pred vs truth). */
  matched: number
  /** Predicted dice beyond the matches (false positives / wrong faces counted as extra). */
  extra: number
  /** Whole-image exact hit: predicted face multiset equals the truth exactly. */
  exact: boolean
}

/**
 * Compare a prediction to ground truth as MULTISETS of face values — order and
 * position don't matter, only "did we read the right faces". `matched` is the
 * multiset intersection; `exact` requires the counts to match on every face.
 */
export function scoreDice(pred: DieDetection[], truth: DieValue[]): SampleScore {
  const p = counts(pred.map((d) => d.value))
  const t = counts(truth)
  let matched = 0
  let exact = true
  for (let v = 1 as DieValue; v <= 6; v = (v + 1) as DieValue) {
    matched += Math.min(p[v], t[v])
    if (p[v] !== t[v]) exact = false
  }
  return { trueTotal: truth.length, matched, extra: pred.length - matched, exact }
}

export interface ConditionStat {
  n: number
  perDieAcc: number
  exactRate: number
}

export interface EngineReport {
  key: string
  name: string
  approxBytes: number
  loadMs: number
  /** value-level recall: matched dice / total true dice, across all samples. */
  perDieAcc: number
  /** fraction of images read exactly right. */
  exactRate: number
  meanMs: number
  p95Ms: number
  /** extra (false / wrong) dice per image. */
  extraPerImage: number
  byCondition: Record<string, ConditionStat>
  error?: string
}

export interface SampleRun {
  condition: string
  score: SampleScore
  ms: number
}

/** Aggregate per-sample runs into one engine report (overall + by-condition). */
export function aggregate(
  meta: { key: string; name: string; approxBytes: number; loadMs: number; error?: string },
  runs: SampleRun[],
): EngineReport {
  const totalTrue = runs.reduce((s, r) => s + r.score.trueTotal, 0)
  const totalMatched = runs.reduce((s, r) => s + r.score.matched, 0)
  const totalExtra = runs.reduce((s, r) => s + r.score.extra, 0)
  const exactCount = runs.filter((r) => r.score.exact).length

  const msSorted = runs.map((r) => r.ms).sort((a, b) => a - b)
  const p95 = msSorted.length ? msSorted[Math.max(0, Math.ceil(0.95 * msSorted.length) - 1)] : 0
  const mean = msSorted.length ? msSorted.reduce((s, m) => s + m, 0) / msSorted.length : 0

  const byCondition: Record<string, ConditionStat> = {}
  for (const r of runs) {
    const c = (byCondition[r.condition] ??= { n: 0, perDieAcc: 0, exactRate: 0 })
    c.n++
    c.perDieAcc += r.score.matched / Math.max(1, r.score.trueTotal)
    c.exactRate += r.score.exact ? 1 : 0
  }
  for (const c of Object.values(byCondition)) {
    c.perDieAcc /= c.n
    c.exactRate /= c.n
  }

  return {
    ...meta,
    perDieAcc: totalTrue ? totalMatched / totalTrue : 0,
    exactRate: runs.length ? exactCount / runs.length : 0,
    meanMs: mean,
    p95Ms: p95,
    extraPerImage: runs.length ? totalExtra / runs.length : 0,
    byCondition,
  }
}
