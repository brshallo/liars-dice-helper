import { FACES, type FaceGroup, type TableContext } from './types'

/**
 * Collapse the six faces into groups that share an identical conditional
 * distribution. With no wilds, two faces behave identically iff the user holds the
 * same number of each (the only thing distinguishing faces is the guaranteed floor
 * from the user's own dice). Before the user enters any dice, all six collapse into
 * a single group — which is why the probability panel shows one row, not six.
 *
 * Groups are returned highest-held first (most certain faces on top), and faces
 * within a group stay in ascending face order for stable, readable labels.
 */
export function faceGroups(ctx: TableContext): FaceGroup[] {
  const byHeld = new Map<number, FaceGroup>()
  for (const face of FACES) {
    const held = ctx.heldByFace[face] ?? 0
    const group = byHeld.get(held)
    if (group) group.faces.push(face)
    else byHeld.set(held, { held, faces: [face] })
  }
  return [...byHeld.values()].sort((a, b) => b.held - a.held)
}
