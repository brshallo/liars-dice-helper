import type { JSX } from 'react'
import { useEffect } from 'react'
import type { Bid, Face } from '../../../lib/types'
import { expectedCount } from '../../../lib/probability'
import type { PanelData } from '../../../state/selectors'
import { FACE_PIPS, formatPct } from '../../../ui/format'
import { probColor, probTextColor, probVerdict } from '../../../ui/prob'
import './InspectorView.css'

interface DisplayProps {
  panel: PanelData
  /** Call whenever the dialed bid changes, to set the live bid. */
  onSelectBid: (bid: Bid) => void
}

/** Wrap a face value into 1..6 so the cycle buttons roll over cleanly. */
function wrapFace(face: number): Face {
  return (((face - 1 + 6) % 6) + 1) as Face
}

/**
 * Focused single-bid inspector: dial one bid (face + quantity) and read its
 * probability of being true, a verdict word, the expected count, and a few safe
 * higher bids to jump to. The dialed bid IS the app's live bid, so every control
 * pushes the new bid up via onSelectBid; panel.currentBid is the source of truth.
 */
export function InspectorView({ panel, onSelectBid }: DisplayProps): JSX.Element {
  const { context, currentBid, currentBidProbability } = panel
  const maxQty = context.totalDice

  // When there is no live bid yet, seed a sensible one ON FIRST RENDER (and only
  // while it stays null). Default face 1, quantity = its expected count clamped to
  // the valid range. The currentBid === null guard makes this a one-shot, not a loop.
  useEffect(() => {
    if (currentBid != null) return
    const face: Face = 1
    const seed = Math.round(expectedCount(context, face))
    const quantity = Math.min(maxQty, Math.max(1, seed))
    onSelectBid({ quantity, face })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the bid clears
  }, [currentBid])

  // Until the seeding effect lands, render a placeholder so hooks stay unconditional.
  if (currentBid == null) {
    return <div className="inspector inspector--empty">Setting up…</div>
  }

  const { quantity, face } = currentBid
  const p = currentBidProbability ?? 0
  const expected = expectedCount(context, face)

  const setFace = (next: Face) => onSelectBid({ quantity, face: next })
  const setQty = (next: number) =>
    onSelectBid({ quantity: Math.min(maxQty, Math.max(1, next)), face })

  return (
    <div className="inspector">
      {/* Controls: face cycler + quantity stepper. */}
      <div className="inspector-dials">
        <div className="inspector-dial">
          <span className="inspector-dial-label">face</span>
          <div className="inspector-stepper">
            <button
              type="button"
              className="inspector-step"
              onClick={() => setFace(wrapFace(face - 1))}
              aria-label="previous face"
            >
              ‹
            </button>
            <span className="inspector-face" aria-label={`face ${face}`}>
              {FACE_PIPS[face]}
            </span>
            <button
              type="button"
              className="inspector-step"
              onClick={() => setFace(wrapFace(face + 1))}
              aria-label="next face"
            >
              ›
            </button>
          </div>
        </div>

        <div className="inspector-dial">
          <span className="inspector-dial-label">quantity</span>
          <div className="inspector-stepper">
            <button
              type="button"
              className="inspector-step"
              onClick={() => setQty(quantity - 1)}
              disabled={quantity <= 1}
              aria-label="decrease quantity"
            >
              −
            </button>
            <span className="inspector-qty" aria-label={`quantity ${quantity}`}>
              {quantity}
            </span>
            <button
              type="button"
              className="inspector-step"
              onClick={() => setQty(quantity + 1)}
              disabled={quantity >= maxQty}
              aria-label="increase quantity"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Headline readout — the glanceable answer, tinted by probability. */}
      <div
        className="inspector-headline"
        style={{
          // A soft tint of the probability colour as background, full colour as accent.
          background: `color-mix(in srgb, ${probColor(p)} 18%, var(--surface))`,
          borderColor: probColor(p),
        }}
      >
        <div className="inspector-headline-label">
          P(at least {quantity} {FACE_PIPS[face]})
        </div>
        <div className="inspector-pct" style={{ color: probColor(p) }}>
          {formatPct(p)}
        </div>
        <div className="inspector-verdict">{probVerdict(p)}</div>
      </div>

      {/* Expected count for the dialed face. */}
      <div className="inspector-expected muted">
        expected {FACE_PIPS[face]} on the table:{' '}
        <strong>{expected.toFixed(1)}</strong>
      </div>

      {/* Safe next bids — tappable chips that jump the live bid. */}
      {panel.suggestions.length > 0 && (
        <div className="inspector-suggestions">
          <span className="inspector-suggestions-label muted">safe next bids</span>
          <div className="inspector-chips">
            {panel.suggestions.slice(0, 4).map((s) => (
              <button
                key={`${s.quantity}-${s.face}`}
                type="button"
                className="inspector-chip"
                onClick={() => onSelectBid({ quantity: s.quantity, face: s.face })}
              >
                <span className="inspector-chip-bid">
                  {s.quantity} {FACE_PIPS[s.face]}
                </span>
                <span
                  className="inspector-chip-pct"
                  style={{
                    background: probColor(s.probability),
                    color: probTextColor(s.probability),
                  }}
                >
                  {formatPct(s.probability)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
