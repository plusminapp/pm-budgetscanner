import { describe, it, expect } from 'vitest'
import { detectFormat } from '../parsers/detectFormat'

const ING_HEADER = `"Datum";"Naam / Omschrijving";"Rekening";"Tegenrekening";"Code";"Af Bij";"Bedrag (EUR)";"MutatieSoort";"Mededelingen"\n`
const RABOBANK_HEADER = `"IBAN/BBAN";"Munt";"BIC";"Volgnr";"Datum";"Rentedatum";"Bedrag";"Saldo na trn";"Tegenrekening IBAN/BBAN";"Naam tegenpartij"\n`
const ABN_LINE = `NL91ABNA0417164300\tEUR\t20231201\t-45,67\tNL86INGB0002445588\tAlbert Heijn\n`
const CAMT_HEADER = `<?xml version="1.0" encoding="UTF-8"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt>`

describe('detectFormat', () => {
  it('detects ING CSV', () => {
    expect(detectFormat(ING_HEADER)).toBe('ING')
  })
  it('detects Rabobank CSV', () => {
    expect(detectFormat(RABOBANK_HEADER)).toBe('RABOBANK')
  })
  it('detects ABN AMRO tab-separated file', () => {
    expect(detectFormat(ABN_LINE)).toBe('ABN_AMRO')
  })
  it('detects CAMT.053 XML', () => {
    expect(detectFormat(CAMT_HEADER)).toBe('CAMT053')
  })
  it('returns null for unknown format', () => {
    expect(detectFormat('some,random,csv,content\n')).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(detectFormat('')).toBeNull()
  })
})
