import Papa from 'papaparse'
import type { ParsedTransaction } from '../types'
import { formatYYYYMMDD } from './utils'

export function parseIng(content: string, fileName: string): ParsedTransaction[] {
  const { data } = Papa.parse<Record<string, string>>(content, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
  })

  return data.map((row) => {
    const rawDate = (row['Datum'] ?? '').trim()
    const datum = formatYYYYMMDD(rawDate)

    const rawBedrag = (row['Bedrag (EUR)'] ?? '').replace(/\./g, '').replace(',', '.')
    const amount = parseFloat(rawBedrag)
    const safeAmount = isNaN(amount) ? 0 : amount
    const bedrag = (row['Af Bij'] ?? '').trim().toLowerCase() === 'af' ? -safeAmount : safeAmount

    const tegenrekening = (row['Tegenrekening'] ?? '').trim() || null

    return {
      id: crypto.randomUUID(),
      datum,
      bedrag,
      omschrijving: row['Mededelingen'] ?? '',
      tegenrekening,
      tegenpartij: (row['Naam / Omschrijving'] ?? '').trim(),
      bronBestand: fileName,
      bankFormat: 'ING',
    }
  })
}
