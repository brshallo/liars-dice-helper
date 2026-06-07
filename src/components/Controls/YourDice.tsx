import type { JSX } from 'react'
import { FACES, type Face } from '../../lib/types'
import { useGame, useGameDispatch } from '../../state/GameContext'
import { FACE_PIPS } from '../../ui/format'
import './Controls.css'

/**
 * Optional entry of the user's own dice. Knowing your dice sharpens every
 * probability: each die you enter becomes a guaranteed floor for that face and
 * leaves the unknown pool. Capacity is your own dice count, so you can't claim more
 * than you hold. (This is the manual path; photo capture is the stretch goal.)
 */
export function YourDice(): JSX.Element {
  const game = useGame()
  const dispatch = useGameDispatch()

  const you = game.players.find((p) => p.isYou)
  const yourDice = you?.dice ?? 0
  const entered = FACES.reduce((s, f) => s + game.heldByFace[f], 0)
  const remaining = yourDice - entered

  const set = (face: Face, count: number) => dispatch({ type: 'SET_HELD', face, count })

  return (
    <div className="your-dice">
      <div className="your-dice-head">
        <h3>Your dice</h3>
        <span className="muted">
          {entered}/{yourDice} entered
        </span>
        {entered > 0 && (
          <button className="link" onClick={() => dispatch({ type: 'CLEAR_HELD' })}>
            clear
          </button>
        )}
      </div>
      <p className="muted hint">Enter what you're holding to sharpen the odds (optional).</p>
      <div className="face-steppers">
        {FACES.map((face) => {
          const count = game.heldByFace[face]
          return (
            <div className="face-stepper" key={face}>
              <span className="face-pip" aria-label={`face ${face}`}>
                {FACE_PIPS[face]}
              </span>
              <button onClick={() => set(face, count - 1)} disabled={count <= 0} aria-label={`fewer ${face}s`}>
                −
              </button>
              <span className="face-count">{count}</span>
              <button onClick={() => set(face, count + 1)} disabled={remaining <= 0} aria-label={`more ${face}s`}>
                +
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
