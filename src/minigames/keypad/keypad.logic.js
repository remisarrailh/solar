// Pure logic for the Keypad minigame — no DOM, no side effects

/**
 * Generate a random numeric code of given length.
 * Returns array of digit strings, e.g. ['3', '7', '1', '4']
 */
export function generateCode(length) {
  return Array.from({ length }, () => String(Math.floor(Math.random() * 10)))
}

/**
 * Check if user input matches the code so far.
 * Returns 'correct' | 'wrong' | 'incomplete'
 */
export function validateInput(input, code) {
  if (input.length < code.length) return 'incomplete'
  return input.join('') === code.join('') ? 'correct' : 'wrong'
}
