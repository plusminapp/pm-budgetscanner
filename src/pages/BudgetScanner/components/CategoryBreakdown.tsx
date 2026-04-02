import { useMemo, useState } from 'react'
import { Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Tab, Tabs, TextField, Typography } from '@mui/material'
import { ChevronDown, ChevronRight, CircleHelp, Home, Pencil, PiggyBank, ShoppingCart, TrendingUp, X } from 'lucide-react'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import { CorrectionDialog } from './CorrectionDialog'
import { TransactionTable } from './TransactionTable'
import { formatTegenpartijVoorWeergave, titleCaseWoorden } from '../displayTegenpartij'
import { matchesRulePattern, matchesOmschrijvingPattern } from '../categorize/patternMatcher'
import type { CategorizedTransaction, Bucket, Potje, UserRule } from '../types'

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

type GroepeerRegel = Pick<UserRule, 'tegenpartijPatroon' | 'omschrijvingPatroon' | 'richting'>

function normalizePattern(pattern: string): string {
  return pattern.trim().toLowerCase()
}

function bepaalTegenpartijPatroon(
  tx: CategorizedTransaction,
  userRules: UserRule[],
  learnedRules: UserRule[],
): string | null {
  const regelNaam = tx.regelNaam?.trim() ?? ''

  if (regelNaam.startsWith('regel:')) {
    const patroon = regelNaam.slice('regel:'.length).trim()
    if (patroon) return normalizePattern(patroon)
  }
  if (regelNaam.startsWith('geleerd:')) {
    const patroon = regelNaam.slice('geleerd:'.length).trim()
    if (patroon) return normalizePattern(patroon)
  }

  const tegenpartij = formatTegenpartijVoorWeergave(tx.tegenpartij).toLowerCase()
  const omschrijving = tx.omschrijving.toLowerCase()
  const regelMatches = (rule: GroepeerRegel) => {
    const pattern = normalizePattern(rule.tegenpartijPatroon)
    if (!pattern) return false
    const richtingMatch = !rule.richting
      || (rule.richting === 'debit' && tx.bedrag < 0)
      || (rule.richting === 'credit' && tx.bedrag > 0)
    if (!richtingMatch) return false
    if (matchesRulePattern(tegenpartij, pattern)) return true
    return Boolean(rule.omschrijvingPatroon && matchesOmschrijvingPattern(omschrijving, normalizePattern(rule.omschrijvingPatroon)))
  }

  const candidates = [...userRules, ...learnedRules]
    .filter(regelMatches)
    .sort((a, b) => b.tegenpartijPatroon.length - a.tegenpartijPatroon.length)

  return candidates[0] ? normalizePattern(candidates[0].tegenpartijPatroon) : null
}

function bepaalGroepNaam(
  tx: CategorizedTransaction,
  userRules: UserRule[],
  learnedRules: UserRule[],
): string {
  const patroon = bepaalTegenpartijPatroon(tx, userRules, learnedRules)
  return patroon ?? tx.tegenpartij
}

function isPatroonGedrevenGroep(
  tx: CategorizedTransaction,
  userRules: UserRule[],
  learnedRules: UserRule[],
): boolean {
  return Boolean(bepaalTegenpartijPatroon(tx, userRules, learnedRules))
}

