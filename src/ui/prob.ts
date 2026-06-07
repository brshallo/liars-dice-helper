/**
 * Map a probability to a colour on a red→amber→green scale. Used everywhere a cell,
 * bar, or pill needs to signal "likely true" (green, don't challenge) vs "likely a
 * bluff" (red, challenge). Centralised so all three displays read identically.
 */
export function probColor(p: number): string {
  const c = Math.max(0, Math.min(1, p))
  const hue = c * 130 // 0 = red, 65 = amber, 130 = green
  // Dip lightness in the amber middle so mid-probabilities don't glow too bright.
  const light = 38 + Math.abs(c - 0.5) * 14
  return `hsl(${hue}, 62%, ${light}%)`
}

/** Readable text colour to sit on top of probColor(p). */
export function probTextColor(p: number): string {
  const c = Math.max(0, Math.min(1, p))
  // The amber band is light enough to want dark text; the ends take white.
  return c > 0.32 && c < 0.62 ? '#10161c' : '#f3f7fa'
}

/** A coarse verdict word for the focused readouts. */
export function probVerdict(p: number): string {
  if (p >= 0.85) return 'very likely'
  if (p >= 0.6) return 'likely'
  if (p >= 0.4) return 'a coin toss'
  if (p >= 0.15) return 'unlikely'
  return 'very unlikely'
}
