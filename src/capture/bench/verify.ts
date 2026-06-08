// Sanity-check the Kaggle d6-dice ground truth: overlay each annotation box on its
// image with the decoded value (class 0..5 -> face 1..6). If the numbers match the
// visible top faces, the labels are trustworthy for scoring.

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

const baseName = (p: string) => p.split('/').pop()!.replace(/\.(jpg|txt)$/, '')
const annByName: Record<string, string> = {}
for (const [p, t] of Object.entries(annRaw)) annByName[baseName(p)] = t
const items = Object.entries(imgUrls)
  .map(([p, url]) => ({ name: baseName(p), url, ann: annByName[baseName(p)] }))
  .filter((it) => it.ann)
  .slice(0, 4)

const root = document.getElementById('verify-root')!
root.style.cssText = 'font-family:system-ui;max-width:1000px;margin:20px auto;padding:0 16px 60px'
root.innerHTML =
  '<h1>Ground-truth verification</h1><p>Each die cropped + enlarged, captioned with its label (class+1). If the dots match the number, the labels are correct.</p>'

/** Crop each labelled die out, enlarge it, and caption with the decoded face value. */
function cropDice(url: string, ann: string): Promise<HTMLElement> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const W = img.naturalWidth
      const H = img.naturalHeight
      const wrap = document.createElement('div')
      wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin:8px 0 24px'
      const lines = ann.trim().split('\n').filter(Boolean).slice(0, 16)
      for (const line of lines) {
        const [cls, cx, cy, w, h] = line.trim().split(/\s+/).map(Number)
        const value = cls + 1
        const pad = 0.4
        const sx = (cx - (w / 2) * (1 + pad)) * W
        const sy = (cy - (h / 2) * (1 + pad)) * H
        const sw = w * (1 + pad) * W
        const sh = h * (1 + pad) * H
        const DST = 96
        const c = document.createElement('canvas')
        c.width = DST
        c.height = DST
        c.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, DST, DST)
        c.style.cssText = 'border:2px solid #19c37d;border-radius:4px;display:block'
        const cell = document.createElement('figure')
        cell.style.cssText = 'margin:0;text-align:center;font-size:13px;font-weight:700'
        cell.appendChild(c)
        const cap = document.createElement('figcaption')
        cap.textContent = `label: ${value}`
        cell.appendChild(cap)
        wrap.appendChild(cell)
      }
      resolve(wrap)
    }
    img.src = url
  })
}

async function run() {
  for (const it of items.slice(0, 2)) {
    const h = document.createElement('h3')
    h.textContent = it.name
    root.appendChild(h)
    root.appendChild(await cropDice(it.url, it.ann))
  }
}
run()
