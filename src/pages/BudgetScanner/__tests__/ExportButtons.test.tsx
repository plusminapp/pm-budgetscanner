import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OpslaanButtons } from '../components/ExportButtons'

const { exportPdfMock, exportOverzichtMock } = vi.hoisted(() => ({
  exportPdfMock: vi.fn(async () => {}),
  exportOverzichtMock: vi.fn(),
}))

vi.mock('../export/exportPdf', () => ({
  exportPdf: exportPdfMock,
}))

vi.mock('../export/exportRules', () => ({
  exportOverzicht: exportOverzichtMock,
}))

describe('OpslaanButtons', () => {
  it('calls exportPdf (and not exportOverzicht) when PDF opslaan is clicked', async () => {
    render(
      <OpslaanButtons transacties={[]} jaar={2025} userRules={[]} learnedRules={[]} potjes={[]} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /opslaan/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /pdf opslaan/i }))

    expect(exportPdfMock).toHaveBeenCalledTimes(1)
    expect(exportOverzichtMock).not.toHaveBeenCalled()
  })

  it('calls onJsonSaved after JSON opslaan', () => {
    const onJsonSaved = vi.fn()
    render(
      <OpslaanButtons
        transacties={[]}
        jaar={2025}
        userRules={[]}
        learnedRules={[]}
        potjes={[]}
        onJsonSaved={onJsonSaved}
      />, 
    )

    fireEvent.click(screen.getByRole('button', { name: /opslaan/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /json opslaan/i }))

    expect(exportOverzichtMock).toHaveBeenCalledTimes(1)
    expect(onJsonSaved).toHaveBeenCalledTimes(1)
  })
})
