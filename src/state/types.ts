import type { Bid, Face, Variant } from '../lib/types'

export interface Player {
  id: string
  name: string
  /** Current dice count. 0 means eliminated (out of the game). */
  dice: number
  /** The user's own seat — anchored in the layout, the one whose dice we can know. */
  isYou: boolean
}

export interface GameState {
  players: Player[]
  /** Dice each player starts a new game with (configurable, default 5). */
  startingDice: number
  /** Game variant (no-wilds or ones-wild). */
  variant: Variant
  /** The user's own dice, counted per face. Sum is the dice they've told the app. */
  heldByFace: Record<Face, number>
  /** The bid currently on the table the user is weighing, or null. */
  currentBid: Bid | null
  /** Monotonic id source for added players (avoids Math.random for deterministic ids). */
  nextId: number
}
