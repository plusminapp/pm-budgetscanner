import { useState, type ElementType } from 'react'
import type { CategorizedTransaction, Bucket } from '../types'
import { TrendingUp, ShoppingCart, Home, PiggyBank } from 'lucide-react'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import { Chip } from '@mui/material'

interface Props {
  transacties: CategorizedTransaction[]
}

interface BucketConfig {
  bucket: Bucket
  label: string
  icon: ElementType
  colorClass: string
  bgClass: string
}

const BUCKET_CONFIG: BucketConfig[] = [
  { bucket: 'INKOMEN',      label: 'Inkomsten',    icon: TrendingUp,   colorClass: 'text-green-600',  bgClass: 'bg-green-50' },
  { bucket: 'LEEFGELD',     label: 'Leefgeld',     icon: ShoppingCart, colorClass: 'text-red-600',    bgClass: 'bg-red-50' },
  { bucket: 'VASTE_LASTEN', label: 'Vaste lasten', icon: Home,         colorClass: 'text-blue-600',   bgClass: 'bg-blue-50' },
  { bucket: 'SPAREN',       label: 'Sparen',       icon: PiggyBank,    colorClass: 'text-amber-600',  bgClass: 'bg-amber-50' },
  { bucket: 'NEGEREN',      label: 'Negeren',      icon: VisibilityOffOutlinedIcon, colorClass: 'text-gray-600', bgClass: 'bg-gray-100' },
]

function formatEur(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

export function BucketCards({ transacties }: Props) {
  const [toonPotjesPerBucket, setToonPotjesPerBucket] = useState<Partial<Record<Bucket, boolean>>>({})
  const aantalMaanden = new Set(transacties.map((t) => t.datum.slice(0, 7))).size || 1

  const totals = Object.fromEntries(
    BUCKET_CONFIG.map(({ bucket }) => [
      bucket,
      transacties.filter((t) => t.bucket === bucket).reduce((sum, t) => sum + t.bedrag, 0),
    ]),
  ) as Record<Bucket, number>

  const potjeTotalsPerBucket = Object.fromEntries(
    BUCKET_CONFIG.map(({ bucket }) => {
      const bucketTxs = transacties.filter((t) => t.bucket === bucket)
      const map = new Map<string, { potjeNaam: string; totaal: number; count: number }>()
      for (const tx of bucketTxs) {
        const potjeNaam = tx.potje?.trim() || 'Zonder potje'
        const entry = map.get(potjeNaam) ?? { potjeNaam, totaal: 0, count: 0 }
        entry.totaal += tx.bedrag
        entry.count += 1
        map.set(potjeNaam, entry)
      }
      return [
        bucket,
        [...map.values()].sort((a, b) => Math.abs(b.totaal) - Math.abs(a.totaal)),
      ]
    }),
  ) as Record<Bucket, Array<{ potjeNaam: string; totaal: number; count: number }>>

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
      {BUCKET_CONFIG.map(({ bucket, label, icon: Icon, colorClass, bgClass }) => (
        <div
          key={bucket}
          className="min-w-0 rounded-xl border bg-white p-4 text-center shadow-sm"
          style={{ containerType: 'inline-size' }}
        >
          <div className="flex min-w-0 items-center justify-center gap-2">
            <div className={`rounded-lg p-2 ${bgClass}`}>
              <Icon
                className={colorClass}
                aria-hidden="true"
                style={{ width: '1.25rem', height: '1.25rem' }}
              />
            </div>
            <span className="min-w-0 break-words text-sm font-medium leading-tight text-gray-500">{label}</span>
          </div>
          <p className={`mt-3 break-words text-2xl font-bold leading-tight ${colorClass}`}>
            {formatEur(totals[bucket])}
          </p>
          <p className="mt-1 break-words text-xs leading-tight text-gray-500">
            Gem. {formatEur(totals[bucket] / aantalMaanden)} / maand
          </p>

          <div className="mt-3 border-t pt-2">
            <button
              type="button"
              className="text-xs font-medium text-gray-600 hover:text-gray-900"
              onClick={() =>
                setToonPotjesPerBucket((current) => ({
                  ...current,
                  [bucket]: !current[bucket],
                }))
              }
            >
              {toonPotjesPerBucket[bucket] ? 'Verberg potjes' : 'Toon potjes'}
            </button>

            {toonPotjesPerBucket[bucket] && (
              <div className="mt-2 space-y-1.5">
                {potjeTotalsPerBucket[bucket].length === 0 && (
                  <p className="text-xs text-gray-500">Geen transacties</p>
                )}
                {potjeTotalsPerBucket[bucket].map(({ potjeNaam, totaal, count }) => (
                  <div key={`${bucket}-${potjeNaam}`} className="flex min-w-0 items-center justify-center gap-2">
                    <Chip
                      size="small"
                      label={potjeNaam}
                      icon={<Icon className="h-3.5 w-3.5" />}
                      variant="outlined"
                      sx={{
                        maxWidth: '100%',
                        minWidth: 0,
                        '& .MuiChip-label': {
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        },
                      }}
                    />
                    <span className="shrink-0 text-xs text-gray-700">
                      {formatEur(totaal)} ({count})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
