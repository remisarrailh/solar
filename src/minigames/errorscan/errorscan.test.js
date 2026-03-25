import { describe, test, expect } from 'vitest'
import { generateDifferences, checkClick } from './errorscan.logic.js'

describe('generateDifferences', () => {
  test('returns correct count', () => {
    expect(generateDifferences(3)).toHaveLength(3)
  })

  test('x and y are within expected bounds', () => {
    const diffs = generateDifferences(20)
    for (const d of diffs) {
      expect(d.x).toBeGreaterThanOrEqual(0.1)
      expect(d.x).toBeLessThanOrEqual(0.8)
      expect(d.y).toBeGreaterThanOrEqual(0.1)
      expect(d.y).toBeLessThanOrEqual(0.8)
    }
  })

  test('radius is 0.06', () => {
    const diffs = generateDifferences(5)
    for (const d of diffs) {
      expect(d.radius).toBe(0.06)
    }
  })
})

describe('checkClick', () => {
  const differences = [
    { x: 0.3, y: 0.4, radius: 0.06 },
    { x: 0.7, y: 0.6, radius: 0.06 },
  ]

  test('direct hit on difference 0', () => {
    expect(checkClick(0.3, 0.4, differences, new Set())).toBe(0)
  })

  test('hit within radius', () => {
    expect(checkClick(0.32, 0.42, differences, new Set())).toBe(0)
  })

  test('miss returns -1', () => {
    expect(checkClick(0.5, 0.5, differences, new Set())).toBe(-1)
  })

  test('already found difference is skipped', () => {
    const found = new Set([0])
    // Click exactly on diff 0 — should miss (already found), not hit diff 1
    expect(checkClick(0.3, 0.4, differences, found)).toBe(-1)
  })

  test('hit on second difference', () => {
    const found = new Set([0])
    expect(checkClick(0.7, 0.6, differences, found)).toBe(1)
  })
})
