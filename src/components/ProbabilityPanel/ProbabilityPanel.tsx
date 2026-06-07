import { useState, type JSX } from 'react'
import type { Bid } from '../../lib/types'
import type { PanelData } from '../../state/selectors'
import { formatPct } from '../../ui/format'
import { probColor, probTextColor } from '../../ui/prob'
import { MatrixView } from '../displays/MatrixView'
import { InspectorView } from '../displays/InspectorView'
import { Modal } from '../Modal/Modal'
import './ProbabilityPanel.css'

interface Props {
  panel: PanelData
  /** null clears the live bid (used when the inspector closes). */
  onSelectBid: (bid: Bid | null) => void
}

/**
 * The probability display. The matrix is always on screen; tapping any cell opens a
 * focused "inspector" on that exact bid, and closing it clears the selection. The
 * explanation lives behind the (i) icon so it isn't underfoot during play.
 */
export function ProbabilityPanel({ panel, onSelectBid }: Props): JSX.Element {
  const [info, setInfo] = useState(false)
  const [inspect, setInspect] = useState(false)

  // Tapping a cell selects that bid AND pops the inspector open on it.
  const selectAndInspect = (bid: Bid) => {
    onSelectBid(bid)
    setInspect(true)
  }
  const closeInspector = () => {
    onSelectBid(null) // deselect when the inspector closes
    setInspect(false)
  }

  return (
    <section className="prob-panel">
      <div className="prob-toolbar">
        <h2 className="prob-title">Probabilities</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="What do these mean?"
          title="What do these mean?"
          onClick={() => setInfo(true)}
        >
          <InfoIcon />
        </button>
      </div>

      <MatrixView panel={panel} onSelectBid={selectAndInspect} />

      {info && (
        <Modal title="Reading the probabilities" onClose={() => setInfo(false)}>
          <InfoContent />
        </Modal>
      )}

      {inspect && (
        <Modal title="Bid inspector" onClose={closeInspector}>
          <InspectorView panel={panel} onSelectBid={onSelectBid} />
        </Modal>
      )}
    </section>
  )
}

/** Visual-first explanation: a colour scale + a worked example row, minimal prose. */
function InfoContent(): JSX.Element {
  const exampleQ = [2, 3, 4, 5, 6]
  const exampleCells = [0.96, 0.82, 0.55, 0.27, 0.08]
  return (
    <div className="info-body">
      <p className="info-lead">
        Each cell is the chance a bid is <strong>true</strong> — that <em>at least</em> that many of
        a face are on the whole table.
      </p>

      {/* The colour scale is the core idea. */}
      <div className="info-scale">
        <div className="info-scale-bar" />
        <div className="info-scale-ends">
          <span>
            <strong>Red</strong> · likely a bluff
            <br />→ challenge it
          </span>
          <span className="right">
            <strong>Green</strong> · likely true
            <br />→ safe to bid
          </span>
        </div>
      </div>

      {/* A worked example: bid quantities across the top, like the real matrix. */}
      <p className="info-head">Example</p>
      <div
        className="info-example"
        style={{ gridTemplateColumns: `auto repeat(${exampleQ.length}, 1fr)` }}
      >
        <div className="info-ex-corner" aria-hidden="true">
          ≥
        </div>
        {exampleQ.map((q) => (
          <div className="info-ex-qhead" key={q}>
            {q}
          </div>
        ))}

        <div className="info-ex-label">
          <span className="info-ex-pip">⚄</span>
          <span className="info-badge">+1</span>
          <span className="info-exp">exp 3.4</span>
        </div>
        {exampleCells.map((p, i) => (
          <span
            key={i}
            className="info-ex-cell"
            style={{ background: probColor(p), color: probTextColor(p) }}
          >
            {formatPct(p)}
          </span>
        ))}
      </div>

      <ul className="info-key">
        <li>
          <span className="info-badge">+1</span>
          <span className="info-key-text">
            a die of this face you already hold (input <em>your</em> dice at the bottom of the
            screen), increasing exp above baseline.
          </span>
        </li>
        <li>
          <span className="info-exp">exp 3.4</span>
          <span className="info-key-text">the expected number of this face on the table.</span>
        </li>
        <li>
          <span className="info-num">1 2 3…</span>
          <span className="info-key-text">
            the bid quantities. They auto-narrow to the range where the decision actually flips.
          </span>
        </li>
      </ul>

      <p className="info-tap">
        👆 Tap any cell to inspect that exact bid and see safe alternative bids.
      </p>
    </div>
  )
}

function InfoIcon(): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="8" r="1.3" fill="currentColor" />
      <path d="M12 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
