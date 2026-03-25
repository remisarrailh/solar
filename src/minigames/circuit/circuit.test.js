import { describe, test, expect } from 'vitest'
import { generateSequence, validateStep } from './circuit.logic.js'

describe('generateSequence', () => {
  test('returns correct length', () => {
    expect(generateSequence(6, 4)).toHaveLength(4)
  })

  test('caps at nodeCount', () => {
    expect(generateSequence(4, 10)).toHaveLength(4)
  })

  test('all values are valid node indices (1-based)', () => {
    const seq = generateSequence(6, 6)
    for (const n of seq) {
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(6)
    }
  })

  test('no duplicates in sequence', () => {
    const seq = generateSequence(8, 6)
    expect(new Set(seq).size).toBe(seq.length)
  })
})

describe('validateStep', () => {
  const sequence = [3, 1, 4, 2]  // 1-based

  test('correct first step', () => {
    // sequence[0] = 3, so 0-based index is 2
    expect(validateStep(2, sequence, 0)).toBe('correct')
  })

  test('wrong step', () => {
    expect(validateStep(0, sequence, 0)).toBe('wrong')
  })

  test('last step returns complete', () => {
    // sequence[3] = 2, 0-based index is 1
    expect(validateStep(1, sequence, 3)).toBe('complete')
  })

  test('wrong step anywhere returns wrong', () => {
    // sequence[2] = 4, so correct 0-based index is 3
    // clicking 0 at position 2 is wrong
    expect(validateStep(0, sequence, 2)).toBe('wrong')
  })
})
