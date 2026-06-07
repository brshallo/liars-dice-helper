import { describe, it, expect } from 'vitest'
import { faceGroups } from './grouping'
import type { Face, TableContext } from './types'

function ctx(held: Partial<Record<Face, number>> = {}): TableContext {
  return { totalDice: 20, heldByFace: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, ...held } }
}

describe('faceGroups', () => {
  it('collapses all six faces into one group before any dice are entered', () => {
    const groups = faceGroups(ctx())
    expect(groups).toHaveLength(1)
    expect(groups[0]).toEqual({ held: 0, faces: [1, 2, 3, 4, 5, 6] })
  })

  it('groups faces by held count, most-certain first', () => {
    // Hold two 5s, one each of 1/2/3, none of 4/6 -> three distinct groups.
    const groups = faceGroups(ctx({ 5: 2, 1: 1, 2: 1, 3: 1 }))
    expect(groups).toEqual([
      { held: 2, faces: [5] },
      { held: 1, faces: [1, 2, 3] },
      { held: 0, faces: [4, 6] },
    ])
  })

  it('keeps faces ascending within a group', () => {
    const groups = faceGroups(ctx({ 6: 1, 2: 1 }))
    expect(groups[0]).toEqual({ held: 1, faces: [2, 6] })
  })
})
