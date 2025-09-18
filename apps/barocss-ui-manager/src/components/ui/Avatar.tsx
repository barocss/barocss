import React from 'react'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClassMap: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(({ 
  className = '', 
  src, 
  alt = '', 
  fallback = '', 
  size = 'md', 
  ...props 
}, ref) => {
  const [isImageError, setIsImageError] = React.useState(false)
  const showImage = !!src && !isImageError

  return (
    <div
      ref={ref}
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-600 ${sizeClassMap[size]} ${className}`}
      {...props}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src || ''}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setIsImageError(true)}
        />
      ) : (
        <span aria-hidden className="select-none uppercase">{fallback?.slice(0, 2)}</span>
      )}
    </div>
  )
})

Avatar.displayName = 'Avatar'

export { Avatar }
