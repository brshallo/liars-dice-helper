import type { JSX } from 'react'
import type { Player } from '../../state/types'
import './PlayerTable.css'

interface PlayerTableProps {
  /** ALL players, active and eliminated, in seat order. */
  players: Player[]
  /** Sum of dice across active players — shown as the centerpiece stat. */
  totalDice: number
  /** Adjust a player's dice by +1 / -1. */
  onAdjustDice: (id: string, delta: number) => void
}

/**
 * Seat geometry: active players sit on an ellipse. "You" is pinned to the bottom-center
 * (angle = 90deg, measuring clockwise from the top). The other seats are spread evenly
 * around the remaining arc so they fan out symmetrically left/right of "You".
 */
function seatPosition(index: number, count: number, isYou: boolean): { left: string; top: string } {
  // Angle in degrees, 0 = top, increasing clockwise. 90 = bottom-center (the "You" anchor).
  let angleDeg: number
  if (isYou || count === 1) {
    angleDeg = 90
  } else {
    // Distribute the non-you seats over the full circle, skipping the bottom slot.
    // Seats step by 360/count starting just past "You" so the ring stays even.
    const step = 360 / count
    angleDeg = 90 + step * index
  }
  const rad = (angleDeg * Math.PI) / 180
  // Radii < 50% keep seats inside the felt; x is wider than y for the oval.
  const x = 50 + 44 * Math.sin(rad)
  const y = 50 - 38 * Math.cos(rad)
  return { left: `${x}%`, top: `${y}%` }
}

export function PlayerTable({ players, totalDice, onAdjustDice }: PlayerTableProps): JSX.Element {
  const active = players.filter((p) => p.dice > 0)
  const eliminated = players.filter((p) => p.dice === 0)

  // Order active seats so "You" comes first (index 0 -> bottom-center anchor).
  const you = active.find((p) => p.isYou)
  const others = active.filter((p) => !p.isYou)
  const ringPlayers = you ? [you, ...others] : others

  return (
    <div className="pt">
      <div className="pt-felt">
        <div className="pt-center">
          <div className="pt-center-num">{totalDice}</div>
          <div className="pt-center-label">dice in play</div>
          <div className="pt-center-sub">
            {active.length} player{active.length === 1 ? '' : 's'}
          </div>
        </div>

        {ringPlayers.map((p, i) => {
          const pos = seatPosition(i, ringPlayers.length, p.isYou)
          return (
            <div
              key={p.id}
              className={`pt-seat${p.isYou ? ' pt-seat--you' : ''}`}
              style={{ left: pos.left, top: pos.top }}
            >
              <div className="pt-seat-name">{p.name}</div>
              <div className="pt-seat-dice">
                <span className="pt-seat-dice-num">{p.dice}</span>
                <span className="pt-seat-dice-label">dice</span>
              </div>
              <div className="pt-seat-ctrls">
                <button
                  type="button"
                  className="pt-btn"
                  aria-label={`Remove a die from ${p.name}`}
                  onClick={() => onAdjustDice(p.id, -1)}
                >
                  −
                </button>
                <button
                  type="button"
                  className="pt-btn"
                  aria-label={`Add a die to ${p.name}`}
                  onClick={() => onAdjustDice(p.id, +1)}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {eliminated.length > 0 && (
        <div className="pt-out-row" aria-label="Eliminated players">
          {eliminated.map((p) => (
            <div key={p.id} className="pt-out-chip">
              <span className="pt-out-name">{p.name}</span>
              <span className="pt-out-tag">OUT</span>
              <button
                type="button"
                className="pt-btn pt-btn--sm"
                aria-label={`Bring ${p.name} back in`}
                onClick={() => onAdjustDice(p.id, +1)}
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
