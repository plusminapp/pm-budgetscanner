import { useEffect, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, Typography, TextField, Chip,
} from '@mui/material'
import { CircleHelp, Home, Pencil, PiggyBank, ShoppingCart, TrendingUp } from 'lucide-react'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import type { UserRule } from '../types'

const BUCKET_COLORS: Record<string, 'success' | 'error' | 'primary' | 'warning' | 'default'> = {
  INKOMEN: 'success',
  LEEFGELD: 'error',
  VASTE_LASTEN: 'primary',
  SPAREN: 'warning',
  ONBEKEND: 'default',
  NEGEREN: 'default',
}

const BUCKET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  INKOMEN: TrendingUp,
  LEEFGELD: ShoppingCart,
  VASTE_LASTEN: Home,
  SPAREN: PiggyBank,
  ONBEKEND: CircleHelp,
  NEGEREN: VisibilityOffOutlinedIcon,
}

const BUCKET_SORT_ORDER: Record<string, number> = {
  INKOMEN: 0,
  LEEFGELD: 1,
  VASTE_LASTEN: 2,
  SPAREN: 3,
  ONBEKEND: 4,
  NEGEREN: 5,
}

interface Props {
  open: boolean
  userRules: UserRule[]
  learnedRules: UserRule[]
  onRegelPatronenWijzigen?: (bron: 'user' | 'learned', oldRegel: UserRule, tegenpartijPatroon: string, omschrijvingPatroon?: string, potje?: string | null) => void
  onPotjeWijzigen?: (bucket: string, oudeNaam: string | null, nieuweNaam: string) => void
  onSluiten: () => void
}

