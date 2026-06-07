import type { JSX } from 'react'
import { useState } from 'react'
import { useGame, useGameDispatch } from '../../state/GameContext'
import { MAX_PLAYERS, MIN_PLAYERS } from '../../state/reducer'
import './Controls.css'

/** Small labelled +/- stepper used for player count and starting dice. */
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}): JSX.Element {
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-controls">
        <button onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`fewer ${label}`}>
          −
        </button>
        <span className="stepper-value">{value}</span>
        <button onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`more ${label}`}>
          +
        </button>
      </div>
    </div>
  )
}

/**
 * New-game setup: choose how many players and how many dice each starts with, then
 * start. Pending values are local until "New game" commits them, so fiddling with
 * the steppers doesn't wipe an in-progress game.
 */
export function SetupBar(): JSX.Element {
  const game = useGame()
  const dispatch = useGameDispatch()
  const [players, setPlayers] = useState(game.players.length)
  const [dice, setDice] = useState(game.startingDice)

  return (
    <div className="setup-bar">
      <Stepper label="Players" value={players} min={MIN_PLAYERS} max={MAX_PLAYERS} onChange={setPlayers} />
      <Stepper label="Dice each" value={dice} min={1} max={6} onChange={setDice} />
      <button
        className="primary"
        onClick={() => dispatch({ type: 'NEW_GAME', playerCount: players, startingDice: dice })}
      >
        New game
      </button>
    </div>
  )
}
