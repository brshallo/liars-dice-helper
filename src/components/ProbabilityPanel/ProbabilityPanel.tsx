import type { JSX } from 'react'
import { useState } from 'react'
import type { Bid } from '../../lib/types'
import type { PanelData } from '../../state/selectors'
import { CombinedView } from '../displays/CombinedView'
import { MatrixView } from '../displays/MatrixView'
import { InspectorView } from '../displays/InspectorView'
import './ProbabilityPanel.css'

type ViewKey = 'combined' | 'matrix' | 'inspector'

const VIEWS: { key: ViewKey; label: string; hint: string }[] = [
  { key: 'combined', label: 'Combined', hint: 'Focus + full grid' },
  { key: 'matrix', label: 'Matrix', hint: 'Heatmap of every bid' },
  { key: 'inspector', label: 'Inspector', hint: 'One bid, big number' },
]

interface Props {
  panel: PanelData
  onSelectBid: (bid: Bid) => void
}

/**
 * Switches between the three probability displays. They all consume the same
 * PanelData and onSelectBid, so flipping tabs only changes presentation — letting
 * the user compare the three approaches live on the same game state.
 */
export function ProbabilityPanel({ panel, onSelectBid }: Props): JSX.Element {
  const [view, setView] = useState<ViewKey>('combined')

  return (
    <section className="prob-panel">
      <div className="view-switch" role="tablist" aria-label="Probability display">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            role="tab"
            aria-selected={view === v.key}
            className={view === v.key ? 'active' : ''}
            onClick={() => setView(v.key)}
            title={v.hint}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="view-body">
        {view === 'combined' && <CombinedView panel={panel} onSelectBid={onSelectBid} />}
        {view === 'matrix' && <MatrixView panel={panel} onSelectBid={onSelectBid} />}
        {view === 'inspector' && <InspectorView panel={panel} onSelectBid={onSelectBid} />}
      </div>
    </section>
  )
}
