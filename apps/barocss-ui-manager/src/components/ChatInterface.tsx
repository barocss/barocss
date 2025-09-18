import React, { useState, useRef, useEffect } from 'react'
import { useBaroCSS } from '../providers/BaroCSSProvider'
import { useTheme } from '../providers/ThemeProvider'
import { useWindowManager } from '../providers/WindowManagerProvider'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { ScrollArea } from './ui/ScrollArea'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from './ui/DropdownMenu'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/Tooltip'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs'
import { SettingsModal } from './SettingsModal'
import { ShortcutsModal } from './ShortcutsModal'
import { FileUpload } from './FileUpload'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export const ChatInterface: React.FC = () => {
  const { director, isLoading } = useBaroCSS()
  const { actualTheme } = useTheme()
  const { handleAIResponse } = useWindowManager()
  const [activeTab, setActiveTab] = useState('chat-1')
  const [chatSessions, setChatSessions] = useState<{[key: string]: Message[]}>({
    'chat-1': [{
      id: '1',
      role: 'assistant',
      content: 'BaroCSS에 오신 것을 환영합니다. 무엇을 만들까요?',
      timestamp: Date.now()
    }],
    'chat-2': [{
      id: '2',
      role: 'assistant',
      content: '새로운 채팅 세션입니다. 무엇을 도와드릴까요?',
      timestamp: Date.now()
    }]
  })
  const [inputValue, setInputValue] = useState('')
  const [isLoadingMessage, setIsLoadingMessage] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const messages = chatSessions[activeTab] || []

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Keyboard shortcuts handlers
  const handleNewChat = () => {
    const newChatId = `chat-${Date.now()}`
    setChatSessions(prev => ({
      ...prev,
      [newChatId]: [{
        id: Date.now().toString(),
        role: 'assistant',
        content: '새로운 채팅 세션입니다. 무엇을 도와드릴까요?',
        timestamp: Date.now()
      }]
    }))
    setActiveTab(newChatId)
  }

  const handleFocusInput = () => {
    inputRef.current?.focus()
  }

  const handleSwitchTab = (direction: 'next' | 'prev') => {
    const tabIds = Object.keys(chatSessions)
    const currentIndex = tabIds.indexOf(activeTab)
    let newIndex
    
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % tabIds.length
    } else {
      newIndex = currentIndex === 0 ? tabIds.length - 1 : currentIndex - 1
    }
    
    setActiveTab(tabIds[newIndex])
  }

  const handleFileSelect = (file: File) => {
    setUploadedFiles(prev => [...prev, file])
    // You can also send the file to the AI here
    console.log('File selected:', file.name)
  }

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSendMessage: () => handleSendMessage(inputValue),
    onNewChat: handleNewChat,
    onSettings: () => setIsSettingsOpen(true),
    onFocusInput: handleFocusInput,
    onSwitchTab: handleSwitchTab,
    onHelp: () => setIsShortcutsOpen(true)
  })

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !director || isLoadingMessage) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: Date.now()
    }

    setChatSessions(prev => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), userMessage]
    }))
    setInputValue('')
    setIsLoadingMessage(true)

    try {
      const result = await director.request(message)
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.title || '응답이 생성되었습니다',
        timestamp: Date.now()
      }

      setChatSessions(prev => ({
        ...prev,
        [activeTab]: [...(prev[activeTab] || []), assistantMessage]
      }))

      // AI Response는 윈도우 매니저에서 자동으로 처리됨
      // (BaroCSSProvider의 onAIResponse 콜백을 통해)
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '죄송합니다. 오류가 발생했습니다.',
        timestamp: Date.now()
      }
      setChatSessions(prev => ({
        ...prev,
        [activeTab]: [...(prev[activeTab] || []), errorMessage]
      }))
    } finally {
      setIsLoadingMessage(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(inputValue)
    }
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
      <div className="w-screen h-dvh flex flex-col bg-gray-50">
        <main className="grow flex overflow-hidden h-full w-full">
          {/* Left: Chat panel */}
          <section className="min-w-[320px] w-[360px] lg:w-[380px] shrink-0 border-r border-gray-200 bg-white flex flex-col h-full shadow-sm">
            {/* Chat header */}
            <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">B</span>
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">BaroCSS UI Manager</h1>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={handleNewChat}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>New Chat</TooltipContent>
                  </Tooltip>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={handleNewChat}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New Chat
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                        Import Chat
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setIsShortcutsOpen(true)}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Keyboard Shortcuts
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              {/* Chat Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="chat-1">Chat 1</TabsTrigger>
                  <TabsTrigger value="chat-2">Chat 2</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

              {/* Messages list */}
              <ScrollArea className="flex-1 px-6 py-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className="flex items-start gap-3">
                      <div className={`h-8 w-8 shrink-0 rounded-full grid place-items-center text-sm font-medium ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                          : 'bg-gradient-to-br from-purple-500 to-purple-600 text-white'
                      }`}>
                        {message.role === 'user' ? 'U' : 'AI'}
                      </div>
                      <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-sm ${
                        message.role === 'user'
                          ? 'bg-blue-50 border border-blue-100 text-gray-800'
                          : 'bg-gray-50 border border-gray-200 text-gray-800'
                      }`}>
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      </div>
                    </div>
                  ))}
              
                  {isLoadingMessage && (
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
                  {messages.length === 0 && (
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
                            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

            {/* Composer */}
            <div className="border-t border-gray-200 bg-white p-6">
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 px-4 py-3">
                  <FileUpload
                    onFileSelect={handleFileSelect}
                    accept="image/*,.pdf,.txt,.md"
                    maxSize={10}
                    disabled={isLoadingMessage || isLoading}
                  />

                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoadingMessage || isLoading}
                    className="flex-1 border-0 shadow-none focus-visible:ring-0 text-sm"
                    placeholder="Describe what you want to build..."
                  />

                  <Button
                    onClick={() => handleSendMessage(inputValue)}
                    disabled={!inputValue.trim() || isLoadingMessage || isLoading}
                    size="sm"
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send
                  </Button>
                </div>
              {/* Uploaded files */}
              {uploadedFiles.length > 0 && (
                <div className="px-3 py-2 border-t">
                  <div className="flex flex-wrap gap-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded-md text-xs">
                        <span>📎</span>
                        <span className="truncate max-w-[100px]">{file.name}</span>
                        <button
                          onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== index))}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="px-3 pb-2">
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <div className="hidden md:block">Shift+Enter: 줄바꿈 • Ctrl+K: 포커스 • Ctrl+/: 도움말</div>
                  <div>모델: <span className="px-1.5 py-0.5 rounded bg-gray-50 border">mock</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Render canvas */}
        <section className="grow overflow-hidden h-full relative bg-gray-50">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="ml-3 text-sm font-medium text-gray-700">Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Canvas window */}
          <div 
            id="bc-output" 
            className="h-full w-full relative overflow-hidden pt-12"
          >
            <div className="h-full w-full grid place-items-center text-center text-gray-600 select-none bg-white rounded-t-2xl shadow-lg">
              <div className="max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to build</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Describe what you want to create and watch it come to life
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">Windows</span>
                  <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">Modals</span>
                  <span className="px-3 py-1 bg-green-50 text-green-700 text-xs rounded-full">Notifications</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      {/* Settings Modal */}
      <SettingsModal 
        open={isSettingsOpen} 
        onOpenChange={setIsSettingsOpen} 
      />
      
      {/* Shortcuts Modal */}
      <ShortcutsModal 
        open={isShortcutsOpen} 
        onOpenChange={setIsShortcutsOpen} 
      />
    </div>
    </TooltipProvider>
  )
}
