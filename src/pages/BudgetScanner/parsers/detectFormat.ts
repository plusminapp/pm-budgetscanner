import type { BankFormat } from '../types'

export function detectFormat(content: string): BankFormat | null {
  const firstLines = content.slice(0, 500)
  if (firstLines.includes('<?xml') && firstLines.includes('<BkToCstmrStmt>')) return 'CAMT053'
  return null
}
