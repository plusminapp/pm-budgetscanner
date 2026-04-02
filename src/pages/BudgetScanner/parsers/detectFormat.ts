import type { BankFormat } from '../types'

export function detectFormat(content: string): BankFormat | null {
  const firstLines = content.slice(0, 500)
  if (firstLines.includes('<?xml') && firstLines.includes('<BkToCstmrStmt>')) return 'CAMT053'
  if (/["']?Datum["']?;"Naam \/ Omschrijving/i.test(firstLines)) return 'ING'
  if (/"IBAN\/BBAN";"Munt";"BIC"/i.test(firstLines)) return 'RABOBANK'
  if (/^NL\d{2}[A-Z]{4}\d+\t/m.test(firstLines)) return 'ABN_AMRO'
  return null
}
