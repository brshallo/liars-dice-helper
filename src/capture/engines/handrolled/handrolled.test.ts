import { describe, it, expect } from 'vitest'
import { integralImage, adaptiveThreshold, boxBlur, type GrayImage, type BinaryMask } from './threshold'
import { connectedComponents } from './components'
import { classifyPips, clusterPips, filterClusters, scoreClusters, type PipBlob } from './pips'
import { detectDice, detectForPolarity } from './handrolledEngine'

// ---- Tiny synthetic-image helpers (no DOM / canvas needed) ----

/** Build a GrayImage filled with `bg`, then paint filled discs at the given centres. */
function makeGray(
  width: number,
  height: number,
  bg: number,
  discs: { x: number; y: number; r: number; v: number }[],
): GrayImage {
  const data = new Uint8ClampedArray(width * height).fill(bg)
  for (const d of discs) {
    for (let y = Math.max(0, d.y - d.r); y <= Math.min(height - 1, d.y + d.r); y++) {
      for (let x = Math.max(0, d.x - d.r); x <= Math.min(width - 1, d.x + d.r); x++) {
        const dx = x - d.x
        const dy = y - d.y
        if (dx * dx + dy * dy <= d.r * d.r) data[y * width + x] = d.v
      }
    }
  }
  return { data, width, height }
}

/**
 * Sprinkle deterministic salt-and-pepper speckle onto a GrayImage in place. Each affected
 * pixel is forced to near-black or near-white, simulating sensor noise. Uses a tiny LCG so
 * the test is reproducible without a dependency.
 */
function addSpeckle(img: GrayImage, count: number, seed = 1): GrayImage {
  let s = seed >>> 0
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
  for (let i = 0; i < count; i++) {
    const x = (next() * img.width) | 0
    const y = (next() * img.height) | 0
    img.data[y * img.width + x] = next() < 0.5 ? 0 : 255
  }
  return img
}

