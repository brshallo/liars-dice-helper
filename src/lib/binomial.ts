/**
 * Exact binomial probabilities. The table never holds more than ~40 dice, so a
 * direct multiplicative computation is well within double precision — no need for
 * log-gamma tricks. Kept dependency-free and pure so it's trivial to unit-test.
 */

/** Binomial coefficient C(n, k), computed multiplicatively to limit overflow. */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  // Use the smaller of k and n-k for fewer iterations and smaller intermediates.
  const kk = Math.min(k, n - k)
  let result = 1
  for (let i = 0; i < kk; i++) {
    result = (result * (n - i)) / (i + 1)
  }
  return result
}

/** P(X = k) for X ~ Binomial(n, p). */
export function binomPMF(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return 0
  return choose(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k)
}

/** P(X <= k) for X ~ Binomial(n, p). */
export function binomCDF(k: number, n: number, p: number): number {
  if (k < 0) return 0
  if (k >= n) return 1
  let sum = 0
  for (let i = 0; i <= k; i++) sum += binomPMF(i, n, p)
  // Guard against tiny floating drift above 1.
  return Math.min(1, sum)
}

/** P(X >= k) for X ~ Binomial(n, p) — the survival function. */
export function binomAtLeast(k: number, n: number, p: number): number {
  if (k <= 0) return 1 // at least zero successes is certain
  if (k > n) return 0 // can't get more successes than trials
  return Math.max(0, 1 - binomCDF(k - 1, n, p))
}
