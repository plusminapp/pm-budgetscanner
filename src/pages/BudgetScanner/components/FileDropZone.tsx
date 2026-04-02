import React, { useRef, useState } from 'react'
import { CircularProgress } from '@mui/material'
import { UploadCloud } from 'lucide-react'

interface Props {
  onFiles: (files: File[]) => void
  isLoading?: boolean
}

export function FileDropZone({ onFiles, isLoading = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) onFiles(files)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onFiles(files)
    e.target.value = ''
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  const borderClass = isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
  const loadingClass = isLoading ? 'pointer-events-none opacity-60' : ''

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Bestanden uploaden"
      onClick={() => inputRef.current?.click()}
      onKeyDown={handleKeyDown}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors ${borderClass} ${loadingClass}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".csv,.xml,.json"
        className="hidden"
        onChange={handleChange}
        aria-hidden="true"
      />
      {isLoading ? (
        <CircularProgress size={40} role="progressbar" />
      ) : (
        <UploadCloud className="h-12 w-12 text-gray-400" />
      )}
      <div className="text-center">
        <p className="text-base font-medium">
          Sleep bankafschriften of regelsbestand hierheen of klik om te selecteren
        </p>
        <p className="mt-1 text-sm text-gray-500">
          ING CSV · ABN AMRO CSV · Rabobank CSV · CAMT.053 XML · Bewaarde&nbsp;JSON
        </p>
      </div>
    </div>
  )
}
