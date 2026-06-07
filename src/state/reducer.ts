import type { Bid, Face } from '../lib/types'
import { FACES } from '../lib/types'
import type { GameState, Player } from './types'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8
export const DEFAULT_STARTING_DICE = 5

const emptyHeld = (): Record<Face, number> => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 })

function makePlayers(count: number, startingDice: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: i === 0 ? 'You' : `Player ${i + 1}`,
    dice: startingDice,
    isYou: i === 0,
  }))
}

export function createGame(playerCount = 5, startingDice = DEFAULT_STARTING_DICE): GameState {
  const count = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, playerCount))
  return {
    players: makePlayers(count, startingDice),
    startingDice,
    heldByFace: emptyHeld(),
    currentBid: null,
    nextId: count + 1,
  }
}

export const initialState: GameState = createGame()

export type GameAction =
  | { type: 'NEW_GAME'; playerCount: number; startingDice: number }
  | { type: 'ADD_PLAYER' }
  | { type: 'REMOVE_PLAYER'; id: string }
  | { type: 'RENAME_PLAYER'; id: string; name: string }
  | { type: 'ADJUST_DICE'; id: string; delta: number }
  | { type: 'SET_HELD'; face: Face; count: number }
  | { type: 'CLEAR_HELD' }
  | { type: 'SET_BID'; bid: Bid | null }

/** Total dice the user currently claims to hold (the known dice). */
function heldSum(held: Record<Face, number>): number {
  return FACES.reduce((s, f) => s + held[f], 0)
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'NEW_GAME':
      return createGame(action.playerCount, action.startingDice)

    case 'ADD_PLAYER': {
      if (state.players.length >= MAX_PLAYERS) return state
      const n = state.nextId
      const player: Player = {
        id: `p${n}`,
        name: `Player ${state.players.length + 1}`,
        dice: state.startingDice,
        isYou: false,
      }
      return { ...state, players: [...state.players, player], nextId: n + 1 }
    }

    case 'REMOVE_PLAYER': {
      if (state.players.length <= MIN_PLAYERS) return state
      const target = state.players.find((p) => p.id === action.id)
      if (target?.isYou) return state // never remove the user's own seat
      return { ...state, players: state.players.filter((p) => p.id !== action.id) }
    }

    case 'RENAME_PLAYER':
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.id ? { ...p, name: action.name } : p,
        ),
      }

    case 'ADJUST_DICE': {
      const players = state.players.map((p) =>
        p.id === action.id ? { ...p, dice: Math.max(0, p.dice + action.delta) } : p,
      )
      // If the user's own dice drop below what they've entered, trim the held dice
      // so we never claim to hold more known dice than we actually have.
      const you = players.find((p) => p.isYou)
      let heldByFace = state.heldByFace
      if (you && heldSum(heldByFace) > you.dice) {
        heldByFace = clampHeldToTotal(heldByFace, you.dice)
      }
      return { ...state, players, heldByFace }
    }

    case 'SET_HELD': {
      const you = state.players.find((p) => p.isYou)
      const youDice = you?.dice ?? 0
      const next = { ...state.heldByFace, [action.face]: Math.max(0, action.count) }
      // Cap total held at the user's own dice count.
      if (heldSum(next) > youDice) return state
      return { ...state, heldByFace: next }
    }

    case 'CLEAR_HELD':
      return { ...state, heldByFace: emptyHeld() }

    case 'SET_BID':
      return { ...state, currentBid: action.bid }

    default:
      return state
  }
}

/** Reduce held counts (highest faces first) until the total fits within `max`. */
function clampHeldToTotal(held: Record<Face, number>, max: number): Record<Face, number> {
  const next = { ...held }
  let over = heldSum(next) - max
  for (let i = FACES.length - 1; i >= 0 && over > 0; i--) {
    const face = FACES[i]
    const take = Math.min(next[face], over)
    next[face] -= take
    over -= take
  }
  return next
}
