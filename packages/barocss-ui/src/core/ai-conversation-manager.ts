/**
 * AI Conversation Manager
 * AI와의 연속 대화 관리
 */

import { 
  AgentRequest, 
  AgentResponse, 
  ContextHierarchy,
  UserAction,
  AIResponseProcessingOptions
} from '../types';
import { AIStateManager } from './ai-state-manager';
import { AgentCommunicationInterface } from './agent-communication-interface';
import { generateId, getCurrentTimestamp } from '../utils/id-generator';

export interface AIConversationManagerOptions {
  maxConversationSteps: number;
  enableContextCompression: boolean;
  contextCompressionThreshold: number;
  autoSaveConversation: boolean;
  conversationTimeout: number;
}

export class AIConversationManager {
  private stateManager: AIStateManager;
  private agentCommunication: AgentCommunicationInterface;
  private conversationStep: number = 0;
  private conversationHistory: Array<{
    step: number;
    userInput: string;
    aiResponse: AgentResponse;
    timestamp: number;
    context: Record<string, any>;
  }> = [];
  private options: AIConversationManagerOptions;

  constructor(
    stateManager: AIStateManager,
    agentCommunication: AgentCommunicationInterface,
    options: Partial<AIConversationManagerOptions> = {}
  ) {
    this.stateManager = stateManager;
    this.agentCommunication = agentCommunication;
    this.options = {
      maxConversationSteps: 50,
      enableContextCompression: true,
      contextCompressionThreshold: 20,
      autoSaveConversation: true,
      conversationTimeout: 30000, // 30초
      ...options
    };
  }

  // ============================================================================
  // 연속 대화 처리
  // ============================================================================

  /**
   * 사용자 액션 처리
   */
  async handleUserAction(
    action: string, 
    data: any, 
    sceneId: string
  ): Promise<AgentResponse> {
    try {
      // 1. 현재 상태 저장
      this.stateManager.setSceneState(sceneId, 'lastAction', action);
      this.stateManager.setSceneState(sceneId, 'actionData', data);
      this.stateManager.setSceneState(sceneId, 'lastActionTime', getCurrentTimestamp());
      
      // 2. 사용자 액션 기록
      const userAction: UserAction = {
        id: generateId('action'),
        type: action,
        target: sceneId,
        data,
        sceneId,
        timestamp: getCurrentTimestamp(),
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
        version: 1
      };
      this.stateManager.recordUserAction(userAction);

      // 3. 다음 AI 요청 준비
      // 4. AI에게 요청 전송
      const request = this.buildAIRequest(action, sceneId);
      const response = await this.sendAIRequest(request);

      // 5. AI 응답 처리
      await this.processAIResponse(response, sceneId);

      // 6. 대화 단계 증가
      this.conversationStep++;
      this.stateManager.setConversationContext('step', this.conversationStep);

      return response;

    } catch (error) {
      // eslint-disable-next-line
      console.error('[AIConversationManager] Failed to handle user action:', error);
      throw error;
    }
  }

  /**
   * AI 응답 처리
   */
  async processAIResponse(
    response: AgentResponse, 
    sceneId: string,
    options: AIResponseProcessingOptions = {}
  ): Promise<void> {
    try {
      // 1. AI 응답을 상태 매니저에 전달
      await this.stateManager.processAIResponse(response, options);

      // 2. 대화 히스토리에 추가
      this.addToConversationHistory('', response, sceneId);

      // 3. 컨텍스트 압축 (필요한 경우)
      if (this.options.enableContextCompression && 
          this.conversationHistory.length > this.options.contextCompressionThreshold) {
        this.compressConversationContext();
      }

      // 4. 자동 저장
      if (this.options.autoSaveConversation) {
        this.saveConversationState();
      }

    } catch (error) {
      // eslint-disable-next-line
      console.error('[AIConversationManager] Failed to process AI response:', error);
      throw error;
    }
  }

  /**
   * 사용자 입력 처리
   */
  async handleUserInput(
    userInput: string, 
    sceneId: string
  ): Promise<AgentResponse> {
    try {
      // 2. AI 요청 생성
      const request = this.buildUserInputRequest(userInput, sceneId);
      
      // 3. AI 요청 전송
      const response = await this.sendAIRequest(request);

      // 4. AI 응답 처리
      await this.processAIResponse(response, sceneId);

      // 5. 대화 히스토리에 추가
      this.addToConversationHistory(userInput, response, sceneId);

      return response;

    } catch (error) {
      // eslint-disable-next-line
      console.error('[AIConversationManager] Failed to handle user input:', error);
      throw error;
    }
  }

  // ============================================================================
  // 대화 컨텍스트 관리
  // ============================================================================

  /**
   * 대화 단계 설정
   */
  setConversationStep(step: number): void {
    this.conversationStep = step;
    this.stateManager.setConversationContext('step', step);
  }

