import { describe, it, expect } from 'vitest'
import { quantityWindow } from './window'
import type { Face, TableContext } from './types'

function ctx(totalDice: number, held: Partial<Record<Face, number>> = {}): TableContext {
  return {
    totalDice,
    heldByFace: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, ...held },
  }
}

describe('quantityWindow', () => {
  it('centres on the action zone for a large table and stays legible', () => {
    // 8 players x 5 dice = 40 unknown; mean count of a face ~6.7.
    const w = quantityWindow(ctx(40))
    expect(w.quantities.length).toBeLessThanOrEqual(10) // capped so it never bleeds on a phone
    expect(w.min).toBeGreaterThanOrEqual(1)
    expect(w.max).toBeLessThanOrEqual(40)
    // The band brackets the expected count (~6.7).
    expect(w.min).toBeLessThanOrEqual(7)
    expect(w.max).toBeGreaterThanOrEqual(7)
  })

  it('caps the column count even with a high held floor', () => {
    // 48 dice + holding five 5s would otherwise span a very wide range.
    const w = quantityWindow(ctx(48, { 5: 5 }), { maxWidth: 9 })
    expect(w.quantities.length).toBeLessThanOrEqual(9)
    expect(w.min).toBeGreaterThanOrEqual(1)
    expect(w.max).toBeLessThanOrEqual(48)
  })

  it('slides down to small quantities as the table shrinks', () => {
    // Late game: 2 players, 2 dice each.
    const w = quantityWindow(ctx(4))
    expect(w.min).toBe(1)
    expect(w.max).toBeLessThanOrEqual(4)
  })

  it('never proposes more dice than exist or fewer than one', () => {
    for (const n of [2, 4, 10, 20, 40]) {
      const w = quantityWindow(ctx(n))
      expect(w.min).toBeGreaterThanOrEqual(1)
      expect(w.max).toBeLessThanOrEqual(n)
    }
  })

  it('respects the minimum width where the table allows it', () => {
    const w = quantityWindow(ctx(20), { minWidth: 6 })
    expect(w.quantities.length).toBeGreaterThanOrEqual(6)
  })

  it('handles a fully-known table (no unknown dice) without crashing', () => {
    const w = quantityWindow(ctx(5, { 5: 3, 1: 2 }))
    expect(w.min).toBeGreaterThanOrEqual(1)
    expect(w.max).toBeLessThanOrEqual(5)
    expect(w.quantities.length).toBeGreaterThan(0)
  })
})
