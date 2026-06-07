import { useEffect, type JSX, type ReactNode } from 'react'
import './Modal.css'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Optional footer (e.g. action buttons). */
  footer?: ReactNode
}

/**
 * A simple centred dialog over a dimmed backdrop. Closes on backdrop click, the ×
 * button, or Escape. Parent decides whether it's mounted (render only when open).
 */
export function Modal({ title, onClose, children, footer }: ModalProps): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      {/* Stop clicks inside the card from bubbling to the backdrop close. */}
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
