import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, FormControl, FormLabel, RadioGroup, FormControlLabel,
  Radio, Typography, Autocomplete, TextField,
} from '@mui/material'
import { createFilterOptions } from '@mui/material/Autocomplete'
import { formatTegenpartijVoorWeergave, titleCaseWoorden } from '../displayTegenpartij'
import type { CategorizedTransaction, Bucket, Potje } from '../types'

const BUCKET_OPTIONS: { value: Bucket; label: string }[] = [
  { value: 'INKOMEN',      label: 'Inkomsten' },
  { value: 'LEEFGELD',     label: 'Leefgeld' },
  { value: 'VASTE_LASTEN', label: 'Vaste lasten' },
  { value: 'SPAREN',       label: 'Sparen' },
  { value: 'NEGEREN',      label: 'Negeren' },
]

interface Props {
  open: boolean
  transacties: CategorizedTransaction[]
  potjes: Potje[]
  groepNaam?: string
  forceLeefgeldEenmalig?: boolean
  onSluiten: () => void
  onCorrectie: (ids: string[], bucket: Bucket, potje: string | null, groepNaam?: string, zonderRegel?: boolean) => void
  onPotjeToevoegen: (naam: string, bucket: Exclude<Bucket, 'ONBEKEND' | 'NEGEREN'>) => void
  onGroepNaamWijzigen?: (naam: string) => void
}

interface PotjeOption {
  naam: string
  isNieuw?: boolean
}

const ASSIGNABLE_BUCKETS: Bucket[] = BUCKET_OPTIONS.map((b) => b.value)
const filter = createFilterOptions<PotjeOption>()
type CategorieKeuze = Bucket | 'LEEFGELD_ZONDER_REGEL'

function suggestBucket(transacties: CategorizedTransaction[]): Bucket {
  const score = new Map<Bucket, number>()
  for (const tx of transacties) {
    if (ASSIGNABLE_BUCKETS.includes(tx.bucket)) {
      score.set(tx.bucket, (score.get(tx.bucket) ?? 0) + 1)
    }
  }
  let best: Bucket | null = null
  let max = 0
  for (const [bucket, count] of score.entries()) {
    if (count > max) {
      max = count
      best = bucket
    }
  }
  if (best) return best
  const totaal = transacties.reduce((s, t) => s + t.bedrag, 0)
  return totaal > 0 ? 'INKOMEN' : 'LEEFGELD'
}

function suggestPotje(transacties: CategorizedTransaction[], bucket: Bucket): string {
  if (bucket === 'NEGEREN') return 'Negeren'
  const score = new Map<string, number>()
  for (const tx of transacties) {
    if (tx.bucket === bucket && tx.potje) {
      score.set(tx.potje, (score.get(tx.potje) ?? 0) + 1)
    }
  }
  let best = ''
  let max = 0
  for (const [potje, count] of score.entries()) {
    if (count > max) {
      max = count
      best = potje
    }
  }
  return best
}

