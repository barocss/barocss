import React, { useState, useRef, useEffect } from 'react'
import { WindowState } from '../types/window'
import { useWindowManager } from '../providers/WindowManagerProvider'
import { Button } from './ui/Button'
import { useBaroCSS } from '../providers/BaroCSSProvider'

interface WindowProps {
  window: WindowState
}

export const Window: React.FC<WindowProps> = ({ window }) => {
  const { updateWindow, closeWindow, minimizeWindow, maximizeWindow, restoreWindow, focusWindow, bringToFront } = useWindowManager()
  const { director } = useBaroCSS()
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const windowRef = useRef<HTMLDivElement>(null)

  // Focus window when clicked
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.window-titlebar')) {
      focusWindow(window.id)
      bringToFront(window.id)
    }
  }

  // Drag functionality
  const handleTitleBarMouseDown = (e: React.MouseEvent) => {
    if (!window.metadata.draggable) return
    
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX - window.position.x,
      y: e.clientY - window.position.y
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && window.metadata.draggable) {
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y
      
      updateWindow(window.id, {
        position: { x: newX, y: newY }
      })
    }
    
    if (isResizing && window.metadata.resizable) {
      const newWidth = Math.max(window.size.minWidth || 200, resizeStart.width + (e.clientX - resizeStart.x))
      const newHeight = Math.max(window.size.minHeight || 150, resizeStart.height + (e.clientY - resizeStart.y))
      
      updateWindow(window.id, {
        size: {
          ...window.size,
          width: newWidth,
          height: newHeight
        }
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
  }

  // Resize functionality
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!window.metadata.resizable) return
    
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: window.size.width,
      height: window.size.height
    })
  }

  // Event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, dragStart, resizeStart, window.metadata.draggable, window.metadata.resizable])

  // Window actions
  const handleClose = () => {
    if (window.metadata.closable) {
      closeWindow(window.id)
    }
  }

  const handleMinimize = () => {
    if (window.metadata.minimizable) {
      minimizeWindow(window.id)
    }
  }

  const handleMaximize = () => {
    if (window.metadata.maximizable) {
      if (window.isMaximized) {
        restoreWindow(window.id)
      } else {
        maximizeWindow(window.id)
      }
    }
  }

  if (window.isMinimized) {
    return null
  }

  return (
    <div
      ref={windowRef}
      className={`absolute bg-white border border-gray-300 shadow-lg rounded-lg overflow-hidden ${
        window.isFocused ? 'ring-2 ring-blue-500' : ''
      } ${isDragging ? 'cursor-move' : ''} ${isResizing ? 'cursor-nw-resize' : ''}`}
      style={{
        left: window.position.x,
        top: window.position.y,
        width: window.size.width,
        height: window.size.height,
        zIndex: window.zIndex
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Title Bar */}
      <div 
        className="window-titlebar flex items-center justify-between bg-gray-100 px-3 py-2 border-b cursor-move select-none"
        onMouseDown={handleTitleBarMouseDown}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 truncate">
            {window.title}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {window.metadata.minimizable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMinimize}
              className="h-6 w-6 p-0 hover:bg-gray-200"
            >
              −
            </Button>
          )}
          
          {window.metadata.maximizable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMaximize}
              className="h-6 w-6 p-0 hover:bg-gray-200"
            >
              {window.isMaximized ? '⧉' : '⧈'}
            </Button>
          )}
          
          {window.metadata.closable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0 hover:bg-red-200 text-red-600"
            >
              ×
            </Button>
          )}
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 overflow-auto h-full">
        <div 
          className="p-4 h-full"
          dangerouslySetInnerHTML={{ __html: window.content }}
          onClick={(e) => {
            const target = e.target as HTMLElement
            const actionEl = target.closest('[data-action-id]') as HTMLElement | null
            if (actionEl) {
              const actionId = actionEl.getAttribute('data-action-id') || ''
              if (director) {
                // Send the action id back to the agent as a follow-up request
                director.request(`action:${actionId}`)
              }
            }
          }}
        />
      </div>

      {/* Resize Handle */}
      {window.metadata.resizable && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize"
          onMouseDown={handleResizeMouseDown}
        >
          <div className="absolute bottom-1 right-1 w-2 h-2 bg-gray-400 opacity-50"></div>
        </div>
      )}
    </div>
  )
}
