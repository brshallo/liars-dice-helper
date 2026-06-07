import { useMemo } from 'react'
import './App.css'
import type { Bid } from './lib/types'
import { useGame, useGameDispatch } from './state/GameContext'
import { derivePanel, totalDice } from './state/selectors'
import { PlayerTable } from './components/PlayerTable'
import { SetupBar, YourDice } from './components/Controls'
import { ProbabilityPanel } from './components/ProbabilityPanel'

function App() {
  const game = useGame()
  const dispatch = useGameDispatch()

  // Derived probability data, recomputed whenever the game state changes.
  const panel = useMemo(() => derivePanel(game), [game])
  const total = totalDice(game)

  const onAdjustDice = (id: string, delta: number) =>
    dispatch({ type: 'ADJUST_DICE', id, delta })
  const onSelectBid = (bid: Bid) => dispatch({ type: 'SET_BID', bid })

  return (
    <div className="app">
      <header className="app-header">
        <h1>Liar&apos;s Dice Helper</h1>
        <SetupBar />
      </header>

      <main className="app-main">
        <div className="col col-table">
          <PlayerTable players={game.players} totalDice={total} onAdjustDice={onAdjustDice} />
          <YourDice />
        </div>
        <div className="col col-panel">
          <ProbabilityPanel panel={panel} onSelectBid={onSelectBid} />
        </div>
      </main>
    </div>
  )
}

export default App
