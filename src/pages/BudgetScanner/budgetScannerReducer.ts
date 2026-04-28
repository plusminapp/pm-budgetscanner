import type {
  BudgetScannerState,
  CategorizedTransaction,
  UserRule,
  Potje,
} from './types'
import { applyRules } from './categorize/ruleEngine'
import { matchesRulePattern } from './categorize/patternMatcher'

export type BudgetScannerAction =
  | { type: 'BESTANDEN_TOEVOEGEN'; bestanden: File[] }
  | { type: 'BESTAND_PARSED'; bestandNaam: string; transacties: CategorizedTransaction[] }
  | { type: 'BESTAND_FOUT'; bestandNaam: string; foutmelding: string }
    | { type: 'RESET' }
  | { type: 'CATEGORIE_WIJZIGEN'; transactieIds: string[]; bucket: CategorizedTransaction['bucket']; potje: string | null; groepCriterium?: string; zonderRegel?: boolean }
  | { type: 'REGEL_PATROON_OVERSCHRIJVEN'; bron: 'user' | 'learned'; oldRegel: UserRule; tegenpartijPatroon: string; omschrijvingPatroon?: string; potje: string | null }
  | { type: 'REGEL_TOEVOEGEN'; regel: UserRule }
  | { type: 'REGEL_TOEPASSEN'; regel: UserRule }
  | { type: 'REGEL_GELEERD'; regel: UserRule }
  | { type: 'REGELS_IMPORTEREN'; userRules: UserRule[]; learnedRules: UserRule[]; potjes: Potje[] }
  | { type: 'SNAPSHOT_IMPORTEREN'; userRules: UserRule[]; learnedRules: UserRule[]; potjes: Potje[]; transacties: CategorizedTransaction[] }
  | { type: 'POTJE_TOEVOEGEN'; naam: string; bucket: Exclude<CategorizedTransaction['bucket'], 'ONBEKEND' | 'NEGEREN'> }
  | { type: 'POTJE_VERWIJDEREN'; id: string }
  | { type: 'POTJE_HERNOEMEN'; id: string; naam: string }
  | { type: 'POTJE_HERNOEMEN_BY_BUCKET_EN_NAAM'; bucket: string; oudeNaam: string | null; nieuweNaam: string }
  | { type: 'NAAR_TOEWIJZEN' }
  | { type: 'NAAR_UPLOAD' }
  | { type: 'NAAR_WELKOM' }

export const initialState: BudgetScannerState = {
  stap: 'WELKOM',
  bestanden: [],
  transacties: [],
  userRules: [],
  learnedRules: [],
  potjes: [],
}

function normalizePotjeForBucket(bucket: CategorizedTransaction['bucket'], potje: string | null): string | null {
  if (bucket === 'NEGEREN') return 'Negeren'
  return potje
}

// Deduplication key for learned rules
function learnedKey(r: UserRule): string {
  return `${r.tegenpartijPatroon.toLowerCase()}|${r.richting ?? ''}|${r.omschrijvingPatroon ?? ''}`
}

// Derive a learned rule from a corrected transaction
function deriveLearnedRule(tx: CategorizedTransaction, bucket: CategorizedTransaction['bucket'], potje: string | null): UserRule {
  const normalizedPotje = normalizePotjeForBucket(bucket, potje)
  return {
    tegenpartijPatroon: tx.tegenpartij.toLowerCase(),
    richting: tx.bedrag < 0 ? 'debit' : tx.bedrag > 0 ? 'credit' : undefined,
    bucket,
    ...(normalizedPotje ? { potje: normalizedPotje } : {}),
  }
}

function deriveLearnedRuleVoorGroep(
  criterium: string,
  txs: CategorizedTransaction[],
  bucket: CategorizedTransaction['bucket'],
  potje: string | null,
): UserRule {
  const normalized = criterium.trim()
  const normalizedPotje = normalizePotjeForBucket(bucket, potje)
  const allDebit = txs.length > 0 && txs.every((tx) => tx.bedrag < 0)
  const allCredit = txs.length > 0 && txs.every((tx) => tx.bedrag > 0)
  return {
    tegenpartijPatroon: normalized,
    richting: allDebit ? 'debit' : allCredit ? 'credit' : undefined,
    bucket,
    ...(normalizedPotje ? { potje: normalizedPotje } : {}),
  }
}

function isZelfdeRegel(a: UserRule, b: UserRule): boolean {
  return a.tegenpartijPatroon === b.tegenpartijPatroon
    && a.omschrijvingPatroon === b.omschrijvingPatroon
    && a.richting === b.richting
    && a.bucket === b.bucket
    && a.potje === b.potje
}

