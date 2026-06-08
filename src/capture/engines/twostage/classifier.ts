import * as tf from '@tensorflow/tfjs'
import type { DieValue } from '../types'
import type { DieBox } from './locate'

// Stage 2: the tiny CNN top-face classifier trained in train.html. Loaded lazily from
// the committed model asset; never imported by the main app.
const MODEL_URL = '/models/dice-classifier/model.json'
const CROP = 44

let modelPromise: Promise<tf.LayersModel> | null = null
export function loadClassifier(): Promise<tf.LayersModel> {
  if (!modelPromise) modelPromise = tf.loadLayersModel(MODEL_URL)
  return modelPromise
}

const cropCanvas = (() => {
  const c = document.createElement('canvas')
  c.width = CROP
  c.height = CROP
  return c
})()
const cctx = cropCanvas.getContext('2d', { willReadFrequently: true })!

export interface CropRead {
  /** 1..6, or null when the crop is classified as background (not a die). */
  value: DieValue | null
  confidence: number
}

/** Classify each box's top face. Returns value (1..6) + softmax confidence per box. */
export async function classifyBoxes(
  source: HTMLCanvasElement,
  boxes: DieBox[],
): Promise<CropRead[]> {
  if (boxes.length === 0) return []
  const model = await loadClassifier()

  const crops = boxes.map((b) => {
    cctx.clearRect(0, 0, CROP, CROP)
    cctx.drawImage(source, b.x, b.y, b.w, b.h, 0, 0, CROP, CROP)
    // Grayscale (mean of channels) — must match the model's training input.
    return tf.tidy(() => tf.browser.fromPixels(cropCanvas).toFloat().mean(2, true).div(255)) as tf.Tensor3D
  })
  const batch = tf.stack(crops) as tf.Tensor4D
  crops.forEach((t) => t.dispose())

  const probs = model.predict(batch) as tf.Tensor
  const argMax = tf.tidy(() => probs.argMax(-1))
  const maxProb = tf.tidy(() => probs.max(-1))
  const values = await argMax.data()
  const confs = await maxProb.data()
  batch.dispose()
  probs.dispose()
  argMax.dispose()
  maxProb.dispose()

  // Class index 6 = background → not a die (value null). 0..5 → faces 1..6.
  return boxes.map((_, i) => ({
    value: values[i] >= 6 ? null : ((values[i] + 1) as DieValue),
    confidence: confs[i],
  }))
}
