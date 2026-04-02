import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TransactionTable } from '../components/TransactionTable'
import type { CategorizedTransaction } from '../types'

const tx = (id: string, tegenpartij: string, bucket: CategorizedTransaction['bucket'] = 'LEEFGELD'): CategorizedTransaction => ({
  id,
  datum: '2023-06-15',
  bedrag: -25.00,
  omschrijving: 'Test omschrijving',
  tegenrekening: null,
  tegenpartij,
  bronBestand: 'test.csv',
  bankFormat: 'ING',
  bucket,
  potje: null,
  isHandmatig: false,
  isDuplicaat: false,
  regelNaam: null,
})

describe('TransactionTable', () => {
  it('renders all transactions', () => {
    render(<TransactionTable transacties={[tx('1', 'Albert Heijn'), tx('2', 'Jumbo')]} />)
    expect(screen.getByText('Albert Heijn')).toBeInTheDocument()
    expect(screen.getByText('Jumbo')).toBeInTheDocument()
  })

  it('shows empty state when no transactions', () => {
    render(<TransactionTable transacties={[]} />)
    expect(screen.getByText(/geen transacties/i)).toBeInTheDocument()
  })

  it('does not render checkboxes', () => {
    render(<TransactionTable transacties={[tx('1', 'Albert Heijn')]} />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('calls onEdit with the transaction when pencil is clicked', () => {
    const onEdit = vi.fn()
    render(<TransactionTable transacties={[tx('1', 'Albert Heijn')]} onEdit={onEdit} />)
    const pencilBtn = screen.getByRole('button', { name: /categorie wijzigen voor albert heijn/i })
    fireEvent.click(pencilBtn)
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: '1', tegenpartij: 'Albert Heijn' }))
  })

  it('does not throw when onEdit is not provided and pencil is clicked', () => {
    render(<TransactionTable transacties={[tx('1', 'Albert Heijn')]} />)
    const pencilBtn = screen.getByRole('button', { name: /categorie wijzigen voor albert heijn/i })
    expect(() => fireEvent.click(pencilBtn)).not.toThrow()
  })
})
