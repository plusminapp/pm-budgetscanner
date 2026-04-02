import Papa from 'papaparse'
import type { CategorizedTransaction } from '../types'

const BOM = '\uFEFF'

export function buildCsvContent(transactions: CategorizedTransaction[]): string {
  const rows = transactions.map((tx) => ({
    datum: tx.datum,
    tegenpartij: tx.tegenpartij,
    omschrijving: tx.omschrijving,
    bedrag: tx.bedrag,
    bucket: tx.bucket,
    potje: tx.potje ?? '',
    bronBestand: tx.bronBestand,
  }))

  return BOM + Papa.unparse(rows, { header: true })
}

export function triggerCsvDownload(
  transactions: CategorizedTransaction[],
  jaar: number,
): void {
  const content = buildCsvContent(transactions)
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `plusmin-jaaroverzicht-${jaar}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
