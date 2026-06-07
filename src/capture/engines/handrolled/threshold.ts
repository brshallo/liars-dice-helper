/**
 * Adaptive (local-mean) thresholding via a summed-area / integral image.
 *
 * Why an integral image: the local mean over an arbitrary window can be read in O(1)
 * per pixel (four array lookups) instead of re-summing the window each time, so the
 * whole adaptive threshold is O(width*height) regardless of window size.
 */

export interface GrayImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** Binary mask: 1 = "ink" (a pip/edge of interest), 0 = background. */
export interface BinaryMask {
  data: Uint8Array
  width: number
  height: number
}

export type Polarity = 'darker' | 'lighter'

/**
 * Build a summed-area table. Use Float64 (not Int32) because for a large image the
 * cumulative sum can exceed 2^31 (e.g. 560*420*255 ≈ 6e7 is fine, but bigger inputs
 * aren't, and the cost of f64 here is negligible). The table is padded by one row/col
 * of zeros so window queries near the border need no bounds branching.
 */
export function integralImage(img: GrayImage): Float64Array {
  const { data, width, height } = img
  const iw = width + 1
  const integral = new Float64Array(iw * (height + 1))
  for (let y = 0; y < height; y++) {
    let rowSum = 0
    for (let x = 0; x < width; x++) {
      rowSum += data[y * width + x]
      // integral[y+1][x+1] = integral[y][x+1] + runningRowSum
      integral[(y + 1) * iw + (x + 1)] = integral[y * iw + (x + 1)] + rowSum
    }
  }
  return integral
}

/**
 * Box-blur denoise via the integral image. Replaces each pixel with the mean of a
 * (2*radius+1)^2 window. A small radius (1 = 3x3) annihilates isolated 1-few-px speckle
 * — its energy is averaged across ~9 px so it falls below the adaptive-threshold margin —
 * while leaving solid pips (tens of px across) essentially intact. O(width*height) since
 * the window mean is an O(1) integral lookup.
 *
 * Why denoise here rather than in the engine: thresholding is exactly where speckle turns
 * into phantom "ink", so we smooth immediately before it.
 */
export function boxBlur(img: GrayImage, radius = 1): GrayImage {
  const { width, height } = img
  const integral = integralImage(img)
  const iw = width + 1
  const out = new Uint8ClampedArray(width * height)
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius)
    const y1 = Math.min(height - 1, y + radius)
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(width - 1, x + radius)
      const count = (x1 - x0 + 1) * (y1 - y0 + 1)
      out[y * width + x] = (boxSum(integral, iw, x0, y0, x1, y1) / count) | 0
    }
  }
  return { data: out, width, height }
}

/** Sum of gray values over the inclusive box [x0..x1] x [y0..y1] using the padded SAT. */
function boxSum(integral: Float64Array, iw: number, x0: number, y0: number, x1: number, y1: number): number {
  // +1 offsets account for the zero-padding row/column.
  const a = integral[y0 * iw + x0]
  const b = integral[y0 * iw + (x1 + 1)]
  const c = integral[(y1 + 1) * iw + x0]
  const d = integral[(y1 + 1) * iw + (x1 + 1)]
  return d - b - c + a
}

/**
 * Adaptive threshold. A pixel is "ink" when it differs from its local mean by more
 * than `marginFrac` of the full range (0..255), in the requested direction.
 *
 * - polarity 'darker': pip is darker than the face (typical: dark pips on light die).
 * - polarity 'lighter': pip is lighter than the face (e.g. white pips on a black die).
 *
 * `windowRadius` is half the side of the local-mean window.
 */
export function adaptiveThreshold(
  img: GrayImage,
  polarity: Polarity,
  windowRadius = 12,
  marginFrac = 0.08,
): BinaryMask {
  const { data, width, height } = img
  const integral = integralImage(img)
  const iw = width + 1
  const margin = marginFrac * 255
  const out = new Uint8Array(width * height)

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - windowRadius)
    const y1 = Math.min(height - 1, y + windowRadius)
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - windowRadius)
      const x1 = Math.min(width - 1, x + windowRadius)
      const count = (x1 - x0 + 1) * (y1 - y0 + 1)
      const mean = boxSum(integral, iw, x0, y0, x1, y1) / count
      const v = data[y * width + x]
      const isInk = polarity === 'darker' ? v < mean - margin : v > mean + margin
      out[y * width + x] = isInk ? 1 : 0
    }
  }
  return { data: out, width, height }
}
