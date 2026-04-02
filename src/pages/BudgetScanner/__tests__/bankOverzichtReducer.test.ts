import { describe, it, expect } from 'vitest'
import { budgetScannerReducer, initialState } from '../budgetScannerReducer'
import type { BudgetScannerState, CategorizedTransaction, UserRule } from '../types'

const makeTx = (overrides: Partial<CategorizedTransaction> = {}): CategorizedTransaction => ({
  id: 'tx-1',
  datum: '2023-06-15',
  bedrag: -25.00,
  omschrijving: 'test',
  tegenrekening: null,
  tegenpartij: 'Albert Heijn',
  bronBestand: 'ing.csv',
  bankFormat: 'ING',
  bucket: 'ONBEKEND',
  potje: null,
  isHandmatig: false,
  regelNaam: null,
  isDuplicaat: false,
  ...overrides,
})

describe('budgetScannerReducer', () => {
  it('starts in WELKOM stap', () => {
    expect(initialState.stap).toBe('WELKOM')
  })

  it('BESTANDEN_TOEVOEGEN adds files with PARSING status', () => {
    const file = { name: 'ing.csv' } as File
    const next = budgetScannerReducer(initialState, {
      type: 'BESTANDEN_TOEVOEGEN',
      bestanden: [file],
    })
    expect(next.bestanden).toHaveLength(1)
    expect(next.bestanden[0]).toEqual({ naam: 'ing.csv', format: null, status: 'PARSING' })
  })

  it('BESTAND_PARSED sets file to KLAAR and appends transactions', () => {
    const state: BudgetScannerState = {
      ...initialState,
      bestanden: [{ naam: 'ing.csv', format: 'ING', status: 'PARSING' }],
    }
    const tx = makeTx()
    const next = budgetScannerReducer(state, {
      type: 'BESTAND_PARSED',
      bestandNaam: 'ing.csv',
      transacties: [tx],
    })
    expect(next.bestanden[0].status).toBe('KLAAR')
    expect(next.transacties).toHaveLength(1)
    expect(next.transacties[0].id).toBe('tx-1')
  })

  it('BESTAND_FOUT sets file to FOUT with error message', () => {
    const state: BudgetScannerState = {
      ...initialState,
      bestanden: [{ naam: 'bad.csv', format: null, status: 'PARSING' }],
    }
    const next = budgetScannerReducer(state, {
      type: 'BESTAND_FOUT',
      bestandNaam: 'bad.csv',
      foutmelding: 'Onbekend formaat',
    })
    expect(next.bestanden[0].status).toBe('FOUT')
    expect(next.bestanden[0].foutmelding).toBe('Onbekend formaat')
  })

  it('CATEGORIE_WIJZIGEN updates bucket and marks as handmatig', () => {
    const state: BudgetScannerState = {
      ...initialState,
      transacties: [makeTx({ id: 'tx-1', bucket: 'ONBEKEND' })],
    }
    const next = budgetScannerReducer(state, {
      type: 'CATEGORIE_WIJZIGEN',
      transactieIds: ['tx-1'],
      bucket: 'LEEFGELD',
      potje: null,
    })
    expect(next.transacties[0].bucket).toBe('LEEFGELD')
    expect(next.transacties[0].isHandmatig).toBe(true)
  })

  it('CATEGORIE_WIJZIGEN forces potje to Negeren when bucket is NEGEREN', () => {
    const state: BudgetScannerState = {
      ...initialState,
      transacties: [makeTx({ id: 'tx-1', bucket: 'LEEFGELD', potje: 'Boodschappen' })],
    }
    const next = budgetScannerReducer(state, {
      type: 'CATEGORIE_WIJZIGEN',
      transactieIds: ['tx-1'],
      bucket: 'NEGEREN',
      potje: null,
    })
    expect(next.transacties[0].bucket).toBe('NEGEREN')
    expect(next.transacties[0].potje).toBe('Negeren')
  })

  it('REGEL_TOEVOEGEN appends a user rule', () => {
    const next = budgetScannerReducer(initialState, {
      type: 'REGEL_TOEVOEGEN',
      regel: { tegenpartijPatroon: 'Jumbo', bucket: 'LEEFGELD' },
    })
    expect(next.userRules).toHaveLength(1)
    expect(next.userRules[0].tegenpartijPatroon).toBe('Jumbo')
  })

  it('REGEL_TOEPASSEN adds rule and re-categorizes matching transactions', () => {
    const state: BudgetScannerState = {
      ...initialState,
      transacties: [
        makeTx({ id: 'tx-1', tegenpartij: 'Jumbo Supermarkt', bucket: 'ONBEKEND' }),
        makeTx({ id: 'tx-2', tegenpartij: 'NS Reizigers', bucket: 'ONBEKEND' }),
      ],
    }
    const next = budgetScannerReducer(state, {
      type: 'REGEL_TOEPASSEN',
      regel: { tegenpartijPatroon: 'Jumbo', bucket: 'LEEFGELD' },
    })
    expect(next.userRules).toHaveLength(1)
    expect(next.transacties[0].bucket).toBe('LEEFGELD')
    expect(next.transacties[0].isHandmatig).toBe(true)
    expect(next.transacties[1].bucket).toBe('ONBEKEND') // no match
  })

  it('NAAR_TOEWIJZEN sets stap to TOEWIJZEN', () => {
    const next = budgetScannerReducer(initialState, { type: 'NAAR_TOEWIJZEN' })
    expect(next.stap).toBe('TOEWIJZEN')
  })

  it('NAAR_UPLOAD sets stap to UPLOAD', () => {
    const state = { ...initialState, stap: 'TOEWIJZEN' as const }
    const next = budgetScannerReducer(state, { type: 'NAAR_UPLOAD' })
    expect(next.stap).toBe('UPLOAD')
  })
})

