import { useReducer, useState, useCallback, useMemo, useEffect } from 'react'
import { Alert, Button, Chip, Step, StepButton, Stepper } from '@mui/material'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'

import { budgetScannerReducer, initialState } from './budgetScannerReducer'
import { detectFormat } from './parsers/detectFormat'
import { parseIng } from './parsers/parseIng'
import { parseAbnAmro } from './parsers/parseAbnAmro'
import { parseRabobank } from './parsers/parseRabobank'
import { parseCamt053 } from './parsers/parseCamt053'
import { applyRules } from './categorize/ruleEngine'
import { applyRecurrenceDetection } from './categorize/recurrenceDetector'
import { markDuplicates } from './parsers/detectDuplicates'
import { FileDropZone } from './components/FileDropZone'
import { BucketCards } from './components/BucketCards'
import { CategoryBreakdown } from './components/CategoryBreakdown'
import { OpslaanButtons } from './components/ExportButtons'
import { PotjesBeheerDialog } from './components/PotjesBeheerDialog'
import { buildOverzichtJson, importRules } from './export/exportRules'
import type { BankFormat, ParsedTransaction, CategorizedTransaction } from './types'

function readFileAsText(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase()
  const isUtf8 = lowerName.endsWith('.xml') || lowerName.endsWith('.json')
  const encoding = isUtf8 ? 'utf-8' : 'windows-1252'
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Leesfout'))
    reader.readAsText(file, encoding)
  })
}

function parseByFormat(content: string, fileName: string, format: BankFormat): ParsedTransaction[] {
  switch (format) {
    case 'ING': return parseIng(content, fileName)
    case 'ABN_AMRO': return parseAbnAmro(content, fileName)
    case 'RABOBANK': return parseRabobank(content, fileName)
    case 'CAMT053': return parseCamt053(content, fileName)
  }
}

function detectDominantYear(txs: CategorizedTransaction[]): number {
  const counts = new Map<number, number>()
  for (const tx of txs) {
    const y = parseInt(tx.datum.slice(0, 4), 10)
    if (!isNaN(y)) counts.set(y, (counts.get(y) ?? 0) + 1)
  }
  let best = new Date().getFullYear(), max = 0
  for (const [y, n] of counts) if (n > max) { max = n; best = y }
  return best
}

type BudgetScannerProps = {
  onToggleHelp: () => void
}

