import React, { useState, useRef, useCallback, useEffect } from 'react'

interface SplitPanelProps {
  children: [React.ReactNode, React.ReactNode]
  defaultSize?: number // percentage (0-100)
  minSize?: number // minimum percentage
  maxSize?: number // maximum percentage
  direction?: 'horizontal' | 'vertical'
  className?: string
  isFirstPanelVisible?: boolean // 첫 번째 패널의 가시성
}

export const SplitPanel: React.FC<SplitPanelProps> = ({
  children,
  defaultSize = 40,
  minSize = 20,
  maxSize = 80,
  direction = 'horizontal',
  className = '',
  isFirstPanelVisible = true
}) => {
  const [size, setSize] = useState(defaultSize)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startPosRef = useRef(0)
  const startSizeRef = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY
    startSizeRef.current = size
  }, [direction, size])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const containerSize = direction === 'horizontal' 
      ? containerRect.width 
      : containerRect.height
    
    const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
    const startPos = startPosRef.current
    const delta = currentPos - startPos
    const deltaPercent = (delta / containerSize) * 100
    
    const newSize = Math.max(
      minSize,
      Math.min(maxSize, startSizeRef.current + deltaPercent)
    )
    
    setSize(newSize)
  }, [isDragging, direction, minSize, maxSize])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp, direction])

  const isHorizontal = direction === 'horizontal'
  const firstPanelSize = isFirstPanelVisible ? size : 0
  const secondPanelSize = isFirstPanelVisible ? 100 - size : 100

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} h-full w-full ${className}`}
    >
      {/* First Panel */}
      <div
        className={`${isHorizontal ? 'flex-shrink-0' : 'flex-shrink-0'} overflow-hidden`}
        style={{
          [isHorizontal ? 'width' : 'height']: isFirstPanelVisible ? `${firstPanelSize}%` : '0',
          transition: isFirstPanelVisible ? 'none' : 'all 300ms ease-in-out'
        }}
      >
        <div 
          className={`h-full ${
            isFirstPanelVisible ? '' : 'transition-transform duration-300 ease-in-out -translate-x-full'
          }`}
          style={{
            width: isFirstPanelVisible ? '100%' : '320px' // 고정 너비는 숨김 상태에서만
          }}
        >
          {children[0]}
        </div>
      </div>

      {/* Resizer */}
      {isFirstPanelVisible && (
        <div
          className={`${
            isHorizontal 
              ? 'w-1 bg-gray-200 hover:bg-gray-300 cursor-col-resize flex-shrink-0' 
              : 'h-1 bg-gray-200 hover:bg-gray-300 cursor-row-resize flex-shrink-0'
          } transition-colors duration-200 relative group`}
          onMouseDown={handleMouseDown}
        >
        {/* Resize Handle */}
        <div
          className={`${
            isHorizontal
              ? 'absolute inset-y-0 -left-1 -right-1 flex items-center justify-center'
              : 'absolute inset-x-0 -top-1 -bottom-1 flex items-center justify-center'
          }`}
        >
          <div
            className={`${
              isHorizontal
                ? 'w-1 h-8 bg-gray-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity'
                : 'h-1 w-8 bg-gray-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity'
            }`}
          />
        </div>
        </div>
      )}

      {/* Second Panel */}
      <div
        className={`${isHorizontal ? 'flex-1' : 'flex-1'} overflow-hidden`}
        style={{
          [isHorizontal ? 'width' : 'height']: `${secondPanelSize}%`
        }}
      >
        {children[1]}
      </div>
    </div>
  )
}
