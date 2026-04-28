import { useMemo, useState } from 'react'
import { Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Tab, Tabs, TextField, Typography } from '@mui/material'
import { ChevronDown, ChevronRight, CircleHelp, Home, Pencil, PiggyBank, ShoppingCart, TrendingUp, X } from 'lucide-react'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import { CorrectionDialog } from './CorrectionDialog'
import { TransactionTable } from './TransactionTable'
import { formatTegenpartijVoorWeergave } from '../displayTegenpartij'
import type { CategorizedTransaction, Bucket, Potje } from '../types'

const BUCKET_COLORS: Record<Bucket, 'success' | 'error' | 'primary' | 'warning' | 'default'> = {
  INKOMEN: 'success',
  LEEFGELD: 'error',
  VASTE_LASTEN: 'primary',
  SPAREN: 'warning',
  ONBEKEND: 'default',
  NEGEREN: 'default',
}

const BUCKET_ICONS: Record<Bucket, React.ComponentType<{ className?: string }>> = {
  INKOMEN: TrendingUp,
  LEEFGELD: ShoppingCart,
  VASTE_LASTEN: Home,
  SPAREN: PiggyBank,
  ONBEKEND: CircleHelp,
  NEGEREN: VisibilityOffOutlinedIcon,
}

type TabFilter = Bucket | 'ALLE' | 'ZONDER_POTJE'

const TABS: { value: TabFilter; label: string }[] = [
  { value: 'ALLE', label: 'Alle' },
  { value: 'INKOMEN', label: 'Inkomsten' },
  { value: 'LEEFGELD', label: 'Leefgeld' },
  { value: 'VASTE_LASTEN', label: 'Vaste lasten' },
  { value: 'SPAREN', label: 'Sparen' },
  { value: 'NEGEREN', label: 'Negeren' },
  { value: 'ONBEKEND', label: 'Onbekend' },
  { value: 'ZONDER_POTJE', label: 'Categorie zonder potje' },
]

function formatEur(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

function parseNonNegativeInt(value: string, fallback: number): number {
  if (value.trim() === '') return fallback
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(0, parsed)
}

function formatZoekbaarBedrag(bedrag: number): string[] {
  const raw = String(bedrag)
  const abs = String(Math.abs(bedrag))
  const comma = raw.replace('.', ',')
  const commaAbs = abs.replace('.', ',')
  const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(bedrag).toLowerCase()
  return [raw, abs, comma, commaAbs, eur]
}

function txMatchesZoekFilter(tx: CategorizedTransaction, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  const tegenpartij = formatTegenpartijVoorWeergave(tx.tegenpartij).toLowerCase()
  const toewijzingsregel = (tx.toewijzingsregel ?? '').toLowerCase()
  const potje = (tx.potje ?? '').toLowerCase()
  const omschrijving = tx.omschrijving.toLowerCase()
  const bedragCandidates = formatZoekbaarBedrag(tx.bedrag)

  return tegenpartij.includes(normalized)
    || toewijzingsregel.includes(normalized)
    || potje.includes(normalized)
    || omschrijving.includes(normalized)
    || bedragCandidates.some((candidate) => candidate.includes(normalized))
}

function normalizePattern(pattern: string): string {
  return pattern.trim().toLowerCase()
}

function bepaalGroepNaam(tx: CategorizedTransaction): string {
  // Use toewijzingsregel from transaction (set during categorization or import)
  // If not set, fallback to tegenpartij (for backward compatibility with old data)
  return tx.toewijzingsregel ?? tx.tegenpartij
}

function isPatroonGedrevenGroep(tx: CategorizedTransaction): boolean {
  // A group is pattern-driven if its toewijzingsregel differs from tegenpartij
  // (meaning it's grouped by a rule pattern, not the raw counterparty name)
  return (tx.toewijzingsregel ?? tx.tegenpartij) !== tx.tegenpartij
}

function buildCounterpartyRanking(
  transacties: CategorizedTransaction[],
) {
  const map = new Map<string, { naam: string; totaal: number; count: number; bucket: Bucket; txs: CategorizedTransaction[]; patroonGedreven: boolean }>()
  for (const tx of transacties) {
    const groupNaam = bepaalGroepNaam(tx)
    const groupKey = normalizePattern(groupNaam) || groupNaam
    const entry = map.get(groupKey) ?? { naam: groupNaam, totaal: 0, count: 0, bucket: tx.bucket, txs: [], patroonGedreven: false }
    entry.totaal += tx.bedrag
    entry.count += 1
    entry.txs.push(tx)
    entry.patroonGedreven = entry.patroonGedreven || isPatroonGedrevenGroep(tx)
    map.set(groupKey, entry)
  }
  return [...map.values()]
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))
    .map((data) => ({
      ...data,
      maandGemiddeld: data.totaal / 12,
    }))
}

