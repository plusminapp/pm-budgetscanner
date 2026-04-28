import type { CategorizedTransaction } from '../types'

function txKey(tx: CategorizedTransaction): string {
  return `${tx.datum}|${tx.bedrag}|${tx.tegenpartij}|${tx.omschrijving}`
}

/**
 * Marks duplicate transactions (same datum, bedrag, tegenpartij, omschrijving).
 * The first occurrence is kept (isDuplicaat: false); subsequent ones are flagged.
 */
export function markDuplicates(
  transactions: CategorizedTransaction[],
): CategorizedTransaction[] {
  const seen = new Set<string>()
  return transactions.map((tx) => {
    const key = txKey(tx)
    if (seen.has(key)) return { ...tx, isDuplicaat: true }
    seen.add(key)
    return { ...tx, isDuplicaat: false }
  })
}

/**
 * Splits incoming transactions into accepted and rejected (duplicates).
 * A transaction is a duplicate if its key (datum|bedrag|tegenpartij|omschrijving)
 * already exists in `existing` or in a previously accepted incoming transaction.
 * Accepted transactions are returned with isDuplicaat: false.
 */
export function splitDuplicates(
  existing: CategorizedTransaction[],
  incoming: CategorizedTransaction[],
): { accepted: CategorizedTransaction[]; rejected: CategorizedTransaction[] } {
  const seen = new Set<string>(existing.map(txKey))
  const accepted: CategorizedTransaction[] = []
  const rejected: CategorizedTransaction[] = []
  for (const tx of incoming) {
    const key = txKey(tx)
    if (seen.has(key)) {
      rejected.push({ ...tx, isDuplicaat: true })
    } else {
      seen.add(key)
      accepted.push({ ...tx, isDuplicaat: false })
    }
  }
  return { accepted, rejected }
}
