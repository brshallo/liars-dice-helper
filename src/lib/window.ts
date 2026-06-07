import { effectiveFloor, matchProb, unknownDice } from './probability'
import { FACES, type TableContext } from './types'

export interface QuantityWindow {
  min: number
  max: number
  /** Inclusive list [min..max] — the quantities a display should show as columns. */
  quantities: number[]
}

export interface WindowOptions {
  /** How many standard deviations of the unknown pool to span. Default 1.6 (~89%). */
  sigma?: number
  /** Minimum number of columns, so small tables still give something to scan. */
  minWidth?: number
  /** Hard cap on columns so the heatmap stays legible on a phone (no number-bleed). */
  maxWidth?: number
}

/**
 * Pick the band of bid quantities worth displaying for the current table.
 *
 * The point of this is the thing that makes the panel readable across 2–8 players:
 * with 40 dice the action is around "six or seven of a face"; with a handful left
 * it's "one or two". Rather than a fixed 1–N axis (mostly dead space), we centre on
 * where the probability actually transitions — the mean count of a face plus/minus a
 * couple of standard deviations — and slide automatically as N shrinks over the game.
 *
 * The held floor differs per face group, so we take the low end from the
 * least-held group and the high end from the most-held group, covering every row.
 */
export function quantityWindow(ctx: TableContext, opts: WindowOptions = {}): QuantityWindow {
  const sigma = opts.sigma ?? 1.6
  const minWidth = opts.minWidth ?? 5
  const maxWidth = opts.maxWidth ?? 10

  const U = unknownDice(ctx)
  const variant = ctx.variant ?? 'no-wilds'

  // Per face, the count is floor + Binomial(U, matchProb). Span the band from the
  // lowest face's lower tail to the highest face's upper tail — this covers every row
  // and is correct for both variants (under ones-wild the non-1 faces sit higher).
  let lo = Infinity
  let hi = -Infinity
  let meanSum = 0
  for (const f of FACES) {
    const p = matchProb(f, variant)
    const mean = effectiveFloor(ctx, f) + U * p
    const sd = Math.sqrt(U * p * (1 - p))
    lo = Math.min(lo, mean - sigma * sd)
    hi = Math.max(hi, mean + sigma * sd)
    meanSum += mean
  }
  const centreMean = meanSum / FACES.length

  let min = Math.max(1, Math.floor(lo))
  let max = Math.min(ctx.totalDice, Math.ceil(hi))
  if (max < min) max = min

  // Guarantee a minimum width: grow upward toward N first, then downward toward 1.
  while (max - min + 1 < minWidth) {
    if (max < ctx.totalDice) max++
    else if (min > 1) min--
    else break
  }

  // Cap width so the matrix never bleeds on a phone — keep the band centred on the
  // mean (where the probability actually transitions) and drop the trivial tails.
  if (max - min + 1 > maxWidth) {
    const centre = Math.round(centreMean)
    min = Math.max(min, centre - Math.floor(maxWidth / 2))
    max = Math.min(max, min + maxWidth - 1)
    min = Math.max(1, max - maxWidth + 1) // re-seat if we hit the top
  }

  const quantities: number[] = []
  for (let q = min; q <= max; q++) quantities.push(q)
  return { min, max, quantities }
}
