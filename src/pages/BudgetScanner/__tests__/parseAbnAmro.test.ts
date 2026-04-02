import { describe, it, expect } from 'vitest'
import { parseAbnAmro } from '../parsers/parseAbnAmro'

const ABN_CSV = `NL91ABNA0417164300\tEUR\t20231201\t-45,67\tNL86INGB0002445588\tAlbert Heijn\t20231201\t1234,56\tBetaling Albert Heijn
NL91ABNA0417164300\tEUR\t20231205\t2500,00\tNL99TEST0000000001\tWerkgever BV\t20231205\t3734,56\tSalaris december
`

describe('parseAbnAmro', () => {
  it('returns two transactions', () => {
    expect(parseAbnAmro(ABN_CSV, 'abn.csv')).toHaveLength(2)
  })
  it('maps negative amount to negative bedrag', () => {
    const result = parseAbnAmro(ABN_CSV, 'abn.csv')
    expect(result[0].bedrag).toBe(-45.67)
  })
  it('maps positive amount to positive bedrag', () => {
    const result = parseAbnAmro(ABN_CSV, 'abn.csv')
    expect(result[1].bedrag).toBe(2500.00)
  })
  it('formats datum as YYYY-MM-DD', () => {
    const result = parseAbnAmro(ABN_CSV, 'abn.csv')
    expect(result[0].datum).toBe('2023-12-01')
  })
  it('sets tegenpartij from column 5', () => {
    const result = parseAbnAmro(ABN_CSV, 'abn.csv')
    expect(result[0].tegenpartij).toBe('Albert Heijn')
  })
  it('sets tegenrekening from column 4', () => {
    const result = parseAbnAmro(ABN_CSV, 'abn.csv')
    expect(result[0].tegenrekening).toBe('NL86INGB0002445588')
  })
  it('sets bankFormat to ABN_AMRO', () => {
    const result = parseAbnAmro(ABN_CSV, 'abn.csv')
    expect(result[0].bankFormat).toBe('ABN_AMRO')
  })
  it('returns empty array for empty content', () => {
    expect(parseAbnAmro('', 'abn.csv')).toHaveLength(0)
  })
})
