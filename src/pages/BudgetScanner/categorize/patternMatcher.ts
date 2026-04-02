export function matchesRulePattern(value: string, rawPattern: string): boolean {
  const pattern = rawPattern.trim().toLowerCase()
  if (!pattern) return false

  const normalizedValue = value.toLowerCase()
  if (!pattern.includes('*')) return normalizedValue.startsWith(pattern)

  const parts = pattern.split('*').filter((part) => part.length > 0)
  if (parts.length === 0) return false

  let fromIndex = 0
  let partIndex = 0

  if (!pattern.startsWith('*')) {
    const first = parts[0]
    if (!normalizedValue.startsWith(first)) return false
    fromIndex = first.length
    partIndex = 1
  }

  for (let i = partIndex; i < parts.length; i += 1) {
    const part = parts[i]
    const foundIndex = normalizedValue.indexOf(part, fromIndex)
    if (foundIndex < 0) return false
    fromIndex = foundIndex + part.length
  }

  return true
}

export function matchesOmschrijvingPattern(value: string, rawPattern: string): boolean {
  const pattern = rawPattern.trim().toLowerCase()
  if (!pattern) return false

  const normalizedValue = value.toLowerCase()
  if (!pattern.includes('*')) return normalizedValue.includes(pattern)

  return matchesRulePattern(value, rawPattern)
}
