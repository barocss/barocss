import React from 'react'
import { XMarkIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'

interface ToolbarProps {
  isChatVisible: boolean
  onToggleChat: () => void
}

export const Toolbar: React.FC<ToolbarProps> = ({
  isChatVisible,
  onToggleChat,
}) => {
  return (
    <div className="h-12 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 flex items-center">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleChat}
          className={`w-8 h-8 rounded-lg shadow-sm transition-colors duration-200 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            isChatVisible 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
          }`}
          title={isChatVisible ? 'Hide Chat (Ctrl+\\)' : 'Show Chat (Ctrl+\\)'}
        >
          {isChatVisible ? (
            <XMarkIcon className="w-4 h-4" />
          ) : (
            <ChatBubbleLeftRightIcon className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  )
}
