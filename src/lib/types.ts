/** A die face value. No-wilds variant: each face counts only as itself. */
export type Face = 1 | 2 | 3 | 4 | 5 | 6

export const FACES: readonly Face[] = [1, 2, 3, 4, 5, 6]

/** Probability any single unknown die shows a given face (no wilds). */
export const FACE_PROB = 1 / 6

/**
 * Everything the probability engine needs about the table from the user's seat.
 *
 * `heldByFace` is the user's OWN dice, known with certainty (manual entry or the
 * stretch-goal photo capture). It forms a guaranteed floor for those faces and is
 * removed from the pool of unknown dice. Faces the user holds none of are simply 0.
 */
export interface TableContext {
  /** Total dice in play across every (non-eliminated) player, including the user's. */
  totalDice: number
  /** The user's own dice, counted per face. Sum must be <= totalDice. */
  heldByFace: Record<Face, number>
}

/** A bid in Liar's Dice: "at least `quantity` dice showing `face`" across the table. */
export interface Bid {
  quantity: number
  face: Face
}

/** Faces that share an identical conditional distribution (same held count). */
export interface FaceGroup {
  /** How many of each face in this group the user holds (the shared floor). */
  held: number
  faces: Face[]
}
