import { describe, it, expect } from 'vitest'
import { applyRules } from '../categorize/ruleEngine'
import type { ParsedTransaction, UserRule } from '../types'

const makeTx = (overrides: Partial<ParsedTransaction> = {}): ParsedTransaction => ({
  id: 'tx-1',
  datum: '2023-06-15',
  bedrag: -25.00,
  omschrijving: '',
  tegenrekening: null,
  tegenpartij: 'Unknown Party',
  bronBestand: 'test.csv',
  bankFormat: 'ING',
  ...overrides,
})

describe('applyRules', () => {
  it('leaves unmatched transactions as ONBEKEND', () => {
    const result = applyRules([makeTx({ tegenpartij: 'Onbekende Partij BV' })], [])
    expect(result[0].bucket).toBe('ONBEKEND')
    expect(result[0].regelNaam).toBeNull()
  })

  it('applies user rule to matching transaction', () => {
    const userRule: UserRule = { tegenpartijPatroon: 'albert heijn', bucket: 'LEEFGELD' }
    const result = applyRules([makeTx({ tegenpartij: 'Albert Heijn' })], [userRule])
    expect(result[0].bucket).toBe('LEEFGELD')
    expect(result[0].isHandmatig).toBe(false)
  })

  it('matching is case-insensitive', () => {
    const userRule: UserRule = { tegenpartijPatroon: 'albert heijn', bucket: 'LEEFGELD' }
    const result = applyRules([makeTx({ tegenpartij: 'ALBERT HEIJN 1234' })], [userRule])
    expect(result[0].bucket).toBe('LEEFGELD')
  })

  it('supports wildcard at start of tegenpartijPatroon', () => {
    const userRule: UserRule = { tegenpartijPatroon: '*philips', bucket: 'VASTE_LASTEN' }
    const result = applyRules([makeTx({ tegenpartij: 'Stichting Philips' })], [userRule])
    expect(result[0].bucket).toBe('VASTE_LASTEN')
  })

  it('supports wildcard in the middle of tegenpartijPatroon', () => {
    const userRule: UserRule = { tegenpartijPatroon: 'asn*sparen', bucket: 'SPAREN' }
    const result = applyRules([
      makeTx({ id: 'tx-1', tegenpartij: 'ASN Sparen' }),
      makeTx({ id: 'tx-2', tegenpartij: 'ASN Ideaalsparen' }),
    ], [userRule])
    expect(result[0].bucket).toBe('SPAREN')
    expect(result[1].bucket).toBe('SPAREN')
  })

  it('omschrijving pattern matches substring anywhere (without wildcards)', () => {
    const userRule: UserRule = { tegenpartijPatroon: 'betaalautomaat', bucket: 'LEEFGELD', omschrijvingPatroon: 'ahold' }
    const result = applyRules([
      makeTx({ omschrijving: 'AHOLD BETAALD' }),
      makeTx({ omschrijving: 'DEF AHOLD BETALING' }),
    ], [userRule])
    expect(result[0].bucket).toBe('LEEFGELD')
    expect(result[1].bucket).toBe('LEEFGELD')
  })

  it('omschrijving pattern with wildcard still works', () => {
    const userRule: UserRule = { tegenpartijPatroon: 'generiek', bucket: 'VASTE_LASTEN', omschrijvingPatroon: 'internet*factuur' }
    const result = applyRules([
      makeTx({ tegenpartij: 'Generiek', omschrijving: 'Internet Monthly Factuur' }),
    ], [userRule])
    expect(result[0].bucket).toBe('VASTE_LASTEN')
  })

  it('sets regelNaam for matched transactions', () => {
    const userRule: UserRule = { tegenpartijPatroon: 'jumbo', bucket: 'LEEFGELD' }
    const result = applyRules([makeTx({ tegenpartij: 'Jumbo Supermarkt' })], [userRule])
    expect(result[0].regelNaam).toBe('regel: jumbo')
  })

  it('sets isHandmatig to false for rule-matched transactions', () => {
    const userRule: UserRule = { tegenpartijPatroon: 'jumbo', bucket: 'LEEFGELD' }
    const result = applyRules([makeTx({ tegenpartij: 'Jumbo Supermarkt' })], [userRule])
    expect(result[0].isHandmatig).toBe(false)
  })

  it('processes multiple transactions independently', () => {
    const rules: UserRule[] = [
      { tegenpartijPatroon: 'albert heijn', bucket: 'LEEFGELD' },
      { tegenpartijPatroon: 'ziggo', bucket: 'VASTE_LASTEN' },
    ]
    const txs = [
      makeTx({ id: 'tx-1', tegenpartij: 'Albert Heijn' }),
      makeTx({ id: 'tx-2', tegenpartij: 'Ziggo' }),
      makeTx({ id: 'tx-3', tegenpartij: 'Onbekend' }),
    ]
    const result = applyRules(txs, rules)
    expect(result[0].bucket).toBe('LEEFGELD')
    expect(result[1].bucket).toBe('VASTE_LASTEN')
    expect(result[2].bucket).toBe('ONBEKEND')
  })

  // --- Direction-aware matching ---
  it('direction-specific credit rule matches credit transaction', () => {
    const rules: UserRule[] = [
      { tegenpartijPatroon: 'belastingdienst', richting: 'credit', bucket: 'INKOMEN' },
      { tegenpartijPatroon: 'belastingdienst', richting: 'debit', bucket: 'VASTE_LASTEN' },
    ]
    const result = applyRules([makeTx({ tegenpartij: 'Belastingdienst', bedrag: 300 })], rules)
    expect(result[0].bucket).toBe('INKOMEN')
  })

  it('direction-specific debit rule matches debit transaction', () => {
    const rules: UserRule[] = [
      { tegenpartijPatroon: 'belastingdienst', richting: 'credit', bucket: 'INKOMEN' },
      { tegenpartijPatroon: 'belastingdienst', richting: 'debit', bucket: 'VASTE_LASTEN' },
    ]
    const result = applyRules([makeTx({ tegenpartij: 'Belastingdienst', bedrag: -300 })], rules)
    expect(result[0].bucket).toBe('VASTE_LASTEN')
  })

  it('zero-amount transaction matches directionless rule', () => {
    const userRule: UserRule = { tegenpartijPatroon: 'albert heijn', bucket: 'LEEFGELD' }
    const result = applyRules([makeTx({ tegenpartij: 'Albert Heijn', bedrag: 0 })], [userRule])
    expect(result[0].bucket).toBe('LEEFGELD')
  })

  // --- Omschrijving fallback (only for generic tegenpartij) ---
  it('matches on omschrijving when tegenpartij is generic', () => {
    const userRule: UserRule = { tegenpartijPatroon: 'albert heijn', bucket: 'LEEFGELD' }
    const result = applyRules([makeTx({
      tegenpartij: 'Betaalautomaat',
      omschrijving: 'Albert Heijn filiaal 1234',
      bedrag: -15,
    })], [userRule])
    expect(result[0].bucket).toBe('LEEFGELD')
  })

  it('does NOT match on omschrijving when tegenpartij is specific', () => {
    const result = applyRules([makeTx({
      tegenpartij: 'Bakker Jan',
      omschrijving: 'Albert Heijn korting',
      bedrag: -15,
    })], [])
    expect(result[0].bucket).toBe('ONBEKEND')
  })

  it('matches on omschrijving when tegenpartij is empty', () => {
    const userRule: UserRule = { tegenpartijPatroon: 'ziggo', bucket: 'VASTE_LASTEN' }
    const result = applyRules([makeTx({
      tegenpartij: '',
      omschrijving: 'Ziggo internet factuur',
      bedrag: -49,
    })], [userRule])
    expect(result[0].bucket).toBe('VASTE_LASTEN')
  })

  // --- Priority cascade: tegenpartij beats omschrijving ---
  it('tegenpartij match beats omschrijving match from another user rule', () => {
    const omschrijvingRule: UserRule = { tegenpartijPatroon: 'albert heijn', bucket: 'SPAREN', omschrijvingPatroon: 'iets' }
    const tegenpartijRule: UserRule = { tegenpartijPatroon: 'jumbo', bucket: 'LEEFGELD' }
    const result = applyRules([makeTx({
      tegenpartij: 'Jumbo Supermarkt',
      omschrijving: 'iets',
      bedrag: -20,
    })], [omschrijvingRule, tegenpartijRule])
    expect(result[0].bucket).toBe('LEEFGELD')
  })

  // --- Learned rules priority ---
  it('learned rules apply when no user rule matches', () => {
    const learned: UserRule = { tegenpartijPatroon: 'jumbo', bucket: 'SPAREN' }
    const result = applyRules(
      [makeTx({ tegenpartij: 'Jumbo Supermarkt', bedrag: -20 })],
      [],
      [learned],
    )
    expect(result[0].bucket).toBe('SPAREN')
    expect(result[0].regelNaam).toBe('geleerd: jumbo')
  })

  it('user rules have higher priority than learned rules', () => {
    const userRule: UserRule = { tegenpartijPatroon: 'jumbo', bucket: 'VASTE_LASTEN' }
    const learnedRule: UserRule = { tegenpartijPatroon: 'jumbo', bucket: 'SPAREN' }
    const result = applyRules(
      [makeTx({ tegenpartij: 'Jumbo', bedrag: -20 })],
      [userRule],
      [learnedRule],
    )
    expect(result[0].bucket).toBe('VASTE_LASTEN')
    expect(result[0].regelNaam).toBe('regel: jumbo')
  })

  // --- Direction-specific beats directionless within same tier ---
  it('direction-specific user rule beats directionless user rule for matching direction', () => {
    const directionless: UserRule = { tegenpartijPatroon: 'foo', bucket: 'LEEFGELD' }
    const directional: UserRule = { tegenpartijPatroon: 'foo', richting: 'debit', bucket: 'VASTE_LASTEN' }
    const result = applyRules([makeTx({ tegenpartij: 'Foo BV', bedrag: -50 })], [directionless, directional])
    expect(result[0].bucket).toBe('VASTE_LASTEN')
  })

  // --- bedrag === 0 matches direction-specific rules ---
  it('bedrag === 0 matches a direction-specific rule', () => {
    const rule: UserRule = { tegenpartijPatroon: 'test', richting: 'debit', bucket: 'VASTE_LASTEN' }
    const result = applyRules([makeTx({ tegenpartij: 'Test BV', bedrag: 0 })], [rule])
    expect(result[0].bucket).toBe('VASTE_LASTEN')
  })

  // --- Backward compat ---
  it('learnedRules defaults to empty array (two-arg call still works)', () => {
    const result = applyRules([makeTx({ tegenpartij: 'Onbekende Partij' })], [])
    expect(result[0].bucket).toBe('ONBEKEND')
  })

  // --- regelNaam for user rules ---
  it('regelNaam is prefixed for user rules', () => {
    const userRule: UserRule = { tegenpartijPatroon: 'albert heijn', bucket: 'SPAREN' }
    const result = applyRules([makeTx({ tegenpartij: 'Albert Heijn' })], [userRule])
    expect(result[0].regelNaam).toBe('regel: albert heijn')
  })
})
