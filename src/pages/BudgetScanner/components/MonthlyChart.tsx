import { useMemo } from 'react'
import { AgCharts } from 'ag-charts-react'
import type { AgChartOptions } from 'ag-charts-community'
import type { CategorizedTransaction } from '../types'

interface Props {
  transacties: CategorizedTransaction[]
}

const MAANDEN = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

function buildChartData(transacties: CategorizedTransaction[]) {
  return MAANDEN.map((maand, i) => {
    const month = i + 1
    const inMonth = transacties.filter(
      (t) => parseInt(t.datum.slice(5, 7), 10) === month,
    )
    return {
      maand,
      inkomen:     inMonth.filter((t) => t.bucket === 'INKOMEN').reduce((s, t) => s + t.bedrag, 0),
      leefgeld:    Math.abs(inMonth.filter((t) => t.bucket === 'LEEFGELD').reduce((s, t) => s + t.bedrag, 0)),
      vasteLasten: Math.abs(inMonth.filter((t) => t.bucket === 'VASTE_LASTEN').reduce((s, t) => s + t.bedrag, 0)),
      sparen:      Math.abs(inMonth.filter((t) => t.bucket === 'SPAREN').reduce((s, t) => s + t.bedrag, 0)),
      negeren:     Math.abs(inMonth.filter((t) => t.bucket === 'NEGEREN').reduce((s, t) => s + t.bedrag, 0)),
    }
  })
}

export function MonthlyChart({ transacties }: Props) {
  const options: AgChartOptions = useMemo(() => ({
    data: buildChartData(transacties),
    series: [
      { type: 'bar', xKey: 'maand', yKey: 'inkomen',     yName: 'Inkomsten',    fill: '#22c55e', stacked: true },
      { type: 'bar', xKey: 'maand', yKey: 'leefgeld',    yName: 'Leefgeld',     fill: '#ef4444', stacked: true },
      { type: 'bar', xKey: 'maand', yKey: 'vasteLasten', yName: 'Vaste lasten', fill: '#3b82f6', stacked: true },
      { type: 'bar', xKey: 'maand', yKey: 'sparen',      yName: 'Sparen',       fill: '#f59e0b', stacked: true },
      { type: 'bar', xKey: 'maand', yKey: 'negeren',     yName: 'Negeren',      fill: '#6b7280', stacked: true },
    ],
    axes: [
      { type: 'category', position: 'bottom' },
      {
        type: 'number',
        position: 'left',
        label: {
          formatter: ({ value }: { value: number }) =>
            new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value),
        },
      },
    ],
    legend: { position: 'bottom' },
  }), [transacties])

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <AgCharts options={options} style={{ height: 320 }} />
    </div>
  )
}
