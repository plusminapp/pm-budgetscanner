import type { ParsedTransaction } from '../types'

function getText(el: Element, tag: string): string {
  return el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''
}

export function parseCamt053(content: string, fileName: string): ParsedTransaction[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/xml')
  // DOMParser never throws — check for parse error document instead
  const parseErrorEl = doc.querySelector('parseerror') ?? doc.getElementsByTagName('parsererror')[0]
  if (parseErrorEl) {
    throw new Error(`XML parse error: ${parseErrorEl.textContent?.trim() ?? 'unknown'}`)
  }
  const entries = Array.from(doc.getElementsByTagName('Ntry'))

  return entries.map((entry) => {
    const amountStr = getText(entry, 'Amt')
    const amount = parseFloat(amountStr)
    const safeAmount = isNaN(amount) ? 0 : amount
    const isDebit = getText(entry, 'CdtDbtInd') === 'DBIT'
    const bedrag = isDebit ? -safeAmount : safeAmount

    const datum = getText(entry, 'Dt')

    const cdtDbtTegenpartij = isDebit
      ? getText(entry.getElementsByTagName('Cdtr')[0] ?? entry, 'Nm')
      : getText(entry.getElementsByTagName('Dbtr')[0] ?? entry, 'Nm')
    const tegenpartij = cdtDbtTegenpartij || getText(entry, 'AddtlNtryInf').replace(/\s+/g, ' ').slice(0, 30)

    const ibanEl = isDebit
      ? entry.getElementsByTagName('CdtrAcct')[0]
      : entry.getElementsByTagName('DbtrAcct')[0]
    const tegenrekening = ibanEl ? getText(ibanEl, 'IBAN') || null : null

    return {
      id: crypto.randomUUID(),
      datum,
      bedrag,
      omschrijving: getText(entry, 'Ustrd'),
      tegenrekening,
      tegenpartij,
      bronBestand: fileName,
      bankFormat: 'CAMT053',
    }
  })
}
