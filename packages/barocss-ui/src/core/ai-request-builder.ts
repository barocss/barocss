/**
 * AIRequestBuilder
 * 컨텍스트를 포함한 AI 요청을 생성하는 클래스
 */

import {
  AgentRequest,
  ConversationChain,
  AggregatedContext,
  ContextHierarchy,
  GlobalContext,
  SessionContext
} from '../types';
import { ConversationContextAggregator } from './conversation-context-aggregator';
import { generateId, getCurrentTimestamp } from '../utils/id-generator';

export class AIRequestBuilder {
  private contextAggregator: ConversationContextAggregator;

  constructor() {
    this.contextAggregator = new ConversationContextAggregator();
  }

  /**
   * 컨텍스트를 포함한 AI 요청 생성
   */
  buildRequest(
    userInput: string, 
    conversationChain: ConversationChain
  ): AgentRequest {
    const aggregatedContext = this.contextAggregator.aggregateContext(conversationChain);
    const timestamp = getCurrentTimestamp();

    return {
      id: generateId('request'),
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      type: 'ai_query',
      timestamp,
      priority: 'normal',
      source: 'user',
      context: this.buildContextHierarchy(aggregatedContext),
      metadata: {
        version: '1.0.0',
        correlationId: generateId('corr'),
        parentRequestId: null,
        tags: ['conversation', 'scene_generation']
      },
      payload: {
        message: userInput,
        instructions: 'Generate a dynamic UI based on user input',
        constraints: {
          maxTokens: 1000,
          temperature: 0.7
        }
      }
    };
  }

  /**
   * 첫 번째 요청 (대화 체인이 없을 때)
   */
  buildInitialRequest(userInput: string): AgentRequest {
    return {
      id: `request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      type: 'ai_query',
      timestamp: Date.now(),
      priority: 'normal',
      source: 'user',
      context: this.buildInitialContextHierarchy(),
      metadata: {
        version: '1.0.0',
        correlationId: generateId('corr'),
        parentRequestId: null,
        tags: ['conversation', 'scene_generation', 'initial']
      },
      payload: {
        message: userInput,
        instructions: 'Generate a dynamic UI based on user input',
        constraints: {
          maxTokens: 1000,
          temperature: 0.7
        }
      }
    };
  }

  private buildContextHierarchy(aggregatedContext: AggregatedContext): ContextHierarchy {
    return {
      global: (aggregatedContext.global as GlobalContext) || this.createDefaultGlobalContext(),
      session: this.createDefaultSessionContext(),
      scene: {
        sceneId: aggregatedContext.currentScene.id,
        type: 'window',
        title: '',
        parent: {
          sceneId: null,
          relationship: 'parent'
        },
        children: {
          sceneIds: [],
          relationships: {}
        },
        state: {
          visible: true,
          active: true,
          focused: false,
          loading: false
        },
        data: {
          props: aggregatedContext.currentScene.context || {},
          state: aggregatedContext.currentScene.context || {},
          computed: {}
        },
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'user',
          version: 1
        }
      },
      component: null,
      temporary: null
    };
  }

  private buildInitialContextHierarchy(): ContextHierarchy {
    return {
      global: this.createDefaultGlobalContext(),
      session: this.createDefaultSessionContext(),
      scene: null,
      component: null,
      temporary: null
    };
  }

  private createDefaultGlobalContext(): GlobalContext {
    return {
      application: {
        version: '1.0.0',
        environment: 'development',
        build: 'latest',
        features: {}
      },
      user: {
        id: 'anonymous',
        role: 'user',
        permissions: [],
        preferences: {
          theme: 'light' as const,
          language: 'ko',
          fontSize: 'medium' as const,
          animations: true,
          sounds: true,
          notifications: true,
          accessibility: {},
          ui: {}
        },
        locale: 'ko-KR',
        timezone: 'Asia/Seoul'
      },
      system: {
        platform: typeof window !== 'undefined' && window.navigator ? window.navigator.platform : 'server',
        browser: typeof window !== 'undefined' && window.navigator ? window.navigator.userAgent : 'server',
        capabilities: {
          webgl: false,
          webWorkers: true,
          serviceWorkers: true,
          pushNotifications: true,
          webGL: false,
          webRTC: false,
          webAudio: false,
          fullscreen: false,
          clipboard: false,
          geolocation: false,
          camera: false,
          microphone: false
        },
        performance: {
          memory: { used: 0, total: 0, limit: 0 },
          timing: 0,
          fps: 0,
          bandwidth: 0
        }
      }
    };
  }

  private createDefaultSessionContext(): SessionContext {
    return {
      sessionId: `session-${Date.now()}`,
      startTime: Date.now(),
      lastActivity: Date.now(),
      duration: 0,
      navigation: {
        history: [],
        current: '/',
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
    };
  }
}

export function createAIRequestBuilder(): AIRequestBuilder {
  return new AIRequestBuilder();
}
