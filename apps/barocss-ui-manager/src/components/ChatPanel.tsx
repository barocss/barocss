import React, { useState, useRef, useEffect } from 'react'
import { Button } from './ui/Button'
import { ScrollArea } from './ui/ScrollArea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/DropdownMenu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/Tooltip'
import { useWindowManager } from '../providers/WindowManagerProvider'
import { useBaroCSS } from '../providers/BaroCSSProvider'
import { useChat } from '../providers/ChatProvider'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { ChatInput } from './ChatInput'
import { SettingsModal } from './SettingsModal'
import { ShortcutsModal } from './ShortcutsModal'
import { 
  PlusIcon, 
  EllipsisVerticalIcon, 
  CloudArrowUpIcon, 
  Cog6ToothIcon, 
  CommandLineIcon,
  ChatBubbleLeftRightIcon,
  BoltIcon
} from '@heroicons/react/24/outline'

export const ChatPanel: React.FC = () => {
  const [inputValue, setInputValue] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { handleAIResponse } = useWindowManager()
  const { director, isLoading: isDirectorLoading } = useBaroCSS()
  const { 
    sessions, 
    activeSessionId, 
    isLoading,
    createSession, 
    setActiveSession, 
    addMessage, 
    setLoading,
    getActiveSession 
  } = useChat()

  const activeSession = getActiveSession()

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (e) {
      console.error('copy failed', e)
    }
  }

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages])

  // Initialize first session if none exists
  useEffect(() => {
    if (sessions.length === 0 && !activeSessionId) {
      createSession('Welcome to BaroCSS UI Manager')
    }
  }, [sessions.length, activeSessionId, createSession])

  const handleNewChat = () => {
    createSession()
    setInputValue('')
  }

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading || !activeSession) return

    // Add user message
    addMessage(activeSession.id, {
      role: 'user',
      content: content.trim(),
    })

    setInputValue('')
    setLoading(true)

    try {
      if (director && !isDirectorLoading) {
        const result = await director.request(content)
        // Assistant acknowledgement in chat
        addMessage(activeSession.id, {
          role: 'assistant',
          content: result.title || `요청을 처리했습니다: ${content}`,
        })
      } else {
        // Fallback: local simulated response
        await new Promise(resolve => setTimeout(resolve, 800))
        const aiResponse = {
          type: 'content' as const,
          id: `response-${Date.now()}`,
          title: 'AI Response',
          content: `I understand you want to: ${content}. Let me help you with that!`,
          metadata: {}
        }
        if (handleAIResponse) handleAIResponse(aiResponse)
        addMessage(activeSession.id, {
          role: 'assistant',
          content: `I understand you want to: ${content}. Let me help you with that!`,
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setLoading(false)
    }
  }

  // (legacy) handleKeyPress no longer used; removed

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onFocusInput: () => inputRef.current?.focus(),
    onHelp: () => setIsShortcutsOpen(prev => !prev),
    onNewChat: handleNewChat,
  })

  const handleFileSelect = (files: File[] | File) => {
    const list = Array.isArray(files) ? files : [files]
    setUploadedFiles(prev => [...prev, ...list])
  }

  const suggestions = [
    '창 열어줘',
    '모달 띄워줘', 
    '알림 보내줘',
    '온라인 쇼핑몰을 만들어줘',
    '에러 알림 보내줘',
    '경고 모달 띄워줘'
  ]

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-white">
        {/* Chat header */}
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-900 text-white rounded-lg grid place-items-center">
                <BoltIcon className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">BaroCSS UI Manager</h1>              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleNewChat} className="h-8 w-8 p-0">
                    <PlusIcon className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New Chat</TooltipContent>
              </Tooltip>
              <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <EllipsisVerticalIcon className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleNewChat}>
                    <PlusIcon className="w-4 h-4 mr-2" />
                    New Chat
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <CloudArrowUpIcon className="w-4 h-4 mr-2" />
                    Import Chat
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(false) }}>
                    <Cog6ToothIcon className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setIsShortcutsOpen(true); setIsMenuOpen(false) }}>
                    <CommandLineIcon className="w-4 h-4 mr-2" />
                    Keyboard Shortcuts
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Action Bar: quick generation presets */}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => handleSendMessage('창 열어줘')} disabled={isLoading || isDirectorLoading}>
              Open Window
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleSendMessage('모달 띄워줘')} disabled={isLoading || isDirectorLoading}>
              Show Modal
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleSendMessage('알림 보내줘')} disabled={isLoading || isDirectorLoading}>
              Notify
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleSendMessage('에러 알림 보내줘')} disabled={isLoading || isDirectorLoading}>
              Error
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleSendMessage('경고 모달 띄워줘')} disabled={isLoading || isDirectorLoading}>
              Warning
            </Button>
          </div>
          
          {/* Session List */}
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setActiveSession(session.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  session.isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{session.title}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Messages list */}
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
            {activeSession?.messages.map((message) => (
              <div key={message.id} className="flex items-start gap-3 group">
                <div className={`h-8 w-8 shrink-0 rounded-full grid place-items-center text-sm font-medium ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                    : 'bg-gradient-to-br from-purple-500 to-purple-600 text-white'
                }`}>
                  {message.role === 'user' ? 'U' : 'AI'}
                </div>
                <div className={`relative max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-sm ${
                  message.role === 'user'
                    ? 'bg-blue-50 border border-blue-100 text-gray-800'
                    : 'bg-gray-50 border border-gray-200 text-gray-800'
                }`}>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  {/* Hover actions */}
                  <div className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/80 border border-gray-200 shadow-sm">
                      <button
                        onClick={() => handleCopy(message.content)}
                        className="text-[11px] text-gray-600 hover:text-gray-800 px-1 cursor-pointer"
                        aria-label="복사"
                      >
                        복사
                      </button>
                      <span className="text-[11px] text-gray-400 select-none">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white grid place-items-center text-sm font-medium">
                  AI
                </div>
                <div className="max-w-[85%] rounded-xl px-4 py-3 text-sm bg-gray-50 border border-gray-200 text-gray-800 shadow-sm">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {activeSession?.messages.length === 1 && (
              <div className="space-y-3 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Try these examples:</h3>
                <div className="grid grid-cols-1 gap-2">
                  {suggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSendMessage(suggestion)}
                      className="justify-start text-left h-auto p-3 text-sm text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-lg"
                    >
<ChatBubbleLeftRightIcon className="w-4 h-4 mr-2 text-gray-400" />
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}
        
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Chat Input */}
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          onFileSelect={handleFileSelect}
          uploadedFiles={uploadedFiles}
          disabled={isLoading}
          placeholder="Describe what you want to build..."
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        open={isSettingsOpen} 
        onOpenChange={setIsSettingsOpen} 
      />
      
      {/* Shortcuts Modal */}
      <ShortcutsModal 
        open={isShortcutsOpen} 
        onOpenChange={(open) => {
          setIsShortcutsOpen(open);
          setIsMenuOpen(false);
        }} 
      />
    </TooltipProvider>
  )
}
