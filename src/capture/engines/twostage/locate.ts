import { toGray, toImageData } from '../util'
import { boxBlur, type GrayImage } from '../handrolled/threshold'
import { connectedComponents } from '../handrolled/components'

export interface DieBox {
  x: number
  y: number
  w: number
  h: number
}

// Stage 1: find DICE (not pips) — solid, square-ish foreground regions. We threshold
// globally (Otsu) so a whole die reads as one SOLID blob (adaptive/local thresholding
// only marks edges, leaving die interiors hollow). The downstream classifier + its
// background class reject false boxes, so we favour recall here.
const MIN_AREA_FRAC = 0.0006 // die ≥ ~0.06% of the image
const MAX_AREA_FRAC = 0.3 // die ≤ 30%
const MIN_ASPECT = 0.5
const MAX_ASPECT = 2.0
const MIN_FILL = 0.6 // a solid square fills its bbox well
const NMS_IOU = 0.4

/** Otsu's global threshold on an 8-bit grayscale image. */
function otsu(gray: GrayImage): number {
  const hist = new Array(256).fill(0)
  for (let i = 0; i < gray.data.length; i++) hist[gray.data[i]]++
  const total = gray.data.length
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * hist[t]
  let sumB = 0
  let wB = 0
  let maxVar = -1
  let thr = 127
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > maxVar) {
      maxVar = between
      thr = t
    }
  }
  return thr
}

function iou(a: DieBox, b: DieBox): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  if (inter <= 0) return 0
  return inter / (a.w * a.h + b.w * b.h - inter)
}

/** Fraction of box `b`'s area that lies inside box `k`. */
function containedFrac(b: DieBox, k: DieBox): number {
  const x1 = Math.max(b.x, k.x)
  const y1 = Math.max(b.y, k.y)
  const x2 = Math.min(b.x + b.w, k.x + k.w)
  const y2 = Math.min(b.y + b.h, k.y + k.h)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  return inter / (b.w * b.h)
}

const CONTAIN_FRAC = 0.8 // only drop near-fully-nested boxes (pip/partial), not adjacent dice

/**
 * Greedy NMS, biggest-first. Drops a box if it overlaps a kept box (IoU) OR is mostly
 * *inside* one — the latter merges the small pip-sized / partial boxes that nest inside
 * a whole-die box (which plain IoU misses, since a small box in a big one has low IoU).
 */
export function dedupe(boxes: DieBox[]): DieBox[] {
  const kept: DieBox[] = []
  for (const b of [...boxes].sort((p, q) => q.w * q.h - p.w * p.h)) {
    if (kept.every((k) => iou(b, k) < NMS_IOU && containedFrac(b, k) < CONTAIN_FRAC)) kept.push(b)
  }
  return kept
}

export function findDice(src: HTMLCanvasElement | ImageData): DieBox[] {
  const img = toImageData(src)
  const gray = boxBlur(toGray(img) as GrayImage, 1)
  const { width, height } = gray
  const area = width * height
  const minArea = area * MIN_AREA_FRAC
  const maxArea = area * MAX_AREA_FRAC
  const thr = otsu(gray)

  const candidates: DieBox[] = []
  // Dice may be the bright side of the split (dark surface) or the dark side (light
  // surface). Try both; the classifier's background class drops the wrong one's blobs.
  for (const bright of [true, false]) {
    const mask = new Uint8Array(area)
    for (let i = 0; i < area; i++) mask[i] = (bright ? gray.data[i] > thr : gray.data[i] < thr) ? 1 : 0
    for (const b of connectedComponents({ data: mask, width, height })) {
      const [x, y, w, h] = b.bbox
      if (b.area < minArea || b.area > maxArea) continue
      const aspect = w / h
      if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) continue
      if (b.fillRatio < MIN_FILL) continue
      candidates.push({ x, y, w, h })
    }
  }
  return dedupe(candidates)
}
