import { unknownDice } from './probability'
import { FACE_PROB, FACES, type TableContext } from './types'

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
  const sd = Math.sqrt(U * FACE_PROB * (1 - FACE_PROB)) // spread of the unknown pool
  const held = FACES.map((f) => ctx.heldByFace[f] ?? 0)
  const minHeld = Math.min(...held)
  const maxHeld = Math.max(...held)

  // Mean count of a face = its guaranteed floor + 1/6 of the unknown dice.
  const lowMean = minHeld + U * FACE_PROB
  const highMean = maxHeld + U * FACE_PROB

  let min = Math.max(1, Math.floor(lowMean - sigma * sd))
  let max = Math.min(ctx.totalDice, Math.ceil(highMean + sigma * sd))
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
    const centre = Math.round((lowMean + highMean) / 2)
    min = Math.max(min, centre - Math.floor(maxWidth / 2))
    max = Math.min(max, min + maxWidth - 1)
    min = Math.max(1, max - maxWidth + 1) // re-seat if we hit the top
  }

  const quantities: number[] = []
  for (let q = min; q <= max; q++) quantities.push(q)
  return { min, max, quantities }
}
