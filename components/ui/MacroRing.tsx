interface MacroRingProps {
  consumed: number
  goal: number
  size?: number
  strokeWidth?: number
  label?: string
  color?: string
}

export default function MacroRing({
  consumed,
  goal,
  size = 120,
  strokeWidth = 10,
  label,
  color = 'var(--color-primary)',
}: MacroRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percent = goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0
  const offset = circumference - (percent / 100) * circumference
  const center = size / 2

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke="var(--color-border)"
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-medium" style={{ fontSize: size * 0.16 }}>{Math.round(consumed)}</span>
        {label && (
          <span style={{ fontSize: size * 0.1, color: 'var(--color-text-muted)' }}>{label}</span>
        )}
        <span style={{ fontSize: size * 0.1, color: 'var(--color-text-muted)' }}>/ {Math.round(goal)}</span>
      </div>
    </div>
  )
}
