import { describe, it, expect } from 'vitest'
import { createGame, gameReducer, MAX_PLAYERS } from './reducer'
import {
  activePlayers,
  eliminatedPlayers,
  derivePanel,
  toTableContext,
  totalDice,
} from './selectors'

describe('createGame', () => {
  it('clamps player count to 2..8 and seats the user first', () => {
    expect(createGame(1).players).toHaveLength(2)
    expect(createGame(99).players).toHaveLength(MAX_PLAYERS)
    const g = createGame(5, 5)
    expect(g.players[0].isYou).toBe(true)
    expect(totalDice(g)).toBe(25)
  })
})

describe('elimination', () => {
  it('drops players at 0 dice from the active set but keeps them listed', () => {
    let g = createGame(3, 1)
    const victim = g.players[2].id
    g = gameReducer(g, { type: 'ADJUST_DICE', id: victim, delta: -1 })
    expect(activePlayers(g)).toHaveLength(2)
    expect(eliminatedPlayers(g).map((p) => p.id)).toEqual([victim])
    expect(totalDice(g)).toBe(2) // eliminated player no longer counts toward N
  })
})

describe('held dice', () => {
  it('refuses to hold more known dice than the user owns', () => {
    let g = createGame(2, 5)
    for (let i = 0; i < 5; i++) g = gameReducer(g, { type: 'SET_HELD', face: 5, count: i + 1 })
    expect(g.heldByFace[5]).toBe(5)
    const blocked = gameReducer(g, { type: 'SET_HELD', face: 1, count: 1 })
    expect(blocked.heldByFace[1]).toBe(0) // already holding all 5 of own dice
  })

  it('trims held dice when the user loses one of their own', () => {
    let g = createGame(2, 5)
    g = gameReducer(g, { type: 'SET_HELD', face: 5, count: 5 })
    g = gameReducer(g, { type: 'ADJUST_DICE', id: 'p1', delta: -1 })
    const you = g.players.find((p) => p.isYou)!
    expect(you.dice).toBe(4)
    expect(g.heldByFace[5]).toBe(4) // trimmed to fit
  })
})

describe('derivePanel', () => {
  it('feeds consistent numbers: one row before capture, grouped after', () => {
    let g = createGame(5, 5) // 25 dice
    expect(derivePanel(g).rows).toHaveLength(1) // all six faces share a row pre-capture

    g = gameReducer(g, { type: 'SET_HELD', face: 5, count: 2 })
    g = gameReducer(g, { type: 'SET_HELD', face: 1, count: 1 })
    const panel = derivePanel(g)
    expect(panel.rows.length).toBe(3) // held 2 / held 1 / held 0
    expect(panel.context).toEqual(toTableContext(g))
  })

  it('reports the current bid probability and ranked suggestions', () => {
    let g = createGame(4, 5) // 20 dice
    g = gameReducer(g, { type: 'SET_BID', bid: { quantity: 4, face: 5 } })
    const panel = derivePanel(g)
    expect(panel.currentBidProbability).not.toBeNull()
    expect(panel.suggestions.length).toBeGreaterThan(0)
    for (let i = 1; i < panel.suggestions.length; i++) {
      expect(panel.suggestions[i - 1].probability).toBeGreaterThanOrEqual(
        panel.suggestions[i].probability,
      )
    }
  })
})