// Helper for learned rule tests
const makeLearnedState = (overrides: Partial<BudgetScannerState> = {}): BudgetScannerState => ({
  ...initialState,
  learnedRules: [],
  ...overrides,
})

describe('learnedRules', () => {
  it('initialState has empty learnedRules', () => {
    expect(initialState.learnedRules).toEqual([])
  })

  it('REGEL_GELEERD adds a learned rule', () => {
    const regel: UserRule = { tegenpartijPatroon: 'test', richting: 'debit', bucket: 'VASTE_LASTEN' }
    const next = budgetScannerReducer(makeLearnedState(), { type: 'REGEL_GELEERD', regel })
    expect(next.learnedRules).toHaveLength(1)
    expect(next.learnedRules[0].tegenpartijPatroon).toBe('test')
  })

  it('REGEL_GELEERD replaces existing rule with same key (last-wins)', () => {
    const existing: UserRule = { tegenpartijPatroon: 'test', richting: 'debit', bucket: 'VASTE_LASTEN' }
    const updated: UserRule = { tegenpartijPatroon: 'test', richting: 'debit', bucket: 'LEEFGELD' }
    const state = makeLearnedState({ learnedRules: [existing] })
    const next = budgetScannerReducer(state, { type: 'REGEL_GELEERD', regel: updated })
    expect(next.learnedRules).toHaveLength(1)
    expect(next.learnedRules[0].bucket).toBe('LEEFGELD')
  })

  it('REGEL_GELEERD auto-applies to ONBEKEND transactions', () => {
    const tx = makeTx({ id: 'tx-1', tegenpartij: 'belastingdienst', bedrag: -100, bucket: 'ONBEKEND' })
    const state = makeLearnedState({ transacties: [tx] })
    const regel: UserRule = { tegenpartijPatroon: 'belastingdienst', richting: 'debit', bucket: 'VASTE_LASTEN' }
    const next = budgetScannerReducer(state, { type: 'REGEL_GELEERD', regel })
    expect(next.transacties[0].bucket).toBe('VASTE_LASTEN')
  })

  it('REGEL_GELEERD does NOT re-categorize already-categorized transactions', () => {
    const tx = makeTx({ id: 'tx-1', tegenpartij: 'belastingdienst', bedrag: -100, bucket: 'LEEFGELD' })
    const state = makeLearnedState({ transacties: [tx] })
    const regel: UserRule = { tegenpartijPatroon: 'belastingdienst', richting: 'debit', bucket: 'VASTE_LASTEN' }
    const next = budgetScannerReducer(state, { type: 'REGEL_GELEERD', regel })
    expect(next.transacties[0].bucket).toBe('LEEFGELD') // unchanged
  })

  it('REGELS_IMPORTEREN replaces userRules and learnedRules', () => {
    const userRules: UserRule[] = [{ tegenpartijPatroon: 'test', bucket: 'SPAREN' }]
    const learnedRules: UserRule[] = [{ tegenpartijPatroon: 'foo', richting: 'debit', bucket: 'VASTE_LASTEN' }]
    const next = budgetScannerReducer(makeLearnedState(), {
      type: 'REGELS_IMPORTEREN',
      userRules,
      learnedRules,
      potjes: [],
    })
    expect(next.userRules).toEqual(userRules)
    expect(next.learnedRules).toEqual(learnedRules)
  })

  it('REGELS_IMPORTEREN re-categorizes existing ONBEKEND transactions with new rules', () => {
    const tx = makeTx({ id: 'tx-1', tegenpartij: 'test', bedrag: -50, bucket: 'ONBEKEND' })
    const state = makeLearnedState({ transacties: [tx] })
    const userRules: UserRule[] = [{ tegenpartijPatroon: 'test', bucket: 'VASTE_LASTEN' }]
    const next = budgetScannerReducer(state, { type: 'REGELS_IMPORTEREN', userRules, learnedRules: [], potjes: [] })
    expect(next.transacties[0].bucket).toBe('VASTE_LASTEN')
  })

  it('REGELS_IMPORTEREN does NOT re-categorize isHandmatig: true transactions', () => {
    const manual = makeTx({ id: 'tx-1', tegenpartij: 'test', bedrag: -50, bucket: 'SPAREN', isHandmatig: true })
    const state = makeLearnedState({ transacties: [manual] })
    const userRules: UserRule[] = [{ tegenpartijPatroon: 'test', bucket: 'VASTE_LASTEN' }]
    const next = budgetScannerReducer(state, { type: 'REGELS_IMPORTEREN', userRules, learnedRules: [], potjes: [] })
    expect(next.transacties[0].bucket).toBe('SPAREN') // manual correction preserved
  })

  it('CATEGORIE_WIJZIGEN derives a learned rule from corrected transactions', () => {
    const tx = makeTx({ id: 'tx-1', tegenpartij: 'Belastingdienst', bedrag: -300, bucket: 'INKOMEN' })
    const state = makeLearnedState({ transacties: [tx] })
    const next = budgetScannerReducer(state, {
      type: 'CATEGORIE_WIJZIGEN',
      transactieIds: ['tx-1'],
      bucket: 'VASTE_LASTEN',
      potje: null,
    })
    expect(next.learnedRules).toHaveLength(1)
    expect(next.learnedRules[0].tegenpartijPatroon).toBe('belastingdienst') // lowercased
    expect(next.learnedRules[0].richting).toBe('debit')
    expect(next.learnedRules[0].bucket).toBe('VASTE_LASTEN')
  })

  it('CATEGORIE_WIJZIGEN lowercases tegenpartijPatroon in learned rule', () => {
    const tx = makeTx({ id: 'tx-1', tegenpartij: 'ZIGGO BV', bedrag: -50, bucket: 'ONBEKEND' })
    const state = makeLearnedState({ transacties: [tx] })
    const next = budgetScannerReducer(state, {
      type: 'CATEGORIE_WIJZIGEN',
      transactieIds: ['tx-1'],
      bucket: 'VASTE_LASTEN',
      potje: null,
    })
    expect(next.learnedRules[0].tegenpartijPatroon).toBe('ziggo bv')
  })

  it('CATEGORIE_WIJZIGEN with zonderRegel updates transaction without creating a learned rule', () => {
    const tx = makeTx({ id: 'tx-1', tegenpartij: 'Albert Heijn', bedrag: -30, bucket: 'ONBEKEND' })
    const state = makeLearnedState({ transacties: [tx] })
    const next = budgetScannerReducer(state, {
      type: 'CATEGORIE_WIJZIGEN',
      transactieIds: ['tx-1'],
      bucket: 'LEEFGELD',
      potje: 'Boodschappen',
      zonderRegel: true,
    })

    expect(next.transacties[0].bucket).toBe('LEEFGELD')
    expect(next.transacties[0].potje).toBe('Boodschappen')
    expect(next.transacties[0].isHandmatig).toBe(true)
    expect(next.learnedRules).toHaveLength(0)
  })

  it('REGEL_TOEPASSEN lowercases tegenpartijPatroon in userRules', () => {
    const next = budgetScannerReducer(makeLearnedState(), {
      type: 'REGEL_TOEPASSEN',
      regel: { tegenpartijPatroon: 'Albert Heijn', bucket: 'SPAREN' },
    })
    expect(next.userRules[0].tegenpartijPatroon).toBe('albert heijn')
  })

  it('REGEL_TOEPASSEN with richting only applies to matching direction', () => {
    const debit = makeTx({ id: 'tx-1', tegenpartij: 'gemeente', bedrag: -50, bucket: 'ONBEKEND' })
    const credit = makeTx({ id: 'tx-2', tegenpartij: 'gemeente', bedrag: 200, bucket: 'ONBEKEND' })
    const state = makeLearnedState({ transacties: [debit, credit] })
    const next = budgetScannerReducer(state, {
      type: 'REGEL_TOEPASSEN',
      regel: { tegenpartijPatroon: 'gemeente', richting: 'debit', bucket: 'VASTE_LASTEN' },
    })
    expect(next.transacties[0].bucket).toBe('VASTE_LASTEN') // debit → updated
    expect(next.transacties[1].bucket).toBe('ONBEKEND')     // credit → untouched
  })

  it('REGEL_TOEPASSEN supports wildcard patroon', () => {
    const a = makeTx({ id: 'tx-1', tegenpartij: 'Stichting Philips', bedrag: -10, bucket: 'ONBEKEND' })
    const b = makeTx({ id: 'tx-2', tegenpartij: 'ASN Ideaalsparen', bedrag: -10, bucket: 'ONBEKEND' })
    const state = makeLearnedState({ transacties: [a, b] })

    const first = budgetScannerReducer(state, {
      type: 'REGEL_TOEPASSEN',
      regel: { tegenpartijPatroon: '*philips', bucket: 'LEEFGELD' },
    })
    expect(first.transacties[0].bucket).toBe('LEEFGELD')

    const second = budgetScannerReducer(first, {
      type: 'REGEL_TOEPASSEN',
      regel: { tegenpartijPatroon: 'asn*sparen', bucket: 'SPAREN' },
    })
    expect(second.transacties[1].bucket).toBe('SPAREN')
  })
})

