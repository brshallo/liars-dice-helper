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
 * Label for a face group. All six faces read "any face"; a contiguous run of 3+
 * collapses to a "first–last" range (keeps the 2–6 group under ones-wild compact);
 * otherwise the individual pips, e.g. "⚀ ⚁ ⚂".
 */
export function groupLabel(group: FaceGroup): string {
  const faces = group.faces
  if (faces.length === 6) return 'any face'
  const contiguous = faces.every((f, i) => i === 0 || f === faces[i - 1] + 1)
  if (contiguous && faces.length >= 3) {
    return `${FACE_PIPS[faces[0]]}–${FACE_PIPS[faces[faces.length - 1]]}`
  }
  return faces.map((f) => FACE_PIPS[f]).join(' ')
}
