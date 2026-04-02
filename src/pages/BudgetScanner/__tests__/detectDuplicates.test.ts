import { describe, it, expect } from 'vitest'
import { markDuplicates } from '../parsers/detectDuplicates'
import type { CategorizedTransaction } from '../types'

const tx = (id: string, overrides: Partial<CategorizedTransaction> = {}): CategorizedTransaction => ({
  id,
  datum: '2023-06-15',
  bedrag: -25.00,
  omschrijving: 'Test',
  tegenrekening: null,
  tegenpartij: 'Albert Heijn',
  bronBestand: 'test.csv',
  bankFormat: 'ING',
  bucket: 'LEEFGELD',
  potje: null,
  isHandmatig: false,
  regelNaam: null,
  isDuplicaat: false,
  ...overrides,
})

describe('markDuplicates', () => {
  it('leaves unique transactions unchanged', () => {
    const result = markDuplicates([tx('1'), tx('2', { tegenpartij: 'Jumbo' })])
    expect(result.every((t) => !t.isDuplicaat)).toBe(true)
  })

  it('marks second occurrence as duplicate', () => {
    const result = markDuplicates([tx('1'), tx('2')])
    expect(result[0].isDuplicaat).toBe(false)
    expect(result[1].isDuplicaat).toBe(true)
  })

  it('keeps the original id on the duplicate', () => {
    const result = markDuplicates([tx('1'), tx('2')])
    expect(result[1].id).toBe('2')
  })

  it('does not flag transactions that differ by bedrag', () => {
    const result = markDuplicates([tx('1'), tx('2', { bedrag: -99.00 })])
    expect(result[1].isDuplicaat).toBe(false)
  })

  it('resets isDuplicaat to false for first occurrence even if pre-flagged', () => {
    const result = markDuplicates([tx('1', { isDuplicaat: true })])
    expect(result[0].isDuplicaat).toBe(false)
  })
})
