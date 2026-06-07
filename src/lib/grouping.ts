import { effectiveFloor, matchProb } from './probability'
import { FACES, type FaceGroup, type TableContext } from './types'

/**
 * Collapse the six faces into groups that share an identical conditional
 * distribution — two faces behave identically iff they have the same guaranteed
 * floor AND the same per-die match rate. So:
 *  - no-wilds: faces group purely by how many you hold (one row before capture).
 *  - ones-wild: 1s always split off (they match at 1/6, the others at 2/6), so even
 *    before capture you see two rows — "the 1s" and "everything else".
 *
 * `held` carries the group's effective floor (incl. wild 1s) for the display badge.
 * Groups are returned most-certain first (highest floor, then highest match rate).
 */
export function faceGroups(ctx: TableContext): FaceGroup[] {
  const variant = ctx.variant ?? 'no-wilds'
  const byKey = new Map<string, FaceGroup>()
  for (const face of FACES) {
    const floor = effectiveFloor(ctx, face)
    const p = matchProb(face, variant)
    const key = `${floor}|${p}`
    const group = byKey.get(key)
    if (group) group.faces.push(face)
    else byKey.set(key, { held: floor, faces: [face] })
  }
  return [...byKey.values()].sort(
    (a, b) => b.held - a.held || matchProb(b.faces[0], variant) - matchProb(a.faces[0], variant),
  )
}
