import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileDropZone } from '../components/FileDropZone'

describe('FileDropZone', () => {
  it('renders with accessible label', () => {
    render(<FileDropZone onFiles={vi.fn()} />)
    expect(screen.getByRole('button', { name: /bestanden uploaden/i })).toBeInTheDocument()
  })

  it('shows helper text', () => {
    render(<FileDropZone onFiles={vi.fn()} />)
    expect(screen.getByText(/sleep bankafschriften/i)).toBeInTheDocument()
  })

  it('is keyboard focusable', () => {
    render(<FileDropZone onFiles={vi.fn()} />)
    const zone = screen.getByRole('button', { name: /bestanden uploaden/i })
    expect(zone).toHaveAttribute('tabindex', '0')
  })

  it('calls onFiles when files are dropped', () => {
    const onFiles = vi.fn()
    render(<FileDropZone onFiles={onFiles} />)
    const zone = screen.getByRole('button', { name: /bestanden uploaden/i })
    const file = new File(['content'], 'ing.csv', { type: 'text/csv' })
    fireEvent.drop(zone, { dataTransfer: { files: [file] } })
    expect(onFiles).toHaveBeenCalledWith([file])
  })

  it('shows loading state when isLoading is true', () => {
    render(<FileDropZone onFiles={vi.fn()} isLoading />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
