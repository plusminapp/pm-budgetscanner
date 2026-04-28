export type BankFormat = 'ING' | 'ABN_AMRO' | 'RABOBANK' | 'CAMT053'

export type Bucket = 'INKOMEN' | 'LEEFGELD' | 'VASTE_LASTEN' | 'SPAREN' | 'ONBEKEND' | 'NEGEREN'

export interface Potje {
  id: string                          // crypto.randomUUID()
  naam: string
  bucket: Exclude<Bucket, 'ONBEKEND' | 'NEGEREN'>
}

export interface ParsedTransaction {
  id: string                   // crypto.randomUUID()
  datum: string                // YYYY-MM-DD
  bedrag: number               // positive = credit, negative = debit
  omschrijving: string
  tegenrekening: string | null // counterparty IBAN
  tegenpartij: string          // counterparty name (cleaned)
  bronBestand: string          // source filename
  bankFormat: BankFormat
}

export interface CategorizedTransaction extends ParsedTransaction {
  bucket: Bucket
  potje: string | null
  isHandmatig: boolean
  regelNaam: string | null     // which rule matched
  isDuplicaat: boolean
  toewijzingsregel?: string     // the pattern/rule this transaction is coupled/grouped by; initially = tegenpartij; never null, always a string value
}

// IMPORTANT: tegenpartij is IMMUTABLE and must NEVER be modified after transaction creation

export interface UserRule {
  tegenpartijPatroon: string
  omschrijvingPatroon?: string   // new
  richting?: 'credit' | 'debit' // new
  bucket: Bucket
  potje?: string          // new
}

export interface BestandStatus {
  naam: string
  format: BankFormat | null
  status: 'PARSING' | 'KLAAR' | 'FOUT'
  foutmelding?: string
}

export interface BudgetScannerState {
  stap: 'WELKOM' | 'UPLOAD' | 'TOEWIJZEN'
  bestanden: BestandStatus[]
  transacties: CategorizedTransaction[]
  userRules: UserRule[]
  learnedRules: UserRule[]
  potjes: Potje[]
}