export function PotjesBeheerDialog({ open, userRules = [], learnedRules = [], onRegelPatronenWijzigen, onPotjeWijzigen, onSluiten }: Props) {
  const [patternDrafts, setPatternDrafts] = useState<Record<string, { tegenpartijPatroon: string; omschrijvingPatroon: string; potje: string }>>({})
  const [potjeDrafts, setPotjeDrafts] = useState<Record<string, string>>({})
  const [editingRegelId, setEditingRegelId] = useState<string | null>(null)
  const [editingPotjeKey, setEditingPotjeKey] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setEditingRegelId(null)
    setEditingPotjeKey(null)
  }, [open])

  // --- Regels tab ---
  type RegelMeta = UserRule & { id: string; bron: 'user' | 'learned'; oldRegel: UserRule }
  const alleRegels: RegelMeta[] = [
    ...userRules.map((r, i) => ({ ...r, id: `user:${i}`, bron: 'user' as const, oldRegel: r })),
    ...learnedRules.map((r, i) => ({ ...r, id: `learned:${i}`, bron: 'learned' as const, oldRegel: r })),
  ]

  const regelGroepen = new Map<string, RegelMeta[]>()
  for (const regel of alleRegels) {
    const key = `${regel.bucket}|${regel.potje ?? ''}`
    const bestaand = regelGroepen.get(key) ?? []
    bestaand.push(regel)
    regelGroepen.set(key, bestaand)
  }

  const gesorteerdeGroepen = [...regelGroepen.entries()].sort(([, a], [, b]) => {
    const bucketA = a[0].bucket
    const bucketB = b[0].bucket
    const bucketDiff = (BUCKET_SORT_ORDER[bucketA] ?? 999) - (BUCKET_SORT_ORDER[bucketB] ?? 999)
    if (bucketDiff !== 0) return bucketDiff

    const potjeA = a[0].potje ?? ''
    const potjeB = b[0].potje ?? ''
    if (potjeA === '' && potjeB !== '') return 1
    if (potjeA !== '' && potjeB === '') return -1
    return potjeA.localeCompare(potjeB, 'nl')
  })

  const vasteLastenGroepen = gesorteerdeGroepen.filter(([, regels]) => regels[0].bucket === 'VASTE_LASTEN')
  const overigeGroepen = gesorteerdeGroepen.filter(([, regels]) => regels[0].bucket !== 'VASTE_LASTEN')
  const vasteLastenRegels = vasteLastenGroepen.flatMap(([, regels]) => regels)

  const getDraft = (regel: RegelMeta) => patternDrafts[regel.id] ?? {
    tegenpartijPatroon: regel.tegenpartijPatroon,
    omschrijvingPatroon: regel.omschrijvingPatroon ?? '',
    potje: regel.potje ?? '',
  }

  const setDraft = (regel: RegelMeta, next: Partial<{ tegenpartijPatroon: string; omschrijvingPatroon: string; potje: string }>) => {
    const current = getDraft(regel)
    setPatternDrafts((prev) => ({
      ...prev,
      [regel.id]: {
        tegenpartijPatroon: next.tegenpartijPatroon ?? current.tegenpartijPatroon,
        omschrijvingPatroon: next.omschrijvingPatroon ?? current.omschrijvingPatroon,
        potje: next.potje ?? current.potje,
      },
    }))
  }

  const handlePatroonOpslaan = (regel: RegelMeta) => {
    if (!onRegelPatronenWijzigen) return
    const draft = getDraft(regel)
    const tegenpartijPatroon = draft.tegenpartijPatroon.trim()
    if (!tegenpartijPatroon) return
    const omschrijvingPatroon = draft.omschrijvingPatroon.trim()
    const potje = draft.potje.trim()
    onRegelPatronenWijzigen(
      regel.bron,
      regel.oldRegel,
      tegenpartijPatroon,
      omschrijvingPatroon || undefined,
      potje || null,
    )
    setEditingRegelId(null)
  }

  const handlePatroonAnnuleren = (regel: RegelMeta) => {
    setPatternDrafts((prev) => {
      const next = { ...prev }
      delete next[regel.id]
      return next
    })
    setEditingRegelId(null)
  }

  const getPotjeDraft = (key: string, currentPotje: string | null) => potjeDrafts[key] ?? (currentPotje || '')

  const setPotjeDraft = (key: string, value: string) => {
    setPotjeDrafts((prev) => ({ ...prev, [key]: value }))
  }

  const handlePotjeOpslaan = (key: string, bucket: string, oudeNaam: string | null) => {
    if (!onPotjeWijzigen) return
    const draft = getPotjeDraft(key, oudeNaam).trim()
    if (!draft) return
    onPotjeWijzigen(bucket, oudeNaam, draft)
    setPotjeDrafts((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setEditingPotjeKey(null)
  }

  const handlePotjeAnnuleren = (key: string) => {
    setPotjeDrafts((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setEditingPotjeKey(null)
  }

  const renderRegel = (r: RegelMeta) => (
    <div key={r.id} className="border-l-2 border-gray-200 pl-2 text-sm" style={{ color: 'var(--mui-palette-success-main)' }}>
      {editingRegelId === r.id ? (
        <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-start">
          <div className="grid gap-2 md:grid-cols-3">
            <TextField
              size="small"
              label="Tegenpartijpatroon"
              value={getDraft(r).tegenpartijPatroon}
              onChange={(e) => setDraft(r, { tegenpartijPatroon: e.target.value })}
            />
            <TextField
              size="small"
              label="Omschrijvingspatroon"
              value={getDraft(r).omschrijvingPatroon}
              onChange={(e) => setDraft(r, { omschrijvingPatroon: e.target.value })}
            />
            <TextField
              size="small"
              label="Potjesnaam"
              value={getDraft(r).potje}
              onChange={(e) => setDraft(r, { potje: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-1 justify-self-end">
            <IconButton
              size="small"
              aria-label={`Patronen wijzigen annuleren voor ${r.tegenpartijPatroon}`}
              onClick={() => handlePatroonAnnuleren(r)}
              color="success"
            >
              <CancelOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label={`Patronen opslaan voor ${r.tegenpartijPatroon}`}
              onClick={() => handlePatroonOpslaan(r)}
              disabled={!getDraft(r).tegenpartijPatroon.trim()}
              color="success"
            >
              <SaveOutlinedIcon fontSize="small" />
            </IconButton>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-1">
            <div><span className="font-mono">{r.tegenpartijPatroon}{r.omschrijvingPatroon ? ` (${r.omschrijvingPatroon})` : ''}</span></div>
          </div>
          <IconButton
            size="small"
            aria-label={`Patronen wijzigen voor ${r.tegenpartijPatroon}`}
            onClick={() => setEditingRegelId(r.id)}
            color="success"
          >
            <Pencil className="h-4 w-4" />
          </IconButton>
        </div>
      )}
    </div>
  )

  const renderPotjeChip = (key: string, bucket: string, potje: string | null, toonPotlood = true) => {
    const BucketIcon = BUCKET_ICONS[bucket] ?? CircleHelp
    const isEditing = editingPotjeKey === key
    const label = potje ?? (bucket === 'VASTE_LASTEN' ? 'Vaste lasten' : '')

    if (toonPotlood && isEditing) {
      return (
        <div key={key} className="mb-2 flex items-center gap-1">
          <TextField
            size="small"
            value={getPotjeDraft(key, potje)}
            onChange={(e) => setPotjeDraft(key, e.target.value)}
            placeholder="Potjesnaam"
            autoFocus
          />
          <IconButton
            size="small"
            onClick={() => handlePotjeAnnuleren(key)}
            color="success"
          >
            <CancelOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handlePotjeOpslaan(key, bucket, potje)}
            disabled={!getPotjeDraft(key, potje).trim()}
            color="success"
          >
            <SaveOutlinedIcon fontSize="small" />
          </IconButton>
        </div>
      )
    }

    return (
      <div key={key} className="mb-2 flex items-center gap-2">
        <Chip
          label={label}
          icon={<BucketIcon className="h-3.5 w-3.5" />}
          color={BUCKET_COLORS[bucket] ?? 'default'}
          size="small"
          sx={label ? { '& .MuiChip-icon': { marginLeft: '6px' } } : { '& .MuiChip-label': { display: 'none' }, '& .MuiChip-icon': { marginLeft: '6px', marginRight: '6px' } }}
        />
        {toonPotlood && (
          <IconButton
            size="small"
            onClick={() => setEditingPotjeKey(key)}
            color="success"
            aria-label={`Potjesnaam wijzigen voor ${potje || bucket}`}
          >
            <Pencil className="h-4 w-4" />
          </IconButton>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onClose={onSluiten} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: 'success.main' }}>Koppelingregels</DialogTitle>
      <DialogContent>
        <div>
          {gesorteerdeGroepen.length === 0 && (
            <Typography variant="body2" sx={{ color: 'success.main' }}>
              Geen koppelingregels beschikbaar.
            </Typography>
          )}
          {overigeGroepen.map(([key, regels]) => {
            const { bucket, potje } = regels[0]
            return (
              <div key={key} className="mb-4">
                {renderPotjeChip(key, bucket, potje ?? null)}
                <div className="ml-2 space-y-1">
                  {regels.map(renderRegel)}
                </div>
              </div>
            )
          })}
          {vasteLastenRegels.length > 0 && (
            <div className="mb-4">
              {renderPotjeChip('VASTE_LASTEN|', 'VASTE_LASTEN', null, false)}
              <div className="ml-2 space-y-1">
                {vasteLastenRegels.map(renderRegel)}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onSluiten} color="success">Sluiten</Button>
      </DialogActions>
    </Dialog>
  )
}

