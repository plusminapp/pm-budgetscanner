import { describe, it, expect } from 'vitest'
import { parseIng } from '../parsers/parseIng'

const ING_CSV = `"Datum";"Naam / Omschrijving";"Rekening";"Tegenrekening";"Code";"Af Bij";"Bedrag (EUR)";"MutatieSoort";"Mededelingen"
"20231201";"Albert Heijn";"NL91INGB0000000000";"NL86INGB0002445588";"GT";"Af";"45,67";"Betaalautomaat";"Betaling pas 1234"
"20231205";"Werkgever BV";"NL91INGB0000000000";"NL99TEST0000000001";"OV";"Bij";"2500,00";"Overschrijving";"Salaris december"
`

describe('parseIng', () => {
  it('returns an array of ParsedTransactions', () => {
    const result = parseIng(ING_CSV, 'ing-export.csv')
    expect(result).toHaveLength(2)
  })
  it('maps debit (Af) to negative bedrag', () => {
    const result = parseIng(ING_CSV, 'ing-export.csv')
    expect(result[0].bedrag).toBe(-45.67)
  })
  it('maps credit (Bij) to positive bedrag', () => {
    const result = parseIng(ING_CSV, 'ing-export.csv')
    expect(result[1].bedrag).toBe(2500.00)
  })
  it('formats datum as YYYY-MM-DD', () => {
    const result = parseIng(ING_CSV, 'ing-export.csv')
    expect(result[0].datum).toBe('2023-12-01')
  })
  it('sets tegenpartij from Naam/Omschrijving column', () => {
    const result = parseIng(ING_CSV, 'ing-export.csv')
    expect(result[0].tegenpartij).toBe('Albert Heijn')
  })
  it('sets tegenrekening from Tegenrekening column', () => {
    const result = parseIng(ING_CSV, 'ing-export.csv')
    expect(result[0].tegenrekening).toBe('NL86INGB0002445588')
  })
  it('sets bronBestand and bankFormat', () => {
    const result = parseIng(ING_CSV, 'ing-export.csv')
    expect(result[0].bronBestand).toBe('ing-export.csv')
    expect(result[0].bankFormat).toBe('ING')
  })
  it('assigns a unique id to each transaction', () => {
    const result = parseIng(ING_CSV, 'ing-export.csv')
    expect(result[0].id).not.toBe(result[1].id)
  })
  it('returns empty array for empty content', () => {
    expect(parseIng('', 'ing.csv')).toHaveLength(0)
  })
})
