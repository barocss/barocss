import React from 'react'
import { Toolbar } from './Toolbar'
import { Canvas } from './Canvas'

interface RenderPanelProps {
  isChatVisible: boolean
  toggleChat: () => void
}

export const RenderPanel: React.FC<RenderPanelProps> = ({ isChatVisible, toggleChat }) => {
  // Simplified toolbar: only chat toggle

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Toolbar */}
      <Toolbar
        isChatVisible={isChatVisible}
        onToggleChat={toggleChat}
      />

      {/* Canvas */}
      <Canvas />
    </div>
  )
}
