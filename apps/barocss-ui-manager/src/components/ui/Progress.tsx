import React from 'react'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
}

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max)

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({ className = '', value = 0, max = 100, ...props }, ref) => {
  const percent = clamp(max === 0 ? 0 : (value / max) * 100, 0, 100)
  return (
    <div ref={ref} className={`relative h-2 w-full overflow-hidden rounded-full bg-gray-200 ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(percent)} {...props}>
      <div className="h-full w-full flex-1">
        <div className="h-full bg-gray-900 transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
})

Progress.displayName = 'Progress'

export { Progress }
