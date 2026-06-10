import { useLayoutEffect, useRef, type JSX } from 'react'
import type { Bid } from '../../../lib/types'
import type { PanelData } from '../../../state/selectors'
import { formatPct, groupLabel } from '../../../ui/format'
import { probColor, probTextColor } from '../../../ui/prob'
import './MatrixView.css'

interface DisplayProps {
  panel: PanelData
  /** Call when the user taps a cell to set the live bid. */
  onSelectBid: (bid: Bid) => void
  /** If given, the top-left corner cell becomes an info button instead of the "≥" mark. */
  onInfo?: () => void
}

/**
 * Auto-windowed heatmap matrix. The face/exp labels live in a fixed left pane and the
 * probability cells in a separate scrolling pane — so the horizontal scrollbar spans
 * only the numbers, not the faces. Cells start scrolled to the expected-count column.
 */
export function MatrixView({ panel, onSelectBid, onInfo }: DisplayProps): JSX.Element {
  const { quantities } = panel.window
  const bid = panel.currentBid
  const scrollRef = useRef<HTMLDivElement>(null)

  // Centre of mass of the expected counts (weighted by faces per group) = where the
  // initial horizontal scroll should sit, so the action zone is visible first.
  const centreExp =
    panel.rows.reduce((sum, r) => sum + r.expected * r.group.faces.length, 0) / 6

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const targetQ = quantities.reduce((best, q) =>
      Math.abs(q - centreExp) < Math.abs(best - centreExp) ? q : best,
    )
    const head = el.querySelector<HTMLElement>(`.matrix-qhead[data-q="${targetQ}"]`)
    if (!head) return
    const desired = head.offsetLeft + head.offsetWidth / 2 - el.clientWidth / 2
    el.scrollLeft = Math.max(0, Math.min(desired, el.scrollWidth - el.clientWidth))
    // Re-centre only when the window itself changes, not on every bid tap.
  }, [quantities.join(','), centreExp])

  return (
    <div className="matrix">
      {/* Fixed label column (faces + held + expected). */}
      <div className="matrix-frozen">
        {onInfo ? (
          <button
            type="button"
            className="matrix-corner matrix-info"
            onClick={onInfo}
            aria-label="Bid and probability — what do these mean?"
            title="What do these mean?"
          >
            <span className="mx-axis-bid">
              bid
              <InfoIcon />
            </span>
            <span className="mx-axis-prob">probability</span>
          </button>
        ) : (
          <div className="matrix-corner" aria-hidden="true">
            ≥
          </div>
        )}
        {panel.rows.map((row) => (
          <div className="matrix-rowhead" key={row.group.faces.join(',')}>
            <span className="matrix-rowlabel">{groupLabel(row.group)}</span>
            {row.group.held > 0 && (
              <span className="matrix-badge" title="dice you hold">
                +{row.group.held}
              </span>
            )}
            <span className="matrix-exp" title="expected count on the table">
              exp {row.expected.toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      {/* Scrolling probability cells — the scrollbar lives only here. */}
      <div className="matrix-scroll" ref={scrollRef}>
        <div
          className="matrix-cols"
          style={{ gridTemplateColumns: `repeat(${quantities.length}, minmax(2.5rem, 1fr))` }}
          role="grid"
        >
          {quantities.map((q) => (
            <div className="matrix-qhead" data-q={q} key={q} role="columnheader">
              {q}
            </div>
          ))}

          {panel.rows.map((row) => {
            const rowHasBid = bid != null && row.group.faces.includes(bid.face)
            return row.cells.map((cell) => {
              const active = rowHasBid && bid!.quantity === cell.quantity
              return (
                <button
                  key={`${row.group.faces.join(',')}:${cell.quantity}`}
                  type="button"
                  className={`matrix-cell${active ? ' is-active' : ''}`}
                  style={{
                    background: probColor(cell.probability),
                    color: probTextColor(cell.probability),
                  }}
                  onClick={() => onSelectBid({ quantity: cell.quantity, face: row.group.faces[0] })}
                  aria-pressed={active}
                  title={`${groupLabel(row.group)} — at least ${cell.quantity}: ${formatPct(
                    cell.probability,
                  )} true`}
                >
                  {formatPct(cell.probability)}
                </button>
              )
            })
          })}
        </div>
      </div>
    </div>
  )
}

function InfoIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="8" r="1.3" fill="currentColor" />
      <path d="M12 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
