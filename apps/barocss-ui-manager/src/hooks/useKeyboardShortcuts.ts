import { useEffect, useCallback } from 'react'

interface KeyboardShortcuts {
  onSendMessage?: () => void
  onNewChat?: () => void
  onSettings?: () => void
  onFocusInput?: () => void
  onSwitchTab?: (direction: 'next' | 'prev') => void
  onHelp?: () => void
  onToggleChat?: () => void // Ctrl+\
}

export const useKeyboardShortcuts = ({
  onSendMessage,
  onNewChat,
  onSettings,
  onFocusInput,
  onSwitchTab,
  onHelp,
  onToggleChat
}: KeyboardShortcuts) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ctrl/Cmd + Enter: Send message
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      onSendMessage?.()
      return
    }

    // Ctrl/Cmd + N: New chat
    if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
      event.preventDefault()
      onNewChat?.()
      return
    }

    // Ctrl/Cmd + ,: Settings
    if ((event.ctrlKey || event.metaKey) && event.key === ',') {
      event.preventDefault()
      onSettings?.()
      return
    }

    // Ctrl/Cmd + K: Focus input
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault()
      onFocusInput?.()
      return
    }

    // Ctrl/Cmd + Tab: Switch to next tab
    if ((event.ctrlKey || event.metaKey) && event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault()
      onSwitchTab?.('next')
      return
    }

    // Ctrl/Cmd + Shift + Tab: Switch to previous tab
    if ((event.ctrlKey || event.metaKey) && event.key === 'Tab' && event.shiftKey) {
      event.preventDefault()
      onSwitchTab?.('prev')
      return
    }

    // Ctrl/Cmd + ?: Help
    if ((event.ctrlKey || event.metaKey) && event.key === '/') {
      event.preventDefault()
      onHelp?.()
      return
    }

    // Ctrl/Cmd + \\ : Toggle chat
    if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
      event.preventDefault()
      onToggleChat?.()
      return
    }

    // Escape: Close modals
    if (event.key === 'Escape') {
      // This will be handled by individual components
      return
    }
  }, [onSendMessage, onNewChat, onSettings, onFocusInput, onSwitchTab, onHelp])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
