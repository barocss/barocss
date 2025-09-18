export interface ChatSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
  isActive: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  metadata?: {
    type?: 'window' | 'modal' | 'notification' | 'content'
    componentId?: string
  }
}

export interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string | null
  isLoading: boolean
}

export type ChatAction =
  | { type: 'CREATE_SESSION'; payload: Omit<ChatSession, 'id' | 'createdAt' | 'updatedAt' | 'isActive'> }
  | { type: 'UPDATE_SESSION'; payload: { id: string; updates: Partial<ChatSession> } }
  | { type: 'DELETE_SESSION'; payload: string }
  | { type: 'SET_ACTIVE_SESSION'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: { sessionId: string; message: ChatMessage } }
  | { type: 'UPDATE_MESSAGE'; payload: { sessionId: string; messageId: string; updates: Partial<ChatMessage> } }
  | { type: 'DELETE_MESSAGE'; payload: { sessionId: string; messageId: string } }
  | { type: 'SET_LOADING'; payload: boolean }
