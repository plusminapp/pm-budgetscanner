import { describe, it, expect } from 'vitest'
import { applyRecurrenceDetection } from '../categorize/recurrenceDetector'
import type { CategorizedTransaction } from '../types'

const makeTx = (
  id: string,
  datum: string,
  bedrag: number,
  tegenpartij: string,
): CategorizedTransaction => ({
  id,
  datum,
  bedrag,
  omschrijving: '',
  tegenrekening: null,
  tegenpartij,
  bronBestand: 'test.csv',
  bankFormat: 'ING',
  bucket: 'ONBEKEND',
  potje: null,
  isHandmatig: false,
  isDuplicaat: false,
  regelNaam: null,
})

describe('applyRecurrenceDetection', () => {
  it('promotes recurring debit to VASTE_LASTEN', () => {
    const txs: CategorizedTransaction[] = [
      makeTx('1', '2023-01-05', -120.00, 'Onbekend Abonnement'),
      makeTx('2', '2023-02-05', -120.00, 'Onbekend Abonnement'),
      makeTx('3', '2023-03-05', -120.00, 'Onbekend Abonnement'),
    ]
    const result = applyRecurrenceDetection(txs)
    expect(result[0].bucket).toBe('VASTE_LASTEN')
    expect(result[1].bucket).toBe('VASTE_LASTEN')
    expect(result[2].bucket).toBe('VASTE_LASTEN')
  })

  it('promotes recurring credit to INKOMEN', () => {
    const txs: CategorizedTransaction[] = [
      makeTx('1', '2023-01-25', 1800.00, 'Onbekende Werkgever'),
      makeTx('2', '2023-02-25', 1800.00, 'Onbekende Werkgever'),
      makeTx('3', '2023-03-25', 1800.00, 'Onbekende Werkgever'),
    ]
    const result = applyRecurrenceDetection(txs)
    expect(result[0].bucket).toBe('INKOMEN')
  })

  it('does not promote with fewer than 3 occurrences', () => {
    const txs: CategorizedTransaction[] = [
      makeTx('1', '2023-01-05', -120.00, 'Zeldzame Betaling'),
      makeTx('2', '2023-02-05', -120.00, 'Zeldzame Betaling'),
    ]
    const result = applyRecurrenceDetection(txs)
    expect(result[0].bucket).toBe('ONBEKEND')
  })

  it('does not promote when intervals are too short', () => {
    const txs: CategorizedTransaction[] = [
      makeTx('1', '2023-01-05', -120.00, 'TeKortInterval'),
      makeTx('2', '2023-01-10', -120.00, 'TeKortInterval'), // 5 days — too short
      makeTx('3', '2023-02-10', -120.00, 'TeKortInterval'),
    ]
    const result = applyRecurrenceDetection(txs)
    expect(result[0].bucket).toBe('ONBEKEND')
  })

  it('does not promote when intervals are too long', () => {
    const txs: CategorizedTransaction[] = [
      makeTx('1', '2023-01-05', -120.00, 'TeLangInterval'),
      makeTx('2', '2023-02-14', -120.00, 'TeLangInterval'), // 40 days — too long
      makeTx('3', '2023-03-25', -120.00, 'TeLangInterval'), // 39 days — too long
    ]
    const result = applyRecurrenceDetection(txs)
    expect(result[0].bucket).toBe('ONBEKEND')
  })

  it('does not promote when amounts vary more than 10%', () => {
    const txs: CategorizedTransaction[] = [
      makeTx('1', '2023-01-05', -100.00, 'Variabel'),
      makeTx('2', '2023-02-05', -150.00, 'Variabel'), // 50% difference
      makeTx('3', '2023-03-05', -100.00, 'Variabel'),
    ]
    const result = applyRecurrenceDetection(txs)
    expect(result[0].bucket).toBe('ONBEKEND')
  })

  it('leaves already-categorized transactions unchanged', () => {
    const txs: CategorizedTransaction[] = [
      { ...makeTx('1', '2023-01-05', -120.00, 'Albert Heijn'), bucket: 'LEEFGELD' },
      { ...makeTx('2', '2023-02-05', -120.00, 'Albert Heijn'), bucket: 'LEEFGELD' },
      { ...makeTx('3', '2023-03-05', -120.00, 'Albert Heijn'), bucket: 'LEEFGELD' },
    ]
    const result = applyRecurrenceDetection(txs)
    expect(result[0].bucket).toBe('LEEFGELD')
  })

  it('sets regelNaam to "terugkerend" for promoted transactions', () => {
    const txs: CategorizedTransaction[] = [
      makeTx('1', '2023-01-05', -99.00, 'Terugkerende Post'),
      makeTx('2', '2023-02-05', -100.00, 'Terugkerende Post'),
      makeTx('3', '2023-03-05', -101.00, 'Terugkerende Post'),
    ]
    const result = applyRecurrenceDetection(txs)
    expect(result[0].regelNaam).toBe('terugkerend')
  })
})