function overschrijfPatronen(regel: UserRule, tegenpartijPatroon: string, omschrijvingPatroon: string | undefined, potje: string | null): UserRule {
  const nextTegenpartijPatroon = tegenpartijPatroon.trim()
  const nextOmschrijvingPatroon = (omschrijvingPatroon ?? '').trim()
  const nextPotje = (potje ?? '').trim()
  const base: UserRule = {
    ...regel,
    tegenpartijPatroon: nextTegenpartijPatroon,
    ...(nextPotje ? { potje: nextPotje } : {}),
  }
  if (!nextPotje) {
    const { potje: _removedPotje, ...withoutPotje } = base
    if (nextOmschrijvingPatroon) {
      return { ...withoutPotje, omschrijvingPatroon: nextOmschrijvingPatroon }
    }
    const { omschrijvingPatroon: _removed, ...withoutOmschrijving } = withoutPotje
    return withoutOmschrijving
  }
  if (nextOmschrijvingPatroon) {
    return { ...base, omschrijvingPatroon: nextOmschrijvingPatroon }
  }
  const { omschrijvingPatroon: _removed, ...withoutOmschrijving } = base
  return withoutOmschrijving
}

// Merge new rules into existing, replacing on same key
function mergeLearnedRules(existing: UserRule[], incoming: UserRule[]): UserRule[] {
  const map = new Map(existing.map((r) => [learnedKey(r), r]))
  for (const r of incoming) map.set(learnedKey(r), r)
  return [...map.values()]
}

// Fundamental reconciliation for rule edits:
// - non-manual transactions are re-categorized by current rules
// - ALL transactions get a fresh toewijzingsregel derived from current rules
function reconcileTransactionsAfterRuleEdit(
  transacties: CategorizedTransaction[],
  userRules: UserRule[],
  learnedRules: UserRule[],
): CategorizedTransaction[] {
  return transacties.map((tx) => {
    const { bucket: _bucket, potje: _potje, isHandmatig: _isHandmatig, regelNaam: _regelNaam, toewijzingsregel: _toewijzingsregel, isDuplicaat, ...parsed } = tx
    const [categorized] = applyRules([parsed], userRules, learnedRules)
    const nextToewijzingsregel = categorized.toewijzingsregel ?? parsed.tegenpartij

    if (tx.isHandmatig) {
      return { ...tx, toewijzingsregel: nextToewijzingsregel }
    }

    return { ...categorized, isDuplicaat, toewijzingsregel: nextToewijzingsregel }
  })
}

function applyEditedRuleGrouping(
  transacties: CategorizedTransaction[],
  editedRule: UserRule,
): CategorizedTransaction[] {
  return transacties.map((tx) => {
    const [matched] = applyRules([tx], [editedRule], [])
    if (!matched.regelNaam) return tx
    return { ...tx, toewijzingsregel: editedRule.tegenpartijPatroon }
  })
}

// Existing behavior for learned auto-apply: touch ONBEKEND only
function applyLearnedToOnbekend(
  transacties: CategorizedTransaction[],
  learnedRules: UserRule[],
): CategorizedTransaction[] {
  if (learnedRules.length === 0) return transacties
  return transacties.map((tx) => {
    if (tx.bucket !== 'ONBEKEND') return tx
    const re = applyRules([tx], [], learnedRules)
    return re[0]
  })
}

