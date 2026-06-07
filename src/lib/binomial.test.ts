import { describe, it, expect } from 'vitest'
import { choose, binomPMF, binomCDF, binomAtLeast } from './binomial'

describe('choose', () => {
  it('handles boundaries', () => {
    expect(choose(5, 0)).toBe(1)
    expect(choose(5, 5)).toBe(1)
    expect(choose(5, 6)).toBe(0)
    expect(choose(5, -1)).toBe(0)
  })
  it('computes known values', () => {
    expect(choose(5, 2)).toBe(10)
    expect(choose(10, 3)).toBe(120)
    expect(choose(40, 2)).toBe(780)
  })
})

describe('binomPMF', () => {
  it('is zero outside [0, n]', () => {
    expect(binomPMF(-1, 5, 1 / 6)).toBe(0)
    expect(binomPMF(6, 5, 1 / 6)).toBe(0)
  })
  it('sums to 1 over all k', () => {
    const n = 40
    let sum = 0
    for (let k = 0; k <= n; k++) sum += binomPMF(k, n, 1 / 6)
    expect(sum).toBeCloseTo(1, 10)
  })
})

describe('binomCDF', () => {
  it('is 0 below 0 and 1 at/after n', () => {
    expect(binomCDF(-1, 5, 1 / 6)).toBe(0)
    expect(binomCDF(5, 5, 1 / 6)).toBe(1)
    expect(binomCDF(9, 5, 1 / 6)).toBe(1)
  })
  it('is non-decreasing', () => {
    let prev = 0
    for (let k = 0; k <= 5; k++) {
      const v = binomCDF(k, 5, 1 / 6)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('binomAtLeast', () => {
  it('is certain for k <= 0 and impossible for k > n', () => {
    expect(binomAtLeast(0, 8, 1 / 6)).toBe(1)
    expect(binomAtLeast(-3, 8, 1 / 6)).toBe(1)
    expect(binomAtLeast(9, 8, 1 / 6)).toBe(0)
  })
  it('matches the survival of the CDF', () => {
    // P(>=1 of n) = 1 - (5/6)^n
    expect(binomAtLeast(1, 5, 1 / 6)).toBeCloseTo(1 - Math.pow(5 / 6, 5), 10)
    expect(binomAtLeast(1, 10, 1 / 6)).toBeCloseTo(1 - Math.pow(5 / 6, 10), 10)
  })
  it('matches a hand-computed value', () => {
    // P(>=2 of 5 at 1/6) = 0.196245...
    expect(binomAtLeast(2, 5, 1 / 6)).toBeCloseTo(0.196245, 5)
  })
})
