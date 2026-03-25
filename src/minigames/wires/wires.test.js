import { describe, test, expect } from 'vitest'
import { shuffle, generateWires, checkConnection, colorHex } from './wires.logic.js'

describe('shuffle', () => {
  test('returns array of same length', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(shuffle(arr)).toHaveLength(5)
  })

  test('does not mutate original', () => {
    const arr = [1, 2, 3]
    shuffle(arr)
    expect(arr).toEqual([1, 2, 3])
  })

  test('contains same elements', () => {
    const arr = ['red', 'blue', 'green']
    const result = shuffle(arr)
    expect(result.sort()).toEqual(arr.sort())
  })
})

describe('generateWires', () => {
  const colors = ['red', 'blue', 'green', 'yellow', 'white', 'purple']

  test('leftOrder has correct pair count', () => {
    const { leftOrder } = generateWires(colors, 3)
    expect(leftOrder).toHaveLength(3)
  })

  test('rightOrder has same colors as leftOrder', () => {
    const { leftOrder, rightOrder } = generateWires(colors, 4)
    const leftColors  = leftOrder.map(n => n.color).sort()
    const rightColors = rightOrder.map(n => n.color).sort()
    expect(leftColors).toEqual(rightColors)
  })

  test('right order is shuffled (not always identical)', () => {
    // Run 10 times — statistically at least one shuffle differs
    const results = Array.from({ length: 10 }, () => {
      const { leftOrder, rightOrder } = generateWires(colors, 4)
      return leftOrder.map(n => n.color).join() === rightOrder.map(n => n.color).join()
    })
    expect(results.some(r => !r)).toBe(true)
  })
})

describe('checkConnection', () => {
  test('correct match returns correct', () => {
    const selected = { color: 'red', side: 'left' }
    const current  = { color: 'red', side: 'right' }
    expect(checkConnection(selected, current)).toBe('correct')
  })

  test('wrong color returns wrong', () => {
    const selected = { color: 'blue', side: 'left' }
    const current  = { color: 'red', side: 'right' }
    expect(checkConnection(selected, current)).toBe('wrong')
  })

  test('same side returns same-side', () => {
    const selected = { color: 'red', side: 'left' }
    const current  = { color: 'blue', side: 'left' }
    expect(checkConnection(selected, current)).toBe('same-side')
  })
})

describe('colorHex', () => {
  test('known color returns hex', () => {
    expect(colorHex('red')).toBe('#ff4444')
    expect(colorHex('blue')).toBe('#4488ff')
  })

  test('unknown color returns fallback', () => {
    expect(colorHex('magenta')).toBe('#ffffff')
  })
})
