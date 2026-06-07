import { describe, it, expect } from 'vitest'
import { matchProb, effectiveFloor, probabilityOfBid, expectedCount } from './probability'
import { faceGroups } from './grouping'
import type { Face, TableContext, Variant } from './types'

function ctx(
  totalDice: number,
  held: Partial<Record<Face, number>> = {},
  variant: Variant = 'ones-wild',
): TableContext {
  return { totalDice, variant, heldByFace: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, ...held } }
}

describe('ones-wild match rate + floor', () => {
  it('non-1 faces match at 2/6, ones at 1/6', () => {
    expect(matchProb(3, 'ones-wild')).toBeCloseTo(2 / 6, 10)
    expect(matchProb(1, 'ones-wild')).toBeCloseTo(1 / 6, 10)
    expect(matchProb(3, 'no-wilds')).toBeCloseTo(1 / 6, 10)
  })
  it('held 1s are a floor for every non-1 face, but not for the 1s bid', () => {
    const c = ctx(10, { 1: 2, 3: 1 })
    expect(effectiveFloor(c, 3)).toBe(3) // one 3 + two wild 1s
    expect(effectiveFloor(c, 2)).toBe(2) // two wild 1s
    expect(effectiveFloor(c, 1)).toBe(2) // just the 1s
  })
})

describe('ones-wild probabilities', () => {
  it('a non-1 bid uses the 2/6 wild rate', () => {
    const c = ctx(12) // U = 12, no held
    expect(probabilityOfBid(c, { quantity: 1, face: 2 })).toBeCloseTo(1 - (2 / 3) ** 12, 10)
    expect(expectedCount(c, 2)).toBeCloseTo(12 * (1 / 3), 10)
  })
  it('a 1s bid stays at 1/6 (no self-wild)', () => {
    const c = ctx(12)
    expect(probabilityOfBid(c, { quantity: 1, face: 1 })).toBeCloseTo(1 - (5 / 6) ** 12, 10)
    expect(expectedCount(c, 1)).toBeCloseTo(12 * (1 / 6), 10)
  })
  it('wild 1s raise a non-1 bid via the floor', () => {
    const c = ctx(10, { 1: 2 }) // U = 8, floor for face 2 is 2
    expect(probabilityOfBid(c, { quantity: 2, face: 2 })).toBe(1) // floor already meets it
    expect(probabilityOfBid(c, { quantity: 3, face: 2 })).toBeCloseTo(1 - (2 / 3) ** 8, 10)
  })
})

describe('ones-wild grouping', () => {
  it('splits the 1s from everything else even before capture', () => {
    const groups = faceGroups(ctx(20))
    expect(groups).toEqual([
      { held: 0, faces: [2, 3, 4, 5, 6] }, // higher match rate first
      { held: 0, faces: [1] },
    ])
  })
  it('reflects wild 1s in every non-1 group floor', () => {
    const groups = faceGroups(ctx(20, { 1: 1, 3: 1 }))
    expect(groups).toEqual([
      { held: 2, faces: [3] }, // a 3 + the wild
      { held: 1, faces: [2, 4, 5, 6] }, // the wild only
      { held: 1, faces: [1] }, // the literal one
    ])
  })
})
