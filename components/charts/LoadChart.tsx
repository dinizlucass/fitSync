'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface LoadChartProps {
  data: { date: string; weight: number; isPR: boolean }[]
}

function CustomDot(props: {
  cx?: number
  cy?: number
  payload?: { isPR: boolean }
}) {
  const { cx, cy, payload } = props
  if (!cx || !cy) return null
  if (payload?.isPR) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="var(--color-fat)" />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize="9" fill="var(--color-fat)" fontWeight="600">PR</text>
      </g>
    )
  }
  return <circle cx={cx} cy={cy} r={3} fill="var(--color-primary)" />
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; payload: { isPR: boolean } }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg px-3 py-2 shadow-sm text-xs border"
      style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
    >
      <p style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <div className="flex items-center gap-1">
        <p className="font-medium" style={{ color: 'var(--color-primary)' }}>{payload[0].value} kg</p>
        {payload[0].payload.isPR && (
          <span className="text-xs font-medium px-1 rounded" style={{ backgroundColor: '#fff8e1', color: 'var(--color-fat)' }}>PR</span>
        )}
      </div>
    </div>
  )
}

export default function LoadChart({ data }: LoadChartProps) {
  const chartData = data.map(d => ({
    date: format(parseISO(d.date), 'd MMM', { locale: ptBR }),
    weight: d.weight,
    isPR: d.isPR,
  }))

  const weights = data.map(d => d.weight)
  const minWeight = Math.floor(Math.min(...weights) - 2)
  const maxWeight = Math.ceil(Math.max(...weights) + 2)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 16, right: 5, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[minWeight, maxWeight]}
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="var(--color-primary)"
          strokeWidth={2}
          dot={<CustomDot />}
          activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--color-primary)' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
