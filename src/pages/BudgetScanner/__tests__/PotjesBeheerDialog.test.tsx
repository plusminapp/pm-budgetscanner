import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PotjesBeheerDialog } from '../components/PotjesBeheerDialog'
import type { UserRule } from '../types'

const userRules: UserRule[] = [
  {
    tegenpartijPatroon: 'ah',
    omschrijvingPatroon: 'boodschappen',
    richting: 'debit',
    bucket: 'LEEFGELD',
    potje: 'Boodschappen',
  },
]

const learnedRules: UserRule[] = [
  {
    tegenpartijPatroon: 'salaris',
    richting: 'credit',
    bucket: 'INKOMEN',
  },
]

describe('PotjesBeheerDialog', () => {
  it('renders grouped regels', () => {
    render(
      <PotjesBeheerDialog open userRules={userRules} learnedRules={learnedRules} onSluiten={vi.fn()} />,
    )
    expect(screen.getByText('ah (boodschappen)')).toBeInTheDocument()
    expect(screen.getByText('salaris')).toBeInTheDocument()
  })

  it('calls onRegelPatronenWijzigen when saving edited pattern', () => {
    const onRegelPatronenWijzigen = vi.fn()
    render(
      <PotjesBeheerDialog
        open
        userRules={userRules}
        learnedRules={[]}
        onRegelPatronenWijzigen={onRegelPatronenWijzigen}
        onSluiten={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /patronen wijzigen voor ah/i }))
    const input = screen.getByLabelText(/tegenpartijpatroon/i)
    fireEvent.change(input, { target: { value: 'albert heijn' } })
    fireEvent.click(screen.getByRole('button', { name: /patronen opslaan voor ah/i }))

    expect(onRegelPatronenWijzigen).toHaveBeenCalledWith(
      'user',
      userRules[0],
      'albert heijn',
      'boodschappen',
      'Boodschappen',
    )
  })

  it('shows Vaste lasten label without potje edit pencil on bucket header', () => {
    const vasteLastenRule: UserRule = {
      tegenpartijPatroon: 'hypotheek',
      richting: 'debit',
      bucket: 'VASTE_LASTEN',
    }

    render(
      <PotjesBeheerDialog open userRules={[vasteLastenRule]} learnedRules={[]} onSluiten={vi.fn()} />,
    )

    expect(screen.getByText('Vaste lasten')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /potjesnaam wijzigen voor VASTE_LASTEN/i })).not.toBeInTheDocument()
  })

  it('calls onSluiten when close button is clicked', () => {
    const onSluiten = vi.fn()
    render(
      <PotjesBeheerDialog open userRules={[]} learnedRules={[]} onSluiten={onSluiten} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /sluiten/i }))
    expect(onSluiten).toHaveBeenCalled()
  })
})
