import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import { gameReducer, initialState, type GameAction } from './reducer'
import type { GameState } from './types'

const GameStateContext = createContext<GameState | null>(null)
const GameDispatchContext = createContext<Dispatch<GameAction> | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  return (
    <GameStateContext.Provider value={state}>
      <GameDispatchContext.Provider value={dispatch}>{children}</GameDispatchContext.Provider>
    </GameStateContext.Provider>
  )
}

export function useGame(): GameState {
  const ctx = useContext(GameStateContext)
  if (!ctx) throw new Error('useGame must be used within a GameProvider')
  return ctx
}

export function useGameDispatch(): Dispatch<GameAction> {
  const ctx = useContext(GameDispatchContext)
  if (!ctx) throw new Error('useGameDispatch must be used within a GameProvider')
  return ctx
}
