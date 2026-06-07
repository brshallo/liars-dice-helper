import { binomAtLeast } from './binomial'
import { FACE_PROB, FACES, type Bid, type Face, type TableContext } from './types'

/** How many dice the user holds in total (the known dice). */
export function heldTotal(ctx: TableContext): number {
  return FACES.reduce((sum, f) => sum + (ctx.heldByFace[f] ?? 0), 0)
}

/** Dice whose value the user does NOT know — each independently 1/6 to show a face. */
export function unknownDice(ctx: TableContext): number {
  return Math.max(0, ctx.totalDice - heldTotal(ctx))
}

/**
 * P(at least `quantity` of `face` exist across the whole table), given the user's
 * own dice. The held dice of that face are a guaranteed floor, so we only need the
 * remaining (quantity - held) to come from the unknown pool:
 *
 *   P(>= q of f) = P(>= (q - c) among U unknown dice, each 1/6)
 */
export function probabilityOfBid(ctx: TableContext, bid: Bid): number {
  const held = ctx.heldByFace[bid.face] ?? 0
  const needed = bid.quantity - held
  return binomAtLeast(needed, unknownDice(ctx), FACE_PROB)
}

/** Expected total number of `face` on the table = guaranteed floor + 1/6 of unknowns. */
export function expectedCount(ctx: TableContext, face: Face): number {
  return (ctx.heldByFace[face] ?? 0) + unknownDice(ctx) * FACE_PROB
}

/**
 * Suggested legal higher bids ranked by how likely they are to be true — the
 * information a player wants when choosing to raise rather than challenge.
 *
 * A bid is legally higher when it raises the quantity, or keeps the quantity and
 * names a higher face. We enumerate the immediate band (same quantity / +1 / +2)
 * which covers every realistic next move, then sort by probability.
 */
export function nextBids(ctx: TableContext, current: Bid): Array<Bid & { probability: number }> {
  const candidates: Bid[] = []
  // Same quantity, a strictly higher face.
  for (const face of FACES) {
    if (face > current.face) candidates.push({ quantity: current.quantity, face })
  }
  // Higher quantity (next two steps), any face.
  for (let q = current.quantity + 1; q <= current.quantity + 2; q++) {
    for (const face of FACES) candidates.push({ quantity: q, face })
  }
  return candidates
    .map((bid) => ({ ...bid, probability: probabilityOfBid(ctx, bid) }))
    .sort((a, b) => b.probability - a.probability)
}
