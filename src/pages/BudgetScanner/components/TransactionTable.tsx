import { Checkbox, Chip } from '@mui/material'
import { CircleHelp, Home, Pencil, PiggyBank, ShoppingCart, TrendingUp } from 'lucide-react'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import { formatTegenpartijVoorWeergave } from '../displayTegenpartij'
import type { CategorizedTransaction, Bucket } from '../types'

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

function formatEur(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

interface Props {
  transacties: CategorizedTransaction[]
  onEdit?: (tx: CategorizedTransaction) => void
  compact?: boolean
  selectable?: boolean
  isSelectableTx?: (tx: CategorizedTransaction) => boolean
  highlightTx?: (tx: CategorizedTransaction) => boolean
  selectedIds?: Set<string>
  onToggleSelect?: (txId: string, selected: boolean) => void
  onToggleSelectAll?: (txIds: string[], selected: boolean) => void
}

export function TransactionTable({
  transacties,
  onEdit,
  compact = false,
  selectable = false,
  isSelectableTx,
  highlightTx,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: Props) {
  if (transacties.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">Geen transacties</p>
  }

  const selectableTxIds = transacties
    .filter((tx) => !isSelectableTx || isSelectableTx(tx))
    .map((tx) => tx.id)
  const selectedCount = selectableTxIds.filter((id) => selectedIds?.has(id)).length
  const allSelected = selectable && selectableTxIds.length > 0 && selectedCount === selectableTxIds.length
  const partlySelected = selectable && selectedCount > 0 && selectedCount < selectableTxIds.length

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-gray-50">
          <tr>
            {selectable && (
              <th className="px-3 py-2 text-left font-medium">
                <Checkbox
                  size="small"
                  color="success"
                  checked={allSelected}
                  indeterminate={partlySelected}
                  onChange={(_, checked) => onToggleSelectAll?.(selectableTxIds, checked)}
                  inputProps={{ 'aria-label': 'Alle zichtbare transacties (de)selecteren' }}
                />
              </th>
            )}
            <th className="px-3 py-2 text-left font-medium">Datum</th>
            <th className="px-3 py-2 text-left font-medium">Tegenpartij</th>
            {!compact && <th className="px-3 py-2 text-left font-medium">Omschrijving</th>}
            <th className="px-3 py-2 text-right font-medium">Bedrag</th>
            <th className="px-3 py-2 text-left font-medium">Categorie</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {transacties.map((tx) => {
            const isHighlighted = Boolean(highlightTx?.(tx))
            return (
            <tr key={tx.id} className={`group ${isHighlighted ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'}`}>
              {selectable && (
                <td className="px-3 py-2">
                  <Checkbox
                    size="small"
                    color="success"
                    disabled={Boolean(isSelectableTx && !isSelectableTx(tx))}
                    checked={Boolean(selectedIds?.has(tx.id))}
                    onChange={(_, checked) => onToggleSelect?.(tx.id, checked)}
                    inputProps={{ 'aria-label': `Transactie op ${tx.datum} selecteren` }}
                  />
                </td>
              )}
              <td className="px-3 py-2 text-gray-500">{tx.datum}</td>
              <td className="px-3 py-2 font-medium">{formatTegenpartijVoorWeergave(tx.tegenpartij)}</td>
              {!compact && (
                <td className="max-w-xs truncate px-3 py-2 text-gray-500">{tx.omschrijving}</td>
              )}
              <td className={`px-3 py-2 text-right font-mono text-sm font-semibold ${tx.bedrag < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatEur(tx.bedrag)}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-1">
                  {(() => {
                    const BucketIcon = BUCKET_ICONS[tx.bucket]
                    return (
                      <Chip
                        label={tx.potje ?? ''}
                        icon={<BucketIcon className="h-3.5 w-3.5" />}
                        color={BUCKET_COLORS[tx.bucket]}
                        size="small"
                        variant={tx.isHandmatig ? 'filled' : 'outlined'}
                        sx={tx.potje ? { '& .MuiChip-icon': { marginLeft: '6px' } } : { '& .MuiChip-label': { display: 'none' }, '& .MuiChip-icon': { marginLeft: '6px', marginRight: '6px' } }}
                      />
                    )
                  })()}
                  {tx.isDuplicaat && (
                    <Chip label="duplicaat" color="warning" size="small" variant="outlined" />
                  )}
                  <button
                    className="invisible rounded p-0.5 hover:bg-gray-100 group-hover:visible"
                    aria-label={`Categorie wijzigen voor ${formatTegenpartijVoorWeergave(tx.tegenpartij)}`}
                    onClick={(e) => { e.stopPropagation(); onEdit?.(tx) }}
                  >
                    <Pencil className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </div>
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