export default function BudgetScanner({ onToggleHelp }: BudgetScannerProps) {
  const [state, dispatch] = useReducer(budgetScannerReducer, initialState)
  const [isLoading, setIsLoading] = useState(false)
  const [potjesOpen, setPotjesOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [regelsImportStatus, setRegelsImportStatus] = useState<{ bericht: string; fout: boolean } | null>(null)
  const [lastSavedJsonSnapshot, setLastSavedJsonSnapshot] = useState<string | null>(null)

  const handleUploadsWissen = useCallback(() => {
    dispatch({ type: 'RESET' })
    dispatch({ type: 'NAAR_UPLOAD' })
    setSelectedYear(null)
    setRegelsImportStatus(null)
    setLastSavedJsonSnapshot(null)
    setIsLoading(false)
    setPotjesOpen(false)
  }, [])

  const handleFiles = useCallback(async (files: File[]) => {
    setIsLoading(true)
    const jsonFiles = files.filter((f) => f.name.toLowerCase().endsWith('.json'))
    const bankFiles = files.filter((f) => !f.name.toLowerCase().endsWith('.json'))
    const uploadBerichten: string[] = []
    let heeftUploadFout = false

    for (const file of jsonFiles) {
      try {
        const content = await readFileAsText(file)
        const { userRules, learnedRules, potjes, transacties } = importRules(content)

        if (transacties.length > 0) {
          dispatch({ type: 'SNAPSHOT_IMPORTEREN', userRules, learnedRules, potjes, transacties })
          setSelectedYear(detectDominantYear(transacties))
          uploadBerichten.push(
            `${file.name}: ${transacties.length} transacties en ${userRules.length + learnedRules.length + potjes.length} regels/potjes geladen`,
          )
          setRegelsImportStatus({
            bericht: `${file.name}: ${transacties.length} transacties en ${userRules.length + learnedRules.length + potjes.length} regels/potjes geladen`,
            fout: false,
          })
          setIsLoading(false)
          return
        }

        dispatch({ type: 'REGELS_IMPORTEREN', userRules, learnedRules, potjes })
        uploadBerichten.push(`${file.name}: ${userRules.length + learnedRules.length + potjes.length} regels/potjes geladen`)
      } catch (err) {
        heeftUploadFout = true
        uploadBerichten.push(`${file.name}: ${String(err)}`)
      }
    }

    if (bankFiles.length > 0) {
      dispatch({ type: 'BESTANDEN_TOEVOEGEN', bestanden: bankFiles })
    }

    // Parse all files first
    const fileResults: { naam: string; txs: CategorizedTransaction[] }[] = []
    for (const file of bankFiles) {
      try {
        const content = await readFileAsText(file)
        const format = detectFormat(content)
        if (!format) {
          heeftUploadFout = true
          uploadBerichten.push(`${file.name}: Onbekend formaat`)
          dispatch({
            type: 'BESTAND_FOUT',
            bestandNaam: file.name,
            foutmelding: 'Onbekend formaat. Ondersteund: ING CSV, ABN AMRO CSV, Rabobank CSV, CAMT.053 XML.',
          })
          continue
        }
        const parsed = parseByFormat(content, file.name, format)
        const categorized = applyRecurrenceDetection(applyRules(parsed, state.userRules, state.learnedRules))
        fileResults.push({ naam: file.name, txs: categorized })
        uploadBerichten.push(`${file.name}: ${categorized.length} transacties geladen`)
      } catch (e) {
        heeftUploadFout = true
        uploadBerichten.push(`${file.name}: ${String(e)}`)
        dispatch({ type: 'BESTAND_FOUT', bestandNaam: file.name, foutmelding: String(e) })
      }
    }

    // Mark duplicates across all files in this batch
    const allNewTxs = fileResults.flatMap((r) => r.txs)
    const withDuplicates = markDuplicates([...state.transacties, ...allNewTxs])
    // Dispatch each file's transactions with updated duplicate flags
    let offset = state.transacties.length
    for (const { naam, txs } of fileResults) {
      const flaggedTxs = withDuplicates.slice(offset, offset + txs.length)
      dispatch({ type: 'BESTAND_PARSED', bestandNaam: naam, transacties: flaggedTxs })
      offset += txs.length
    }

    if (fileResults.length > 0) {
      const allTxs = [...state.transacties, ...allNewTxs]
      const year = detectDominantYear(allTxs)
      setSelectedYear(year)
    }

    if (uploadBerichten.length > 0) {
      setRegelsImportStatus({
        bericht: uploadBerichten.join(' | '),
        fout: heeftUploadFout,
      })
    }

    setIsLoading(false)
  }, [state.userRules, state.learnedRules, state.transacties])

  const jaar = selectedYear ?? detectDominantYear(state.transacties)
  const jaarFiltered = state.transacties.filter((t) => t.datum.startsWith(String(jaar)))
  const onbekendCount = jaarFiltered.filter((t) => t.bucket === 'ONBEKEND').length
  const onbekendOntvangen = jaarFiltered
    .filter((t) => t.bucket === 'ONBEKEND' && t.bedrag > 0)
    .reduce((s, t) => s + t.bedrag, 0)
  const onbekendUitgegeven = jaarFiltered
    .filter((t) => t.bucket === 'ONBEKEND' && t.bedrag < 0)
    .reduce((s, t) => s + t.bedrag, 0)
  const categorieZonderPotje = jaarFiltered.filter((t) => t.bucket !== 'ONBEKEND' && !(t.potje ?? '').trim())
  const categorieZonderPotjeCount = categorieZonderPotje.length
  const categorieZonderPotjeOntvangen = categorieZonderPotje
    .filter((t) => t.bedrag > 0)
    .reduce((s, t) => s + t.bedrag, 0)
  const categorieZonderPotjeUitgegeven = categorieZonderPotje
    .filter((t) => t.bedrag < 0)
    .reduce((s, t) => s + t.bedrag, 0)

  const availableYears = [...new Set(
    state.transacties.map((t) => parseInt(t.datum.slice(0, 4), 10)).filter((y) => !isNaN(y)),
  )].sort()

  const stapIndex = { WELKOM: 0, UPLOAD: 1, TOEWIJZEN: 2 }[state.stap]
  const heeftTransacties = state.transacties.length > 0
  const currentJsonSnapshot = useMemo(
    () => buildOverzichtJson(jaarFiltered, state.userRules, state.learnedRules, state.potjes),
    [jaarFiltered, state.userRules, state.learnedRules, state.potjes],
  )
  const heeftWijzigingenSindsJsonOpslaan =
    (state.transacties.length > 0 || state.userRules.length > 0 || state.learnedRules.length > 0 || state.potjes.length > 0)
    && (lastSavedJsonSnapshot === null || currentJsonSnapshot !== lastSavedJsonSnapshot)

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!heeftWijzigingenSindsJsonOpslaan) return

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [heeftWijzigingenSindsJsonOpslaan])

  return (
    <div>
      {/* ── Stepper ──────────────────────────────────────────────────────── */}
      <div className="px-[10%]">
        <Stepper
          nonLinear
          activeStep={stapIndex}
          sx={{
            mt: 3,
            mb: 4,
          '& .MuiStepIcon-root': {
            fontSize: '2rem',
          },
          '& .MuiStepLabel-label': {
            fontSize: '0.875rem',
            lineHeight: 1.43,
          },
          '& .MuiStepIcon-root.Mui-active, & .MuiStepIcon-root.Mui-completed': {
            color: 'success.main',
          },
          '& .MuiStepConnector-root.Mui-active .MuiStepConnector-line, & .MuiStepConnector-root.Mui-completed .MuiStepConnector-line': {
            borderColor: 'success.main',
          },
        }}
      >
        <Step completed={stapIndex > 0}>
          <StepButton sx={{ '& .MuiStepLabel-label': { color: 'text.primary' } }} onClick={() => dispatch({ type: 'NAAR_WELKOM' })}>Welkom</StepButton>
        </Step>
        <Step completed={stapIndex > 1}>
          <StepButton sx={{ '& .MuiStepLabel-label': { color: 'text.primary' } }} onClick={() => dispatch({ type: 'NAAR_UPLOAD' })}>Uploaden</StepButton>
        </Step>
        <Step completed={stapIndex > 2} disabled={!heeftTransacties}>
          <StepButton
            disabled={!heeftTransacties}
            sx={{
              '& .MuiStepLabel-label': { color: heeftTransacties ? 'text.primary' : 'text.disabled' },
              '&.Mui-disabled': {
                opacity: 0.65,
              },
              '&.Mui-disabled .MuiStepLabel-label': {
                color: '#94a3b8',
              },
              '&.Mui-disabled .MuiStepIcon-root': {
                color: '#cbd5e1',
              },
            }}
            onClick={() => dispatch({ type: 'NAAR_TOEWIJZEN' })}
          >
            Toewijzen
          </StepButton>
        </Step>
      </Stepper>
      </div>

      {/* ── WELKOM ────────────────────────────────────────────────────────── */}
      {state.stap === 'WELKOM' && (
        <div className="py-12 space-y-6 px-[10%]">
          <h1 className="text-2xl font-bold">BudgetScanner</h1>

          <p>
            Welkom terug? Of eigenlijk, gewoon welkom (want we weten helemaal niet of je hier al eerder
            was)!
          </p>

          <p>
            Met de functie 'BudgetScanner' maak je snel een helder overzicht van al je
            betalingen, bijvoorbeeld over het afgelopen jaar. Je uploadt hiervoor de afschriften die je
            van je bank hebt gedownload. Vervolgens maak je (budget)potjes aan en koppel je elke uitgave
            of inkomsten aan het juiste potje. Zo zie je precies hoeveel geld je met elk potje hebt
            uitgegeven of ontvangen. Dit is erg handig als je wilt beginnen met budgetteren, maar nog
            niet weet waar je geld naartoe gaat of vandaan komt.
          </p>

          <p>
            Privacy staat bij ons voorop. Daarom weten we niet of je hier al eens bent geweest. We
            onthouden niets van je vorige sessie; voor ons ben je elke keer nieuw. Heb je bij een eerder
            bezoek een koppelingsbestand gedownload? Dat bestand bevat de regels die bepalen welke
            betaling bij welk potje hoort. Je kunt dit bestand opnieuw uploaden. Samen met je (nieuwe)
            bankafschriften kun je zo direct verdergaan waar je gebleven was, voor een vliegende start.
          </p>

          <p>
            Nog een belangrijke privacy-voordeel: Je bestanden verlaten je computer of telefoon nooit.
            Alle verwerking gebeurt volledig in je browser, rechtstreeks op jouw apparaat. Twijfel je
            hierover? Geen probleem: open de app in je browser, zorg dat je bestanden op je apparaat staan en
            verbreek daarna je internetverbinding. Alles blijft gewoon werken, omdat we niets naar
            externe servers sturen. Je bent volledig zelf baas over je data.
          </p>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-2">
            <p className="font-semibold text-gray-900">Handig om te starten</p>
            <p>
              De <button
                type="button"
                className="text-green-700 underline hover:text-green-800"
                onClick={onToggleHelp}
              >
                online handleiding
              </button>
              : alle stappen met uitleg en schermafbeeldingen in de linkerhelft van het scherm. Je kunt de handleiding ook tonen/verbergen met de knop linksboven dit venster
            </p>
            <p>
              <a className="text-green-700 underline hover:text-green-800" href="/docs/budgetscanner/BudgetScanner.pdf" target="_blank" rel="noreferrer">
                BudgetScanner.pdf
              </a>
              : een pdf versie van de handleiding, om te bewaren of te lezen als je geen internet hebt.
            </p>
            <p>
              <a className="text-green-700 underline hover:text-green-800" href="/docs/budgetscanner/voorbeelden/demo-johan.csv" target="_blank" rel="noreferrer">
                voorbeelden/demo-johan.csv
              </a>
              : een voorbeeld van een bankbestand met alleen betalingen zonder uitgewerkte koppelingen, dus waarmee je kunt starten.
            </p>
            <p>
              <a className="text-green-700 underline hover:text-green-800" href="/docs/budgetscanner/voorbeelden/demo-johan-ingevuld.json" target="_blank" rel="noreferrer">
                voorbeelden/demo-johan-ingevuld.json
              </a>
              : een voorbeeld van een bewaard bestand met betalingen, koppelingen en regels, zodat je ziet wat het eindresultaat zou kunnen zijn.
            </p>
            <p>
              <a className="text-green-700 underline hover:text-green-800" href="/docs/budgetscanner/voorbeelden/demo-johan-ingevuld.pdf" target="_blank" rel="noreferrer">
                voorbeelden/demo-johan-ingevuld.pdf
              </a>
              : het bijbehorende jaaroverzicht als pdf, zodat je ziet hoe de uitvoer eruit ziet.
            </p>
          </div>

          <div className="flex justify-end items-center">
            <Button
              color="success"
              variant="contained"
              size="large"
              onClick={() => dispatch({ type: 'NAAR_UPLOAD' })}
            >
              Aan de slag
            </Button>
          </div>
        </div>
      )}

      {/* ── UPLOAD ────────────────────────────────────────────────────────── */}
      {state.stap === 'UPLOAD' && (
        <div className="py-12 space-y-6 px-[10%]">
          <p className="mb-8">
            Upload je bankafschriften, of bewaarde gegevens van een vorige sessie, voor een overzicht van ontvangsten en uitgaven van een jaar. Alle data blijft in je browser.
          </p>
          <div className="w-full lg:w-1/2 lg:mx-auto">
            <FileDropZone onFiles={handleFiles} isLoading={isLoading} />
          </div>
          {regelsImportStatus && (
            <p className="mt-5 text-sm">
              {regelsImportStatus.bericht}
            </p>
          )}
          <p className="mt-10 mb-4">
            Voor het eerst hier? Dan upload je één of meer bankbestanden (CSV of XML/CAMT.053). Heb je meerdere rekeningen, zoals een betaalrekening, spaarrekening en creditcard? Dan kun je die hier allemaal tegelijk aanbieden. Lees eerst even hoofdstuk 2 als je niet zeker weet welke bestanden je nu wel of niet mee wil nemen.
          </p>
          <p className="mb-4">
            Terugkomen en verdergaan? Dan upload je het JSON-bestand dat je de vorige keer hebt opgeslagen. Daarin zitten al je eerder geüploade betalingen en alle koppelingen die je al had gemaakt. Je gaat gewoon verder waar je was gebleven — je hoeft dan geen losse bankbestanden meer toe te voegen.
          </p>
          <p className="mb-4">
            Nieuwe betalingen toevoegen aan een bestaand overzicht? Dan upload je tegelijk het JSON-bestand én de nieuwe bankbestanden met de extra betalingen. BudgetScanner voegt de nieuwe betalingen toe aan wat er al in het JSON-bestand zat. Zorg wel dat je geen periodes dubbel meeneemt.
          </p>
          <p className="mb-8">
            Zodra je bestanden zijn ingelezen, zie je direct terugkoppeling onder de uploadzone. Per bestand staat de bestandsnaam en het aantal ingelezen betalingen. Zo check je snel of alles goed is gegaan.
          </p>

          <div className="mt-8 flex items-center justify-between gap-2">
            <Button
              variant="outlined"
              color="success"
              size="small"
              disabled={!heeftTransacties}
              startIcon={<DeleteOutlineOutlinedIcon fontSize="small" />}
              onClick={() => { if (window.confirm('Weet je het zeker? Alle uploads en koppelingen worden gewist.')) handleUploadsWissen() }}
            >
              Uploads wissen
            </Button>
            <Button
              color="success"
              variant="contained"
              onClick={() => dispatch({ type: 'NAAR_TOEWIJZEN' })}
              disabled={!heeftTransacties}
            >
              Toewijzen
            </Button>
          </div>
        </div>
      )}

      {/* ── TOEWIJZEN ──────────────────────────────────────────────────────── */}
      {state.stap === 'TOEWIJZEN' && (
        <div className="space-y-4">
          {/* Top bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outlined"
              color="success"
              size="small"
              startIcon={<LinkOutlinedIcon fontSize="small" />}
              onClick={() => setPotjesOpen(true)}
            >
              Koppelingregels
            </Button>

            <OpslaanButtons
              transacties={jaarFiltered}
              jaar={jaar}
              userRules={state.userRules}
              learnedRules={state.learnedRules}
              potjes={state.potjes}
              onJsonSaved={() => setLastSavedJsonSnapshot(currentJsonSnapshot)}
            />

            {availableYears.length > 1 && (
              <div className="flex items-center gap-1">
                {availableYears.map((y) => (
                  <Chip
                    key={y}
                    label={y}
                    color={y === jaar ? 'primary' : 'default'}
                    onClick={() => setSelectedYear(y)}
                    clickable
                    size="small"
                  />
                ))}
              </div>
            )}

            <div className="ml-auto">
            </div>
          </div>

          {(onbekendCount > 0 || categorieZonderPotjeCount > 0) && (
            <Alert severity="warning">
              {onbekendCount > 0 && (
                <>
                  {onbekendCount} transacties zonder categorie zijn uitgesloten van de totalen
                  {onbekendOntvangen !== 0 && (
                    <> — ontvangen: {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(onbekendOntvangen)}</>
                  )}
                  {onbekendUitgegeven !== 0 && (
                    <>, uitgegeven: {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(onbekendUitgegeven)}</>
                  )}
                </>
              )}
              {onbekendCount > 0 && categorieZonderPotjeCount > 0 && <br />}
              {categorieZonderPotjeCount > 0 && (
                <>
                  {categorieZonderPotjeCount} transacties met categorie zonder potje — ontvangen: {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(categorieZonderPotjeOntvangen)}, uitgegeven: {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(categorieZonderPotjeUitgegeven)}
                </>
              )}
            </Alert>
          )}

          <BucketCards transacties={jaarFiltered} />

          <div className="flex flex-col gap-4">
            <CategoryBreakdown
              transacties={jaarFiltered}
              potjes={state.potjes}
              userRules={state.userRules}
              learnedRules={state.learnedRules}
              onCorrectie={(ids, bucket, potje, groepCriterium, zonderRegel) =>
                dispatch({ type: 'CATEGORIE_WIJZIGEN', transactieIds: ids, bucket, potje, groepCriterium, zonderRegel })
              }
              onPotjeToevoegen={(naam, bucket) => dispatch({ type: 'POTJE_TOEVOEGEN', naam, bucket })}
            />
          </div>
        </div>
      )}

      <PotjesBeheerDialog
        open={potjesOpen}
        userRules={state.userRules}
        learnedRules={state.learnedRules}
        onRegelPatronenWijzigen={(bron, oldRegel, tegenpartijPatroon, omschrijvingPatroon, potje) =>
          dispatch({ type: 'REGEL_PATROON_OVERSCHRIJVEN', bron, oldRegel, tegenpartijPatroon, omschrijvingPatroon, potje: potje ?? null })
        }
        onSluiten={() => setPotjesOpen(false)}
        onPotjeWijzigen={(bucket, oudeNaam, nieuweNaam) =>
          dispatch({ type: 'POTJE_HERNOEMEN_BY_BUCKET_EN_NAAM', bucket, oudeNaam, nieuweNaam })
        }
      />
    </div>
  )
}