describe('potje actions', () => {
  it('POTJE_TOEVOEGEN adds a potje with generated id', () => {
    const next = budgetScannerReducer(initialState, {
      type: 'POTJE_TOEVOEGEN',
      naam: 'Huur',
      bucket: 'VASTE_LASTEN',
    })
    expect(next.potjes).toHaveLength(1)
    expect(next.potjes[0].naam).toBe('Huur')
    expect(next.potjes[0].bucket).toBe('VASTE_LASTEN')
    expect(typeof next.potjes[0].id).toBe('string')
  })

  it('POTJE_VERWIJDEREN removes the matching potje', () => {
    const state = budgetScannerReducer(initialState, {
      type: 'POTJE_TOEVOEGEN', naam: 'Huur', bucket: 'VASTE_LASTEN',
    })
    const id = state.potjes[0].id
    const next = budgetScannerReducer(state, { type: 'POTJE_VERWIJDEREN', id })
    expect(next.potjes).toHaveLength(0)
  })

  it('POTJE_VERWIJDEREN leaves other potjes untouched', () => {
    let state = budgetScannerReducer(initialState, {
      type: 'POTJE_TOEVOEGEN', naam: 'Huur', bucket: 'VASTE_LASTEN',
    })
    state = budgetScannerReducer(state, {
      type: 'POTJE_TOEVOEGEN', naam: 'Boodschappen', bucket: 'LEEFGELD',
    })
    const idToRemove = state.potjes[0].id
    const next = budgetScannerReducer(state, { type: 'POTJE_VERWIJDEREN', id: idToRemove })
    expect(next.potjes).toHaveLength(1)
    expect(next.potjes[0].naam).toBe('Boodschappen')
  })

  it('POTJE_HERNOEMEN updates the naam of a potje', () => {
    const state = budgetScannerReducer(initialState, {
      type: 'POTJE_TOEVOEGEN', naam: 'Huur', bucket: 'VASTE_LASTEN',
    })
    const id = state.potjes[0].id
    const next = budgetScannerReducer(state, { type: 'POTJE_HERNOEMEN', id, naam: 'Hypotheek' })
    expect(next.potjes[0].naam).toBe('Hypotheek')
    expect(next.potjes[0].bucket).toBe('VASTE_LASTEN')
  })

  it('initialState has empty potjes array', () => {
    expect(initialState.potjes).toEqual([])
  })

    it('POTJE_HERNOEMEN_BY_BUCKET_EN_NAAM updates potje by bucket and name', () => {
      const state = budgetScannerReducer(initialState, {
        type: 'POTJE_TOEVOEGEN', naam: 'Boodschappen', bucket: 'LEEFGELD',
      })
      const next = budgetScannerReducer(state, {
        type: 'POTJE_HERNOEMEN_BY_BUCKET_EN_NAAM',
        bucket: 'LEEFGELD',
        oudeNaam: 'Boodschappen',
        nieuweNaam: 'Groceries',
      })
      expect(next.potjes[0].naam).toBe('Groceries')
      expect(next.potjes[0].bucket).toBe('LEEFGELD')
    })

    it('POTJE_HERNOEMEN_BY_BUCKET_EN_NAAM does not update other potjes', () => {
      let state = budgetScannerReducer(initialState, {
        type: 'POTJE_TOEVOEGEN', naam: 'Boodschappen', bucket: 'LEEFGELD',
      })
      state = budgetScannerReducer(state, {
        type: 'POTJE_TOEVOEGEN', naam: 'Huur', bucket: 'VASTE_LASTEN',
      })
      const next = budgetScannerReducer(state, {
        type: 'POTJE_HERNOEMEN_BY_BUCKET_EN_NAAM',
        bucket: 'LEEFGELD',
        oudeNaam: 'Boodschappen',
        nieuweNaam: 'Groceries',
      })
      expect(next.potjes[0].naam).toBe('Groceries')
      expect(next.potjes[1].naam).toBe('Huur')
    })
})

