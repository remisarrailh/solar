// Pure logic for the Gauges minigame — no DOM, no side effects

/**
 * Generate random target values for each gauge.
 * Values are in range [0.10, 0.90] (10%-90%) to avoid extremes.
 * Returns array of floats.
 */
export function generateTargets(count) {
  return Array.from({ length: count }, () => Math.round(Math.random() * 80 + 10) / 100)
}

/**
 * Check if all gauge values are within tolerance of their targets.
 * values: array of floats (0-1, from range input / 100)
 * targets: array of floats (0-1)
 * tolerance: float, e.g. 0.05
 * lockedIndex: index of auto-locked gauge (-1 = none)
 * Returns true if all gauges are within tolerance.
 */
export function checkGauges(values, targets, tolerance, lockedIndex = -1) {
  for (let i = 0; i < targets.length; i++) {
    if (i === lockedIndex) continue  // locked gauge is always correct
    if (Math.abs(values[i] - targets[i]) > tolerance) return false
  }
  return true
}

/**
 * Check a single gauge value against its target.
 */
export function isGaugeOk(value, target, tolerance) {
  return Math.abs(value - target) <= tolerance
}
