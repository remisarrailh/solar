import { describe, test, expect } from 'vitest'
import { generateTargets, checkGauges, isGaugeOk } from './gauges.logic.js'

describe('generateTargets', () => {
  test('returns correct count', () => {
    expect(generateTargets(3)).toHaveLength(3)
  })

  test('all values in range 0.10 to 0.90', () => {
    const targets = generateTargets(20)
    for (const t of targets) {
      expect(t).toBeGreaterThanOrEqual(0.10)
      expect(t).toBeLessThanOrEqual(0.90)
    }
  })
})

describe('checkGauges', () => {
  const targets = [0.5, 0.3, 0.7]
  const tolerance = 0.05

  test('all exact values returns true', () => {
    expect(checkGauges([0.5, 0.3, 0.7], targets, tolerance)).toBe(true)
  })

  test('within tolerance returns true', () => {
    expect(checkGauges([0.52, 0.28, 0.73], targets, tolerance)).toBe(true)
  })

  test('one gauge out of tolerance returns false', () => {
    expect(checkGauges([0.5, 0.3, 0.6], targets, tolerance)).toBe(false)
  })

  test('locked gauge is ignored even if out of range', () => {
    // gauge 0 is locked (forced to target), gauges 1 and 2 are in range
    expect(checkGauges([0.99, 0.3, 0.7], targets, tolerance, 0)).toBe(true)
  })
})

describe('isGaugeOk', () => {
  test('exact value is ok', () => {
    expect(isGaugeOk(0.5, 0.5, 0.05)).toBe(true)
  })

  test('within tolerance is ok', () => {
    expect(isGaugeOk(0.54, 0.5, 0.05)).toBe(true)
  })

  test('outside tolerance is not ok', () => {
    expect(isGaugeOk(0.56, 0.5, 0.05)).toBe(false)
  })

  test('value just within tolerance is ok', () => {
    expect(isGaugeOk(0.54, 0.5, 0.05)).toBe(true)
  })
})
