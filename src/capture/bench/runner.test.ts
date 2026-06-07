import { describe, it, expect } from 'vitest'
import { scoreDice, aggregate, type SampleRun } from './runner'
import type { DieDetection, DieValue } from '../engines/types'

const dice = (...vs: DieValue[]): DieDetection[] => vs.map((value) => ({ value }))

describe('scoreDice', () => {
  it('rewards an exact multiset match regardless of order', () => {
    const s = scoreDice(dice(5, 2, 5), [5, 5, 2])
    expect(s).toEqual({ trueTotal: 3, matched: 3, extra: 0, exact: true })
  })
  it('counts partial matches and extras', () => {
    const s = scoreDice(dice(5, 5, 1), [5, 2]) // predicts one 5 correctly, extra 5 + wrong 1
    expect(s.trueTotal).toBe(2)
    expect(s.matched).toBe(1)
    expect(s.extra).toBe(2)
    expect(s.exact).toBe(false)
  })
  it('handles empty predictions (manual baseline)', () => {
    const s = scoreDice([], [1, 2, 3])
    expect(s).toEqual({ trueTotal: 3, matched: 0, extra: 0, exact: false })
  })
})

describe('aggregate', () => {
  it('computes overall and by-condition stats', () => {
    const runs: SampleRun[] = [
      { condition: 'clean', score: scoreDice(dice(1, 2), [1, 2]), ms: 10 },
      { condition: 'clean', score: scoreDice(dice(3), [3, 4]), ms: 20 },
      { condition: 'glare', score: scoreDice([], [6]), ms: 30 },
    ]
    const r = aggregate({ key: 'x', name: 'X', approxBytes: 0, loadMs: 5 }, runs)
    // matched: clean 2 + clean 1 + glare 0 = 3 of true 2+2+1 = 5
    expect(r.perDieAcc).toBeCloseTo(3 / 5, 6)
    expect(r.exactRate).toBeCloseTo(1 / 3, 6) // only first sample exact
    expect(r.meanMs).toBeCloseTo(20, 6)
    expect(r.byCondition.clean.n).toBe(2)
    expect(r.byCondition.glare.exactRate).toBe(0)
  })
})
