const DISPLAY_PREFIX_RE = /^(?:BCK\*|CCV\*|CM\*|MOLLIE\*|PAY\.NL\*|SUMUP\*?\s+)/i

export function formatTegenpartijVoorWeergave(naam: string): string {
  const trimmed = naam.trim()
  const cleaned = trimmed.replace(DISPLAY_PREFIX_RE, '').trim()
  return cleaned || trimmed
}

export function titleCaseWoorden(naam: string): string {
  const lower = naam.toLowerCase()
  return lower.replace(/(^|[\s\-/])([a-z\u00c0-\u024f])/g, (_match, prefix, letter) => {
    return `${prefix}${letter.toUpperCase()}`
  })
}
