/** Shared helpers for engines: normalise inputs to canvas / ImageData / grayscale. */

export function toCanvas(src: HTMLCanvasElement | ImageData): HTMLCanvasElement {
  if (src instanceof HTMLCanvasElement) return src
  const canvas = document.createElement('canvas')
  canvas.width = src.width
  canvas.height = src.height
  canvas.getContext('2d')!.putImageData(src, 0, 0)
  return canvas
}

export function toImageData(src: HTMLCanvasElement | ImageData): ImageData {
  if (!(src instanceof HTMLCanvasElement)) return src
  const ctx = src.getContext('2d')!
  return ctx.getImageData(0, 0, src.width, src.height)
}

/** Single-channel luminance buffer (0..255) from an image. */
export function toGray(img: ImageData): { data: Uint8ClampedArray; width: number; height: number } {
  const { data, width, height } = img
  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Rec. 601 luma — cheap and good enough for pip/face separation.
    gray[p] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0
  }
  return { data: gray, width, height }
}
