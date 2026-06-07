import { useEffect, useRef, useState, type JSX, type PointerEvent as RPointerEvent } from 'react'
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

/** Seat-ring radius as a fraction of the felt (matched in PlayerTable.css geometry). */
const RADIUS = 0.35

/** Place a seat on the circular felt at `angleDeg` (0 = top, clockwise). */
function seatStyle(angleDeg: number): { left: string; top: string } {
  const rad = (angleDeg * Math.PI) / 180
  return {
    left: `${50 + RADIUS * 100 * Math.sin(rad)}%`,
    top: `${50 - RADIUS * 100 * Math.cos(rad)}%`,
  }
}

export function PlayerTable({ players, totalDice, onAdjustDice }: PlayerTableProps): JSX.Element {
  const active = players.filter((p) => p.dice > 0)
  const eliminated = players.filter((p) => p.dice === 0)

  const you = active.find((p) => p.isYou)
  const others = active.filter((p) => !p.isYou)
  const ring = you ? [you, ...others] : others
  const count = ring.length

  // "You" can be dragged around the ring; everyone else redistributes evenly from there.
  // Angle: 0 = top, clockwise — so 180 = bottom-centre, where you'd naturally sit.
  const [youAngle, setYouAngle] = useState(180)
  const [dragging, setDragging] = useState(false)
  const feltRef = useRef<HTMLDivElement>(null)

  // Seat size scales with the felt (container-query units) AND with how many seats
  // must fit, so 2 players read large and 8 stay clear of each other. Unit = cqmin.
  const seatScale = count >= 7 ? 21 : count >= 5 ? 24 : 28

  const angleFor = (index: number, isYou: boolean): number => {
    if (isYou || count <= 1) return youAngle
    return youAngle + (360 / count) * index
  }

  // Convert a pointer position to an angle around the felt centre (0 = top, clockwise).
  const pointerAngle = (clientX: number, clientY: number): number => {
    const r = feltRef.current!.getBoundingClientRect()
    const dx = clientX - (r.left + r.width / 2)
    const dy = clientY - (r.top + r.height / 2)
    return (Math.atan2(dx, -dy) * 180) / Math.PI
  }

  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => setYouAngle(pointerAngle(e.clientX, e.clientY))
    const stop = () => setDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [dragging])

  return (
    <div className="pt">
      <div
        className="pt-felt"
        ref={feltRef}
        style={{ ['--sw' as string]: seatScale } as React.CSSProperties}
      >
        <div className="pt-center">
          <div className="pt-center-num">{totalDice}</div>
          <div className="pt-center-label">dice in play</div>
          <div className="pt-center-sub">
            {active.length} player{active.length === 1 ? '' : 's'}
          </div>
        </div>

        {ring.map((p, i) => {
          const isYou = p.isYou
          // Stop a tap on the +/- buttons from starting a drag of the seat.
          const stop = (e: RPointerEvent) => e.stopPropagation()
          return (
            <div
              key={p.id}
              className={`pt-seat${isYou ? ' pt-seat--you' : ''}${
                isYou && dragging ? ' is-dragging' : ''
              }`}
              style={seatStyle(angleFor(i, isYou))}
              onPointerDown={isYou ? () => setDragging(true) : undefined}
              title={isYou ? 'Drag to move your seat around the table' : undefined}
            >
              {isYou && (
                <span className="pt-grip" aria-hidden="true">
                  ⠿
                </span>
              )}
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
                  onPointerDown={stop}
                  onClick={() => onAdjustDice(p.id, -1)}
                >
                  −
                </button>
                <button
                  type="button"
                  className="pt-btn"
                  aria-label={`Add a die to ${p.name}`}
                  onPointerDown={stop}
                  onClick={() => onAdjustDice(p.id, +1)}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <p className="pt-hint muted">Drag your seat ⠿ to match where you sit at the table.</p>

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
