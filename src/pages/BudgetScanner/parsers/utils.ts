/** Converts YYYYMMDD → YYYY-MM-DD. Returns the input unchanged if it is not 8 digits. */
export function formatYYYYMMDD(raw: string): string {
  return raw.length === 8
    ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    : raw
}

/** Cleans counterparty name: truncates at '>' character and trims whitespace. */
export function cleanTegenpartij(naam: string): string {
  return naam.replace(/\s+/g, ' ').split('>')[0].trim()
}
