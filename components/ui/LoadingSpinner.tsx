interface LoadingSpinnerProps {
  size?: number
  color?: string
}

export default function LoadingSpinner({
  size = 24,
  color = 'var(--color-primary)',
}: LoadingSpinnerProps) {
  return (
    <div
      className="rounded-full border-2 border-t-transparent animate-spin"
      style={{
        width: size,
        height: size,
        borderColor: color,
        borderTopColor: 'transparent',
      }}
    />
  )
}
