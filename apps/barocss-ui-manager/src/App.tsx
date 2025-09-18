import React from 'react'
import { BaroCSSProvider } from './providers/BaroCSSProvider'
import { ThemeProvider } from './providers/ThemeProvider'
import { WindowManagerProvider, useWindowManager } from './providers/WindowManagerProvider'
import { ChatProvider } from './providers/ChatProvider'
import { ChatPanel } from './components/ChatPanel'
import { RenderPanel } from './components/RenderPanel'
import { WindowManager } from './components/WindowManager'
import { ModalManager } from './components/ModalManager'
import { NotificationManager } from './components/NotificationManager'
import { SplitPanel } from './components/SplitPanel'
import { useChatToggle } from './hooks/useChatToggle'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

const AppContent: React.FC = () => {
  const { handleAIResponse } = useWindowManager()
  const { isChatVisible, toggleChat } = useChatToggle(true)
  
  // Keyboard shortcuts
  useKeyboardShortcuts({
    onToggleChat: toggleChat,
  })
  
  return (
    <BaroCSSProvider onAIResponse={handleAIResponse}>
      <div className="w-screen h-dvh flex flex-col bg-gray-50">
        {/* Main Content Area */}
        <div className="flex-1 flex">
          <SplitPanel 
            defaultSize={isChatVisible ? 40 : 0}
            minSize={isChatVisible ? 25 : 0}
            maxSize={isChatVisible ? 75 : 0}
            direction="horizontal"
            className="flex-1"
            isFirstPanelVisible={isChatVisible}
          >
            <ChatPanel />
            <RenderPanel isChatVisible={isChatVisible} toggleChat={toggleChat} />
          </SplitPanel>
        </div>
      </div>
      <WindowManager />
      <ModalManager />
      <NotificationManager />
    </BaroCSSProvider>
  )
}

function App() {
  return (
    <ThemeProvider>
      <WindowManagerProvider>
        <ChatProvider>
          <AppContent />
        </ChatProvider>
      </WindowManagerProvider>
    </ThemeProvider>
  )
}

export default App
