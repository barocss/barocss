import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'default', 
  size = 'md', 
  className = '', 
  children, 
  ...props 
}) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer disabled:pointer-events-none disabled:opacity-50'
  
  const variantClasses = {
    // 보다 절제된 회색 톤 기본 버튼
    default: 'bg-gray-900 text-white hover:bg-gray-800 focus-visible:ring-gray-700',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500',
    ghost: 'hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-500',
    destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500'
  }
  
  const sizeClasses = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
    lg: 'h-10 px-6 text-base'
  }
  
  return (
    <button 
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
