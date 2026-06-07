import { useState, type JSX } from 'react'
import type { Variant } from '../../lib/types'
import { useGame, useGameDispatch } from '../../state/GameContext'
import { MAX_PLAYERS, MIN_PLAYERS } from '../../state/reducer'
import { Modal } from '../Modal/Modal'
import './Controls.css'

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
 * Header button that opens the New Game dialog — keeps the setup controls off-screen
 * during play. Pending values start from the current game and only commit on "Start".
 */
export function NewGameButton(): JSX.Element {
  const game = useGame()
  const dispatch = useGameDispatch()
  const [open, setOpen] = useState(false)

  // Pending form state (seeded from the current game when the dialog opens).
  const [players, setPlayers] = useState(game.players.length)
  const [dice, setDice] = useState(5) // standard default
  const [variant, setVariant] = useState<Variant>(game.variant)

  const openDialog = () => {
    setPlayers(game.players.length)
    setDice(game.startingDice)
    setVariant(game.variant)
    setOpen(true)
  }

  const start = () => {
    dispatch({ type: 'NEW_GAME', playerCount: players, startingDice: dice, variant })
    setOpen(false)
  }

  return (
    <>
      <button type="button" className="primary" onClick={openDialog}>
        New game
      </button>

      {open && (
        <Modal
          title="New game"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button onClick={() => setOpen(false)}>Cancel</button>
              <button className="primary" onClick={start}>
                Start
              </button>
            </>
          }
        >
          <div className="newgame">
            <Stepper label="Players" value={players} min={MIN_PLAYERS} max={MAX_PLAYERS} onChange={setPlayers} />
            <Stepper label="Dice each" value={dice} min={1} max={10} onChange={setDice} />

            <div className="variant-field">
              <span className="stepper-label">Variant</span>
              <div className="seg">
                <button
                  className={variant === 'no-wilds' ? 'active' : ''}
                  onClick={() => setVariant('no-wilds')}
                >
                  No wilds
                </button>
                <button
                  className={variant === 'ones-wild' ? 'active' : ''}
                  onClick={() => setVariant('ones-wild')}
                >
                  1s wild
                </button>
              </div>
              <p className="variant-note muted">
                {variant === 'ones-wild'
                  ? 'Ones (⚀) count as every face, so non-1 bids are much more likely.'
                  : 'Every face counts only as itself.'}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
