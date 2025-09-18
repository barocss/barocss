import React, { useRef, useState } from 'react'
import { Button } from './ui/Button'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept?: string
  maxSize?: number // in MB
  disabled?: boolean
  className?: string
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  accept = '*/*', 
  maxSize = 10,
  disabled = false,
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileSelect = (file: File) => {
    if (file.size > maxSize * 1024 * 1024) {
      alert(`파일 크기는 ${maxSize}MB를 초과할 수 없습니다.`)
      return
    }
    onFileSelect(file)
  }

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
    // Reset input value to allow selecting the same file again
    event.target.value = ''
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    if (!disabled) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
    
    if (disabled) return

    const file = event.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`relative ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={`h-8 w-8 p-0 ${isDragOver ? 'bg-blue-100' : ''}`}
          >
            📎
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>파일 업로드 (최대 {maxSize}MB)</p>
      </TooltipContent>
      
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
    </Tooltip>
  )
}
