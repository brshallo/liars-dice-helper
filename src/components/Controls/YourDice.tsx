import type { JSX } from 'react'
import { FACES, type Face } from '../../lib/types'
import { useGame, useGameDispatch } from '../../state/GameContext'
import './Controls.css'

// Pip positions on a 3×3 grid (indices 0–8), per face value.
const PIP_GRID: Record<Face, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

/** A real-looking die face: a 3×3 grid of pips drawn in CSS. */
function DieFace({ face }: { face: Face }): JSX.Element {
  const on = new Set(PIP_GRID[face])
  return (
    <span className="die-face" role="img" aria-label={`face ${face}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={on.has(i) ? 'pip' : 'pip pip-off'} />
      ))}
    </span>
  )
}

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
      <p className="muted hint">Enter yours to sharpen the odds (optional).</p>
      <div className="face-steppers">
        {FACES.map((face) => {
          const count = game.heldByFace[face]
          return (
            <div className="face-stepper" key={face}>
              <DieFace face={face} />
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
