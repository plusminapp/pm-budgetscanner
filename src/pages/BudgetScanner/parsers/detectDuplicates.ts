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
