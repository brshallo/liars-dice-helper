import type { JSX } from 'react'
import type { Bid } from '../../../lib/types'
import type { PanelData } from '../../../state/selectors'
import { FACE_PIPS, formatPct, groupLabel } from '../../../ui/format'
import { probColor, probTextColor, probVerdict } from '../../../ui/prob'
import './CombinedView.css'

interface DisplayProps {
  panel: PanelData
  /** Tap a cell or a suggestion to set the live bid. */
  onSelectBid: (bid: Bid) => void
}

/** "<quantity> <face-pips>" — the canonical short way to render a bid. */
function bidText(bid: Bid): string {
  return `${bid.quantity} ${FACE_PIPS[bid.face]}`
}

/**
 * The "combined" display: a focus box for the single live bid (probability +
 * best safe next bid) on its own surface card, plus a compact grouped heatmap
 * matrix below for the whole landscape. Self-contained — it renders its own
 * small matrix rather than reusing the standalone MatrixView. Pure presentational.
 */
export function CombinedView({ panel, onSelectBid }: DisplayProps): JSX.Element {
  const { quantities } = panel.window
  const bid = panel.currentBid
  // Show at most three suggestion chips so the focus box stays scannable.
  const chips = panel.suggestions.slice(0, 3)

  return (
    <div className="combined">
      {/* ---- FOCUS BOX ---- */}
      <section className="combined-focus" aria-label="live bid">
        {bid == null || panel.currentBidProbability == null ? (
          <p className="combined-prompt muted">Tap a cell below to weigh a bid</p>
        ) : (
          <>
            <div className="combined-bidline">
              <span className="combined-bid">{bidText(bid)}</span>
              <span
                className="combined-prob"
                // Tint the headline number by how true the bid is.
                style={{ color: probColor(panel.currentBidProbability) }}
              >
                {formatPct(panel.currentBidProbability)}
              </span>
              <span className="combined-verdict muted">
                {probVerdict(panel.currentBidProbability)}
              </span>
            </div>

            {chips.length > 0 && (
              <div className="combined-next">
                <span className="combined-next-label muted">next safe:</span>
                {chips.map((s, i) => (
                  <button
                    key={`${s.quantity}-${s.face}`}
                    type="button"
                    // First chip is the recommended pick; the rest are alternates.
                    className={`combined-chip${i === 0 ? ' is-top' : ''}`}
                    onClick={() => onSelectBid({ quantity: s.quantity, face: s.face })}
                    title={`${bidText(s)} — ${formatPct(s.probability)} true`}
                  >
                    <span className="combined-chip-bid">{bidText(s)}</span>
                    <span className="combined-chip-prob">{formatPct(s.probability)}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ---- MATRIX ---- */}
      <div
        className="combined-grid"
        // One label column + one column per quantity, sized to fit the panel.
        style={{ gridTemplateColumns: `auto repeat(${quantities.length}, 1fr)` }}
        role="grid"
      >
        <div className="combined-corner" role="columnheader" aria-label="face group">
          ≥
        </div>
        {quantities.map((q) => (
          <div key={q} className="combined-qhead" role="columnheader">
            {q}
          </div>
        ))}

        {panel.rows.map((row) => {
          const { group } = row
          // Highlight when the live bid's face falls in this group.
          const rowHasBid = bid != null && group.faces.includes(bid.face)
          return (
            <div
              className="combined-row"
              role="row"
              key={group.faces.join(',')}
              data-group={group.faces.join(',')}
            >
              <div className="combined-rowhead" role="rowheader">
                <span className="combined-rowlabel">{groupLabel(group)}</span>
                {group.held > 0 && (
                  <span className="combined-badge" title="dice you hold">
                    +{group.held}
                  </span>
                )}
                <span className="combined-exp" title="expected count on the table">
                  exp {row.expected.toFixed(1)}
                </span>
              </div>

              {row.cells.map((cell) => {
                const active = rowHasBid && bid!.quantity === cell.quantity
                return (
                  <button
                    key={cell.quantity}
                    type="button"
                    className={`combined-cell${active ? ' is-active' : ''}`}
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
            </div>
          )
        })}
      </div>

      <p className="combined-caption muted">
        Green = likely true (safe to bid); red = likely a bluff (challenge).
        Columns auto-shift to the live range as dice leave the table.
      </p>
    </div>
  )
}
