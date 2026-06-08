import * as tf from '@tensorflow/tfjs'

// M1: train a tiny top-face classifier (6 classes) entirely in the browser, on die
// crops harvested from the Kaggle d6-dice set (YOLO boxes, class 0..5 = face 1..6).
// Reports held-out per-face accuracy + a confusion matrix. No Python involved.

const imgUrls = import.meta.glob('/data/d6-dice/Images/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>
const annRaw = import.meta.glob('/data/d6-dice/Annotations/*.txt', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const CROP = 44 // model input size
const PAD = 0.25 // include a little context around each die box

const root = document.getElementById('train-root')!
root.style.cssText = 'font-family:system-ui;max-width:900px;margin:20px auto;padding:0 16px 60px'
const log = (html: string) => {
  root.innerHTML = html
}
const win = window as unknown as { __TRAIN__: Record<string, unknown> }
win.__TRAIN__ = { status: 'starting' }

const baseName = (p: string) => p.split('/').pop()!.replace(/\.(jpg|txt)$/, '')

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = url
  })
}

/** Crop one die box (normalized cx,cy,w,h) out of an image into a CROPxCROP canvas. */
const cropCanvas = document.createElement('canvas')
cropCanvas.width = CROP
cropCanvas.height = CROP
const cctx = cropCanvas.getContext('2d', { willReadFrequently: true })!

function cropToTensor(img: HTMLImageElement, cx: number, cy: number, w: number, h: number): tf.Tensor3D {
  const W = img.naturalWidth
  const H = img.naturalHeight
  const sw = w * (1 + PAD) * W
  const sh = h * (1 + PAD) * H
  const sx = Math.max(0, cx * W - sw / 2)
  const sy = Math.max(0, cy * H - sh / 2)
  cctx.clearRect(0, 0, CROP, CROP)
  cctx.drawImage(img, sx, sy, Math.min(sw, W - sx), Math.min(sh, H - sy), 0, 0, CROP, CROP)
  return tf.tidy(() => tf.browser.fromPixels(cropCanvas).toFloat().div(255)) as tf.Tensor3D
}

async function harvest(): Promise<{ xs: tf.Tensor4D; labels: number[] }> {
  const items = Object.entries(imgUrls)
    .map(([p, url]) => ({ name: baseName(p), url, ann: annRaw[`/data/d6-dice/Annotations/${baseName(p)}.txt`] }))
    .filter((it) => it.ann)
  const crops: tf.Tensor3D[] = []
  const labels: number[] = []
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const img = await loadImage(it.url)
    for (const line of it.ann.trim().split('\n').filter(Boolean)) {
      const [cls, cx, cy, w, h] = line.trim().split(/\s+/).map(Number)
      if (cls < 0 || cls > 5) continue
      crops.push(cropToTensor(img, cx, cy, w, h))
      labels.push(cls)
    }
    if (i % 20 === 0) {
      log(`<h1>Training data</h1><p>Harvesting crops… image ${i}/${items.length}, ${crops.length} dice so far</p>`)
      await tf.nextFrame()
    }
  }
  const xs = tf.stack(crops) as tf.Tensor4D
  crops.forEach((t) => t.dispose())
  return { xs, labels }
}

function buildModel(): tf.LayersModel {
  const m = tf.sequential()
  m.add(tf.layers.conv2d({ inputShape: [CROP, CROP, 3], filters: 24, kernelSize: 3, activation: 'relu' }))
  m.add(tf.layers.maxPooling2d({ poolSize: 2 }))
  m.add(tf.layers.conv2d({ filters: 48, kernelSize: 3, activation: 'relu' }))
  m.add(tf.layers.maxPooling2d({ poolSize: 2 }))
  m.add(tf.layers.conv2d({ filters: 64, kernelSize: 3, activation: 'relu' }))
  m.add(tf.layers.maxPooling2d({ poolSize: 2 }))
  m.add(tf.layers.flatten())
  m.add(tf.layers.dropout({ rate: 0.35 }))
  m.add(tf.layers.dense({ units: 96, activation: 'relu' }))
  m.add(tf.layers.dense({ units: 6, activation: 'softmax' }))
  m.compile({ optimizer: tf.train.adam(0.001), loss: 'categoricalCrossentropy', metrics: ['accuracy'] })
  return m
}

