import { describe, expect, it } from 'vitest'
import { appendUploadStatus } from '../uploadStatus'

describe('appendUploadStatus', () => {
  it('sets the first upload message when there is no previous status', () => {
    const result = appendUploadStatus(null, 'ruud-2026.zip: 227 transacties geladen', false)
    expect(result).toEqual({
      bericht: 'ruud-2026.zip: 227 transacties geladen',
      fout: false,
    })
  })

  it('appends a new upload message instead of replacing previous text', () => {
    const first = appendUploadStatus(null, 'ruud-2026.zip: 227 transacties geladen', false)
    const second = appendUploadStatus(first, 'demo-johan.zip: 503 transacties geladen', false)
    expect(second).toEqual({
      bericht: 'ruud-2026.zip: 227 transacties geladen | demo-johan.zip: 503 transacties geladen',
      fout: false,
    })
  })

  it('keeps fout=true once any upload in the chain has an error', () => {
    const withError = appendUploadStatus(null, 'bestand-a.zip: Onbekend formaat', true)
    const afterSuccess = appendUploadStatus(withError, 'bestand-b.zip: 12 transacties geladen', false)
    expect(afterSuccess.fout).toBe(true)
  })
})