function bepaalGezamenlijkNaamdeel(namen: string[]): string {
  if (namen.length === 0) return ''
  if (namen.length === 1) return namen[0].trim()

  const lowerNamen = namen.map((n) => n.toLowerCase())
  const kortsteNaam = [...lowerNamen].sort((a, b) => a.length - b.length)[0]

  for (let lengte = kortsteNaam.length; lengte >= 2; lengte -= 1) {
    for (let start = 0; start <= kortsteNaam.length - lengte; start += 1) {
      const kandidaat = kortsteNaam.slice(start, start + lengte)
      if (!/[a-z0-9]/i.test(kandidaat)) continue
      if (!lowerNamen.every((naam) => naam.includes(kandidaat))) continue

      const opgeschoond = kandidaat
        .replace(/^[\s\-_,.;:()]+|[\s\-_,.;:()]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (opgeschoond.length >= 2) return opgeschoond
    }
  }

  return ''
}

function buildCounterpartyRanking(
  transacties: CategorizedTransaction[],
  userRules: UserRule[],
  learnedRules: UserRule[],
) {
  const map = new Map<string, { naam: string; totaal: number; count: number; bucket: Bucket; txs: CategorizedTransaction[]; patroonGedreven: boolean }>()
  for (const tx of transacties) {
    const groupNaam = bepaalGroepNaam(tx, userRules, learnedRules)
    const groupKey = normalizePattern(groupNaam) || groupNaam
    const entry = map.get(groupKey) ?? { naam: groupNaam, totaal: 0, count: 0, bucket: tx.bucket, txs: [], patroonGedreven: false }
    entry.totaal += tx.bedrag
    entry.count += 1
    entry.txs.push(tx)
    entry.patroonGedreven = entry.patroonGedreven || isPatroonGedrevenGroep(tx, userRules, learnedRules)
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
  userRules: UserRule[]
  learnedRules: UserRule[]
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

type SorteerOptie = 'naam' | 'categorie' | 'potje' | 'aantal' | 'bedrag'
type SorteerRichting = 'asc' | 'desc'
type RichtingFilter = 'alles' | 'ontvangsten' | 'uitgaven'
type Bewerking = 'samenvoegen' | 'eenmalig'

const SORTEER_LABELS: Record<SorteerOptie, string> = {
  naam: 'Naam',
  categorie: 'Categorie',
  potje: 'Potje',
  aantal: 'Aantal transacties',
  bedrag: 'Bedrag',
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

type GroupMerge = {
  id: string
  naam: string
  criterium: string
  leden: string[]
}

export function CategoryBreakdown({ transacties, potjes, userRules, learnedRules, onCorrectie, onPotjeToevoegen }: Props) {
  const [activeTab, setActiveTab] = useState<TabFilter>('ALLE')
  const [bewerking, setBewerking] = useState<Bewerking>('samenvoegen')
  const [sorteerOp, setSorteerOp] = useState<SorteerOptie>('naam')
  const [sorteerRichting, setSorteerRichting] = useState<SorteerRichting>('asc')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dialogTxs, setDialogTxs] = useState<CategorizedTransaction[]>([])
  const [dialogGroupKey, setDialogGroupKey] = useState<string | null>(null)
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
  const [samengevoegdeGroepen, setSamengevoegdeGroepen] = useState<GroupMerge[]>([])
  const [groupNameOverrides, setGroupNameOverrides] = useState<Record<string, string>>({})

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

  const basisRanking: CounterpartyGroup[] = buildCounterpartyRanking(filtered, userRules, learnedRules).map((item) => ({
    ...item,
    key: item.naam,
  }))
  const basisMap = new Map(basisRanking.map((item) => [item.naam, item]))

  const mergedGroups: CounterpartyGroup[] = samengevoegdeGroepen
    .map((merge) => {
      const leden = merge.leden
        .map((naam) => basisMap.get(naam))
        .filter((item): item is CounterpartyGroup => Boolean(item))
      if (leden.length === 0) return null
      const totaal = leden.reduce((sum, item) => sum + item.totaal, 0)
      const count = leden.reduce((sum, item) => sum + item.count, 0)
      const txs = leden.flatMap((item) => item.txs)
      return {
        key: `merge:${merge.id}`,
        naam: merge.naam,
        patroonGedreven: false,
        totaal,
        count,
        txs,
        maandGemiddeld: totaal / 12,
      }
    })
    .filter((item): item is CounterpartyGroup => Boolean(item))

  const ledenVanMerges = new Set(samengevoegdeGroepen.flatMap((merge) => merge.leden))
  const ranking: CounterpartyGroup[] = [
    ...basisRanking.filter((item) => !ledenVanMerges.has(item.naam)),
    ...mergedGroups,
  ].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))

  const getGroupNaamVoorWeergave = (group: CounterpartyGroup) => {
    const override = groupNameOverrides[group.key]
    if (override) return override
    return formatTegenpartijVoorWeergave(group.naam)
  }

  const minTransacties = parseNonNegativeInt(minTransactiesFilter, 0)
  const maxTransacties = maxTransactiesFilter.trim() === ''
    ? Infinity
    : parseNonNegativeInt(maxTransactiesFilter, Infinity)
  const rankingFiltered = ranking.filter((group) => {
    const naamMatch = tegenpartijFilter.trim() === ''
      || matchesRulePattern(getGroupNaamVoorWeergave(group), tegenpartijFilter)
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

  const getDefaultSorteerRichting = (optie: SorteerOptie): SorteerRichting => {
    if (optie === 'aantal' || optie === 'bedrag') return 'desc'
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
      return direction * getGroupNaamVoorWeergave(a).localeCompare(getGroupNaamVoorWeergave(b), 'nl')
    }
    if (sorteerOp === 'categorie') {
      const diff = (BUCKET_SORT_ORDER[getPrimaryBucket(a)] ?? 999) - (BUCKET_SORT_ORDER[getPrimaryBucket(b)] ?? 999)
      if (diff !== 0) return direction * diff
      return getGroupNaamVoorWeergave(a).localeCompare(getGroupNaamVoorWeergave(b), 'nl')
    }
    if (sorteerOp === 'potje') {
      const potjeDiff = getPrimaryPotje(a).localeCompare(getPrimaryPotje(b), 'nl')
      if (potjeDiff !== 0) return direction * potjeDiff
      return getGroupNaamVoorWeergave(a).localeCompare(getGroupNaamVoorWeergave(b), 'nl')
    }
    if (sorteerOp === 'aantal') {
      const diff = a.count - b.count
      if (diff !== 0) return direction * diff
      return getGroupNaamVoorWeergave(a).localeCompare(getGroupNaamVoorWeergave(b), 'nl')
    }
    const bedragDiff = Math.abs(a.totaal) - Math.abs(b.totaal)
    if (bedragDiff !== 0) return direction * bedragDiff
    return getGroupNaamVoorWeergave(a).localeCompare(getGroupNaamVoorWeergave(b), 'nl')
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

  const samenvoegen = () => {
    const groepen = ranking.filter(({ key }) => geselecteerdSet.has(key))
    if (groepen.length < 2) return

    const namen = groepen.map((g) => getGroupNaamVoorWeergave(g))
    const fallbackNaam = [...namen].sort((a, b) => a.localeCompare(b, 'nl'))[0]
    const filterNaam = tegenpartijFilter.trim()
    const nieuweNaam = filterNaam || titleCaseWoorden(bepaalGezamenlijkNaamdeel(namen) || fallbackNaam)
    if (!nieuweNaam) return

    const leden = groepen.flatMap((group) => {
      if (group.key.startsWith('merge:')) {
        const mergeId = group.key.slice('merge:'.length)
        const merge = samengevoegdeGroepen.find((item) => item.id === mergeId)
        return merge?.leden ?? []
      }
      return [group.naam]
    })
    const uniekeLeden = [...new Set(leden)]
    const mergeCriterium = (bepaalGezamenlijkNaamdeel(uniekeLeden) || uniekeLeden[0] || '').trim()
    const nieuweMerge: GroupMerge = {
      id: crypto.randomUUID(),
      naam: nieuweNaam,
      criterium: mergeCriterium,
      leden: uniekeLeden,
    }
    const teVerwijderenMergeIds = new Set(
      groepen
        .filter((group) => group.key.startsWith('merge:'))
        .map((group) => group.key.slice('merge:'.length)),
    )

    setSamengevoegdeGroepen((current) => [
      ...current.filter((merge) => !teVerwijderenMergeIds.has(merge.id)),
      nieuweMerge,
    ])
    setGeselecteerdeGroepen([])
    setExpanded(`merge:${nieuweMerge.id}`)
  }

  const startEenmaligDialoog = (geselecteerdeTxs: CategorizedTransaction[]) => {
    setDialogTxs(geselecteerdeTxs)
    setDialogGroupKey(null)
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

  const wijzigBewerking = (nieuweBewerking: Bewerking) => {
    const volgendeBewerking = nieuweBewerking
    setBewerking(volgendeBewerking)
    setGeselecteerdeGroepen([])
    setGeselecteerdeTransacties([])
    setBevestigEenmaligTxs([])
    if (volgendeBewerking !== 'samenvoegen') {
      setTegenpartijFilter('')
    }
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
          {/* Row 1: checkbox, bewerking, zoeken (left) | sorteren, in/uit (right) */}
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
                    inputProps={{ 'aria-label': 'Alle zichtbare groepen (de)selecteren' }}
                  />
                ) : (
                  <span className="invisible inline-flex h-10 w-10" aria-hidden="true" />
                )}
              </div>
              <TextField
                select
                size="small"
                label="Bewerking"
                value={bewerking}
                onChange={(e) => wijzigBewerking(e.target.value as Bewerking)}
                sx={{ minWidth: 180, ...COMPACT_FIELD_SX }}
              >
                <MenuItem value="samenvoegen" sx={COMPACT_MENUITEM_SX}>Zoeken/samenvoegen</MenuItem>
                <MenuItem value="eenmalig" sx={COMPACT_MENUITEM_SX}>Toewijzen zonder regel</MenuItem>
              </TextField>
            </div>
            <div className="ml-12 hidden flex-wrap items-center gap-2 md:ml-0 md:flex md:justify-end">
              <TextField
                select
                size="small"
                label="Sorteer op"
                value={sorteerOp}
                onChange={() => {}}
                sx={{ width: RIGHT_FIELD_WIDTH, ...COMPACT_FIELD_SX }}
                SelectProps={{
                  renderValue: (value) => (
                    <span className="inline-flex items-center">
                      {SORTEER_LABELS[value as SorteerOptie]}
                      {renderSorteerPijl()}
                    </span>
                  ),
                }}
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

          {/* Row 2: bewerking-knop (left) | min, max transacties (right) */}
          <div className={`${bewerking === 'eenmalig' ? 'hidden md:flex' : 'flex'} flex-col gap-2 md:flex-row md:items-center md:justify-between`}>
            <div className="flex min-h-10 flex-wrap items-center gap-2">
              <span className="inline-flex w-10 shrink-0" aria-hidden="true" />
              {bewerking === 'samenvoegen' && (
                <TextField
                  size="small"
                  label="Zoeken"
                  placeholder="Filter"
                  value={tegenpartijFilter}
                  onChange={(e) => {
                    const value = e.target.value
                    setTegenpartijFilter(value)
                    if (value === '') {
                      setGeselecteerdeGroepen([])
                    }
                  }}
                  sx={{ minWidth: 180, ...COMPACT_FIELD_SX }}
                  slotProps={{
                    inputLabel: { sx: { color: 'text.disabled', fontSize: '0.8rem' } },
                    input: {
                      endAdornment: tegenpartijFilter ? (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            aria-label="filter wissen"
                            onClick={() => {
                              setTegenpartijFilter('')
                              setGeselecteerdeGroepen([])
                            }}
                            edge="end"
                          >
                            <X size={14} />
                          </IconButton>
                        </InputAdornment>
                      ) : undefined,
                    },
                  }}
                />
              )}
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

          {/* Row 3: samenvoegen-knop (left) | datum-van, datum-tot (right) */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex min-h-10 flex-wrap items-center gap-2">
              <span className="inline-flex w-10 shrink-0" aria-hidden="true" />
              {bewerking === 'samenvoegen' && (
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  onClick={samenvoegen}
                  disabled={tegenpartijFilter.trim() === '' || geselecteerdeGroepen.length < 2}
                >
                  Samenvoegen ({geselecteerdeGroepen.length})
                </Button>
              )}
              {bewerking === 'eenmalig' && (
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  onClick={openBulkLeefgeldEenmalig}
                  disabled={geselecteerdeGroepen.length === 0}
                >
                  Toewijzen zonder regel ({geselecteerdeGroepen.length})
                </Button>
              )}
            </div>
            <div className="ml-12 hidden flex-wrap items-center gap-2 md:ml-0 md:flex md:justify-end">
              <TextField
                size="small"
                type="date"
                label="Datum van"
                value={datumVanFilter}
                onChange={(e) => setDatumVanFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: RIGHT_FIELD_WIDTH, ...COMPACT_FIELD_SX }}
              />
              <TextField
                size="small"
                type="date"
                label="Datum tot"
                value={datumTotFilter}
                onChange={(e) => setDatumTotFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
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
                SelectProps={{
                  renderValue: (value) => (
                    <span className="inline-flex items-center">
                      {SORTEER_LABELS[value as SorteerOptie]}
                      {renderSorteerPijl()}
                    </span>
                  ),
                }}
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
                InputLabelProps={{ shrink: true }}
                sx={{ width: '100%', ...COMPACT_FIELD_SX }}
              />
              <TextField
                size="small"
                type="date"
                label="Datum tot"
                value={datumTotFilter}
                onChange={(e) => setDatumTotFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
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
          const weergaveNaam = getGroupNaamVoorWeergave(group)
          return (
            <div key={key}>
              <div
                role="button"
                tabIndex={0}
                className="group flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50"
                onClick={() => { setExpanded(expanded === key ? null : key) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setExpanded(expanded === key ? null : key)
                  }
                }}
              >
                {expanded === key
                  ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                  : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                }
                {toonSelectieCheckboxes && (
                  <Checkbox
                    size="small"
                    color="success"
                    checked={geselecteerdSet.has(key)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleGroepSelectie(key)}
                    inputProps={{ 'aria-label': `Groep ${weergaveNaam} selecteren` }}
                  />
                )}
                <span className="flex-1 font-medium">
                  {weergaveNaam}
                  {patroonGedreven && (
                    <span className="ml-2 text-xs font-normal text-gray-500">(op patroon)</span>
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
                    setDialogTxs(txs)
                    setDialogGroupKey(key)
                    setDialogGroupNaam(weergaveNaam)
                    setDialogForceLeefgeldEenmalig(false)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </div>

              {expanded === key && (
                <div className="border-t bg-gray-50 px-4 py-3">
                  <TransactionTable
                    transacties={txs}
                    selectable={false}
                    isSelectableTx={undefined}
                    selectedIds={geselecteerdeTxSet}
                    onToggleSelect={toggleTransactieSelectie}
                    onToggleSelectAll={toggleAlleTransactiesInGroep}
                    onEdit={(tx) => {
                      setDialogTxs([tx])
                      setDialogGroupKey(key)
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
            setDialogGroupKey(null)
            setDialogGroupNaam('')
            setDialogForceLeefgeldEenmalig(false)
            setBevestigEenmaligTxs([])
          }}
          onPotjeToevoegen={onPotjeToevoegen}
          onGroepNaamWijzigen={(nieuweNaam) => {
            if (!dialogGroupKey) return
            if (dialogGroupKey.startsWith('merge:')) {
              const mergeId = dialogGroupKey.slice('merge:'.length)
              setSamengevoegdeGroepen((current) =>
                current.map((merge) => merge.id === mergeId ? { ...merge, naam: nieuweNaam } : merge),
              )
            } else {
              setGroupNameOverrides((current) => ({ ...current, [dialogGroupKey]: nieuweNaam }))
            }
            setDialogGroupNaam(nieuweNaam)
          }}
          onCorrectie={(ids, bucket, potje, groepNaam, zonderRegel) => {
            const geselecteerdeGroep = dialogGroupKey
              ? ranking.find((group) => group.key === dialogGroupKey)
              : undefined
            const isGroepCorrectie = Boolean(
              (dialogGroupKey && dialogGroupKey.startsWith('merge:'))
              || (geselecteerdeGroep && geselecteerdeGroep.count > 1),
            )
            const groepCriterium = isGroepCorrectie
              ? (groepNaam?.trim() || dialogGroupNaam.trim() || undefined)
              : undefined
            if (zonderRegel) {
              onCorrectie(ids, bucket, potje, groepCriterium, true)
            } else {
              onCorrectie(ids, bucket, potje, groepCriterium)
            }
            setDialogTxs([])
            setDialogGroupKey(null)
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
