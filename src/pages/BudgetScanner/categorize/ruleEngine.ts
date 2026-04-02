import type { ParsedTransaction, CategorizedTransaction, UserRule } from '../types'
import { formatTegenpartijVoorWeergave } from '../displayTegenpartij'
import { matchesRulePattern, matchesOmschrijvingPattern } from './patternMatcher'

// Internal adapter — bridges Rule (patroon) and UserRule (tegenpartijPatroon) into one shape
interface MatchableRule {
  tegenpartijPatroon: string
  omschrijvingPatroon?: string
  richting?: 'credit' | 'debit'
  bucket: CategorizedTransaction['bucket']
  potje: string | null
  naam: string | null
}

const GENERIC_TEGENPARTIJEN = new Set([
  'betaalautomaat', 'ideal', 'tikkie', 'pin', 'overschrijving', 'sepa',
])

function isGeneric(tegenpartij: string): boolean {
  return tegenpartij.trim() === '' || GENERIC_TEGENPARTIJEN.has(tegenpartij.trim().toLowerCase())
}

function fromUser(r: UserRule, naamPrefix: string): MatchableRule {
  return {
    tegenpartijPatroon: r.tegenpartijPatroon,
    omschrijvingPatroon: r.omschrijvingPatroon,
    richting: r.richting,
    bucket: r.bucket,
    potje: r.potje ?? null,
    naam: `${naamPrefix}: ${r.tegenpartijPatroon}`,
  }
}

function directionMatches(richting: 'credit' | 'debit' | undefined, bedrag: number): boolean {
  if (!richting || bedrag === 0) return true
  if (richting === 'credit') return bedrag > 0
  return bedrag < 0
}

function matches(
  rule: MatchableRule,
  tegenpartij: string,
  omschrijving: string,
  bedrag: number,
): { field: 'tegenpartij' | 'omschrijving' } | null {
  if (!directionMatches(rule.richting, bedrag)) return null

  const tpMatch = formatTegenpartijVoorWeergave(tegenpartij).toLowerCase()
  const om = omschrijving.toLowerCase()
  const patroon = rule.tegenpartijPatroon

  // Tegenpartij match (skip if empty/whitespace)
  if (tpMatch.trim() !== '' && matchesRulePattern(tpMatch, patroon)) {
    return { field: 'tegenpartij' }
  }

  // Omschrijving match
  if (rule.omschrijvingPatroon) {
    if (matchesOmschrijvingPattern(om, rule.omschrijvingPatroon)) {
      return { field: 'omschrijving' }
    }
  } else if (isGeneric(tegenpartij)) {
    // Fallback: use tegenpartijPatroon against omschrijving only for generic counterparties
    if (matchesRulePattern(om, patroon)) {
      return { field: 'omschrijving' }
    }
  }

  return null
}

function categorize(tx: ParsedTransaction, rule: MatchableRule): CategorizedTransaction {
  return {
    ...tx,
    bucket: rule.bucket,
    potje: rule.potje,
    isHandmatig: false,
    isDuplicaat: false,
    regelNaam: rule.naam,
  }
}

function sortBySpecificity(rules: MatchableRule[]): MatchableRule[] {
  // Direction-specific rules before directionless within a tier
  return [...rules].sort((a, b) => (a.richting ? 0 : 1) - (b.richting ? 0 : 1))
}

export function applyRules(
  transactions: ParsedTransaction[],
  userRules: UserRule[],
  learnedRules: UserRule[] = [],
): CategorizedTransaction[] {
  const user = sortBySpecificity(userRules.map((r) => fromUser(r, 'regel')))
  const learned = sortBySpecificity(learnedRules.map((r) => fromUser(r, 'geleerd')))

  const tiers = [user, learned]

  return transactions.map((tx) => {
    const { tegenpartij, omschrijving, bedrag } = tx

    // Pass 1: tegenpartij matches across all tiers (highest priority)
    for (const tier of tiers) {
      for (const rule of tier) {
        const m = matches(rule, tegenpartij, omschrijving, bedrag)
        if (m?.field === 'tegenpartij') return categorize(tx, rule)
      }
    }

    // Pass 2: omschrijving matches across all tiers
    for (const tier of tiers) {
      for (const rule of tier) {
        const m = matches(rule, tegenpartij, omschrijving, bedrag)
        if (m?.field === 'omschrijving') return categorize(tx, rule)
      }
    }

    return {
      ...tx,
      bucket: 'ONBEKEND',
      potje: null,
      isHandmatig: false,
      isDuplicaat: false,
      regelNaam: null,
    }
  })
}