async function run() {
  log('<h1>Training</h1><p>Loading…</p>')
  const { xs, labels } = await harvest()
  const N = labels.length
  win.__TRAIN__.crops = N

  // Shuffle, then split 85/15 train/val.
  const idx = tf.util.createShuffledIndices(N) as unknown as Int32Array
  const order = Array.from(idx)
  const valN = Math.floor(N * 0.15)
  const valIdx = order.slice(0, valN)
  const trIdx = order.slice(valN)

  const gather = (rows: number[]) => tf.tidy(() => tf.gather(xs, tf.tensor1d(rows, 'int32')))
  let xTr = gather(trIdx) as tf.Tensor4D
  const xVal = gather(valIdx) as tf.Tensor4D
  const yTrLabels = trIdx.map((r) => labels[r])
  const yValLabels = valIdx.map((r) => labels[r])

  // Augment TRAIN only with the 4 right-angle rotations (pip COUNT is rotation-invariant),
  // so the classifier sees dice at every orientation — 4x the data.
  const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]
  const parts = angles.map((a) => (a === 0 ? xTr.clone() : (tf.image.rotateWithOffset(xTr, a) as tf.Tensor4D)))
  const xTrAug = tf.concat(parts) as tf.Tensor4D
  parts.forEach((t) => t.dispose())
  xTr.dispose()
  xTr = xTrAug
  const yTrAug = angles.flatMap(() => yTrLabels)
  const yTr = tf.oneHot(tf.tensor1d(yTrAug, 'int32'), 6)
  const yVal = tf.oneHot(tf.tensor1d(yValLabels, 'int32'), 6)

  const model = buildModel()
  win.__TRAIN__.params = model.countParams()

  const EPOCHS = 35
  await model.fit(xTr, yTr, {
    epochs: EPOCHS,
    batchSize: 64,
    validationData: [xVal, yVal],
    shuffle: true,
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        log(
          `<h1>Training</h1><p>${N} crops (${xTr.shape[0]} train w/ flip-aug, ${valN} val), ${model.countParams()} params</p>
           <p>epoch ${epoch + 1}/${EPOCHS} — train acc ${(logs!.acc as number).toFixed(3)}, <b>val acc ${(logs!.val_acc as number).toFixed(3)}</b></p>`,
        )
        win.__TRAIN__ = { ...win.__TRAIN__, status: 'training', epoch: epoch + 1, valAcc: logs!.val_acc }
        await tf.nextFrame()
      },
    },
  })

  // Confusion matrix on the held-out val set.
  const predIdx = tf.tidy(() => (model.predict(xVal) as tf.Tensor).argMax(-1))
  const preds = Array.from(await predIdx.data())
  predIdx.dispose()
  const conf = Array.from({ length: 6 }, () => new Array(6).fill(0))
  let correct = 0
  for (let i = 0; i < yValLabels.length; i++) {
    conf[yValLabels[i]][preds[i]]++
    if (yValLabels[i] === preds[i]) correct++
  }
  const valAcc = correct / yValLabels.length
  const perClass = conf.map((rowArr, c) => {
    const tot = rowArr.reduce((a, b) => a + b, 0)
    return tot ? conf[c][c] / tot : 0
  })

  // Save the trained model artifacts onto window for extraction (base64 weights + topology).
  await model.save(
    tf.io.withSaveHandler(async (artifacts) => {
      const wd = artifacts.weightData as ArrayBuffer
      const bytes = new Uint8Array(wd)
      let bin = ''
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
      win.__TRAIN__.model = {
        topology: artifacts.modelTopology,
        weightSpecs: artifacts.weightSpecs,
        weightsB64: btoa(bin),
      }
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } }
    }),
  )

  win.__TRAIN__ = { ...win.__TRAIN__, status: 'done', valAcc, perClass, confusion: conf, crops: N }

  const fmt = (x: number) => (x * 100).toFixed(1) + '%'
  log(`
    <h1>Tiny top-face classifier — results</h1>
    <p><b>Held-out val accuracy: ${fmt(valAcc)}</b> on ${yValLabels.length} crops · ${N} crops total · ${model.countParams()} params</p>
    <h3>Per-face accuracy</h3>
    <p>${perClass.map((a, c) => `face ${c + 1}: <b>${fmt(a)}</b>`).join(' · ')}</p>
    <h3>Confusion matrix (rows = true face, cols = predicted)</h3>
    <table style="border-collapse:collapse;font-variant-numeric:tabular-nums">
      <tr><th></th>${[1, 2, 3, 4, 5, 6].map((c) => `<th style="padding:4px 8px">${c}</th>`).join('')}</tr>
      ${conf
        .map(
          (rowArr, r) =>
            `<tr><th style="padding:4px 8px">${r + 1}</th>${rowArr
              .map((v, c) => `<td style="padding:4px 8px;text-align:center;background:${r === c ? '#d6f5d6' : v ? '#f7d6d6' : '#fff'}">${v}</td>`)
              .join('')}</tr>`,
        )
        .join('')}
    </table>`)
}

run().catch((e) => {
  log(`<h1>Training error</h1><pre>${(e as Error).stack}</pre>`)
  win.__TRAIN__ = { status: 'error', error: String(e) }
})
