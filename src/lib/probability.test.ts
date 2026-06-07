import { describe, it, expect } from 'vitest'
import {
  unknownDice,
  heldTotal,
  probabilityOfBid,
  expectedCount,
  nextBids,
} from './probability'
import type { Face, TableContext } from './types'

/** Build a context with zero held dice except the overrides given. */
function ctx(totalDice: number, held: Partial<Record<Face, number>> = {}): TableContext {
  return {
    totalDice,
    heldByFace: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, ...held },
  }
}

describe('held/unknown accounting', () => {
  it('counts held dice and the unknown remainder', () => {
    const c = ctx(10, { 5: 2, 1: 1 })
    expect(heldTotal(c)).toBe(3)
    expect(unknownDice(c)).toBe(7)
  })
  it('never reports negative unknowns', () => {
    expect(unknownDice(ctx(2, { 5: 5 }))).toBe(0)
  })
})

describe('probabilityOfBid', () => {
  it('is certain when the held floor already meets the bid', () => {
    const c = ctx(10, { 5: 2 })
    expect(probabilityOfBid(c, { quantity: 1, face: 5 })).toBe(1)
    expect(probabilityOfBid(c, { quantity: 2, face: 5 })).toBe(1)
  })
  it('is impossible when more are needed than unknown dice can supply', () => {
    const c = ctx(10, { 5: 2 }) // U = 8, floor 2 -> max possible 10
    expect(probabilityOfBid(c, { quantity: 11, face: 5 })).toBe(0)
  })
  it('uses only the (quantity - held) shortfall against the unknown pool', () => {
    const c = ctx(10, { 5: 2 }) // U = 8, needed = 1
    expect(probabilityOfBid(c, { quantity: 3, face: 5 })).toBeCloseTo(
      1 - Math.pow(5 / 6, 8),
      10,
    )
  })
  it('with no held dice reduces to a plain binomial', () => {
    const c = ctx(12)
    expect(probabilityOfBid(c, { quantity: 1, face: 3 })).toBeCloseTo(
      1 - Math.pow(5 / 6, 12),
      10,
    )
  })
})

describe('expectedCount', () => {
  it('is the held floor plus 1/6 of the unknown dice', () => {
    const c = ctx(10, { 5: 2 }) // U = 8
    expect(expectedCount(c, 5)).toBeCloseTo(2 + 8 / 6, 10)
    expect(expectedCount(c, 1)).toBeCloseTo(8 / 6, 10)
  })
})

describe('nextBids', () => {
  it('returns only legally-higher bids, ranked by probability', () => {
    const c = ctx(20, { 3: 1 })
    const result = nextBids(c, { quantity: 3, face: 3 })
    // Every suggestion must be a legal raise of (3, face=3).
    for (const b of result) {
      const higher = b.quantity > 3 || (b.quantity === 3 && b.face > 3)
      expect(higher).toBe(true)
    }
    // Sorted by probability, descending.
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].probability).toBeGreaterThanOrEqual(result[i].probability)
    }
    // A smaller raise should never be less likely than a bigger one for the same face.
    const sameFaceP1 = result.find((b) => b.quantity === 4 && b.face === 3)!
    const sameFaceP2 = result.find((b) => b.quantity === 5 && b.face === 3)!
    expect(sameFaceP1.probability).toBeGreaterThanOrEqual(sameFaceP2.probability)
  })
})
