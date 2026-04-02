import type { ParsedTransaction } from '../types'
import { formatYYYYMMDD } from './utils'

export function parseAbnAmro(content: string, fileName: string): ParsedTransaction[] {
  const lines = content.split('\n').filter((l) => l.trim().length > 0)
  const dataLines = lines.filter((l) => /^NL\d{2}[A-Z]{4}\d+\t/i.test(l))

  return dataLines.map((line) => {
    const cols = line.split('\t')
    const rawDate = (cols[2] ?? '').trim()
    const datum = formatYYYYMMDD(rawDate)

    const rawBedrag = (cols[3] ?? '').replace(/\./g, '').replace(',', '.')
    const parsed = parseFloat(rawBedrag)
    const bedrag = isNaN(parsed) ? 0 : parsed

    const tegenrekening = (cols[4] ?? '').trim() || null

    return {
      id: crypto.randomUUID(),
      datum,
      bedrag,
      omschrijving: (cols[8] ?? '').trim(),
      tegenrekening,
      tegenpartij: (cols[5] ?? '').trim(),
      bronBestand: fileName,
      bankFormat: 'ABN_AMRO',
    }
  })
}