interface Props {
  transacties: CategorizedTransaction[]
  potjes: Potje[]
  onCorrectie: (ids: string[], bucket: Bucket, potje: string | null, groepCriterium?: string, zonderRegel?: boolean) => void
  onPotjeToevoegen: (naam: string, bucket: Exclude<Bucket, 'ONBEKEND' | 'NEGEREN'>) => void
}

type CounterpartyGroup = {
  key: string
  naam: string
  patroonGedreven: boolean
  totaal: number
  count: number
  txs: CategorizedTransaction[]
  maandGemiddeld: number
}

type SorteerOptie = 'naam' | 'categorie' | 'potje' | 'aantal' | 'bedrag' | 'datum'
type SorteerRichting = 'asc' | 'desc'
type RichtingFilter = 'alles' | 'ontvangsten' | 'uitgaven'

const SORTEER_LABELS: Record<SorteerOptie, string> = {
  naam: 'Naam',
  categorie: 'Categorie',
  potje: 'Potje',
  aantal: 'Aantal transacties',
  bedrag: 'Bedrag',
  datum: 'Datum',
}

const BUCKET_SORT_ORDER: Record<Bucket, number> = {
  INKOMEN: 0,
  LEEFGELD: 1,
  VASTE_LASTEN: 2,
  SPAREN: 3,
  NEGEREN: 4,
  ONBEKEND: 5,
}

const RIGHT_FIELD_WIDTH = 180
const COMPACT_FIELD_SX = {
  '& .MuiInputLabel-root': { fontSize: '0.8rem' },
  '& .MuiInputBase-input': { fontSize: '0.8rem' },
  '& .MuiSelect-select': { fontSize: '0.8rem' },
}
const COMPACT_MENUITEM_SX = { fontSize: '0.8rem' }

