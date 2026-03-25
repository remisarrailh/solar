// Pure logic for the ErrorScan minigame — no DOM, no side effects

/**
 * Generate random difference positions for the errorscan game.
 * count: number of differences
 * Returns array of { x, y, radius } — all normalized 0-1
 */
export function generateDifferences(count) {
  return Array.from({ length: count }, () => ({
    x:      Math.random() * 0.7 + 0.1,  // 10%-80% horizontally
    y:      Math.random() * 0.7 + 0.1,  // 10%-80% vertically
    radius: 0.06,
  }))
}

/**
 * Check if a click at (xPct, yPct) hits any unfound difference.
 * Returns the index of the hit difference, or -1 if miss.
 */
export function checkClick(xPct, yPct, differences, foundSet) {
  for (let i = 0; i < differences.length; i++) {
    if (foundSet.has(i)) continue
    const diff = differences[i]
    const dx = xPct - diff.x
    const dy = yPct - diff.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist <= diff.radius) return i
  }
  return -1
}
