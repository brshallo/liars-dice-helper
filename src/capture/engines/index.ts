import { manualEngine } from './manual'
import type { DiceEngine } from './types'

/**
 * All engines the lab and benchmark know about. Real engines (opencv, handrolled,
 * ml) are appended here as they land — the harness iterates this list, so adding an
 * engine is a one-line change and nothing else needs to know the roster.
 */
export const engines: DiceEngine[] = [manualEngine]

export * from './types'
