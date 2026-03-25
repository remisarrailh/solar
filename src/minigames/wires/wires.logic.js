// Pure logic for the Wires minigame — no DOM, no side effects

export function shuffle(arr) {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Generate the wire layout for a game.
 * Returns { leftOrder, rightOrder } — arrays of { color, index }
 */
export function generateWires(colors, pairs) {
  const usedColors = shuffle([...colors]).slice(0, pairs)
  const leftOrder  = usedColors.map((c, i) => ({ color: c, index: i }))
  const rightOrder = shuffle([...leftOrder])
  return { leftOrder, rightOrder }
}

/**
 * Check if two selected nodes form a valid connection.
 * Returns 'correct' | 'wrong' | 'same-side'
 */
export function checkConnection(selected, current) {
  if (selected.side === current.side) return 'same-side'
  const leftColor  = current.side === 'left'  ? current.color : selected.color
  const rightColor = current.side === 'right' ? current.color : selected.color
  return leftColor === rightColor ? 'correct' : 'wrong'
}

export function colorHex(name) {
  const map = {
    red: '#ff4444', blue: '#4488ff', green: '#44dd66',
    yellow: '#ffcc00', white: '#cccccc', purple: '#bb44ff',
  }
  return map[name] ?? '#ffffff'
}
