import { describe, it, expect } from 'vitest'
import { buildOverzichtJson, buildRulesJson, importRules } from '../export/exportRules'
import type { UserRule, Potje, CategorizedTransaction } from '../types'

describe('buildRulesJson', () => {
  it('includes versie: 1', () => {
    const result = JSON.parse(buildRulesJson([], [], []))
    expect(result.versie).toBe(1)
  })

  it('tags user rules with bron: user', () => {
    const userRule: UserRule = { tegenpartijPatroon: 'albert heijn', bucket: 'LEEFGELD' }
    const result = JSON.parse(buildRulesJson([userRule], [], []))
    expect(result.regels[0].bron).toBe('user')
  })

  it('tags learned rules with bron: learned', () => {
    const learned: UserRule = { tegenpartijPatroon: 'ziggo', richting: 'debit', bucket: 'VASTE_LASTEN' }
    const result = JSON.parse(buildRulesJson([], [learned], []))
    expect(result.regels[0].bron).toBe('learned')
  })

  it('includes all rule fields including null omschrijvingPatroon', () => {
    const rule: UserRule = { tegenpartijPatroon: 'test', bucket: 'SPAREN' }
    const result = JSON.parse(buildRulesJson([rule], [], []))
    expect(result.regels[0]).toMatchObject({
      tegenpartijPatroon: 'test',
      omschrijvingPatroon: null,
      richting: null,
      bucket: 'SPAREN',
      potje: null,
      bron: 'user',
    })
  })

  it('round-trip: export then import preserves rule tiers', () => {
    const userRules: UserRule[] = [{ tegenpartijPatroon: 'ah', bucket: 'LEEFGELD' }]
    const learnedRules: UserRule[] = [{ tegenpartijPatroon: 'ziggo', richting: 'debit', bucket: 'VASTE_LASTEN' }]
    const json = buildRulesJson(userRules, learnedRules, [])
    const imported = importRules(json)
    expect(imported.userRules).toHaveLength(1)
    expect(imported.userRules[0].tegenpartijPatroon).toBe('ah')
    expect(imported.learnedRules).toHaveLength(1)
    expect(imported.learnedRules[0].tegenpartijPatroon).toBe('ziggo')
  })
})

describe('importRules', () => {
  it('throws on malformed JSON', () => {
    expect(() => importRules('not json')).toThrow()
  })

  it('throws on versie > 1', () => {
    const json = JSON.stringify({ versie: 3, regels: [] })
    expect(() => importRules(json)).toThrow('nieuwere versie')
  })

  it('throws when versie field is missing', () => {
    const json = JSON.stringify({ regels: [] })
    expect(() => importRules(json)).toThrow()
  })

  it('defaults missing bron to userRules', () => {
    const json = JSON.stringify({
      versie: 1,
      regels: [{ tegenpartijPatroon: 'test', bucket: 'SPAREN' }],
    })
    const result = importRules(json)
    expect(result.userRules).toHaveLength(1)
    expect(result.learnedRules).toHaveLength(0)
  })

  it('splits rules into userRules and learnedRules by bron', () => {
    const json = JSON.stringify({
      versie: 1,
      regels: [
        { tegenpartijPatroon: 'ah', bucket: 'LEEFGELD', bron: 'user' },
        { tegenpartijPatroon: 'ziggo', bucket: 'VASTE_LASTEN', bron: 'learned' },
      ],
    })
    const result = importRules(json)
    expect(result.userRules).toHaveLength(1)
    expect(result.learnedRules).toHaveLength(1)
  })
})

describe('potjes round-trip', () => {
  it('round-trip preserves potjes array', () => {
    const potje: Potje = { id: 'p-1', naam: 'Huur', bucket: 'VASTE_LASTEN' }
    const json = buildRulesJson([], [], [potje])
    const result = importRules(json)
    expect(result.potjes).toEqual([potje])
  })

  it('missing potjes field defaults to empty array on import', () => {
    const json = JSON.stringify({ versie: 1, regels: [] })
    const result = importRules(json)
    expect(result.potjes).toEqual([])
  })

  it('includes versie:1 when potjes present', () => {
    const result = JSON.parse(buildRulesJson([], [], [{ id: 'p-1', naam: 'Test', bucket: 'SPAREN' }]))
    expect(result.versie).toBe(1)
  })
})

describe('snapshot round-trip', () => {
  it('imports v2 transacties from overzichtbestand', () => {
    const tx: CategorizedTransaction = {
      id: 't-1',
      datum: '2025-01-15',
      bedrag: -12.34,
      omschrijving: 'Boodschappen',
      tegenrekening: null,
      tegenpartij: 'Albert Heijn',
      bronBestand: 'ing.csv',
      bankFormat: 'ING',
      bucket: 'LEEFGELD',
      potje: 'Boodschappen',
      isHandmatig: true,
      regelNaam: null,
      isDuplicaat: false,
    }
    const json = buildOverzichtJson([tx], [], [], [])
    const result = importRules(json)
    expect(result.transacties).toHaveLength(1)
    expect(result.transacties[0].id).toBe('t-1')
  })
})
