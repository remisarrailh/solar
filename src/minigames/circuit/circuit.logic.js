// Pure logic for the Circuit minigame — no DOM, no side effects

function shuffle(arr) {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Generate a random sequence for the circuit game.
 * nodeCount: total number of nodes
 * sequenceLength: how many nodes appear in the sequence (max nodeCount, capped at 6)
 * Returns array of 1-based node indices, e.g. [3, 1, 4, 2]
 */
export function generateSequence(nodeCount, sequenceLength) {
  const len = Math.min(nodeCount, sequenceLength ?? 6)
  const all = Array.from({ length: nodeCount }, (_, i) => i + 1)
  return shuffle(all).slice(0, len)
}

/**
 * Validate a player's step in the sequence.
 * nodeIndex: 0-based index of the clicked node
 * sequence: array of 1-based node indices
 * inputIdx: current position in the sequence (0-based)
 * Returns 'correct' | 'wrong' | 'complete'
 */
export function validateStep(nodeIndex, sequence, inputIdx) {
  const expected = sequence[inputIdx] - 1  // convert to 0-based
  if (nodeIndex !== expected) return 'wrong'
  if (inputIdx + 1 >= sequence.length) return 'complete'
  return 'correct'
}
