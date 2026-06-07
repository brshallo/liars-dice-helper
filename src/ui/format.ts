import type { Face, FaceGroup } from '../lib/types'

/** Compact percentage for tight cells: "78%", with <1% / >99% guards. */
export function formatPct(p: number): string {
  const pct = p * 100
  if (pct <= 0) return '0%'
  if (pct >= 100) return '100%'
  if (pct < 1) return '<1%'
  if (pct > 99) return '>99%'
  return `${Math.round(pct)}%`
}

/** Unicode die faces — compact, readable, no image assets needed. */
export const FACE_PIPS: Record<Face, string> = {
  1: '⚀',
  2: '⚁',
  3: '⚂',
  4: '⚃',
  5: '⚄',
  6: '⚅',
}

export function faceLabel(face: Face): string {
  return FACE_PIPS[face]
}

/**
 * Label for a face group. All six faces (pre-capture) read "any face"; otherwise
 * the pips of the faces it covers, e.g. "⚀ ⚁ ⚂".
 */
export function groupLabel(group: FaceGroup): string {
  if (group.faces.length === 6) return 'any face'
  return group.faces.map((f) => FACE_PIPS[f]).join(' ')
}
