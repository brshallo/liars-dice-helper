import { binomAtLeast } from './binomial'
import { FACE_PROB, FACES, type Bid, type Face, type TableContext, type Variant } from './types'

const variantOf = (ctx: TableContext): Variant => ctx.variant ?? 'no-wilds'

/**
 * Probability one unknown die counts toward `face`. No-wilds: always 1/6. Ones-wild:
 * a non-1 face is matched by showing that face OR a 1 → 2/6; a 1 is still just 1/6.
 */
export function matchProb(face: Face, variant: Variant): number {
  return variant === 'ones-wild' && face !== 1 ? 2 * FACE_PROB : FACE_PROB
}

/**
 * Guaranteed count toward `face` from the user's own dice. No-wilds: just held of
 * that face. Ones-wild: a non-1 face also gets every held 1 (wild); a 1 only its 1s.
 */
export function effectiveFloor(ctx: TableContext, face: Face): number {
  const base = ctx.heldByFace[face] ?? 0
  if (variantOf(ctx) === 'ones-wild' && face !== 1) return base + (ctx.heldByFace[1] ?? 0)
  return base
}

/** How many dice the user holds in total (the known dice). */
export function heldTotal(ctx: TableContext): number {
  return FACES.reduce((sum, f) => sum + (ctx.heldByFace[f] ?? 0), 0)
}

/** Dice whose value the user does NOT know. */
export function unknownDice(ctx: TableContext): number {
  return Math.max(0, ctx.totalDice - heldTotal(ctx))
}

/**
 * P(at least `quantity` of `face` exist across the whole table), given the user's
 * own dice and the variant. The effective floor is guaranteed, so we only need the
 * remaining (quantity - floor) to come from the unknown pool at the face's match rate:
 *
 *   P(>= q of f) = P(>= (q - floor) among U unknown dice, each matchProb(f))
 */
export function probabilityOfBid(ctx: TableContext, bid: Bid): number {
  const needed = bid.quantity - effectiveFloor(ctx, bid.face)
  return binomAtLeast(needed, unknownDice(ctx), matchProb(bid.face, variantOf(ctx)))
}

/** Expected total number of `face` on the table = floor + matchProb x unknown dice. */
export function expectedCount(ctx: TableContext, face: Face): number {
  return effectiveFloor(ctx, face) + unknownDice(ctx) * matchProb(face, variantOf(ctx))
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