export function CorrectionDialog({
  open, transacties, potjes, groepNaam, forceLeefgeldEenmalig, onSluiten, onCorrectie, onPotjeToevoegen, onGroepNaamWijzigen,
}: Props) {
  const [categorieKeuze, setCategorieKeuze] = useState<CategorieKeuze>('LEEFGELD')
  const [gekozenPotje, setGekozenPotje] = useState<string>('')
  const [bewerkteGroepNaam, setBewerkteGroepNaam] = useState('')

  useEffect(() => {
    if (!open) return
    if (forceLeefgeldEenmalig) {
      setCategorieKeuze('LEEFGELD_ZONDER_REGEL')
      setGekozenPotje(suggestPotje(transacties, 'LEEFGELD'))
      setBewerkteGroepNaam('')
      return
    }
    const bucket = suggestBucket(transacties)
    setCategorieKeuze(bucket)
    setGekozenPotje(suggestPotje(transacties, bucket))
    const initNaam = groepNaam ?? formatTegenpartijVoorWeergave(transacties[0]?.tegenpartij ?? '')
    setBewerkteGroepNaam(titleCaseWoorden(initNaam))
  }, [open, transacties, groepNaam, forceLeefgeldEenmalig])

  const gekozenBucket: Bucket = categorieKeuze === 'LEEFGELD_ZONDER_REGEL' ? 'LEEFGELD' : categorieKeuze
  const zonderRegel = categorieKeuze === 'LEEFGELD_ZONDER_REGEL'

  const tegenpartij = formatTegenpartijVoorWeergave(transacties[0]?.tegenpartij ?? '')
  const isGroepNiveau = !forceLeefgeldEenmalig && (transacties.length > 1 || Boolean(groepNaam))
  const aantalTekst = transacties.length === 1 ? '1 transactie' : `${transacties.length} transacties`
  const bucketPotjes = potjes.filter((p) => p.bucket === gekozenBucket)
  const potjeOptions: PotjeOption[] = bucketPotjes.map((p) => ({ naam: p.naam }))

  const handleOpslaan = () => {
    const normalizedNaam = bewerkteGroepNaam.trim()
    if (isGroepNiveau && onGroepNaamWijzigen) {
      if (normalizedNaam) onGroepNaamWijzigen(normalizedNaam)
    }

    const trimmedPotje = gekozenPotje.trim()
    const finalPotje = gekozenBucket === 'NEGEREN' ? 'Negeren' : trimmedPotje || null
    if (trimmedPotje && gekozenBucket !== 'NEGEREN') {
      const bestondAl = bucketPotjes.some((p) => p.naam.toLowerCase() === trimmedPotje.toLowerCase())
      if (!bestondAl && gekozenBucket !== 'ONBEKEND') {
        onPotjeToevoegen(trimmedPotje, gekozenBucket)
      }
    }
    const ids = transacties.map((t) => t.id)
    const groepCriterium = isGroepNiveau ? normalizedNaam || undefined : undefined
    if (zonderRegel) {
      onCorrectie(ids, gekozenBucket, finalPotje, groepCriterium, true)
    } else {
      onCorrectie(ids, gekozenBucket, finalPotje, groepCriterium)
    }
    onSluiten()
  }

  const handleDialogKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter') return
    if (event.defaultPrevented) return
    event.preventDefault()
    handleOpslaan()
  }

  return (
    <Dialog open={open} onClose={onSluiten} onKeyDown={handleDialogKeyDown} maxWidth="xs" fullWidth>
      <DialogTitle>{forceLeefgeldEenmalig ? 'Leefgeld toewijzen zonder regel' : 'Potjes toewijzen'}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {aantalTekst} voor <strong>{isGroepNiveau ? bewerkteGroepNaam || tegenpartij : tegenpartij}</strong>
        </Typography>

        {forceLeefgeldEenmalig && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Deze koppeling geldt alleen voor de geselecteerde transacties. Er wordt geen regel opgeslagen.
          </Typography>
        )}

        {isGroepNiveau && (
          <TextField
            fullWidth
            color="success"
            label="Groepsnaam"
            value={bewerkteGroepNaam}
            onChange={(e) => setBewerkteGroepNaam(e.target.value)}
            onBlur={() => setBewerkteGroepNaam((current) => current.trim())}
            sx={{ mt: 1 }}
          />
        )}

        {!forceLeefgeldEenmalig && (
          <FormControl component="fieldset" sx={{ mt: 2, width: '100%' }}>
            <FormLabel component="legend" sx={{ color: 'success.main', '&.Mui-focused': { color: 'success.main' } }}>Categorie</FormLabel>
            <RadioGroup value={categorieKeuze} onChange={(e) => setCategorieKeuze(e.target.value as CategorieKeuze)}>
              {BUCKET_OPTIONS.map(({ value, label }) => {
                if (value !== 'LEEFGELD') {
                  return <FormControlLabel key={value} value={value} control={<Radio color="success" />} label={label} />
                }
                return (
                  <div key={value} className="flex items-center gap-4">
                    <FormControlLabel value="LEEFGELD" control={<Radio color="success" />} label="Leefgeld" />
                    <FormControlLabel value="LEEFGELD_ZONDER_REGEL" control={<Radio color="success" />} label="Leefgeld zonder regel" />
                  </div>
                )
              })}
            </RadioGroup>
          </FormControl>
        )}

        {gekozenBucket !== 'ONBEKEND' && gekozenBucket !== 'NEGEREN' && (
          <Autocomplete
            freeSolo
            selectOnFocus
            clearOnBlur
            handleHomeEndKeys
            options={potjeOptions}
            value={gekozenPotje ? { naam: gekozenPotje } : null}
            onChange={(_, value) => {
              if (!value) {
                setGekozenPotje('')
                return
              }
              setGekozenPotje(typeof value === 'string' ? value : value.naam)
            }}
            filterOptions={(options, params) => {
              const filtered = filter(options, params)
              const input = params.inputValue.trim()
              const bestaat = options.some((option) => option.naam.toLowerCase() === input.toLowerCase())
              if (input !== '' && !bestaat) {
                filtered.push({ naam: input, isNieuw: true })
              }
              return filtered
            }}
            getOptionLabel={(option) => (typeof option === 'string' ? option : option.naam)}
            renderOption={(props, option) => {
              const { key, ...rest } = props
              return (
                <li key={key} {...rest}>
                {option.isNieuw ? `Nieuw potje toevoegen: ${option.naam}` : option.naam}
                </li>
              )
            }}
            onInputChange={(_, value) => setGekozenPotje(value)}
            sx={{ mt: 2 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Potje"
                color="success"
                helperText="Typ om te filteren of voeg een nieuw potje toe."
              />
            )}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onSluiten} color="success">Annuleren</Button>
        <Button onClick={handleOpslaan} variant="contained" color="success">Opslaan</Button>
      </DialogActions>
    </Dialog>
  )
}
