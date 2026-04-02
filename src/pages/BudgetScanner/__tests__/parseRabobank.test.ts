import { describe, it, expect } from 'vitest'
import { parseRabobank } from '../parsers/parseRabobank'

const RABO_CSV = `"IBAN/BBAN";"Munt";"BIC";"Volgnr";"Datum";"Rentedatum";"Bedrag";"Saldo na trn";"Tegenrekening IBAN/BBAN";"Naam tegenpartij";"Naam uiteindelijke partij";"Naam initiërende partij";"BIC tegenpartij";"Code";"Batch ID";"Transactiereferentie";"Machtigingskenmerk";"Incassant ID";"Betalingskenmerk";"Omschrijving-1";"Omschrijving-2";"Omschrijving-3";"Reden retour";"Oorspr bedrag";"Oorspr munt";"Koers"
"NL91RABO0000000000";"EUR";"RABONL2U";"1";"2023-12-01";"2023-12-01";"-45,67";"1234,56";"NL86INGB0002445588";"Albert Heijn";"Albert Heijn";"";"";"";"";"";"";"";"";"";"";"";"";"";"";""
"NL91RABO0000000000";"EUR";"RABONL2U";"2";"2023-12-05";"2023-12-05";"2500,00";"3734,56";"NL99TEST0000000001";"Werkgever BV";"Werkgever BV";"";"";"";"";"";"";"";"";"Salaris";"";"";"";"";"";""
`

describe('parseRabobank', () => {
  it('returns two transactions', () => {
    expect(parseRabobank(RABO_CSV, 'rabo.csv')).toHaveLength(2)
  })
  it('maps negative Bedrag to negative bedrag', () => {
    const result = parseRabobank(RABO_CSV, 'rabo.csv')
    expect(result[0].bedrag).toBe(-45.67)
  })
  it('maps positive Bedrag to positive bedrag', () => {
    const result = parseRabobank(RABO_CSV, 'rabo.csv')
    expect(result[1].bedrag).toBe(2500.00)
  })
  it('preserves YYYY-MM-DD datum format', () => {
    const result = parseRabobank(RABO_CSV, 'rabo.csv')
    expect(result[0].datum).toBe('2023-12-01')
  })
  it('sets tegenpartij from Naam tegenpartij column', () => {
    const result = parseRabobank(RABO_CSV, 'rabo.csv')
    expect(result[0].tegenpartij).toBe('Albert Heijn')
  })
  it('sets omschrijving from Omschrijving-1 column', () => {
    const result = parseRabobank(RABO_CSV, 'rabo.csv')
    expect(result[1].omschrijving).toBe('Salaris')
  })
  it('sets bankFormat to RABOBANK', () => {
    const result = parseRabobank(RABO_CSV, 'rabo.csv')
    expect(result[0].bankFormat).toBe('RABOBANK')
  })
  it('returns empty array for empty content', () => {
    expect(parseRabobank('', 'rabo.csv')).toHaveLength(0)
  })
})