  /**
   * 대화 단계 조회
   */
  getConversationStep(): number {
    return this.conversationStep;
  }

  /**
   * 대화 초기화
   */
  resetConversation(): void {
    this.conversationStep = 0;
    this.conversationHistory = [];
    this.stateManager.clearConversationContext('step');
    this.stateManager.clearActionHistory();
  }

  /**
   * 대화 히스토리 조회
   */
  getConversationHistory(): Array<{
    step: number;
    userInput: string;
    aiResponse: AgentResponse;
    timestamp: number;
    context: Record<string, any>;
  }> {
    return [...this.conversationHistory];
  }

  /**
   * 특정 단계의 대화 조회
   */
  getConversationAtStep(step: number): {
    step: number;
    userInput: string;
    aiResponse: AgentResponse;
    timestamp: number;
    context: Record<string, any>;
  } | null {
    return this.conversationHistory.find(conv => conv.step === step) || null;
  }

  // ============================================================================
  // 상태 전달
  // ============================================================================

  /**
   * 상태를 AI에게 전달
   */
  async sendStateToAI(sceneId: string): Promise<AgentResponse> {
    try {
      const currentState = this.stateManager.collectStateForAI(sceneId);
      
      const request: AgentRequest = {
        id: generateId('request'),
        type: 'ai_query',
        timestamp: getCurrentTimestamp(),
        priority: 'normal',
        source: 'system',
        context: this.buildContextHierarchy(sceneId),
        metadata: {
          version: '1.0.0',
          correlationId: generateId('corr'),
          parentRequestId: null,
          tags: ['state_sync']
        },
        payload: {
          message: 'Update UI based on current state',
          instructions: 'Please update the UI to reflect the current state',
          constraints: {
            maxTokens: 1000,
            temperature: 0.7
          },
          // context: currentState // AIQueryRequest에 context 속성이 없음
        }
      } as AgentRequest;

      return await this.sendAIRequest(request);

    } catch (error) {
      // eslint-disable-next-line
      console.error('[AIConversationManager] Failed to send state to AI:', error);
      throw error;
    }
  }

  /**
   * 컨텍스트 요약 생성
   */
  generateContextSummary(): {
    totalSteps: number;
    lastActivity: number;
    contextSize: number;
    keyTopics: string[];
  } {
    const totalSteps = this.conversationHistory.length;
    const lastActivity = this.conversationHistory.length > 0 
      ? this.conversationHistory[this.conversationHistory.length - 1].timestamp 
      : 0;
    
    const contextSize = JSON.stringify(this.conversationHistory).length;
    
    // 키워드 추출 (간단한 구현)
    const keyTopics = this.extractKeyTopics();

    return {
      totalSteps,
      lastActivity,
      contextSize,
      keyTopics
    };
  }

  // ============================================================================
  // 내부 메서드들
  // ============================================================================

  /**
   * AI 요청 생성 (사용자 액션용)
   */
  private buildAIRequest(
    action: string, 
    sceneId: string
  ): AgentRequest {
    return {
      id: generateId('request'),
      type: 'ai_query',
      timestamp: getCurrentTimestamp(),
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
      version: 1,
      priority: 'normal',
      source: 'user',
      context: this.buildContextHierarchy(sceneId),
      metadata: {
        version: '1.0.0',
        correlationId: generateId('corr'),
        parentRequestId: null,
        tags: ['user_action', action]
      },
      payload: {
        message: `[action:${action}] for scene ${sceneId}`,
        instructions: 'Handle user action and update the UI accordingly',
        constraints: {
          maxTokens: 1000,
          temperature: 0.7
        }
      }
    };
  }

  /**
   * AI 요청 생성 (사용자 입력용)
   */
  private buildUserInputRequest(
    userInput: string, 
    sceneId: string
  ): AgentRequest {
    return {
      id: generateId('request'),
      type: 'ai_query',
      timestamp: getCurrentTimestamp(),
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
      version: 1,
      priority: 'normal',
      source: 'user',
      context: this.buildContextHierarchy(sceneId),
      metadata: {
        version: '1.0.0',
        correlationId: generateId('corr'),
        parentRequestId: null,
        tags: ['user_input']
      },
      payload: {
        message: userInput,
        instructions: 'Please respond to the user input and update the UI accordingly',
        constraints: {
          maxTokens: 2000,
          temperature: 0.7
        }
      }
    };
  }

