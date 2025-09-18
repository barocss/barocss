import React, { useRef, useEffect, forwardRef } from 'react'

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string
  minRows?: number
  maxRows?: number
}

export const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ className = '', minRows = 1, maxRows = 6, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const adjustHeight = () => {
      const textarea = textareaRef.current
      if (!textarea) return

      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto'
      
      // Calculate the height based on content
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20
      const minHeight = lineHeight * minRows
      const maxHeight = lineHeight * maxRows
      
      const scrollHeight = textarea.scrollHeight
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
      
      textarea.style.height = `${newHeight}px`
    }

    useEffect(() => {
      adjustHeight()
    }, [props.value])

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      adjustHeight()
      if (props.onInput) {
        props.onInput(e)
      }
    }

    return (
      <textarea
        ref={ref || textareaRef}
        className={`resize-none overflow-hidden ${className}`}
        onInput={handleInput}
        {...props}
      />
    )
  }
)

AutoResizeTextarea.displayName = 'AutoResizeTextarea'
