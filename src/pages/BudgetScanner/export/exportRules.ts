import type { UserRule, Potje, CategorizedTransaction } from '../types'

interface ExportedRule {
  tegenpartijPatroon: string
  omschrijvingPatroon: string | null
  richting: 'credit' | 'debit' | null
  bucket: string
  potje: string | null
  bron: 'user' | 'learned'
}

interface RulesFile {
  versie: number
  regels: ExportedRule[]
  potjes: Potje[]
}

interface OverzichtFile extends RulesFile {
  transacties: CategorizedTransaction[]
}

export function buildRulesJson(userRules: UserRule[], learnedRules: UserRule[], potjes: Potje[]): string {
  const toExported = (r: UserRule, bron: 'user' | 'learned'): ExportedRule => ({
    tegenpartijPatroon: r.tegenpartijPatroon,
    omschrijvingPatroon: r.omschrijvingPatroon ?? null,
    richting: r.richting ?? null,
    bucket: r.bucket,
    potje: r.potje ?? null,
    bron,
  })

  const file: RulesFile = {
    versie: 1,
    regels: [
      ...userRules.map((r) => toExported(r, 'user')),
      ...learnedRules.map((r) => toExported(r, 'learned')),
    ],
    potjes,
  }
  return JSON.stringify(file, null, 2)
}

export function exportRules(userRules: UserRule[], learnedRules: UserRule[], potjes: Potje[]): void {
  const json = buildRulesJson(userRules, learnedRules, potjes)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'budgetscanner-regels.json'
  a.click()
  URL.revokeObjectURL(url)
}

export function buildOverzichtJson(
  transacties: CategorizedTransaction[],
  userRules: UserRule[],
  learnedRules: UserRule[],
  potjes: Potje[],
): string {
  const rulesOnly = JSON.parse(buildRulesJson(userRules, learnedRules, potjes)) as RulesFile
  const file: OverzichtFile = {
    ...rulesOnly,
    versie: 2,
    transacties,
  }
  return JSON.stringify(file, null, 2)
}

export function exportOverzicht(
  transacties: CategorizedTransaction[],
  jaar: number,
  userRules: UserRule[],
  learnedRules: UserRule[],
  potjes: Potje[],
): void {
  const json = buildOverzichtJson(transacties, userRules, learnedRules, potjes)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `plusmin-jaaroverzicht-${jaar}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importRules(json: string): {
  userRules: UserRule[]
  learnedRules: UserRule[]
  potjes: Potje[]
  transacties: CategorizedTransaction[]
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Ongeldig JSON-bestand.')
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('versie' in parsed) ||
    typeof (parsed as Record<string, unknown>).versie !== 'number'
  ) {
    throw new Error('Ongeldig regelbestand: versie ontbreekt.')
  }

  const file = parsed as RulesFile | OverzichtFile
  if (file.versie > 2) {
    throw new Error(
      'Dit regelbestand is van een nieuwere versie. Update de app om het te kunnen laden.',
    )
  }

  if (!Array.isArray(file.regels)) {
    throw new Error('Ongeldig regelbestand: regels ontbreekt.')
  }

  const userRules: UserRule[] = []
  const learnedRules: UserRule[] = []

  for (const r of file.regels) {
    const rule: UserRule = {
      tegenpartijPatroon: r.tegenpartijPatroon,
      ...(r.omschrijvingPatroon ? { omschrijvingPatroon: r.omschrijvingPatroon } : {}),
      ...(r.richting ? { richting: r.richting } : {}),
      bucket: r.bucket as UserRule['bucket'],
      ...(r.potje ? { potje: r.potje } : {}),
    }
    if (r.bron === 'learned') {
      learnedRules.push(rule)
    } else {
      userRules.push(rule) // default to user for missing bron
    }
  }

  const potjes: Potje[] = Array.isArray((file as any).potjes) ? (file as any).potjes : []
  const transacties: CategorizedTransaction[] =
    file.versie >= 2 && Array.isArray((file as OverzichtFile).transacties)
      ? (file as OverzichtFile).transacties
      : []
  return { userRules, learnedRules, potjes, transacties }
}
