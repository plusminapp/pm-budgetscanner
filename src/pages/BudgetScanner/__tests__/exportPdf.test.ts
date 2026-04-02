import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CategorizedTransaction } from '../types'

const { mockDoc, autoTableMock } = vi.hoisted(() => {
  const localMockDoc = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    setFillColor: vi.fn(),
    circle: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    addImage: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
    lastAutoTable: { finalY: 60 },
  }

  const localAutoTableMock = vi.fn((doc: typeof localMockDoc, options?: unknown) => {
    const tableOptions = options as { startY?: number; body?: unknown[] }
    const startY = tableOptions?.startY ?? 20
    const bodyLength = tableOptions?.body?.length ?? 0
    doc.lastAutoTable = { finalY: startY + 8 + (bodyLength * 6) }
  })

  return { mockDoc: localMockDoc, autoTableMock: localAutoTableMock }
})

vi.mock('jspdf', () => ({
  default: vi.fn(function MockJsPdf() {
    return mockDoc
  }),
}))

vi.mock('jspdf-autotable', () => ({
  default: autoTableMock,
}))

vi.mock('../export/exportRules', () => ({
  exportRules: vi.fn(),
}))

import { exportPdf } from '../export/exportPdf'
import { exportRules } from '../export/exportRules'

function formatEur(amount: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

const txBase: CategorizedTransaction = {
  id: 'tx-1',
  datum: '2025-01-15',
  bedrag: -12.34,
  omschrijving: 'Interne boeking',
  tegenrekening: null,
  tegenpartij: 'Eigen rekening',
  bronBestand: 'ing.csv',
  bankFormat: 'ING',
  bucket: 'NEGEREN',
  potje: null,
  isHandmatig: true,
  regelNaam: null,
  isDuplicaat: false,
}

describe('exportPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no logo') }))
  })

  it('downloads PDF and includes Negeren in summary bucket rows', async () => {
    await exportPdf([txBase], 2025, [], [], [])

    expect(mockDoc.save).toHaveBeenCalledWith('plusmin-jaaroverzicht.pdf')
    expect(autoTableMock).toHaveBeenCalled()

    const summaryCall = autoTableMock.mock.calls[0]
    const options = summaryCall[1] as unknown as { body: string[][] }
    const summaryLabels = options.body.map((row) => row[0])

    expect(summaryLabels).toContain('Negeren')
    expect(summaryLabels[summaryLabels.length - 1]).toBe('Negeren')
    expect(mockDoc.addPage).toHaveBeenCalledTimes(1)
  })

  it('does not export rules JSON alongside PDF when rules exist', async () => {
    await exportPdf([txBase], 2025, [{ tegenpartijPatroon: 'eigen', bucket: 'NEGEREN' }], [], [])
    expect(exportRules).not.toHaveBeenCalled()
  })

  it('exports totalen per potje per bucket', async () => {
    const txA: CategorizedTransaction = { ...txBase, id: 'tx-a', potje: 'Buffer', bedrag: -10 }
    const txB: CategorizedTransaction = { ...txBase, id: 'tx-b', potje: 'Buffer', bedrag: -20 }
    const txC: CategorizedTransaction = { ...txBase, id: 'tx-c', potje: null, bedrag: -5 }

    await exportPdf(
      [txA, txB, txC],
      2025,
      [{ tegenpartijPatroon: 'eigen rekening', bucket: 'NEGEREN' }],
      [],
      [],
    )

    const negerenPotjesCall = autoTableMock.mock.calls[6]
    const options = negerenPotjesCall[1] as unknown as { body: Array<[string, string, string]>; head: string[][] }

    expect(options.head[0]).toEqual(['Potje', 'Totaal', 'Aantal transacties'])
    expect(options.body).toEqual([
      ['Buffer', formatEur(-30), '2'],
      ['Zonder potje', formatEur(-5), '1'],
    ])
  })

  it('starts a new page only when a full bucket section no longer fits', async () => {
    const txs: CategorizedTransaction[] = [
      { ...txBase, id: 'i-1', bucket: 'INKOMEN', potje: 'Salaris', bedrag: 1000 },
      { ...txBase, id: 'l-1', bucket: 'LEEFGELD', potje: 'Boodschappen', bedrag: -100 },
      { ...txBase, id: 'v-1', bucket: 'VASTE_LASTEN', potje: 'Huur', bedrag: -800 },
      { ...txBase, id: 's-1', bucket: 'SPAREN', potje: 'Buffer', bedrag: -200 },
      { ...txBase, id: 'n-1', bucket: 'NEGEREN', potje: 'Intern', bedrag: -10 },
    ]

    await exportPdf(txs, 2025, [], [], [])

    expect(mockDoc.addPage).toHaveBeenCalledTimes(1)
  })
})
