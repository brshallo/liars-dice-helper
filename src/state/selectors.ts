import { faceGroups } from '../lib/grouping'
import { expectedCount, nextBids, probabilityOfBid, unknownDice } from '../lib/probability'
import type { Bid, FaceGroup, TableContext } from '../lib/types'
import { quantityWindow, type QuantityWindow } from '../lib/window'
import type { GameState, Player } from './types'

/** Players still in the game (dice > 0). Eliminated players drop out of play. */
export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.dice > 0)
}

/** Players knocked out this game — shown faded, not as active seats. */
export function eliminatedPlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.dice === 0)
}

export function totalDice(state: GameState): number {
  return activePlayers(state).reduce((sum, p) => sum + p.dice, 0)
}

/** The view of the table the pure probability engine needs. */
export function toTableContext(state: GameState): TableContext {
  return { totalDice: totalDice(state), heldByFace: state.heldByFace, variant: state.variant }
}

/** One probability cell in the grouped matrix. */
export interface MatrixCell {
  quantity: number
  probability: number
}

/** A face group with its per-quantity probabilities and expected count. */
export interface MatrixRow {
  group: FaceGroup
  expected: number
  cells: MatrixCell[]
}

/**
 * Everything the probability panel needs, derived once and shared by all three
 * displays (Combined, Matrix, Inspector). Keeping this in one place means the
 * displays only differ in presentation, never in the numbers they show.
 */
export interface PanelData {
  context: TableContext
  unknown: number
  window: QuantityWindow
  rows: MatrixRow[]
  currentBid: Bid | null
  currentBidProbability: number | null
  /** Legal higher bids ranked by probability — the "what can I safely bid?" hint. */
  suggestions: Array<Bid & { probability: number }>
}

export function derivePanel(state: GameState): PanelData {
  const context = toTableContext(state)
  const groups = faceGroups(context)
  const window = quantityWindow(context)

  const rows: MatrixRow[] = groups.map((group) => {
    const face = group.faces[0] // every face in a group shares the same distribution
    return {
      group,
      expected: expectedCount(context, face),
      cells: window.quantities.map((quantity) => ({
        quantity,
        probability: probabilityOfBid(context, { quantity, face }),
      })),
    }
  })

  const currentBid = state.currentBid
  return {
    context,
    unknown: unknownDice(context),
    window,
    rows,
    currentBid,
    currentBidProbability: currentBid ? probabilityOfBid(context, currentBid) : null,
    suggestions: currentBid ? nextBids(context, currentBid).slice(0, 5) : [],
  }
}
