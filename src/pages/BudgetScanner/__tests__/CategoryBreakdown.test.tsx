import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CategoryBreakdown } from '../components/CategoryBreakdown'
import type { CategorizedTransaction, UserRule } from '../types'

const tx = (id: string, tegenpartij: string): CategorizedTransaction => ({
  id,
  datum: '2025-01-15',
  bedrag: -12.34,
  omschrijving: 'Abonnement',
  tegenrekening: null,
  tegenpartij,
  bronBestand: 'ing.csv',
  bankFormat: 'ING',
  bucket: 'ONBEKEND',
  potje: null,
  isHandmatig: false,
  regelNaam: null,
  isDuplicaat: false,
})

describe('CategoryBreakdown', () => {
  const kiesBewerking = (waarde: RegExp) => {
    const bewerkingInput = screen.getByLabelText(/bewerking/i)
    fireEvent.mouseDown(bewerkingInput)
    fireEvent.click(screen.getByRole('option', { name: waarde }))
  }

  it('groups transactions together when one tegenpartij has a payment prefix and both match the same Jumbo rule', () => {
    render(
      <CategoryBreakdown
        transacties={[
          { ...tx('t-1', 'BCK*Jumbo Deventer >DEVENTER 2.01.'), bucket: 'LEEFGELD' },
          { ...tx('t-2', 'Jumbo Binnend Twel>TWELLO'), bucket: 'LEEFGELD' },
        ]}
        potjes={[]}
        userRules={[{ tegenpartijPatroon: 'jumbo', bucket: 'LEEFGELD' }]}
        learnedRules={[]}
        onCorrectie={vi.fn()}
        onPotjeToevoegen={vi.fn()}
      />,
    )

    expect(screen.getByText('2×')).toBeInTheDocument()
  })

  it('passes edited group name as groepCriterium when saving from a single row inside a group', () => {
    const onCorrectie = vi.fn()
    const learnedRules: UserRule[] = [
      {
        tegenpartijPatroon: 'Netflix',
        bucket: 'LEEFGELD',
      },
    ]

    render(
      <CategoryBreakdown
        transacties={[
          tx('t-1', 'Netflix Amsterdam'),
          tx('t-2', 'Netflix BV'),
        ]}
        potjes={[]}
        userRules={[]}
        learnedRules={learnedRules}
        onCorrectie={onCorrectie}
        onPotjeToevoegen={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText(/netflix/i))
    fireEvent.click(screen.getByRole('button', { name: /categorie wijzigen voor netflix amsterdam/i }))

    const groepNaamInput = screen.getByLabelText(/groepsnaam/i)
    fireEvent.change(groepNaamInput, { target: { value: 'Netflix Gezinsabonnement' } })
    fireEvent.click(screen.getByRole('button', { name: /opslaan/i }))

    expect(onCorrectie).toHaveBeenCalledWith(
      ['t-1'],
      'LEEFGELD',
      null,
      'Netflix Gezinsabonnement',
    )
  })

  it('defaults to samenvoegen and enables one-time linking only after groups are selected', () => {
    render(
      <CategoryBreakdown
        transacties={[
          tx('t-1', 'Albert Heijn'),
          { ...tx('t-2', 'Jumbo'), bedrag: 25.5 },
        ]}
        potjes={[]}
        userRules={[]}
        learnedRules={[]}
        onCorrectie={vi.fn()}
        onPotjeToevoegen={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: /onbekend/i }))

  expect(screen.getByRole('checkbox', { name: /alle zichtbare groepen/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /samenvoegen \(0\)/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /toewijzen zonder regel/i })).not.toBeInTheDocument()

    kiesBewerking(/toewijzen zonder regel/i)

    expect(screen.getByRole('checkbox', { name: /alle zichtbare groepen/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /toewijzen zonder regel \(0\)/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: /alle zichtbare groepen/i }))
    expect(screen.getByRole('button', { name: /toewijzen zonder regel \(2\)/i })).toBeEnabled()
  })

  it('allows selecting toewijzen zonder regel outside the onbekend tab', () => {
    render(
      <CategoryBreakdown
        transacties={[
          { ...tx('t-1', 'Werkgever'), bucket: 'INKOMEN', bedrag: 2500 },
        ]}
        potjes={[]}
        userRules={[]}
        learnedRules={[]}
        onCorrectie={vi.fn()}
        onPotjeToevoegen={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: /inkomsten/i }))
    kiesBewerking(/toewijzen zonder regel/i)

    expect(screen.getByRole('checkbox', { name: /alle zichtbare groepen/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /toewijzen zonder regel \(0\)/i })).toBeDisabled()
  })

  it('warns when selected groups contain already linked transactions and allows continue or cancel', async () => {
    render(
      <CategoryBreakdown
        transacties={[
          tx('t-1', 'Albert Heijn'),
          { ...tx('t-2', 'Werkgever'), bucket: 'INKOMEN', bedrag: 2500, potje: 'Salaris' },
        ]}
        potjes={[]}
        userRules={[]}
        learnedRules={[]}
        onCorrectie={vi.fn()}
        onPotjeToevoegen={vi.fn()}
      />,
    )

    kiesBewerking(/toewijzen zonder regel/i)
    fireEvent.click(screen.getByRole('checkbox', { name: /alle zichtbare groepen/i }))
    fireEvent.click(screen.getByRole('button', { name: /toewijzen zonder regel \(2\)/i }))

    expect(screen.getByText(/er zitten al gekoppelde transacties in je selectie/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /doorgaan/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /annuleren/i })).toBeInTheDocument()

    const gekoppeldeRij = screen.getAllByText(/werkgever/i)[1].closest('tr')
    expect(gekoppeldeRij).toHaveClass('bg-yellow-50')

    fireEvent.click(screen.getAllByRole('button', { name: /^annuleren$/i }).at(-1) as HTMLElement)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /waarschuwing bij toewijzen zonder regel/i })).not.toBeInTheDocument()
    })
  })

  it('applies one-time linking to all selected transactions after warning confirmation', () => {
    const onCorrectie = vi.fn()

    render(
      <CategoryBreakdown
        transacties={[
          tx('t-1', 'Albert Heijn'),
          { ...tx('t-2', 'Werkgever'), bucket: 'INKOMEN', bedrag: 2500, potje: 'Salaris' },
        ]}
        potjes={[]}
        userRules={[]}
        learnedRules={[]}
        onCorrectie={onCorrectie}
        onPotjeToevoegen={vi.fn()}
      />,
    )

    kiesBewerking(/toewijzen zonder regel/i)
    fireEvent.click(screen.getByRole('checkbox', { name: /alle zichtbare groepen/i }))
    fireEvent.click(screen.getByRole('button', { name: /toewijzen zonder regel \(2\)/i }))
    fireEvent.click(screen.getByRole('button', { name: /doorgaan/i }))

    expect(screen.getByText(/deze koppeling geldt alleen voor de geselecteerde transacties/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /opslaan/i }))

    expect(onCorrectie).toHaveBeenCalledWith(
      ['t-1', 't-2'],
      'LEEFGELD',
      null,
      undefined,
      true,
    )
  })

  it('supports wildcard in tegenpartij filter', () => {
    render(
      <CategoryBreakdown
        transacties={[
          tx('t-1', 'Stichting Philips'),
          tx('t-2', 'ASN Ideaalsparen'),
          tx('t-3', 'Jumbo Deventer'),
        ]}
        potjes={[]}
        userRules={[]}
        learnedRules={[]}
        onCorrectie={vi.fn()}
        onPotjeToevoegen={vi.fn()}
      />,
    )

    kiesBewerking(/samenvoegen/i)

    const filterInput = screen.getByRole('textbox', { name: /zoeken/i })

    fireEvent.change(filterInput, { target: { value: '*philips' } })
    expect(screen.getByText(/stichting philips/i)).toBeInTheDocument()
    expect(screen.queryByText(/asn ideaalsparen/i)).not.toBeInTheDocument()

    fireEvent.change(filterInput, { target: { value: 'asn*sparen' } })
    expect(screen.getByText(/asn ideaalsparen/i)).toBeInTheDocument()
    expect(screen.queryByText(/stichting philips/i)).not.toBeInTheDocument()
  })

  it('uses the entered tegenpartij filter as merged group name', () => {
    render(
      <CategoryBreakdown
        transacties={[
          tx('t-1', 'ASN Sparen'),
          tx('t-2', 'ASN Ideaalsparen'),
        ]}
        potjes={[]}
        userRules={[]}
        learnedRules={[]}
        onCorrectie={vi.fn()}
        onPotjeToevoegen={vi.fn()}
      />,
    )

    kiesBewerking(/samenvoegen/i)

    const filterInput = screen.getByRole('textbox', { name: /zoeken/i })
    fireEvent.change(filterInput, { target: { value: 'asn*sparen' } })

    fireEvent.click(screen.getByRole('checkbox', { name: /alle zichtbare groepen/i }))
    fireEvent.click(screen.getByRole('button', { name: /samenvoegen \(2\)/i }))

    expect(screen.getByText('asn*sparen')).toBeInTheDocument()
  })

  it('shows merge controls by default and hides them outside samenvoegen mode', () => {
    render(
      <CategoryBreakdown
        transacties={[
          tx('t-1', 'ASN Sparen'),
          tx('t-2', 'ASN Ideaalsparen'),
        ]}
        potjes={[]}
        userRules={[]}
        learnedRules={[]}
        onCorrectie={vi.fn()}
        onPotjeToevoegen={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: /alle zichtbare groepen/i }))

    expect(screen.getByRole('textbox', { name: /zoeken/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /samenvoegen \(2\)/i })).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox', { name: /zoeken/i }), { target: { value: 'asn' } })
    expect(screen.getByRole('button', { name: /samenvoegen \(2\)/i })).toBeEnabled()

    kiesBewerking(/toewijzen zonder regel/i)

    expect(screen.queryByRole('textbox', { name: /zoeken/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /samenvoegen \(/i })).not.toBeInTheDocument()
  })

  it('filters groups by minimum and maximum number of transactions', () => {
    render(
      <CategoryBreakdown
        transacties={[
          tx('t-1', 'Albert Heijn'),
          tx('t-2', 'Jumbo'),
          tx('t-3', 'Jumbo'),
          tx('t-4', 'Jumbo'),
        ]}
        potjes={[]}
        userRules={[]}
        learnedRules={[]}
        onCorrectie={vi.fn()}
        onPotjeToevoegen={vi.fn()}
      />,
    )

    const minInput = screen.getByLabelText(/min transacties/i)
    const maxInput = screen.getByLabelText(/max transacties/i)

    fireEvent.change(minInput, { target: { value: '2' } })
    expect(screen.queryByText(/albert heijn/i)).not.toBeInTheDocument()
    expect(screen.getByText(/jumbo/i)).toBeInTheDocument()

    fireEvent.change(minInput, { target: { value: '0' } })
    fireEvent.change(maxInput, { target: { value: '1' } })
    expect(screen.getByText(/albert heijn/i)).toBeInTheDocument()
    expect(screen.queryByText(/jumbo/i)).not.toBeInTheDocument()
  })

  it('filters transactions by datum van/tot inclusively', () => {
    render(
      <CategoryBreakdown
        transacties={[
          { ...tx('t-1', 'Albert Heijn'), datum: '2025-01-10' },
          { ...tx('t-2', 'Jumbo'), datum: '2025-01-15' },
          { ...tx('t-3', 'Netflix'), datum: '2025-01-20' },
        ]}
        potjes={[]}
        userRules={[]}
        learnedRules={[]}
        onCorrectie={vi.fn()}
        onPotjeToevoegen={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText(/datum van/i), { target: { value: '2025-01-15' } })
    fireEvent.change(screen.getByLabelText(/datum tot/i), { target: { value: '2025-01-20' } })

    expect(screen.queryByText(/albert heijn/i)).not.toBeInTheDocument()
    expect(screen.getByText(/jumbo/i)).toBeInTheDocument()
    expect(screen.getByText(/netflix/i)).toBeInTheDocument()
  })

  it('sorts groups by selected sort option', () => {
    render(
      <CategoryBreakdown
        transacties={[
          tx('t-1', 'Albert Heijn'),
          tx('t-2', 'Jumbo'),
          tx('t-3', 'Jumbo'),
          tx('t-4', 'Jumbo'),
        ]}
        potjes={[]}
        userRules={[]}
        learnedRules={[]}
        onCorrectie={vi.fn()}
        onPotjeToevoegen={vi.fn()}
      />,
    )

    const sortInput = screen.getByLabelText(/sorteer op/i)
    fireEvent.mouseDown(sortInput)
    fireEvent.click(screen.getByRole('option', { name: /aantal transacties/i }))

    const rijTeksten = screen.getAllByText(/albert heijn|jumbo/i)
      .map((el) => el.textContent ?? '')

    expect(rijTeksten[0]).toMatch(/jumbo/i)

    fireEvent.mouseDown(sortInput)
    fireEvent.click(screen.getByRole('option', { name: /aantal transacties/i }))

    fireEvent.mouseDown(sortInput)
    expect(screen.getByRole('option', { name: /aantal transacties/i })).toBeInTheDocument()
    fireEvent.click(document.body)

    const rijTekstenAsc = screen.getAllByText(/albert heijn|jumbo/i)
      .map((el) => el.textContent ?? '')

    expect(rijTekstenAsc[0]).toMatch(/albert heijn/i)
  })
})
