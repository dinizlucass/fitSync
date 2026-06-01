'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface WeightChartProps {
  data: { date: string; weight: number }[]
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg px-3 py-2 shadow-sm text-xs border"
      style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
    >
      <p style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p className="font-medium" style={{ color: 'var(--color-primary)' }}>{payload[0].value.toFixed(1)} kg</p>
    </div>
  )
}

export default function WeightChart({ data }: WeightChartProps) {
  const chartData = data.map(d => ({
    date: format(parseISO(d.date), 'd MMM', { locale: ptBR }),
    weight: d.weight,
  }))

  const weights = data.map(d => d.weight)
  const minWeight = Math.floor(Math.min(...weights) - 1)
  const maxWeight = Math.ceil(Math.max(...weights) + 1)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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
          dot={{ fill: 'var(--color-primary)', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
