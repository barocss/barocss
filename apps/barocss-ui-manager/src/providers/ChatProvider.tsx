import React, { createContext, useContext, useReducer, useCallback } from 'react'
import { ChatSession, ChatMessage, ChatState, ChatAction } from '../types/chat'

const initialChatState: ChatState = {
  sessions: [],
  activeSessionId: null,
  isLoading: false,
}

const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'CREATE_SESSION': {
      const newSession: ChatSession = {
        ...action.payload,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      }
      
      return {
        ...state,
        sessions: [newSession, ...state.sessions.map(s => ({ ...s, isActive: false }))],
        activeSessionId: newSession.id,
      }
    }
    
    case 'UPDATE_SESSION':
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === action.payload.id
            ? { ...session, ...action.payload.updates, updatedAt: Date.now() }
            : session
        ),
      }
    
    case 'DELETE_SESSION': {
      const remainingSessions = state.sessions.filter(s => s.id !== action.payload)
      const newActiveSessionId = remainingSessions.length > 0 
        ? remainingSessions[0].id 
        : null
      
      return {
        ...state,
        sessions: remainingSessions,
        activeSessionId: newActiveSessionId,
      }
    }
    
    case 'SET_ACTIVE_SESSION':
      return {
        ...state,
        sessions: state.sessions.map(session => ({
          ...session,
          isActive: session.id === action.payload
        })),
        activeSessionId: action.payload,
      }
    
    case 'ADD_MESSAGE':
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === action.payload.sessionId
            ? {
                ...session,
                messages: [...session.messages, action.payload.message],
                updatedAt: Date.now(),
              }
            : session
        ),
      }
    
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === action.payload.sessionId
            ? {
                ...session,
                messages: session.messages.map(message =>
                  message.id === action.payload.messageId
                    ? { ...message, ...action.payload.updates }
                    : message
                ),
                updatedAt: Date.now(),
              }
            : session
        ),
      }
    
    case 'DELETE_MESSAGE':
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === action.payload.sessionId
            ? {
                ...session,
                messages: session.messages.filter(m => m.id !== action.payload.messageId),
                updatedAt: Date.now(),
              }
            : session
        ),
      }
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      }
    
    default:
      return state
  }
}

interface ChatContextType extends ChatState {
  createSession: (title?: string) => string
  updateSession: (id: string, updates: Partial<ChatSession>) => void
  deleteSession: (id: string) => void
  setActiveSession: (id: string) => void
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void
  deleteMessage: (sessionId: string, messageId: string) => void
  setLoading: (loading: boolean) => void
  getActiveSession: () => ChatSession | null
  getSession: (id: string) => ChatSession | null
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export const useChat = () => {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}

interface ChatProviderProps {
  children: React.ReactNode
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialChatState)

  const createSession = useCallback((title?: string) => {
    const sessionTitle = title || `New Chat ${state.sessions.length + 1}`
    const sessionId = `session-${Date.now()}`
    
    dispatch({
      type: 'CREATE_SESSION',
      payload: {
        id: sessionId,
        title: sessionTitle,
        messages: [{
          id: 'welcome',
          role: 'assistant',
          content: 'Hello! I\'m your AI assistant. I can help you create windows, modals, notifications, and other UI components. What would you like to build today?',
          timestamp: Date.now()
        }]
      }
    })
    
    return sessionId
  }, [state.sessions.length])

  const updateSession = useCallback((id: string, updates: Partial<ChatSession>) => {
    dispatch({ type: 'UPDATE_SESSION', payload: { id, updates } })
  }, [])

  const deleteSession = useCallback((id: string) => {
    dispatch({ type: 'DELETE_SESSION', payload: id })
  }, [])

  const setActiveSession = useCallback((id: string) => {
    dispatch({ type: 'SET_ACTIVE_SESSION', payload: id })
  }, [])

  const addMessage = useCallback((sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}`,
      timestamp: Date.now(),
    }
    dispatch({ type: 'ADD_MESSAGE', payload: { sessionId, message: newMessage } })
  }, [])

  const updateMessage = useCallback((sessionId: string, messageId: string, updates: Partial<ChatMessage>) => {
    dispatch({ type: 'UPDATE_MESSAGE', payload: { sessionId, messageId, updates } })
  }, [])

  const deleteMessage = useCallback((sessionId: string, messageId: string) => {
    dispatch({ type: 'DELETE_MESSAGE', payload: { sessionId, messageId } })
  }, [])

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading })
  }, [])

  const getActiveSession = useCallback(() => {
    if (!state.activeSessionId) return null
    return state.sessions.find(s => s.id === state.activeSessionId) || null
  }, [state.activeSessionId, state.sessions])

  const getSession = useCallback((id: string) => {
    return state.sessions.find(s => s.id === id) || null
  }, [state.sessions])

  const contextValue = {
    ...state,
    createSession,
    updateSession,
    deleteSession,
    setActiveSession,
    addMessage,
    updateMessage,
    deleteMessage,
    setLoading,
    getActiveSession,
    getSession,
  }

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  )
}