export function budgetScannerReducer(
  state: BudgetScannerState,
  action: BudgetScannerAction,
): BudgetScannerState {
  switch (action.type) {
    case 'RESET':
      return initialState

    case 'BESTANDEN_TOEVOEGEN':
      return {
        ...state,
        bestanden: [
          ...state.bestanden,
          ...action.bestanden.map((f) => ({
            naam: f.name,
            format: null,
            status: 'PARSING' as const,
          })),
        ],
      }

    case 'BESTAND_PARSED':
      return {
        ...state,
        bestanden: state.bestanden.map((b) =>
          b.naam === action.bestandNaam ? { ...b, status: 'KLAAR' as const } : b,
        ),
        transacties: [...state.transacties, ...action.transacties],
      }

    case 'BESTAND_FOUT':
      return {
        ...state,
        bestanden: state.bestanden.map((b) =>
          b.naam === action.bestandNaam
            ? { ...b, status: 'FOUT' as const, foutmelding: action.foutmelding }
            : b,
        ),
      }

    case 'CATEGORIE_WIJZIGEN': {
      const ids = new Set(action.transactieIds)
      const normalizedPotje = normalizePotjeForBucket(action.bucket, action.potje)
      const nieuwToewijzingsregel = action.groepCriterium?.trim()
      const updatedTxs = state.transacties.map((tx) =>
        ids.has(tx.id)
          ? {
              ...tx,
              bucket: action.bucket,
              potje: normalizedPotje,
              isHandmatig: true,
              toewijzingsregel: nieuwToewijzingsregel || tx.toewijzingsregel, // Update toewijzingsregel if provided
            }
          : tx,
      )
      if (action.zonderRegel) {
        return { ...state, transacties: updatedTxs }
      }
      const corrected = state.transacties.filter((tx) => ids.has(tx.id))
      const groupedCriterium = action.groepCriterium?.trim()
      const newRules = groupedCriterium
        ? [deriveLearnedRuleVoorGroep(groupedCriterium, corrected, action.bucket, normalizedPotje)]
        : corrected.map((tx) => deriveLearnedRule(tx, action.bucket, normalizedPotje))
      const mergedRules = mergeLearnedRules(state.learnedRules, newRules)

      const finalTxs = groupedCriterium
        ? applyEditedRuleGrouping(
            reconcileTransactionsAfterRuleEdit(updatedTxs, state.userRules, mergedRules),
            newRules[0],
          )
        : applyLearnedToOnbekend(updatedTxs, mergedRules)

      return { ...state, transacties: finalTxs, learnedRules: mergedRules }
    }

    case 'REGEL_PATROON_OVERSCHRIJVEN': {
      let vervangen = false
      let editedRule: UserRule | null = null
      const update = (regels: UserRule[]) => regels.map((regel) => {
        if (vervangen || !isZelfdeRegel(regel, action.oldRegel)) return regel
        vervangen = true
        const next = overschrijfPatronen(regel, action.tegenpartijPatroon, action.omschrijvingPatroon, action.potje)
        editedRule = next
        return next
      })

      if (action.bron === 'user') {
        const userRules = update(state.userRules)
        const reconciled = reconcileTransactionsAfterRuleEdit(state.transacties, userRules, state.learnedRules)
        const transacties = editedRule ? applyEditedRuleGrouping(reconciled, editedRule) : reconciled
        return { ...state, userRules, transacties }
      }

      const learnedRules = update(state.learnedRules)
      const reconciled = reconcileTransactionsAfterRuleEdit(state.transacties, state.userRules, learnedRules)
      const transacties = editedRule ? applyEditedRuleGrouping(reconciled, editedRule) : reconciled
      return { ...state, learnedRules, transacties }
    }

    case 'REGEL_TOEVOEGEN':
      return { ...state, userRules: [...state.userRules, action.regel] }

    case 'REGEL_TOEPASSEN': {
      const lowercased: UserRule = {
        ...action.regel,
        tegenpartijPatroon: action.regel.tegenpartijPatroon.toLowerCase(),
      }
      return {
        ...state,
        userRules: [...state.userRules, lowercased],
        transacties: state.transacties.map((tx) => {
          if (!matchesRulePattern(tx.tegenpartij, lowercased.tegenpartijPatroon)) return tx
          if (lowercased.richting === 'debit' && tx.bedrag > 0) return tx
          if (lowercased.richting === 'credit' && tx.bedrag < 0) return tx
          return { ...tx, bucket: lowercased.bucket, potje: lowercased.potje ?? null, isHandmatig: true }
        }),
      }
    }

    case 'REGEL_GELEERD': {
      const merged = mergeLearnedRules(state.learnedRules, [action.regel])
      const finalTxs = applyLearnedToOnbekend(state.transacties, merged)
      return { ...state, learnedRules: merged, transacties: finalTxs }
    }

    case 'REGELS_IMPORTEREN': {
      const finalTxs = state.transacties.length > 0
        ? state.transacties.map((tx) => {
            // Preserve manually-corrected transactions untouched
            if (tx.isHandmatig) return tx
            // Strip categorization fields and re-categorize
            const { bucket: _b, potje: _s, isHandmatig: _h, isDuplicaat, regelNaam: _r, ...parsed } = tx
            const [recategorized] = applyRules([parsed], action.userRules, action.learnedRules)
            return { ...recategorized, isDuplicaat } // preserve duplicate flag
          })
        : state.transacties
      return {
        ...state,
        userRules: action.userRules,
        learnedRules: action.learnedRules,
        potjes: action.potjes,
        transacties: finalTxs,
      }
    }

    case 'SNAPSHOT_IMPORTEREN': {
      const bestandMap = new Map<string, { naam: string; format: CategorizedTransaction['bankFormat']; status: 'KLAAR' }>()
      for (const tx of action.transacties) {
        if (!bestandMap.has(tx.bronBestand)) {
          bestandMap.set(tx.bronBestand, {
            naam: tx.bronBestand,
            format: tx.bankFormat,
            status: 'KLAAR',
          })
        }
      }
      return {
        ...state,
        bestanden: [...bestandMap.values()],
        transacties: action.transacties,
        userRules: action.userRules,
        learnedRules: action.learnedRules,
        potjes: action.potjes,
      }
    }

    case 'POTJE_TOEVOEGEN':
      return {
        ...state,
        potjes: [...state.potjes, { id: crypto.randomUUID(), naam: action.naam, bucket: action.bucket }],
      }

    case 'POTJE_VERWIJDEREN':
      return { ...state, potjes: state.potjes.filter((p) => p.id !== action.id) }

    case 'POTJE_HERNOEMEN':
      return {
        ...state,
        potjes: state.potjes.map((p) => p.id === action.id ? { ...p, naam: action.naam } : p),
      }
    
      case 'POTJE_HERNOEMEN_BY_BUCKET_EN_NAAM':
        return {
          ...state,
          potjes: state.potjes.map((p) =>
            p.bucket === action.bucket && p.naam === action.oudeNaam
              ? { ...p, naam: action.nieuweNaam }
              : p
          ),
        }

    case 'NAAR_TOEWIJZEN':
      return { ...state, stap: 'TOEWIJZEN' }

    case 'NAAR_UPLOAD':
      return { ...state, stap: 'UPLOAD' }

    case 'NAAR_WELKOM':
      return { ...state, stap: 'WELKOM' }

    default:
      return state
  }
}
