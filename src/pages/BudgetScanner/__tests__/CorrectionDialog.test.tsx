import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CorrectionDialog } from '../components/CorrectionDialog'
import type { CategorizedTransaction, Potje } from '../types'

const tx = (id: string): CategorizedTransaction => ({
  id,
  datum: '2023-06-15',
  bedrag: -25.00,
  omschrijving: '',
  tegenrekening: null,
  tegenpartij: 'Onbekende Winkel',
  bronBestand: 'test.csv',
  bankFormat: 'ING',
  bucket: 'ONBEKEND',
  potje: null,
  isHandmatig: false,
  isDuplicaat: false,
  regelNaam: null,
})

const noPotjes: Potje[] = []
const somePotjes: Potje[] = [
  { id: 'p-1', naam: 'Huur', bucket: 'VASTE_LASTEN' },
  { id: 'p-2', naam: 'Boodschappen', bucket: 'LEEFGELD' },
]

describe('CorrectionDialog', () => {
  it('renders when open', () => {
    render(
      <CorrectionDialog open transacties={[tx('1')]} potjes={noPotjes}
        onSluiten={vi.fn()} onCorrectie={vi.fn()} onPotjeToevoegen={vi.fn()} />,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <CorrectionDialog open={false} transacties={[tx('1')]} potjes={noPotjes}
        onSluiten={vi.fn()} onCorrectie={vi.fn()} onPotjeToevoegen={vi.fn()} />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows all four assignable bucket options', () => {
    render(
      <CorrectionDialog open transacties={[tx('1')]} potjes={noPotjes}
        onSluiten={vi.fn()} onCorrectie={vi.fn()} onPotjeToevoegen={vi.fn()} />,
    )
    expect(screen.getByRole('radio', { name: /inkomsten/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^leefgeld$/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /vaste lasten/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /sparen/i })).toBeInTheDocument()
  })

  it('calls onCorrectie with bucket and null potje when no potje selected', () => {
    const onCorrectie = vi.fn()
    render(
      <CorrectionDialog open transacties={[tx('1')]} potjes={noPotjes}
        onSluiten={vi.fn()} onCorrectie={onCorrectie} onPotjeToevoegen={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /inkomsten/i }))
    fireEvent.click(screen.getByRole('button', { name: /opslaan/i }))
    expect(onCorrectie).toHaveBeenCalledWith(['1'], 'INKOMEN', null, undefined)
  })

  it('calls onSluiten when cancel is clicked', () => {
    const onSluiten = vi.fn()
    render(
      <CorrectionDialog open transacties={[tx('1')]} potjes={noPotjes}
        onSluiten={onSluiten} onCorrectie={vi.fn()} onPotjeToevoegen={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /annuleren/i }))
    expect(onSluiten).toHaveBeenCalled()
  })

  it('shows potje dropdown for non-ONBEKEND bucket', () => {
    render(
      <CorrectionDialog open transacties={[tx('1')]} potjes={somePotjes}
        onSluiten={vi.fn()} onCorrectie={vi.fn()} onPotjeToevoegen={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /vaste lasten/i }))
    expect(screen.getByRole('combobox', { name: /^potje$/i })).toBeInTheDocument()
  })

  it('filters potje dropdown to selected bucket', () => {
    render(
      <CorrectionDialog open transacties={[tx('1')]} potjes={somePotjes}
        onSluiten={vi.fn()} onCorrectie={vi.fn()} onPotjeToevoegen={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /vaste lasten/i }))
    const input = screen.getByRole('combobox', { name: /^potje$/i })
    fireEvent.mouseDown(input)
    expect(screen.getByText('Huur')).toBeInTheDocument()
    expect(screen.queryByText('Boodschappen')).not.toBeInTheDocument()
  })

  it('shows helper text for filtering and adding potjes', () => {
    render(
      <CorrectionDialog open transacties={[tx('1')]} potjes={noPotjes}
        onSluiten={vi.fn()} onCorrectie={vi.fn()} onPotjeToevoegen={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /^leefgeld$/i }))
    expect(screen.getByText(/typ om te filteren of voeg een nieuw potje toe/i)).toBeInTheDocument()
  })

  it('uses current category as default when available', () => {
    const categorizedTx: CategorizedTransaction = { ...tx('1'), bucket: 'VASTE_LASTEN' }
    render(
      <CorrectionDialog open transacties={[categorizedTx]} potjes={somePotjes}
        onSluiten={vi.fn()} onCorrectie={vi.fn()} onPotjeToevoegen={vi.fn()} />,
    )
    expect(screen.getByRole('radio', { name: /vaste lasten/i })).toBeChecked()
  })

  it('adds a new potje when entered name does not exist', () => {
    const onPotjeToevoegen = vi.fn()
    const onCorrectie = vi.fn()
    render(
      <CorrectionDialog open transacties={[{ ...tx('1'), bucket: 'LEEFGELD' }]} potjes={somePotjes}
        onSluiten={vi.fn()} onCorrectie={onCorrectie} onPotjeToevoegen={onPotjeToevoegen} />,
    )
    fireEvent.change(screen.getByRole('combobox', { name: /^potje$/i }), { target: { value: 'Nieuw Potje' } })
    fireEvent.click(screen.getByRole('button', { name: /opslaan/i }))
    expect(onPotjeToevoegen).toHaveBeenCalledWith('Nieuw Potje', 'LEEFGELD')
    expect(onCorrectie).toHaveBeenCalledWith(['1'], 'LEEFGELD', 'Nieuw Potje', undefined)
  })

  it('pressing Enter in the open dialog saves and closes', () => {
    const onCorrectie = vi.fn()
    const onSluiten = vi.fn()
    render(
      <CorrectionDialog open transacties={[tx('1')]} potjes={noPotjes}
        onSluiten={onSluiten} onCorrectie={onCorrectie} onPotjeToevoegen={vi.fn()} />,
    )

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter', code: 'Enter' })

    expect(onCorrectie).toHaveBeenCalledWith(['1'], 'LEEFGELD', null, undefined)
    expect(onSluiten).toHaveBeenCalled()
  })

  it('shows Leefgeld zonder regel as radio option on the Leefgeld row', () => {
    render(
      <CorrectionDialog open transacties={[tx('1')]} potjes={noPotjes}
        onSluiten={vi.fn()} onCorrectie={vi.fn()} onPotjeToevoegen={vi.fn()} />,
    )
    expect(screen.getByRole('radio', { name: /^leefgeld$/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /leefgeld zonder regel/i })).toBeInTheDocument()
  })

  it('passes zonderRegel=true when Leefgeld zonder regel is selected', () => {
    const onCorrectie = vi.fn()
    render(
      <CorrectionDialog open transacties={[tx('1')]} potjes={noPotjes}
        onSluiten={vi.fn()} onCorrectie={onCorrectie} onPotjeToevoegen={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /leefgeld zonder regel/i }))
    fireEvent.click(screen.getByRole('button', { name: /opslaan/i }))
    expect(onCorrectie).toHaveBeenCalledWith(['1'], 'LEEFGELD', null, undefined, true)
  })

  it('uses Negeren as potjesnaam when Negeren is selected', () => {
    const onCorrectie = vi.fn()
    render(
      <CorrectionDialog open transacties={[{ ...tx('1'), bucket: 'LEEFGELD', potje: 'Boodschappen' }]} potjes={somePotjes}
        onSluiten={vi.fn()} onCorrectie={onCorrectie} onPotjeToevoegen={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /negeren/i }))
    fireEvent.click(screen.getByRole('button', { name: /opslaan/i }))
    expect(onCorrectie).toHaveBeenCalledWith(['1'], 'NEGEREN', 'Negeren', undefined)
  })
})
