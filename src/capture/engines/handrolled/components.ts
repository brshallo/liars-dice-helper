/**
 * Connected-component labelling on a binary mask via iterative flood fill.
 *
 * Why iterative (explicit stack) rather than recursion: a ~560x420 image can have a
 * single blob spanning tens of thousands of pixels, which would blow the JS call
 * stack. The explicit stack is also faster (no call overhead).
 *
 * 4-connectivity is used: pips are solid round-ish blobs, so 4-connectivity is enough
 * and avoids bridging two near-touching blobs through a diagonal pixel.
 */

import type { BinaryMask } from './threshold'

export interface Blob {
  /** Number of pixels in the component. */
  area: number
  /** [x, y, w, h] bounding box. */
  bbox: [number, number, number, number]
  /** Centroid in pixel coordinates. */
  cx: number
  cy: number
  /** area / (w*h): how "solid" the blob is. A disc fills ~0.79 of its box. */
  fillRatio: number
}

export function connectedComponents(mask: BinaryMask): Blob[] {
  const { data, width, height } = mask
  const visited = new Uint8Array(width * height)
  const blobs: Blob[] = []
  // Reused flood-fill stack of flat pixel indices.
  const stack: number[] = []

  for (let start = 0; start < data.length; start++) {
    if (data[start] !== 1 || visited[start]) continue

    let area = 0
    let sumX = 0
    let sumY = 0
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0

    stack.length = 0
    stack.push(start)
    visited[start] = 1

    while (stack.length > 0) {
      const idx = stack.pop()!
      const x = idx % width
      const y = (idx - x) / width

      area++
      sumX += x
      sumY += y
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y

      // 4-neighbours
      if (x > 0) {
        const n = idx - 1
        if (data[n] === 1 && !visited[n]) { visited[n] = 1; stack.push(n) }
      }
      if (x < width - 1) {
        const n = idx + 1
        if (data[n] === 1 && !visited[n]) { visited[n] = 1; stack.push(n) }
      }
      if (y > 0) {
        const n = idx - width
        if (data[n] === 1 && !visited[n]) { visited[n] = 1; stack.push(n) }
      }
      if (y < height - 1) {
        const n = idx + width
        if (data[n] === 1 && !visited[n]) { visited[n] = 1; stack.push(n) }
      }
    }

    const w = maxX - minX + 1
    const h = maxY - minY + 1
    blobs.push({
      area,
      bbox: [minX, minY, w, h],
      cx: sumX / area,
      cy: sumY / area,
      fillRatio: area / (w * h),
    })
  }

  return blobs
}
