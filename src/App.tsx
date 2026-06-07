import { useMemo } from 'react'
import './App.css'
import type { Bid } from './lib/types'
import { useGame, useGameDispatch } from './state/GameContext'
import { derivePanel, totalDice } from './state/selectors'
import { PlayerTable } from './components/PlayerTable'
import { NewGameButton, YourDice } from './components/Controls'
import { ProbabilityPanel } from './components/ProbabilityPanel'

function App() {
  const game = useGame()
  const dispatch = useGameDispatch()

  // Derived probability data, recomputed whenever the game state changes.
  const panel = useMemo(() => derivePanel(game), [game])
  const total = totalDice(game)

  const onAdjustDice = (id: string, delta: number) =>
    dispatch({ type: 'ADJUST_DICE', id, delta })
  const onSelectBid = (bid: Bid | null) => dispatch({ type: 'SET_BID', bid })

  const isWild = game.variant === 'ones-wild'

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>Liar&apos;s Dice Helper</h1>
          <span className={`variant-badge${isWild ? ' is-wild' : ''}`}>
            {isWild ? '1s wild' : 'No wilds'}
          </span>
        </div>
        <NewGameButton />
      </header>

      <main className="app-main">
        {/* Probabilities first — the thing you check most during play. */}
        <ProbabilityPanel panel={panel} onSelectBid={onSelectBid} />
        <PlayerTable players={game.players} totalDice={total} onAdjustDice={onAdjustDice} />
        <YourDice />
      </main>
    </div>
  )
}

export default App
