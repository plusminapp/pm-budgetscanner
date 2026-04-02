import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CategorizedTransaction, Bucket, UserRule, Potje } from '../types'
import plusMinLogoUrl from '../../../assets/plusminlogo.png'

const BUCKET_LABELS: Record<Bucket, string> = {
  INKOMEN: 'Inkomsten',
  LEEFGELD: 'Leefgeld',
  VASTE_LASTEN: 'Vaste lasten',
  SPAREN: 'Sparen',
  ONBEKEND: 'Onbekend',
  NEGEREN: 'Negeren',
}

const BUCKET_COLORS: Record<Bucket, [number, number, number]> = {
  INKOMEN:      [34,  197, 94],
  LEEFGELD:     [239, 68,  68],
  VASTE_LASTEN: [59,  130, 246],
  SPAREN:       [245, 158, 11],
  ONBEKEND:     [156, 163, 175],
  NEGEREN:      [107, 114, 128],
}

const DARK_GRAY: [number, number, number] = [55, 65, 81]

type MonthlyTotals = Record<number, Partial<Record<Bucket, number>>>

function buildMonthlyTotals(transactions: CategorizedTransaction[]): MonthlyTotals {
  const totals: MonthlyTotals = {}
  for (let m = 1; m <= 12; m++) totals[m] = {}
  for (const tx of transactions) {
    const month = parseInt(tx.datum.slice(5, 7), 10)
    const bucket = tx.bucket
    if (bucket === 'ONBEKEND') continue
    totals[month][bucket] = (totals[month][bucket] ?? 0) + tx.bedrag
  }
  return totals
}

function buildBucketSummary(
  transactions: CategorizedTransaction[],
): Record<Bucket, { totaal: number; gemiddeld: number }> {
  const sums: Partial<Record<Bucket, number>> = {}
  for (const tx of transactions) {
    if (tx.bucket === 'ONBEKEND') continue
    sums[tx.bucket] = (sums[tx.bucket] ?? 0) + tx.bedrag
  }
  const buckets: Bucket[] = ['INKOMEN', 'LEEFGELD', 'VASTE_LASTEN', 'SPAREN', 'NEGEREN']
  return Object.fromEntries(
    buckets.map((b) => [b, { totaal: sums[b] ?? 0, gemiddeld: (sums[b] ?? 0) / 12 }]),
  ) as Record<Bucket, { totaal: number; gemiddeld: number }>
}

