import { manualEngine } from './manual'
import { handrolledEngine } from './handrolled'
import { opencvEngine } from './opencv'
import { mlEngine } from './ml'
import type { DiceEngine } from './types'

/**
 * All engines the lab and benchmark know about. The harness iterates this list, so
 * adding an engine is a one-line change and nothing else needs to know the roster.
 * `manual` is the no-detection baseline (accuracy floor).
 */
export const engines: DiceEngine[] = [handrolledEngine, opencvEngine, mlEngine, manualEngine]

export * from './types'
