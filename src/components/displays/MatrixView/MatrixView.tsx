import type { JSX } from 'react'
import type { Bid } from '../../../lib/types'
import type { PanelData } from '../../../state/selectors'
import { formatPct, groupLabel } from '../../../ui/format'
import { probColor, probTextColor } from '../../../ui/prob'
import './MatrixView.css'

interface DisplayProps {
  panel: PanelData
  /** Call when the user taps a cell to set the live bid. */
  onSelectBid: (bid: Bid) => void
}

/**
 * Auto-windowed heatmap matrix: rows are face groups, columns are the bid
 * quantities chosen upstream (panel.window.quantities), cells coloured by the
 * probability that "at least q of this face" is true. Pure presentational.
 */
export function MatrixView({ panel, onSelectBid }: DisplayProps): JSX.Element {
  const { quantities } = panel.window
  const bid = panel.currentBid

  return (
    <div className="matrix">
      <div
        className="matrix-grid"
        // Label column + one per quantity. minmax keeps cells >=2.5rem so percentages
        // never crush together; if the band can't fit, the grid scrolls horizontally.
        style={{ gridTemplateColumns: `auto repeat(${quantities.length}, minmax(2.5rem, 1fr))` }}
        role="grid"
      >
        {/* Header row: empty corner, then the quantity columns. */}
        <div className="matrix-corner" role="columnheader" aria-label="face group">
          ≥
        </div>
        {quantities.map((q) => (
          <div key={q} className="matrix-qhead" role="columnheader">
            {q}
          </div>
        ))}

        {panel.rows.map((row) => {
          const { group } = row
          // A row is highlighted when the live bid's face falls in this group.
          const rowHasBid = bid != null && group.faces.includes(bid.face)
          return (
            <FragmentRow
              key={group.faces.join(',')}
              labelKey={group.faces.join(',')}
            >
              <div className="matrix-rowhead" role="rowheader">
                <span className="matrix-rowlabel">{groupLabel(group)}</span>
                {group.held > 0 && (
                  <span className="matrix-badge" title="dice you hold">
                    +{group.held}
                  </span>
                )}
                <span className="matrix-exp" title="expected count on the table">
                  exp {row.expected.toFixed(1)}
                </span>
              </div>

              {row.cells.map((cell) => {
                const active = rowHasBid && bid!.quantity === cell.quantity
                return (
                  <button
                    key={cell.quantity}
                    type="button"
                    className={`matrix-cell${active ? ' is-active' : ''}`}
                    style={{
                      background: probColor(cell.probability),
                      color: probTextColor(cell.probability),
                    }}
                    onClick={() =>
                      onSelectBid({ quantity: cell.quantity, face: group.faces[0] })
                    }
                    aria-pressed={active}
                    title={`${groupLabel(group)} — at least ${cell.quantity}: ${formatPct(
                      cell.probability,
                    )} true`}
                  >
                    {formatPct(cell.probability)}
                  </button>
                )
              })}
            </FragmentRow>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Display:contents wrapper so each group's header + cells live on one CSS-grid
 * row without an extra DOM box breaking the column tracks.
 */
function FragmentRow({
  children,
  labelKey,
}: {
  children: React.ReactNode
  labelKey: string
}): JSX.Element {
  return (
    <div className="matrix-row" role="row" data-group={labelKey}>
      {children}
    </div>
  )
}
