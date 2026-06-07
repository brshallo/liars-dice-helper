/** A die face value. No-wilds variant: each face counts only as itself. */
export type Face = 1 | 2 | 3 | 4 | 5 | 6

export const FACES: readonly Face[] = [1, 2, 3, 4, 5, 6]

/** Probability any single unknown die shows a given face (no wilds). */
export const FACE_PROB = 1 / 6

/**
 * Game variant.
 * - `no-wilds`: every face counts only as itself; each unknown die is 1/6 a face.
 * - `ones-wild`: 1s ("aces") count as ANY face. So an unknown die matches a non-1
 *   face with prob 2/6 (it shows the face OR a 1), and your held 1s are a floor for
 *   every non-1 face. A bid ON 1s is unaffected (still just literal 1s, 1/6).
 */
export type Variant = 'no-wilds' | 'ones-wild'

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
  /** Defaults to `no-wilds` when omitted. */
  variant?: Variant
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
