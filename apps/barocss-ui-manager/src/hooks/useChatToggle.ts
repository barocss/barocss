import { useState, useCallback } from 'react'

export const useChatToggle = (defaultVisible: boolean = true) => {
  const [isChatVisible, setIsChatVisible] = useState(defaultVisible)

  const toggleChat = useCallback(() => {
    setIsChatVisible(prev => !prev)
  }, [])

  const showChat = useCallback(() => {
    setIsChatVisible(true)
  }, [])

  const hideChat = useCallback(() => {
    setIsChatVisible(false)
  }, [])

  return {
    isChatVisible,
    toggleChat,
    showChat,
    hideChat,
  }
}
