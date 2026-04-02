import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildCsvContent, triggerCsvDownload } from '../export/exportCsv'
import type { CategorizedTransaction } from '../types'

const tx: CategorizedTransaction = {
  id: 'tx-1',
  datum: '2023-12-01',
  bedrag: -45.67,
  omschrijving: 'Betaling pas 1234',
  tegenrekening: 'NL86INGB0002445588',
  tegenpartij: 'Albert Heijn',
  bronBestand: 'ing.csv',
  bankFormat: 'ING',
  bucket: 'LEEFGELD',
  potje: 'boodschappen',
  isHandmatig: false,
  isDuplicaat: false,
  regelNaam: 'Albert Heijn',
}

describe('buildCsvContent', () => {
  it('returns a string', () => {
    expect(typeof buildCsvContent([tx])).toBe('string')
  })

  it('includes all 7 required column names in the header', () => {
    const csv = buildCsvContent([tx])
    const header = csv.split('\n')[0]
    for (const col of ['datum', 'tegenpartij', 'omschrijving', 'bedrag', 'bucket', 'potje', 'bronBestand']) {
      expect(header).toContain(col)
    }
  })

  it('includes the transaction data in the second row', () => {
    const csv = buildCsvContent([tx])
    expect(csv).toContain('2023-12-01')
    expect(csv).toContain('Albert Heijn')
    expect(csv).toContain('-45.67')
    expect(csv).toContain('LEEFGELD')
  })

  it('starts with UTF-8 BOM for Windows Excel compatibility', () => {
    const csv = buildCsvContent([tx])
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
  })

  it('handles multiple transactions', () => {
    const tx2 = { ...tx, id: 'tx-2', tegenpartij: 'Jumbo' }
    const csv = buildCsvContent([tx, tx2])
    const lines = csv.split('\n').filter(Boolean)
    expect(lines).toHaveLength(3) // BOM+header + 2 data rows
  })
})

describe('triggerCsvDownload', () => {
  beforeEach(() => {
    const mockUrl = 'blob:mock-url'
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => mockUrl),
      revokeObjectURL: vi.fn(),
    })
    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
      style: {},
    }
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLAnchorElement)
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as unknown as Node)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as unknown as Node)
  })

  it('triggers a download with a .csv filename', () => {
    const anchor = { href: '', download: '', click: vi.fn(), style: {} }
    vi.spyOn(document, 'createElement').mockReturnValue(anchor as unknown as HTMLAnchorElement)
    triggerCsvDownload([tx], 2023)
    expect(anchor.download).toMatch(/\.csv$/)
  })
})