/** Build a binary mask directly from a 2D 0/1 grid (rows of equal length). */
function maskFromGrid(grid: number[][]): BinaryMask {
  const height = grid.length
  const width = grid[0].length
  const data = new Uint8Array(width * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data[y * width + x] = grid[y][x] ? 1 : 0
  return { data, width, height }
}

describe('integralImage', () => {
  it('produces a padded summed-area table with correct box sums', () => {
    // 2x2 image of value 10 → bottom-right of SAT is the total (40).
    const img: GrayImage = { data: new Uint8ClampedArray([10, 10, 10, 10]), width: 2, height: 2 }
    const sat = integralImage(img)
    const iw = 3 // width + 1
    expect(sat[2 * iw + 2]).toBe(40) // full sum
    expect(sat[1 * iw + 1]).toBe(10) // top-left pixel only
    // first padded row/col are all zero
    expect(sat[0]).toBe(0)
    expect(sat[iw]).toBe(0)
  })
})

describe('adaptiveThreshold', () => {
  it('marks a dark disc on a light field as ink (darker polarity)', () => {
    const img = makeGray(40, 40, 230, [{ x: 20, y: 20, r: 5, v: 20 }])
    const mask = adaptiveThreshold(img, 'darker', 8, 0.08)
    // centre of the disc should be ink
    expect(mask.data[20 * 40 + 20]).toBe(1)
    // a far corner of plain background should not be ink
    expect(mask.data[2 * 40 + 2]).toBe(0)
  })

  it('handles inverted contrast with lighter polarity', () => {
    const img = makeGray(40, 40, 20, [{ x: 20, y: 20, r: 5, v: 230 }])
    const dark = adaptiveThreshold(img, 'darker', 8, 0.08)
    const light = adaptiveThreshold(img, 'lighter', 8, 0.08)
    expect(light.data[20 * 40 + 20]).toBe(1)
    expect(dark.data[20 * 40 + 20]).toBe(0)
  })
})

describe('connectedComponents', () => {
  it('finds N separate blobs', () => {
    // three 2x2 blocks separated by background
    const grid = [
      [1, 1, 0, 1, 1, 0, 0],
      [1, 1, 0, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 1, 0, 0, 0],
      [0, 0, 1, 1, 0, 0, 0],
    ]
    const blobs = connectedComponents(maskFromGrid(grid))
    expect(blobs.length).toBe(3)
    for (const b of blobs) expect(b.area).toBe(4)
  })

  it('uses 4-connectivity (diagonal touch = two blobs)', () => {
    const grid = [
      [1, 0],
      [0, 1],
    ]
    expect(connectedComponents(maskFromGrid(grid)).length).toBe(2)
  })

  it('records centroid, bbox and fill ratio', () => {
    const grid = [
      [1, 1, 1],
      [1, 1, 1],
    ]
    const [b] = connectedComponents(maskFromGrid(grid))
    expect(b.area).toBe(6)
    expect(b.bbox).toEqual([0, 0, 3, 2])
    expect(b.cx).toBeCloseTo(1)
    expect(b.cy).toBeCloseTo(0.5)
    expect(b.fillRatio).toBeCloseTo(1)
  })

  it('does not overflow the stack on a large solid blob', () => {
    // 200x200 solid → ~40k pixels in one component; iterative fill must not throw.
    const width = 200
    const height = 200
    const data = new Uint8Array(width * height).fill(1)
    const blobs = connectedComponents({ data, width, height })
    expect(blobs.length).toBe(1)
    expect(blobs[0].area).toBe(width * height)
  })
})

describe('classifyPips', () => {
  it('keeps round pip-sized blobs and rejects the big face blob', () => {
    // four similar pip discs on a light field + one giant dark "face" region.
    const img = makeGray(120, 120, 235, [
      { x: 30, y: 30, r: 5, v: 20 },
      { x: 50, y: 30, r: 5, v: 20 },
      { x: 30, y: 50, r: 5, v: 20 },
      { x: 50, y: 50, r: 5, v: 20 },
      { x: 90, y: 90, r: 25, v: 30 }, // big blob — should be rejected as too large
    ])
    const blobs = connectedComponents(adaptiveThreshold(img, 'darker'))
    const pips = classifyPips(blobs)
    // the four small discs survive; the oversized one is filtered by the area band
    expect(pips.length).toBe(4)
  })

  it('returns empty when there are no plausible pips', () => {
    expect(classifyPips([])).toEqual([])
  })
})

describe('clusterPips', () => {
  function pip(x: number, y: number, d = 10): PipBlob {
    return {
      area: Math.PI * (d / 2) ** 2,
      bbox: [x - d / 2, y - d / 2, d, d],
      cx: x,
      cy: y,
      fillRatio: 0.78,
      diameter: d,
    }
  }

  it('groups 5 nearby pips into ONE die with value 5', () => {
    // a "5" face: four corners + centre, all within one die.
    const pips = [pip(100, 100), pip(120, 100), pip(100, 120), pip(120, 120), pip(110, 110)]
    const clusters = clusterPips(pips)
    expect(clusters.length).toBe(1)
    expect(clusters[0].value).toBe(5)
  })

  it('separates two distant dice into two clusters', () => {
    const dieA = [pip(50, 50), pip(70, 50)] // value 2
    const dieB = [pip(300, 300), pip(320, 300), pip(310, 310)] // value 3
    const clusters = clusterPips([...dieA, ...dieB])
    expect(clusters.length).toBe(2)
    const values = clusters.map((c) => c.value).sort()
    expect(values).toEqual([2, 3])
  })

  it('clamps a group of >6 pips to value 6', () => {
    const pips = Array.from({ length: 8 }, (_, i) => pip(100 + (i % 4) * 8, 100 + ((i / 4) | 0) * 8))
    const clusters = clusterPips(pips)
    expect(clusters.length).toBe(1)
    expect(clusters[0].value).toBe(6)
  })

  it('union bbox covers all member pips', () => {
    // diameter 10 → maxDist 45, so keep the two pips within that to stay one die.
    const pips = [pip(100, 100), pip(130, 130)]
    const clusters = clusterPips(pips)
    expect(clusters.length).toBe(1)
    const [x, y, w, h] = clusters[0].bbox
    expect(x).toBeLessThanOrEqual(95)
    expect(y).toBeLessThanOrEqual(95)
    expect(x + w).toBeGreaterThanOrEqual(135)
    expect(y + h).toBeGreaterThanOrEqual(135)
  })
})

describe('scoreClusters / polarity selection', () => {
  it('prefers well-formed clusters over empty results', () => {
    const good = clusterPips([
      { area: 78, bbox: [0, 0, 10, 10], cx: 5, cy: 5, fillRatio: 0.78, diameter: 10 },
    ])
    expect(scoreClusters(good)).toBeGreaterThan(scoreClusters([]))
  })
})

describe('detectForPolarity / detectDice (end-to-end on synthetic image)', () => {
  // A "3" die: dark pips on a light face. Single die, value 3.
  const lightDieThree = makeGray(120, 120, 235, [
    { x: 40, y: 40, r: 5, v: 20 },
    { x: 60, y: 60, r: 5, v: 20 },
    { x: 80, y: 80, r: 5, v: 20 },
  ])

  it('detectForPolarity(darker) reads a dark-pip die', () => {
    const clusters = detectForPolarity(lightDieThree, 'darker')
    expect(clusters.length).toBe(1)
    expect(clusters[0].value).toBe(3)
  })

  it('detectDice auto-picks polarity for an inverted (white-pip) die', () => {
    // white pips on a dark face — only the "lighter" polarity should read it.
    const darkDieFour = makeGray(120, 120, 25, [
      { x: 40, y: 40, r: 5, v: 235 },
      { x: 80, y: 40, r: 5, v: 235 },
      { x: 40, y: 80, r: 5, v: 235 },
      { x: 80, y: 80, r: 5, v: 235 },
    ])
    const clusters = detectDice(darkDieFour)
    expect(clusters.length).toBe(1)
    expect(clusters[0].value).toBe(4)
  })

  it('detects two dice and the correct multiset of values', () => {
    // left die = 2, right die = 3, well separated.
    const twoDice = makeGray(260, 140, 235, [
      // die A (value 2)
      { x: 40, y: 60, r: 5, v: 20 },
      { x: 70, y: 90, r: 5, v: 20 },
      // die B (value 3)
      { x: 180, y: 50, r: 5, v: 20 },
      { x: 200, y: 70, r: 5, v: 20 },
      { x: 220, y: 90, r: 5, v: 20 },
    ])
    const clusters = detectDice(twoDice)
    expect(clusters.length).toBe(2)
    const values = clusters.map((c) => c.value).sort()
    expect(values).toEqual([2, 3])
  })
})

describe('boxBlur (denoise)', () => {
  it('flattens isolated speckle toward the local mean but preserves a solid disc', () => {
    const img = makeGray(60, 60, 200, [{ x: 30, y: 30, r: 8, v: 20 }])
    addSpeckle(img, 80, 7)
    const blurred = boxBlur(img, 1)
    // Disc centre stays dark (a solid blob survives the 3x3 average).
    expect(blurred.data[30 * 60 + 30]).toBeLessThan(60)
    // No blurred background pixel is anywhere near a forced 0/255 extreme: a lone speckle
    // averaged over 9 px can't stay extreme. Check the whole background region.
    let extremeBg = 0
    for (let y = 2; y < 58; y++) {
      for (let x = 2; x < 58; x++) {
        const dx = x - 30
        const dy = y - 30
        if (dx * dx + dy * dy <= 12 * 12) continue // skip near the disc
        const v = blurred.data[y * 60 + x]
        if (v < 120 || v > 235) extremeBg++
      }
    }
    expect(extremeBg).toBe(0)
  })
})

describe('filterClusters (noise guards)', () => {
  function pip(x: number, y: number, d = 10, area = Math.PI * (d / 2) ** 2, fill = 0.78): PipBlob {
    return { area, bbox: [x - d / 2, y - d / 2, d, d], cx: x, cy: y, fillRatio: fill, diameter: d }
  }

  it('rejects a lone tiny/ragged single pip but keeps a clean large one', () => {
    const speckleDie = clusterPips([pip(50, 50, 4, 8, 0.4)]) // tiny + ragged → not a die
    expect(filterClusters(speckleDie).length).toBe(0)

    const realOne = clusterPips([pip(50, 50, 12, 113, 0.78)]) // clean solid "1"
    expect(filterClusters(realOne).length).toBe(1)
  })

  it('rejects an over-merged cluster whose footprint is too large for its pip size', () => {
    // Two tiny pips just close enough to union (within SAME_DIE_DIAMETERS) yet spanning
    // more than a real die square for that pip size — a noise artifact, not a die.
    // d=4 → union radius = 4*4.5 = 18px; place centres 17px apart so they merge, giving a
    // bbox span of 21px = 5.25 diameters, just over MAX_DIE_SPAN_DIAMETERS (5).
    const d = 4
    const scattered = clusterPips([pip(20, 20, d), pip(37, 20, d)])
    expect(scattered.length).toBe(1) // they merged into one cluster
    expect(filterClusters(scattered).length).toBe(0) // ...which the span guard rejects
  })

  it('keeps a normal compact multi-pip die', () => {
    const fiveDie = clusterPips([pip(100, 100), pip(120, 100), pip(100, 120), pip(120, 120), pip(110, 110)])
    expect(filterClusters(fiveDie).length).toBe(1)
  })
})

describe('end-to-end noise rejection', () => {
  it('reads the real dice and emits NO phantom dice on a heavily speckled image', () => {
    // Two clean dice (value 2 and value 4) on a light field, then heavy speckle everywhere.
    const img = makeGray(260, 160, 235, [
      // die A (value 2)
      { x: 50, y: 60, r: 7, v: 20 },
      { x: 80, y: 90, r: 7, v: 20 },
      // die B (value 4)
      { x: 180, y: 50, r: 7, v: 20 },
      { x: 220, y: 50, r: 7, v: 20 },
      { x: 180, y: 90, r: 7, v: 20 },
      { x: 220, y: 90, r: 7, v: 20 },
    ])
    addSpeckle(img, 1200, 42) // ~3% of pixels forced to salt/pepper

    const clusters = detectDice(img)
    // Exactly the two real dice — no phantom single-pip "dice" from the speckle.
    expect(clusters.length).toBe(2)
    expect(clusters.map((c) => c.value).sort()).toEqual([2, 4])
  })

  it('a pure-noise image (no dice) yields zero or near-zero phantom dice', () => {
    const img = makeGray(200, 200, 235, [])
    addSpeckle(img, 1500, 99)
    const clusters = detectDice(img)
    // The whole point: random speckle must not manufacture a pile of phantom dice.
    expect(clusters.length).toBeLessThanOrEqual(1)
  })
})