export function CategoryBreakdown({ transacties, potjes, onCorrectie, onPotjeToevoegen }: Props) {
  const [activeTab, setActiveTab] = useState<TabFilter>('ALLE')
  const [sorteerOp, setSorteerOp] = useState<SorteerOptie>('naam')
  const [sorteerRichting, setSorteerRichting] = useState<SorteerRichting>('asc')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dialogTxs, setDialogTxs] = useState<CategorizedTransaction[]>([])
  const [dialogGroupNaam, setDialogGroupNaam] = useState('')
  const [dialogForceLeefgeldEenmalig, setDialogForceLeefgeldEenmalig] = useState(false)
  const [bevestigEenmaligTxs, setBevestigEenmaligTxs] = useState<CategorizedTransaction[]>([])
  const [tegenpartijFilter, setTegenpartijFilter] = useState('')
  const [datumVanFilter, setDatumVanFilter] = useState('')
  const [datumTotFilter, setDatumTotFilter] = useState('')
  const [minTransactiesFilter, setMinTransactiesFilter] = useState('0')
  const [maxTransactiesFilter, setMaxTransactiesFilter] = useState('')
  const [richtingFilter, setRichtingFilter] = useState<RichtingFilter>('alles')
  const [geselecteerdeGroepen, setGeselecteerdeGroepen] = useState<string[]>([])
  const [geselecteerdeTransacties, setGeselecteerdeTransacties] = useState<string[]>([])

  const isAlGekoppeldVoorEenmalig = (tx: CategorizedTransaction) => tx.bucket !== 'ONBEKEND'

  const transactiesBinnenDatumBereik = useMemo(() => (
    transacties.filter((tx) => {
      if (datumVanFilter && tx.datum < datumVanFilter) return false
      if (datumTotFilter && tx.datum > datumTotFilter) return false
      return true
    })
  ), [transacties, datumVanFilter, datumTotFilter])

  const tabCounts = useMemo(() => (
    Object.fromEntries(
      TABS.map(({ value }) => [
        value,
        value === 'ALLE'
          ? transactiesBinnenDatumBereik.length
          : value === 'ZONDER_POTJE'
            ? transactiesBinnenDatumBereik.filter((t) => t.bucket !== 'ONBEKEND' && !(t.potje ?? '').trim()).length
          : transactiesBinnenDatumBereik.filter((t) => t.bucket === value).length,
      ]),
    ) as Record<TabFilter, number>
  ), [transactiesBinnenDatumBereik])

  const filtered = activeTab === 'ALLE'
    ? transactiesBinnenDatumBereik
    : activeTab === 'ZONDER_POTJE'
      ? transactiesBinnenDatumBereik.filter((t) => t.bucket !== 'ONBEKEND' && !(t.potje ?? '').trim())
      : transactiesBinnenDatumBereik.filter((t) => t.bucket === activeTab)

  const basisRanking: CounterpartyGroup[] = buildCounterpartyRanking(filtered).map((item) => ({
    ...item,
    key: item.naam,
  }))
  const ranking: CounterpartyGroup[] = basisRanking

  const minTransacties = parseNonNegativeInt(minTransactiesFilter, 0)
  const maxTransacties = maxTransactiesFilter.trim() === ''
    ? Infinity
    : parseNonNegativeInt(maxTransactiesFilter, Infinity)
  const rankingFiltered = ranking.filter((group) => {
    const naamMatch = tegenpartijFilter.trim() === ''
      || group.txs.some((tx) => txMatchesZoekFilter(tx, tegenpartijFilter))
    if (!naamMatch) return false
    if (group.count < minTransacties) return false
    if (group.count > maxTransacties) return false
    if (richtingFilter === 'ontvangsten' && group.totaal <= 0) return false
    if (richtingFilter === 'uitgaven' && group.totaal >= 0) return false
    return true
  })

  const getPrimaryBucket = (group: CounterpartyGroup): Bucket => {
    const counts = new Map<Bucket, number>()
    for (const tx of group.txs) {
      counts.set(tx.bucket, (counts.get(tx.bucket) ?? 0) + 1)
    }
    let best: Bucket = group.txs[0]?.bucket ?? 'ONBEKEND'
    let max = -1
    for (const [bucket, count] of counts) {
      if (count > max) {
        max = count
        best = bucket
      }
    }
    return best
  }

  const getPrimaryPotje = (group: CounterpartyGroup): string => {
    const counts = new Map<string, number>()
    for (const tx of group.txs) {
      const naam = tx.potje?.trim() || ''
      counts.set(naam, (counts.get(naam) ?? 0) + 1)
    }
    let best = ''
    let max = -1
    for (const [potjeNaam, count] of counts) {
      if (count > max) {
        max = count
        best = potjeNaam
      }
    }
    return best
  }

  const sortTransactionsInGroup = (txs: CategorizedTransaction[]): CategorizedTransaction[] => {
    if (sorteerOp !== 'datum') return txs

    const direction = sorteerRichting === 'asc' ? 1 : -1
    return [...txs].sort((a, b) => {
      const dateDiff = a.datum.localeCompare(b.datum)
      if (dateDiff !== 0) return direction * dateDiff

      const amountDiff = Math.abs(a.bedrag) - Math.abs(b.bedrag)
      if (amountDiff !== 0) return amountDiff

      return a.id.localeCompare(b.id, 'nl')
    })
  }

  const getSortedGroupTransactions = (group: CounterpartyGroup): CategorizedTransaction[] => sortTransactionsInGroup(group.txs)

  const getGroupSortDatum = (group: CounterpartyGroup): string => {
    const firstTx = getSortedGroupTransactions(group)[0]
    return firstTx?.datum ?? ''
  }

  const getDefaultSorteerRichting = (optie: SorteerOptie): SorteerRichting => {
    if (optie === 'aantal' || optie === 'bedrag' || optie === 'datum') return 'desc'
    return 'asc'
  }

  const toggleSorteerRichting = () => {
    setSorteerRichting((current) => (current === 'asc' ? 'desc' : 'asc'))
  }

  const kiesSorteerOptie = (optie: SorteerOptie) => {
    if (optie === sorteerOp) {
      toggleSorteerRichting()
      return
    }
    setSorteerOp(optie)
    setSorteerRichting(getDefaultSorteerRichting(optie))
  }

  const renderSorteerPijl = () => (sorteerRichting === 'asc'
    ? <KeyboardArrowUpIcon fontSize="small" />
    : <KeyboardArrowDownIcon fontSize="small" />)

  const rankingSorted = [...rankingFiltered].sort((a, b) => {
    const direction = sorteerRichting === 'asc' ? 1 : -1
    if (sorteerOp === 'naam') {
      return direction * formatTegenpartijVoorWeergave(a.naam).localeCompare(formatTegenpartijVoorWeergave(b.naam), 'nl')
    }
    if (sorteerOp === 'categorie') {
      const diff = (BUCKET_SORT_ORDER[getPrimaryBucket(a)] ?? 999) - (BUCKET_SORT_ORDER[getPrimaryBucket(b)] ?? 999)
      if (diff !== 0) return direction * diff
      return formatTegenpartijVoorWeergave(a.naam).localeCompare(formatTegenpartijVoorWeergave(b.naam), 'nl')
    }
    if (sorteerOp === 'potje') {
      const potjeDiff = getPrimaryPotje(a).localeCompare(getPrimaryPotje(b), 'nl')
      if (potjeDiff !== 0) return direction * potjeDiff
      return formatTegenpartijVoorWeergave(a.naam).localeCompare(formatTegenpartijVoorWeergave(b.naam), 'nl')
    }
    if (sorteerOp === 'aantal') {
      const diff = a.count - b.count
      if (diff !== 0) return direction * diff
      return formatTegenpartijVoorWeergave(a.naam).localeCompare(formatTegenpartijVoorWeergave(b.naam), 'nl')
    }
    if (sorteerOp === 'datum') {
      const dateDiff = getGroupSortDatum(a).localeCompare(getGroupSortDatum(b))
      if (dateDiff !== 0) return direction * dateDiff
      return formatTegenpartijVoorWeergave(a.naam).localeCompare(formatTegenpartijVoorWeergave(b.naam), 'nl')
    }
    const bedragDiff = Math.abs(a.totaal) - Math.abs(b.totaal)
    if (bedragDiff !== 0) return direction * bedragDiff
    return formatTegenpartijVoorWeergave(a.naam).localeCompare(formatTegenpartijVoorWeergave(b.naam), 'nl')
  })

  const zichtbareGroepen = rankingSorted.map(({ key }) => key)
  const geselecteerdSet = new Set(geselecteerdeGroepen)
  const geselecteerdeTxSet = new Set(geselecteerdeTransacties)
  const toonSelectieCheckboxes = true
  const alleZichtbareGeselecteerd =
    zichtbareGroepen.length > 0 && zichtbareGroepen.every((key) => geselecteerdSet.has(key))
  const deelsZichtbaarGeselecteerd =
    zichtbareGroepen.some((key) => geselecteerdSet.has(key)) && !alleZichtbareGeselecteerd

  const toggleGroepSelectie = (key: string) => {
    setGeselecteerdeGroepen((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key],
    )
  }

  const toggleAllesZichtbaar = (checked: boolean) => {
    if (checked) {
      setGeselecteerdeGroepen((current) => [...new Set([...current, ...zichtbareGroepen])])
      return
    }
    const zichtbaarSet = new Set(zichtbareGroepen)
    setGeselecteerdeGroepen((current) => current.filter((key) => !zichtbaarSet.has(key)))
  }

  const startEenmaligDialoog = (geselecteerdeTxs: CategorizedTransaction[]) => {
    setDialogTxs(geselecteerdeTxs)
    setDialogGroupNaam('')
    setDialogForceLeefgeldEenmalig(true)
  }

  const toggleTransactieSelectie = (txId: string, checked: boolean) => {
    setGeselecteerdeTransacties((current) => {
      if (checked) return current.includes(txId) ? current : [...current, txId]
      return current.filter((id) => id !== txId)
    })
  }

  const toggleAlleTransactiesInGroep = (txIds: string[], checked: boolean) => {
    setGeselecteerdeTransacties((current) => {
      if (checked) return [...new Set([...current, ...txIds])]
      const toRemove = new Set(txIds)
      return current.filter((id) => !toRemove.has(id))
    })
  }

  const openBulkLeefgeldEenmalig = () => {
    const groepen = ranking.filter(({ key }) => geselecteerdSet.has(key))
    const geselecteerdeTxs = groepen.flatMap((group) => group.txs)
    if (geselecteerdeTxs.length === 0) return
    if (geselecteerdeTxs.some(isAlGekoppeldVoorEenmalig)) {
      setBevestigEenmaligTxs(geselecteerdeTxs)
      return
    }
    startEenmaligDialoog(geselecteerdeTxs)
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="sticky top-[-26px] z-20 border-b bg-white/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="min-w-0">
          <Tabs
            value={activeTab}
            onChange={(_, v) => {
              setActiveTab(v)
              setExpanded(null)
              setGeselecteerdeGroepen([])
              setGeselecteerdeTransacties([])
              setBevestigEenmaligTxs([])
            }}
            variant="scrollable"
            scrollButtons="auto"
          >
            {TABS.map(({ value, label }) => (
              <Tab key={value} value={value} label={`${label} (${tabCounts[value]})`} />
            ))}
          </Tabs>
        </div>
        <div className="mt-3 space-y-2">
          {/* Row 1: checkbox + zoeken (left) | sorteren, in/uit (right) */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex w-10 shrink-0 justify-center">
                {toonSelectieCheckboxes ? (
                  <Checkbox
                    size="small"
                    color="success"
                    checked={alleZichtbareGeselecteerd}
                    indeterminate={deelsZichtbaarGeselecteerd}
                    onChange={(_, checked) => toggleAllesZichtbaar(checked)}
                    slotProps={{ input: { 'aria-label': 'Alle zichtbare groepen (de)selecteren' } }}
                  />
                ) : (
                  <span className="invisible inline-flex h-10 w-10" aria-hidden="true" />
                )}
              </div>
              <TextField
                size="small"
                label="Zoeken"
                placeholder="Filter"
                value={tegenpartijFilter}
                onChange={(e) => setTegenpartijFilter(e.target.value)}
                sx={{ minWidth: 180, ...COMPACT_FIELD_SX }}
                slotProps={{
                  inputLabel: { sx: { color: 'text.disabled', fontSize: '0.8rem' } },
                  input: {
                    endAdornment: tegenpartijFilter ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          aria-label="filter wissen"
                          onClick={() => setTegenpartijFilter('')}
                          edge="end"
                        >
                          <X size={14} />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  },
                }}
              />
            </div>
            <div className="ml-12 hidden flex-wrap items-center gap-2 md:ml-0 md:flex md:justify-end">
              <TextField
                select
                size="small"
                label="Sorteer op"
                value={sorteerOp}
                onChange={() => {}}
                sx={{ width: RIGHT_FIELD_WIDTH, ...COMPACT_FIELD_SX }}
                slotProps={{ select: {
                  renderValue: (value) => (
                    <span className="inline-flex items-center">
                      {SORTEER_LABELS[value as SorteerOptie]}
                      {renderSorteerPijl()}
                    </span>
                  ),
                }}}
              >
                <MenuItem value="naam" onClick={() => kiesSorteerOptie('naam')} sx={COMPACT_MENUITEM_SX}>
                  <span className="inline-flex items-center">
                    {SORTEER_LABELS.naam}
                    {sorteerOp === 'naam' ? renderSorteerPijl() : null}
                  </span>
                </MenuItem>
                <MenuItem value="categorie" onClick={() => kiesSorteerOptie('categorie')} sx={COMPACT_MENUITEM_SX}>
                  <span className="inline-flex items-center">
                    {SORTEER_LABELS.categorie}
                    {sorteerOp === 'categorie' ? renderSorteerPijl() : null}
                  </span>
                </MenuItem>
                <MenuItem value="potje" onClick={() => kiesSorteerOptie('potje')} sx={COMPACT_MENUITEM_SX}>
                  <span className="inline-flex items-center">
                    {SORTEER_LABELS.potje}
                    {sorteerOp === 'potje' ? renderSorteerPijl() : null}
                  </span>
                </MenuItem>
                <MenuItem value="aantal" onClick={() => kiesSorteerOptie('aantal')} sx={COMPACT_MENUITEM_SX}>
                  <span className="inline-flex items-center">
                    {SORTEER_LABELS.aantal}
                    {sorteerOp === 'aantal' ? renderSorteerPijl() : null}
                  </span>
                </MenuItem>
                <MenuItem value="bedrag" onClick={() => kiesSorteerOptie('bedrag')} sx={COMPACT_MENUITEM_SX}>
                  <span className="inline-flex items-center">
                    {SORTEER_LABELS.bedrag}
                    {sorteerOp === 'bedrag' ? renderSorteerPijl() : null}
                  </span>
                </MenuItem>
                <MenuItem value="datum" onClick={() => kiesSorteerOptie('datum')} sx={COMPACT_MENUITEM_SX}>
                  <span className="inline-flex items-center">
                    {SORTEER_LABELS.datum}
                    {sorteerOp === 'datum' ? renderSorteerPijl() : null}
                  </span>
                </MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label="In/Uit"
                value={richtingFilter}
                onChange={(e) => {
                  setRichtingFilter(e.target.value as RichtingFilter)
                  if (activeTab === 'ONBEKEND') setGeselecteerdeTransacties([])
                }}
                sx={{ width: RIGHT_FIELD_WIDTH, ...COMPACT_FIELD_SX }}
              >
                <MenuItem value="alles" sx={COMPACT_MENUITEM_SX}>Alles</MenuItem>
                <MenuItem value="ontvangsten" sx={COMPACT_MENUITEM_SX}>Ontvangsten</MenuItem>
                <MenuItem value="uitgaven" sx={COMPACT_MENUITEM_SX}>Uitgaven</MenuItem>
              </TextField>
            </div>
          </div>

          {/* Row 2: eenmalig-knop (left) | min, max transacties (right) */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex min-h-10 flex-wrap items-center gap-2">
              <span className="inline-flex w-10 shrink-0" aria-hidden="true" />
              <Button
                size="small"
                variant="outlined"
                color="success"
                onClick={openBulkLeefgeldEenmalig}
                disabled={geselecteerdeGroepen.length === 0}
              >
                Toewijzen zonder regel ({geselecteerdeGroepen.length})
              </Button>
            </div>
            <div className="ml-12 hidden flex-wrap items-center gap-2 md:ml-0 md:flex md:justify-end">
              <TextField
                size="small"
                type="number"
                label="Min transacties"
                value={minTransactiesFilter}
                onChange={(e) => setMinTransactiesFilter(e.target.value)}
                slotProps={{ htmlInput: { min: 0 } }}
                sx={{ width: RIGHT_FIELD_WIDTH, ...COMPACT_FIELD_SX }}
              />
              <TextField
                size="small"
                type="number"
                label="Max transacties"
                placeholder="∞"
                value={maxTransactiesFilter}
                onChange={(e) => setMaxTransactiesFilter(e.target.value)}
                slotProps={{ htmlInput: { min: 0 } }}
                sx={{ width: RIGHT_FIELD_WIDTH, ...COMPACT_FIELD_SX }}
              />
            </div>
          </div>

          {/* Row 3: spacer (left) | datum-van, datum-tot (right) */}
          <div className="hidden md:flex md:items-center md:justify-between">
            <div className="flex min-h-10 flex-wrap items-center gap-2">
              <span className="inline-flex w-10 shrink-0" aria-hidden="true" />
            </div>
            <div className="ml-12 hidden flex-wrap items-center gap-2 md:ml-0 md:flex md:justify-end">
              <TextField
                size="small"
                type="date"
                label="Datum van"
                value={datumVanFilter}
                onChange={(e) => setDatumVanFilter(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: RIGHT_FIELD_WIDTH, ...COMPACT_FIELD_SX }}
              />
              <TextField
                size="small"
                type="date"
                label="Datum tot"
                value={datumTotFilter}
                onChange={(e) => setDatumTotFilter(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: RIGHT_FIELD_WIDTH, ...COMPACT_FIELD_SX }}
              />
            </div>
          </div>

          {/* Mobile-only: right-side pairs stacked below left controls */}
          <div className="ml-12 w-[calc(100%-3rem)] flex flex-col gap-2 md:hidden">
            <div className="grid grid-cols-2 gap-2">
              <TextField
                select
                size="small"
                label="Sorteer op"
                value={sorteerOp}
                onChange={() => {}}
                sx={{ width: '100%', ...COMPACT_FIELD_SX }}
                slotProps={{ select: {
                  renderValue: (value) => (
                    <span className="inline-flex items-center">
                      {SORTEER_LABELS[value as SorteerOptie]}
                      {renderSorteerPijl()}
                    </span>
                  ),
                }}}
              >
                <MenuItem value="naam" onClick={() => kiesSorteerOptie('naam')} sx={COMPACT_MENUITEM_SX}>
                  <span className="inline-flex items-center">
                    {SORTEER_LABELS.naam}
                    {sorteerOp === 'naam' ? renderSorteerPijl() : null}
                  </span>
                </MenuItem>
                <MenuItem value="categorie" onClick={() => kiesSorteerOptie('categorie')} sx={COMPACT_MENUITEM_SX}>
                  <span className="inline-flex items-center">
                    {SORTEER_LABELS.categorie}
                    {sorteerOp === 'categorie' ? renderSorteerPijl() : null}
                  </span>
                </MenuItem>
                <MenuItem value="potje" onClick={() => kiesSorteerOptie('potje')} sx={COMPACT_MENUITEM_SX}>
                  <span className="inline-flex items-center">
                    {SORTEER_LABELS.potje}
                    {sorteerOp === 'potje' ? renderSorteerPijl() : null}
                  </span>
                </MenuItem>
                <MenuItem value="aantal" onClick={() => kiesSorteerOptie('aantal')} sx={COMPACT_MENUITEM_SX}>
                  <span className="inline-flex items-center">
                    {SORTEER_LABELS.aantal}
                    {sorteerOp === 'aantal' ? renderSorteerPijl() : null}
                  </span>
                </MenuItem>
                <MenuItem value="bedrag" onClick={() => kiesSorteerOptie('bedrag')} sx={COMPACT_MENUITEM_SX}>
                  <span className="inline-flex items-center">
                    {SORTEER_LABELS.bedrag}
                    {sorteerOp === 'bedrag' ? renderSorteerPijl() : null}
                  </span>
                </MenuItem>
                <MenuItem value="datum" onClick={() => kiesSorteerOptie('datum')} sx={COMPACT_MENUITEM_SX}>
                  <span className="inline-flex items-center">
                    {SORTEER_LABELS.datum}
                    {sorteerOp === 'datum' ? renderSorteerPijl() : null}
                  </span>
                </MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label="In/Uit"
                value={richtingFilter}
                onChange={(e) => {
                  setRichtingFilter(e.target.value as RichtingFilter)
                  if (activeTab === 'ONBEKEND') setGeselecteerdeTransacties([])
                }}
                sx={{ width: '100%', ...COMPACT_FIELD_SX }}
              >
                <MenuItem value="alles" sx={COMPACT_MENUITEM_SX}>Alles</MenuItem>
                <MenuItem value="ontvangsten" sx={COMPACT_MENUITEM_SX}>Ontvangsten</MenuItem>
                <MenuItem value="uitgaven" sx={COMPACT_MENUITEM_SX}>Uitgaven</MenuItem>
              </TextField>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextField
                size="small"
                type="number"
                label="Min transacties"
                value={minTransactiesFilter}
                onChange={(e) => setMinTransactiesFilter(e.target.value)}
                slotProps={{ htmlInput: { min: 0 } }}
                sx={{ width: '100%', ...COMPACT_FIELD_SX }}
              />
              <TextField
                size="small"
                type="number"
                label="Max transacties"
                placeholder="∞"
                value={maxTransactiesFilter}
                onChange={(e) => setMaxTransactiesFilter(e.target.value)}
                slotProps={{ htmlInput: { min: 0 } }}
                sx={{ width: '100%', ...COMPACT_FIELD_SX }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextField
                size="small"
                type="date"
                label="Datum van"
                value={datumVanFilter}
                onChange={(e) => setDatumVanFilter(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: '100%', ...COMPACT_FIELD_SX }}
              />
              <TextField
                size="small"
                type="date"
                label="Datum tot"
                value={datumTotFilter}
                onChange={(e) => setDatumTotFilter(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: '100%', ...COMPACT_FIELD_SX }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y">
        {rankingSorted.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">Geen transacties</p>
        )}
        {rankingSorted.map((group) => {
          const { key, patroonGedreven, totaal, count, txs, maandGemiddeld } = group
          const sortedTxs = getSortedGroupTransactions(group)
          const weergaveNaam = formatTegenpartijVoorWeergave(group.naam)
          const isExpanded = expanded === key

          const openPotjesToewijzen = () => {
            setDialogTxs(sortedTxs)
            setDialogGroupNaam(weergaveNaam)
            setDialogForceLeefgeldEenmalig(false)
          }

          return (
            <div key={key}>
              <div
                className="group flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50"
                onClick={openPotjesToewijzen}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openPotjesToewijzen()
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-gray-100"
                  aria-label={`${isExpanded ? 'Inklappen' : 'Uitklappen'} ${weergaveNaam}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded(isExpanded ? null : key)
                  }}
                >
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                    : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                  }
                </button>
                {toonSelectieCheckboxes && (
                  <Checkbox
                    size="small"
                    color="success"
                    checked={geselecteerdSet.has(key)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleGroepSelectie(key)}
                    slotProps={{ input: { 'aria-label': `Groep ${weergaveNaam} selecteren` } }}
                  />
                )}
                <span className="flex-1 font-medium">
                  {weergaveNaam}
                  {patroonGedreven && (
                    <span className="ml-2 text-xs font-normal text-gray-500">(met toewijzingsregel)</span>
                  )}
                </span>
                <span className="flex flex-wrap gap-1">
                  {[...new Map(txs.map((tx) => [`${tx.bucket}|${tx.potje ?? ''}`, tx])).values()].map((tx) => {
                    const BucketIcon = BUCKET_ICONS[tx.bucket]
                    return (
                      <Chip
                        key={`${tx.bucket}|${tx.potje ?? ''}`}
                        label={tx.potje ?? ''}
                        icon={<BucketIcon className="h-3.5 w-3.5" />}
                        color={BUCKET_COLORS[tx.bucket]}
                        size="small"
                        variant={tx.isHandmatig ? 'filled' : 'outlined'}
                        sx={tx.potje ? { '& .MuiChip-icon': { marginLeft: '6px' } } : { '& .MuiChip-label': { display: 'none' }, '& .MuiChip-icon': { marginLeft: '6px', marginRight: '6px' } }}
                      />
                    )
                  })}
                </span>
                <span className="text-xs text-gray-400">{count}×</span>
                <span className="text-xs text-gray-400">gem. {formatEur(maandGemiddeld)}/mnd</span>
                <span className={`font-mono text-sm font-semibold ${totaal < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatEur(totaal)}
                </span>
                <button
                  className="ml-2 rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100"
                  aria-label={`Categorie wijzigen voor ${weergaveNaam}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    openPotjesToewijzen()
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </div>

              {isExpanded && (
                <div className="border-t bg-gray-50 px-4 py-3">
                  <TransactionTable
                    transacties={sortedTxs}
                    selectable={false}
                    isSelectableTx={undefined}
                    selectedIds={geselecteerdeTxSet}
                    onToggleSelect={toggleTransactieSelectie}
                    onToggleSelectAll={toggleAlleTransactiesInGroep}
                    onEdit={(tx) => {
                      setDialogTxs([tx])
                      setDialogGroupNaam(weergaveNaam)
                      setDialogForceLeefgeldEenmalig(false)
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {dialogTxs.length > 0 && (
        <CorrectionDialog
          open
          transacties={dialogTxs}
          potjes={potjes}
          groepNaam={dialogGroupNaam}
          forceLeefgeldEenmalig={dialogForceLeefgeldEenmalig}
          onSluiten={() => {
            setDialogTxs([])
            setDialogGroupNaam('')
            setDialogForceLeefgeldEenmalig(false)
            setBevestigEenmaligTxs([])
          }}
          onPotjeToevoegen={onPotjeToevoegen}
          onGroepNaamWijzigen={(nieuweNaam) => {
            // dialogGroupNaam is used as fallback in onCorrectie callback
            setDialogGroupNaam(nieuweNaam)
          }}
          onCorrectie={(ids, bucket, potje, groepNaam, zonderRegel) => {
            // Alleen doorgegeven groepCriterium (toewijzingsregel) als zonderRegel false is
            // Als zonderRegel true, moet groepCriterium undefined zijn om geen regel te maken
            const groepCriterium = !zonderRegel ? (groepNaam?.trim() || dialogGroupNaam.trim() || undefined) : undefined
            if (zonderRegel) {
              onCorrectie(ids, bucket, potje, groepCriterium, true)
            } else {
              onCorrectie(ids, bucket, potje, groepCriterium)
            }
            setDialogTxs([])
            setDialogGroupNaam('')
            setDialogForceLeefgeldEenmalig(false)
            setGeselecteerdeTransacties([])
            setBevestigEenmaligTxs([])
          }}
        />
      )}

      <Dialog
        open={bevestigEenmaligTxs.length > 0}
        onClose={() => setBevestigEenmaligTxs([])}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Waarschuwing bij toewijzen zonder regel</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Er zitten al gekoppelde transacties in je selectie. Deze transacties zijn hieronder geel gemarkeerd.
            Als je doorgaat, worden ook deze transacties opnieuw gekoppeld zonder regel.
          </Typography>
          <TransactionTable
            transacties={bevestigEenmaligTxs}
            highlightTx={isAlGekoppeldVoorEenmalig}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBevestigEenmaligTxs([])} color="success">Annuleren</Button>
          <Button
            onClick={() => {
              const txs = bevestigEenmaligTxs
              setBevestigEenmaligTxs([])
              startEenmaligDialoog(txs)
            }}
            variant="contained"
            color="success"
          >
            Doorgaan
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
