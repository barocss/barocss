import React, { useState, useRef, useCallback, KeyboardEvent, useEffect, useMemo } from 'react'
import { Button } from './ui/Button'
import { AutoResizeTextarea } from './ui/AutoResizeTextarea'
import { FileUpload } from './FileUpload'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/Tooltip'
import { DocumentIcon, XMarkIcon, BoltIcon } from '@heroicons/react/24/outline'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: (message: string) => void
  onFileSelect: (files: File[]) => void
  uploadedFiles: File[]
  disabled?: boolean
  placeholder?: string
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onFileSelect,
  uploadedFiles,
  disabled = false,
  placeholder = "Describe what you want to build..."
}) => {
  const [isFocused, setIsFocused] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [toolbarElevated, setToolbarElevated] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !disabled) {
        onSend(value.trim())
      }
    }
  }, [value, onSend, disabled])

  const handleSend = useCallback(() => {
    if (value.trim() && !disabled) {
      onSend(value.trim())
    }
  }, [value, onSend, disabled])

  const removeFile = useCallback((index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index)
    onFileSelect(newFiles)
  }, [uploadedFiles, onFileSelect])

  // Drag & drop (visual only; FileUpload handles actual selection)
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) setIsDraggingOver(true)
  }
  const handleDragLeave = () => setIsDraggingOver(false)
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingOver(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      // Adapt to FileUpload signature: call per file
      files.forEach((f) => onFileSelect([f]))
    }
  }

  // Observe scroll to elevate toolbar with shadow
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setToolbarElevated(el.scrollTop > 0)
    el.addEventListener('scroll', onScroll)
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Build previews for image files (revoke when list changes)
  const previews = useMemo(() => {
    return uploadedFiles.map(file => ({
      file,
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    }))
  }, [uploadedFiles])

  useEffect(() => {
    return () => {
      previews.forEach(p => p.url && URL.revokeObjectURL(p.url))
    }
  }, [previews])

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    if (mb >= 1) return `${mb.toFixed(1)}MB`
    const kb = bytes / 1024
    return `${Math.ceil(kb)}KB`
  }

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Uploaded files (limit to 5 with +N badge) */}
      {uploadedFiles.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex flex-wrap gap-2">
            {previews.slice(0, 5).map((p, index) => (
              <div
                key={`${p.file.name}-${index}`}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs shadow-sm"
              >
                {p.url ? (
                  <img src={p.url} alt={p.file.name} className="w-6 h-6 rounded object-cover" />
                ) : (
                  <DocumentIcon className="w-4 h-4 text-gray-500" />
                )}
                <span className="text-gray-700 truncate max-w-[120px]" title={p.file.name}>{p.file.name}</span>
                <span className="text-gray-400">{formatSize(p.file.size)}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="파일 제거"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
            {uploadedFiles.length > 5 && (
              <div className="px-2 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-600">
                +{uploadedFiles.length - 5}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input area */}
      <div
        className={`relative transition-all duration-200 rounded-2xl border border-gray-200 bg-white shadow-sm focus-within:border-gray-300 focus-within:bg-gray-50 ${
          isFocused ? 'border-gray-300 bg-gray-50 ring-2 ring-blue-500/20 shadow-md' : ''
        } ${isDraggingOver ? 'bg-blue-50/50' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Textarea (scrollable when content exceeds max height) */}
        <div className="p-4 pt-4">
          <div ref={scrollRef} className="max-h-56 overflow-y-auto pr-1">
          <AutoResizeTextarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            placeholder={placeholder}
            className={`
              w-full px-3 py-2 border-0 bg-transparent rounded-2xl
              focus:outline-none focus:ring-0
              placeholder:text-gray-400 disabled:text-gray-500
              resize-none overflow-hidden
              text-sm leading-relaxed
            `}
            minRows={2}
            maxRows={8}
          />
          </div>
        </div>

        {/* Toolbar under textarea (sticky with shadow when scrolled) */}
        <div className={`px-3 pb-3 pt-2 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl ${
          toolbarElevated ? 'shadow-[0_-6px_12px_-8px_rgba(0,0,0,0.15)]' : ''
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <FileUpload
                      onFileSelect={(file) => onFileSelect([file])}
                      accept="image/*,.pdf,.txt,.md"
                      maxSize={10}
                      disabled={disabled}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Attach files</TooltipContent>
              </Tooltip>
              <span className="text-[11px] text-gray-500 hidden sm:inline">Enter to send • Shift+Enter new line</span>
            </div>

            <Button
              variant="secondary"
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              size="sm"
              className={`
                h-9 px-3 rounded-full transition-all duration-200 flex items-center gap-1
                ${value.trim() && !disabled ? '' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
              `}
            >
              <BoltIcon className="w-4 h-4" />
              <span className="text-xs">Send</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