function buildPotjeTotals(
  transactions: CategorizedTransaction[],
  bucket: Bucket,
): Array<{ naam: string; totaal: number; gemiddeld: number; aantal: number }> {
  const sums = new Map<string, { naam: string; totaal: number; aantal: number }>()
  for (const tx of transactions.filter((t) => t.bucket === bucket)) {
    const potjeNaam = tx.potje?.trim() || 'Zonder potje'
    const entry = sums.get(potjeNaam) ?? { naam: potjeNaam, totaal: 0, aantal: 0 }
    entry.totaal += tx.bedrag
    entry.aantal += 1
    sums.set(potjeNaam, entry)
  }
  return [...sums.values()]
    .sort((a, b) => Math.abs(b.totaal) - Math.abs(a.totaal))
    .map((row) => ({ ...row, gemiddeld: row.totaal / 12 }))
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const PAGE_TOP_MARGIN = 14
const PAGE_BOTTOM_MARGIN = 14
const BUCKET_SECTION_GAP = 8
const BUCKET_HEADER_HEIGHT = 14
const BUCKET_TABLE_OFFSET = 4
const BUCKET_TABLE_ROW_HEIGHT = 7
const PDF_HEADER_HEIGHT = 22
const LOGO_ASPECT_RATIO = 2
const LOGO_RENDER_WIDTH = 20
const LOGO_RENDER_HEIGHT = LOGO_RENDER_WIDTH / LOGO_ASPECT_RATIO
const LOGO_RIGHT_PADDING = 4

function estimateBucketSectionHeight(rowCount: number): number {
  const tableRows = Math.max(rowCount, 1)
  return BUCKET_HEADER_HEIGHT + BUCKET_TABLE_OFFSET + ((tableRows + 1) * BUCKET_TABLE_ROW_HEIGHT) + 6
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const resp = await fetch(plusMinLogoUrl)
    if (!resp.ok) return null
    const blob = await resp.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function alignNumericHeaderCells(data: { section: string; column: { index: number }; cell: { styles: { halign?: string } } }) {
  if (data.section === 'head' && data.column.index > 0) {
    data.cell.styles.halign = 'right'
  }
}

export async function exportPdf(
  transactions: CategorizedTransaction[],
  jaar: number,
  userRules: UserRule[] = [],
  learnedRules: UserRule[] = [],
  potjes: Potje[] = [],
): Promise<void> {
  void jaar
  void userRules
  void learnedRules
  void potjes
  const [doc, logoDataUrl] = await Promise.all([
    Promise.resolve(new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })),
    loadLogoDataUrl(),
  ])
  const summary = buildBucketSummary(transactions)
  const monthlyTotals = buildMonthlyTotals(transactions)
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Header
  doc.setFillColor(34, 197, 94)
  doc.rect(0, 0, pageWidth, PDF_HEADER_HEIGHT, 'F')
  doc.setTextColor(...DARK_GRAY)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`PlusMin Jaaroverzicht ${jaar}`, 14, 11)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Gegenereerd op ${new Date().toLocaleDateString('nl-NL')}`, 14, 18)
  if (logoDataUrl) {
    const logoX = pageWidth - LOGO_RENDER_WIDTH - LOGO_RIGHT_PADDING
    const logoY = (PDF_HEADER_HEIGHT - LOGO_RENDER_HEIGHT) / 2
    doc.addImage(logoDataUrl, 'PNG', logoX, logoY, LOGO_RENDER_WIDTH, LOGO_RENDER_HEIGHT)
  }

  // Bucket summary table
  doc.setTextColor(...DARK_GRAY)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Jaaroverzicht per categorie', 14, 32)

  const buckets: Bucket[] = ['INKOMEN', 'LEEFGELD', 'VASTE_LASTEN', 'SPAREN', 'NEGEREN']
  const activeBuckets = buckets.filter((b) => summary[b].totaal !== 0)
  autoTable(doc, {
    startY: 36,
    head: [['Categorie', 'Jaartotaal', 'Maandgemiddelde']],
    body: activeBuckets.map((b) => [
      BUCKET_LABELS[b],
      formatEur(summary[b].totaal),
      formatEur(summary[b].gemiddeld),
    ]),
    headStyles: { fillColor: [34, 197, 94], textColor: 255 },
    styles: { fontSize: 10 },
    didParseCell: alignNumericHeaderCells,
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  })

  // Monthly breakdown table
  const afterSummary = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Maandelijks overzicht', 14, afterSummary)

  const monthlyBuckets = (['INKOMEN', 'LEEFGELD', 'VASTE_LASTEN', 'SPAREN'] as Bucket[]).filter(
    (b) => summary[b].totaal !== 0,
  )
  const monthlyColumnStyles = Object.fromEntries(
    monthlyBuckets.map((_, i) => [i + 1, { halign: 'right' as const }]),
  )
  autoTable(doc, {
    startY: afterSummary + 4,
    head: [['Maand', ...monthlyBuckets.map((b) => BUCKET_LABELS[b])]],
    body: Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const t = monthlyTotals[m]
      return [MAANDEN[i], ...monthlyBuckets.map((b) => formatEur(t[b] ?? 0))]
    }),
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 9 },
    didParseCell: alignNumericHeaderCells,
    columnStyles: monthlyColumnStyles,
  })

  // Totals per potje per bucket
  let currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  for (const bucket of activeBuckets) {
    const potjeTotals = buildPotjeTotals(transactions, bucket)
    if (potjeTotals.length === 0) continue
    const sectionHeight = estimateBucketSectionHeight(potjeTotals.length)
    if (currentY + sectionHeight > pageHeight - PAGE_BOTTOM_MARGIN) {
      doc.addPage()
      currentY = PAGE_TOP_MARGIN
    }

    const [r, g, b] = BUCKET_COLORS[bucket]
    doc.setFillColor(r, g, b)
    doc.rect(0, currentY, pageWidth, BUCKET_HEADER_HEIGHT, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(`Totalen per potje — ${BUCKET_LABELS[bucket]}`, 14, currentY + 9)

    autoTable(doc, {
      startY: currentY + BUCKET_HEADER_HEIGHT + BUCKET_TABLE_OFFSET,
      head: [['Potje', 'Totaal', 'Gemiddeld per maand', 'Aantal transacties']],
      body: potjeTotals.map((row) => [row.naam, formatEur(row.totaal), formatEur(row.gemiddeld), String(row.aantal)]),
      headStyles: { fillColor: [r, g, b], textColor: 255 },
      styles: { fontSize: 10 },
      pageBreak: 'avoid',
      didParseCell: alignNumericHeaderCells,
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    })
    currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + BUCKET_SECTION_GAP
  }

  doc.save('plusmin-jaaroverzicht.pdf')
}
