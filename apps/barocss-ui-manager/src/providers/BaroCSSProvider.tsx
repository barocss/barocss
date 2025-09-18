import React, { createContext, useContext, useEffect, useState } from 'react'
import { initializeDirector, Director } from '@barocss/ui'
import { AIResponse, AIRenderType } from '../types/window'

// Mock Agent for testing
class MockAgent {
  public name = 'mock-agent'
  public type = 'mock'
  private onAIResponse?: (response: AIResponse) => void
  
  constructor(onAIResponse?: (response: AIResponse) => void) {
    this.onAIResponse = onAIResponse
  }
  
  async initialize() { 
    return true 
  }
  
  async shutdown() { 
    return true 
  }
  
  isConnected() { 
    return true 
  }
  
  async sendRequest(request: any) {
    // Extract user message robustly across various shapes
    let message = ''
    if (typeof request === 'string') {
      message = request
    } else if (request && typeof request === 'object') {
      message = request.payload?.message
        || request.payload?.input
        || request.payload?.text
        || request.message
        || request.input
        || request.text
        || request.query
        || ''
    }
    
    // Parse message to determine response type
    let responseType: AIRenderType = 'content'
    let title = 'BaroCSS UI Manager'
    let content = ''
    let metadata: any = {}

    if (message.includes('창') || message.includes('window')) {
      responseType = 'window'
      title = '새 창'
      content = `
        <div data-scene-root>
          <h1>새로운 창이 열렸습니다!</h1>
          <p>요청: ${message}</p>
          <div class="p-4 bg-blue-50 rounded-lg">
            <h2 class="text-lg font-semibold mb-2">창 기능</h2>
            <ul class="list-disc list-inside space-y-1">
              <li>드래그로 이동 가능</li>
              <li>크기 조절 가능</li>
              <li>최소화/최대화 가능</li>
              <li>닫기 가능</li>
            </ul>
          </div>
          <button data-action-id="next" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">다음</button>
        </div>`
      metadata = {
        size: { width: 600, height: 400 },
        position: { x: 200, y: 150 },
        resizable: true,
        draggable: true,
        closable: true,
        minimizable: true,
        maximizable: true
      }
    } else if (message.includes('모달') || message.includes('modal')) {
      responseType = 'modal'
      title = '확인'
      content = `
        <div data-scene-root>
          <h2 class="text-lg font-semibold mb-4">모달 창</h2>
          <p class="mb-4">요청: ${message}</p>
          <p class="text-gray-600 mb-4">이것은 모달 창입니다. 배경을 클릭하거나 ESC 키로 닫을 수 있습니다.</p>
          <div class="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p class="text-sm text-yellow-800">모달은 다른 창 위에 표시되며, 배경을 클릭하면 닫힙니다.</p>
          </div>
        </div>`
      metadata = {
        size: { width: 450, height: 300 },
        actions: [
          { id: 'confirm', label: '확인', variant: 'primary' },
          { id: 'cancel', label: '취소', variant: 'secondary' }
        ]
      }
    } else if (message.includes('알림') || message.includes('notification')) {
      responseType = 'notification'
      title = '시스템 알림'
      content = `요청: ${message}`
      metadata = {
        duration: 5000,
        type: 'success',
        actions: [
          { id: 'view', label: '보기', variant: 'primary' },
          { id: 'dismiss', label: '닫기', variant: 'secondary' }
        ]
      }
    } else if (message.includes('에러') || message.includes('error')) {
      responseType = 'notification'
      title = '오류 발생'
      content = `요청: ${message}`
      metadata = {
        duration: 7000,
        type: 'error',
        actions: [
          { id: 'retry', label: '재시도', variant: 'primary' },
          { id: 'dismiss', label: '닫기', variant: 'secondary' }
        ]
      }
    } else if (message.includes('경고') || message.includes('warning')) {
      responseType = 'modal'
      title = '경고'
      content = `
        <div data-scene-root>
          <h2 class="text-lg font-semibold mb-4 text-yellow-600">⚠️ 경고</h2>
          <p class="mb-4">요청: ${message}</p>
          <p class="text-gray-600 mb-4">이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?</p>
          <div class="p-3 bg-red-50 border border-red-200 rounded">
            <p class="text-sm text-red-800">주의: 이 작업은 시스템에 영향을 줄 수 있습니다.</p>
          </div>
        </div>`
      metadata = {
        size: { width: 500, height: 350 },
        actions: [
          { id: 'proceed', label: '계속', variant: 'danger' },
          { id: 'cancel', label: '취소', variant: 'secondary' }
        ]
      }
    } else {
      // Default content
      content = `
        <div data-scene-root>
          <h1>BaroCSS UI Manager</h1>
          <p>요청: ${message}</p>
          <div class="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 class="font-semibold mb-2">사용 가능한 명령어:</h3>
            <ul class="list-disc list-inside space-y-1 text-sm">
              <li>"창 열어줘" - 새 창 생성</li>
              <li>"모달 띄워줘" - 모달 창 표시</li>
              <li>"알림 보내줘" - 알림 표시</li>
            </ul>
          </div>
          <button data-action-id="next" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">다음</button>
        </div>`
    }

    // Create AI Response with stable id and default fallbacks
    const aiResponse: AIResponse = {
      type: responseType,
      id: `scene-${Date.now()}`,
      title,
      content,
      metadata: metadata || {}
    }

    // Call the callback if provided
    if (this.onAIResponse) {
      this.onAIResponse(aiResponse)
    }
    
    return {
      type: 'success',
      id: `req-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      requestId: request?.id || `local-${Date.now()}`,
      correlationId: request?.metadata?.correlationId,
      data: {
        result: {
          content: aiResponse.content,
          type: 'html',
          metadata: { aiResponse }
        }
      },
      metadata: { provider: 'mock', agent: 'mock-agent' }
    }
  }
}

interface BaroCSSContextType {
  director: Director | null
  isLoading: boolean
  error: string | null
  onAIResponse?: (response: AIResponse) => void
}

const BaroCSSContext = createContext<BaroCSSContextType>({
  director: null,
  isLoading: true,
  error: null,
  onAIResponse: undefined
})

export const useBaroCSS = () => {
  const context = useContext(BaroCSSContext)
  if (!context) {
    throw new Error('useBaroCSS must be used within BaroCSSProvider')
  }
  return context
}

interface BaroCSSProviderProps {
  children: React.ReactNode
  onAIResponse?: (response: AIResponse) => void
}

export const BaroCSSProvider: React.FC<BaroCSSProviderProps> = ({ children, onAIResponse }) => {
  const [director, setDirector] = useState<Director | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initDirector = async () => {
      try {
        const directorInstance = await initializeDirector({}, new MockAgent(onAIResponse) as any)
        
        // Subscribe to events for debugging
        directorInstance.subscribeToEvents((e) => {
          console.log('[manager:event]', e.type, e)
        })
        
        setDirector(directorInstance)
        setIsLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize BaroCSS Director')
        setIsLoading(false)
      }
    }

    initDirector()
  }, [onAIResponse])

  return (
    <BaroCSSContext.Provider value={{ director, isLoading, error, onAIResponse }}>
      {children}
    </BaroCSSContext.Provider>
  )
}
