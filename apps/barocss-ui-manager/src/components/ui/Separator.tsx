import React from 'react'

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
  decorative?: boolean
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(({ 
  className = '', 
  orientation = 'horizontal', 
  decorative = true, 
  ...props 
}, ref) => {
  const isVertical = orientation === 'vertical'
  return (
    <div
      ref={ref}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      className={`shrink-0 bg-gray-200 ${isVertical ? 'w-px h-full' : 'h-px w-full'} ${className}`}
      {...props}
    />
  )
})

Separator.displayName = 'Separator'

export { Separator }
