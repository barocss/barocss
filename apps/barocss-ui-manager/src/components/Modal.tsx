import React, { useEffect } from 'react'
import { ModalState } from '../types/window'
import { useWindowManager } from '../providers/WindowManagerProvider'
import { Button } from './ui/Button'

interface ModalProps {
  modal: ModalState
}

export const Modal: React.FC<ModalProps> = ({ modal }) => {
  const { closeModal } = useWindowManager()

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal(modal.id)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [modal.id, closeModal])

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeModal(modal.id)
    }
  }

  // Handle action button click
  const handleActionClick = (actionId: string) => {
    // Find the action and execute its onClick if available
    const action = modal.actions?.find(a => a.id === actionId)
    if (action?.onClick) {
      action.onClick()
    }
    
    // Close modal after action (unless it's a cancel action)
    if (actionId !== 'cancel') {
      closeModal(modal.id)
    }
  }

  if (!modal.isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden"
        style={{
          width: modal.size.width,
          height: modal.size.height,
          zIndex: modal.zIndex
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {modal.title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => closeModal(modal.id)}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            ×
          </Button>
        </div>

        {/* Modal Content */}
        <div className="p-4 overflow-auto max-h-[calc(90vh-120px)]">
          <div 
            dangerouslySetInnerHTML={{ __html: modal.content }}
          />
        </div>

        {/* Modal Actions */}
        {modal.actions && modal.actions.length > 0 && (
          <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
            {modal.actions.map((action) => (
              <Button
                key={action.id}
                variant={action.variant === 'primary' ? 'default' : 'secondary'}
                onClick={() => handleActionClick(action.id)}
                className={
                  action.variant === 'danger' 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : ''
                }
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