describe('CATEGORIE_WIJZIGEN with potje', () => {
  it('writes potje onto updated transactions', () => {
    const state: BudgetScannerState = { ...initialState, transacties: [makeTx()] }
    const next = budgetScannerReducer(state, {
      type: 'CATEGORIE_WIJZIGEN',
      transactieIds: ['tx-1'],
      bucket: 'LEEFGELD',
      potje: 'Boodschappen',
    })
    expect(next.transacties[0].potje).toBe('Boodschappen')
    expect(next.transacties[0].bucket).toBe('LEEFGELD')
    expect(next.transacties[0].isHandmatig).toBe(true)
  })

  it('writes null potje when passed null', () => {
    const state: BudgetScannerState = {
      ...initialState,
      transacties: [makeTx({ potje: 'Huur' })],
    }
    const next = budgetScannerReducer(state, {
      type: 'CATEGORIE_WIJZIGEN',
      transactieIds: ['tx-1'],
      bucket: 'VASTE_LASTEN',
      potje: null,
    })
    expect(next.transacties[0].potje).toBeNull()
  })

  it('derives learned rule with user-chosen potje, not hardcoded overig', () => {
    const state: BudgetScannerState = { ...initialState, transacties: [makeTx()] }
    const next = budgetScannerReducer(state, {
      type: 'CATEGORIE_WIJZIGEN',
      transactieIds: ['tx-1'],
      bucket: 'LEEFGELD',
      potje: 'Boodschappen',
    })
    expect(next.learnedRules[0].potje).toBe('Boodschappen')
  })

  it('derives learned rule without potje when null passed', () => {
    const state: BudgetScannerState = { ...initialState, transacties: [makeTx()] }
    const next = budgetScannerReducer(state, {
      type: 'CATEGORIE_WIJZIGEN',
      transactieIds: ['tx-1'],
      bucket: 'LEEFGELD',
      potje: null,
    })
    expect(next.learnedRules[0].potje).toBeUndefined()
  })
})

