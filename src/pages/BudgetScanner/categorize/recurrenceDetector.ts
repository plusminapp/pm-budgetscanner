import type { CategorizedTransaction } from '../types'

const MIN_OCCURRENCES = 3
const MIN_INTERVAL_DAYS = 25
const MAX_INTERVAL_DAYS = 35
const AMOUNT_TOLERANCE = 0.10

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  )
}

function amountsWithinTolerance(amounts: number[]): boolean {
  const abs = amounts.map(Math.abs)
  const min = Math.min(...abs)
  const max = Math.max(...abs)
  return min > 0 && (max - min) / min <= AMOUNT_TOLERANCE
}

function intervalsAreMonthly(dates: string[]): boolean {
  const sorted = [...dates].sort()
  for (let i = 1; i < sorted.length; i++) {
    const days = daysBetween(sorted[i - 1], sorted[i])
    if (days < MIN_INTERVAL_DAYS || days > MAX_INTERVAL_DAYS) return false
  }
  return true
}

export function applyRecurrenceDetection(
  transactions: CategorizedTransaction[],
): CategorizedTransaction[] {
  // Group ONBEKEND transactions by tegenpartij
  const groups = new Map<string, CategorizedTransaction[]>()
  for (const tx of transactions) {
    if (tx.bucket !== 'ONBEKEND') continue
    const key = tx.tegenpartij.toLowerCase()
    const group = groups.get(key) ?? []
    group.push(tx)
    groups.set(key, group)
  }

  // Determine which tegenpartij groups are recurring
  const recurringIds = new Set<string>()
  const recurringBucket = new Map<string, CategorizedTransaction['bucket']>()

  for (const [key, group] of groups) {
    if (group.length < MIN_OCCURRENCES) continue
    const amounts = group.map((t) => t.bedrag)
    // All amounts must have the same sign (no mixed debit/credit groups)
    const isCredit = amounts.every((a) => a > 0)
    const isDebit = amounts.every((a) => a < 0)
    if (!isCredit && !isDebit) continue
    if (!amountsWithinTolerance(amounts)) continue
    if (!intervalsAreMonthly(group.map((t) => t.datum))) continue
    recurringIds.add(key)
    recurringBucket.set(key, isCredit ? 'INKOMEN' : 'VASTE_LASTEN')
  }

  return transactions.map((tx) => {
    const key = tx.tegenpartij.toLowerCase()
    if (tx.bucket === 'ONBEKEND' && recurringIds.has(key)) {
      return {
        ...tx,
        bucket: recurringBucket.get(key)!,
        regelNaam: 'terugkerend',
      }
    }
    return tx
  })
}
