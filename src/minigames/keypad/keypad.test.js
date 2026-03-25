import { describe, test, expect } from 'vitest'
import { generateCode, validateInput } from './keypad.logic.js'

describe('generateCode', () => {
  test('returns correct length for easy', () => {
    expect(generateCode(4)).toHaveLength(4)
  })

  test('returns correct length for hard', () => {
    expect(generateCode(6)).toHaveLength(6)
  })

  test('all elements are digit strings 0-9', () => {
    const code = generateCode(10)
    for (const digit of code) {
      expect(['0','1','2','3','4','5','6','7','8','9']).toContain(digit)
    }
  })
})

describe('validateInput', () => {
  const code = ['3', '7', '1', '4']

  test('correct input returns correct', () => {
    expect(validateInput(['3', '7', '1', '4'], code)).toBe('correct')
  })

  test('wrong input returns wrong', () => {
    expect(validateInput(['1', '2', '3', '4'], code)).toBe('wrong')
  })

  test('incomplete input returns incomplete', () => {
    expect(validateInput(['3', '7'], code)).toBe('incomplete')
  })

  test('empty input returns incomplete', () => {
    expect(validateInput([], code)).toBe('incomplete')
  })
})