describe('REGEL_TOEPASSEN with potje', () => {
  it('writes potje onto matched transactions', () => {
    const state: BudgetScannerState = {
      ...initialState,
      transacties: [makeTx({ tegenpartij: 'Albert Heijn', bucket: 'ONBEKEND' })],
    }
    const next = budgetScannerReducer(state, {
      type: 'REGEL_TOEPASSEN',
      regel: { tegenpartijPatroon: 'albert heijn', bucket: 'LEEFGELD', potje: 'Boodschappen' },
    })
    expect(next.transacties[0].potje).toBe('Boodschappen')
  })

  it('writes null potje when rule has none', () => {
    const state: BudgetScannerState = {
      ...initialState,
      transacties: [makeTx({ tegenpartij: 'Albert Heijn', potje: 'OldPotje' })],
    }
    const next = budgetScannerReducer(state, {
      type: 'REGEL_TOEPASSEN',
      regel: { tegenpartijPatroon: 'albert heijn', bucket: 'LEEFGELD' },
    })
    expect(next.transacties[0].potje).toBeNull()
  })
})

describe('REGELS_IMPORTEREN with potjes', () => {
  it('sets state.potjes from action payload', () => {
    const potje = { id: 'p-1', naam: 'Huur', bucket: 'VASTE_LASTEN' as const }
    const next = budgetScannerReducer(initialState, {
      type: 'REGELS_IMPORTEREN',
      userRules: [],
      learnedRules: [],
      potjes: [potje],
    })
    expect(next.potjes).toEqual([potje])
  })
})