  /**
   * 컨텍스트 계층 구조 생성
   */
  private buildContextHierarchy(sceneId: string): ContextHierarchy {
    return {
      global: {
        application: {
          version: '1.0.0',
          environment: 'development',
          build: '',
          features: {}
        },
        user: {
          id: '',
          role: '',
          permissions: [],
          preferences: {
            theme: 'auto',
            language: 'en',
            fontSize: 'medium',
            animations: true,
            sounds: false,
            notifications: true,
            accessibility: {},
            ui: {}
          },
          locale: 'en-US',
          timezone: 'UTC'
        },
        system: {
          platform: 'web',
          browser: 'unknown',
          capabilities: {
            webGL: true,
            webRTC: true,
            webAudio: true,
            fullscreen: true,
            clipboard: true,
            geolocation: true,
            camera: true,
            microphone: true,
            webgl: true,
            webWorkers: true,
            serviceWorkers: true,
            pushNotifications: false
          },
          performance: {
            memory: { used: 0, total: 0, limit: 0 },
            timing: 0,
            fps: 60,
            bandwidth: 0
          }
        }
      },
      session: {
        sessionId: this.stateManager.getConversationContext('sessionId') || generateId('session'),
        startTime: this.stateManager.getConversationContext('startTime') || getCurrentTimestamp(),
        lastActivity: getCurrentTimestamp(),
        duration: 0,
        navigation: {
          history: [],
          current: '',
          previous: null
        },
        state: {
          authenticated: false,
          loading: false,
          error: null
        },
        data: {
          cache: {},
          variables: {},
          temporary: {}
        }
      },
      scene: {
        sceneId,
        type: 'page',
        title: '',
        parent: { sceneId: null, relationship: 'parent' },
        children: { sceneIds: [], relationships: {} },
        state: {
          visible: true,
          active: true,
          focused: false,
          loading: false
        },
        data: { props: {}, state: {}, computed: {} },
        metadata: {
          createdAt: getCurrentTimestamp(),
          updatedAt: getCurrentTimestamp(),
          createdBy: 'system',
          version: 1
        }
      },
      component: null,
      temporary: {
        requestId: generateId('temp'),
        timestamp: getCurrentTimestamp(),
        expiresAt: getCurrentTimestamp() + 300000,
        data: {},
        metadata: {
          source: 'user',
          priority: 'normal',
          tags: ['conversation']
        }
      }
    };
  }

  /**
   * AI 요청 전송
   */
  private async sendAIRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const response = await this.agentCommunication.sendRequest(request);
      
      // 타임아웃 처리
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), this.options.conversationTimeout);
      });

      return await Promise.race([response, timeoutPromise]);

    } catch (error) {
      // eslint-disable-next-line
      console.error('[AIConversationManager] AI request failed:', error);
      throw error;
    }
  }

  /**
   * 대화 히스토리에 추가
   */
  private addToConversationHistory(
    userInput: string, 
    aiResponse: AgentResponse, 
    sceneId: string
  ): void {
    this.conversationHistory.push({
      step: this.conversationStep,
      userInput,
      aiResponse,
      timestamp: getCurrentTimestamp(),
      context: this.stateManager.collectStateForAI(sceneId)
    });

    // 히스토리 크기 제한
    if (this.conversationHistory.length > this.options.maxConversationSteps) {
      this.conversationHistory = this.conversationHistory.slice(-this.options.maxConversationSteps);
    }
  }

  /**
   * 컨텍스트 압축
   */
  private compressConversationContext(): void {
    if (this.conversationHistory.length <= this.options.contextCompressionThreshold) return;

    // 중간 단계들 제거하고 중요한 단계들만 유지
    const compressed = [
      this.conversationHistory[0], // 첫 번째
      ...this.conversationHistory.slice(-10) // 마지막 10개
    ];

    this.conversationHistory = compressed;
    
    // eslint-disable-next-line
    console.log('[AIConversationManager] Conversation context compressed');
  }

  /**
   * 키워드 추출
   */
  private extractKeyTopics(): string[] {
    const topics = new Set<string>();
    
    this.conversationHistory.forEach(conv => {
      // 간단한 키워드 추출 (실제로는 더 정교한 NLP 필요)
      const words = conv.userInput.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 3 && !this.isStopWord(word)) {
          topics.add(word);
        }
      });
    });

    return Array.from(topics).slice(0, 10); // 상위 10개
  }

  /**
   * 불용어 확인
   */
  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return stopWords.includes(word);
  }

  /**
   * 대화 상태 저장
   */
  private saveConversationState(): void {
    this.stateManager.setConversationContext('conversationHistory', this.conversationHistory);
    this.stateManager.setConversationContext('conversationStep', this.conversationStep);
  }

  /**
   * 정리
   */
  cleanup(): void {
    this.resetConversation();
  }
}

// 팩토리 함수
export function createAIConversationManager(
  stateManager: AIStateManager,
  agentCommunication: AgentCommunicationInterface,
  options?: Partial<AIConversationManagerOptions>
): AIConversationManager {
  return new AIConversationManager(stateManager, agentCommunication, options);
}
