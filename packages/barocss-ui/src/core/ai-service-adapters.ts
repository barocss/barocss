/**
 * AI Service Adapters
 * 다양한 AI 서비스들과의 요청/응답 포맷 변환을 담당
 */

import { AgentRequest, AgentResponse, ConversationMessage, UIContent, SceneState } from '../types';

// ============================================================================
// OpenAI 어댑터
// ============================================================================

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  functions?: any[];
  function_call?: any;
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      function_call?: any;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Helper functions
function createDefaultSceneState(): SceneState {
  return {
    visible: true,
    active: false,
    focused: false,
    loading: false,
    error: null,
    data: {}
  };
}

export class OpenAIAdapter {
  private systemPrompt: string;

  constructor(systemPrompt?: string) {
    this.systemPrompt = systemPrompt || `You are a UI designer that creates beautiful, modern web interfaces.
When the user requests a UI element or application, respond with HTML using Tailwind CSS classes.
Always include interactive elements with data-action attributes for user interactions.
Format your response as valid HTML that can be directly rendered in a browser.

Example format:
<div class="container mx-auto p-6">
  <h1 class="text-2xl font-bold mb-4">Title</h1>
  <button data-action="click-action" class="bg-blue-500 text-white px-4 py-2 rounded">
    Click me
  </button>
</div>`;
  }

  extractConversationHistory(request: AgentRequest): ConversationMessage[] {
    return request.context?.conversationHistory || [];
  }

  /**
   * Director AgentRequest를 OpenAI API 형식으로 변환
   */
  convertToOpenAI(request: AgentRequest): OpenAIRequest {
    if (request.type !== 'ai_query') {
      throw new Error('OpenAI adapter only supports ai_query requests');
    }

    const messages: OpenAIMessage[] = [
      { role: 'system', content: this.systemPrompt }
    ];

    // 이전 대화 컨텍스트 추가
    if (request.context?.conversationHistory && request.context.conversationHistory.length > 0) {
      const conversationHistory = this.extractConversationHistory(request);
      messages.push(...conversationHistory.map(msg => ({ role: msg.role, content: msg.content })));
    }

    // 현재 사용자 메시지 추가
    let userContent = request.payload.message;
    if (request.payload.instructions) {
      userContent += `\n\n추가 지침: ${request.payload.instructions}`;
    }
    if (request.payload.constraints) {
      userContent += `\n\n제약사항: ${JSON.stringify(request.payload.constraints, null, 2)}`;
    }

    messages.push({
      role: 'user',
      content: userContent
    });

    return {
      model: request.metadata?.model as string || 'gpt-4',
      messages,
      max_tokens: request.payload.constraints?.maxTokens || 4000,
      temperature: request.payload.constraints?.temperature || 0.7,
      stream: request.payload.constraints?.stream || false
    };
  }

  /**
   * OpenAI API 응답을 Director AgentResponse로 변환
   */
  convertFromOpenAI(openaiResponse: OpenAIResponse, requestId: string): AgentResponse {
    const content = openaiResponse.choices[0]?.message?.content || '';
    
    // HTML 콘텐츠에서 UI 정보 추출
    const ui = this.extractUIFromContent(content);
    
    return {
      id: `openai-${openaiResponse.id}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      requestId,
      type: 'success',
      timestamp: Date.now(),
      processingTime: 0, // OpenAI doesn't provide this
      status: {
        success: true,
        code: 200,
        message: 'OpenAI response converted successfully'
      },
      data: {
        result: {
          title: this.extractTitleFromContent(content),
          type: 'html',
          content: content,
          ui,
          state: createDefaultSceneState(),
          metadata: {
            tokens_used: openaiResponse.usage.total_tokens,
            model_version: openaiResponse.model,
            finish_reason: openaiResponse.choices[0]?.finish_reason
          }
        },
        reasoning: `OpenAI ${openaiResponse.model}이 생성한 UI입니다.`,
        // suggestions: this.generateSuggestions(content)
      },
      metadata: {
        version: '1.0.0',
        provider: 'openai',
        // originalFormat: 'openai_chat',
        correlationId: `openai-${Date.now()}`
      }
    };
  }

  private buildConversationHistory(scenes: any[]): OpenAIMessage[] {
    const messages: OpenAIMessage[] = [];
    
    scenes.forEach((scene) => {
      if (scene.metadata?.userInput) {
        messages.push({
          role: 'user',
          content: scene.metadata.userInput
        });
      }
      
      if (scene.ui?.content) {
        messages.push({
          role: 'assistant',
          content: scene.ui.content
        });
      }
    });
    
    return messages;
  }

  private extractUIFromContent(content: string): UIContent {
    // HTML 태그가 있으면 HTML로 처리
    if (content.includes('<') && content.includes('>')) {
      return {
        type: 'html',
        content: content.trim(),
        actions: this.extractActionsFromHTML(content)
      };
    }
    
    // 일반 텍스트면 기본 HTML로 래핑
    return {
      type: 'html',
      content: `<div class="ai-response p-4 bg-gray-50 rounded">${content}</div>`,
      actions: {}
    };
  }

  private extractActionsFromHTML(html: string): Record<string, string> {
    const actions: Record<string, string> = {};
    const actionMatches = html.matchAll(/data-action="([^"]+)"/g);
    
    for (const match of actionMatches) {
      const actionName = match[1];
      actions[`[data-action="${actionName}"]`] = actionName;
    }
    
    return actions;
  }

  private extractTitleFromContent(content: string): string {
    // h1 태그에서 제목 추출
    const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      return h1Match[1].trim();
    }
    
    // title 클래스에서 추출
    const titleMatch = content.match(/class="[^"]*title[^"]*"[^>]*>([^<]+)</i);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
    
    return `AI Generated UI - ${new Date().toLocaleTimeString()}`;
  }

  private extractStateFromContent(content: string): Record<string, any> {
    const state: Record<string, any> = {};
    
    // 폼 필드에서 초기 상태 추출
    const inputMatches = content.matchAll(/<input[^>]+name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/g);
    for (const match of inputMatches) {
      state[match[1]] = match[2];
    }
    
    return state;
  }

  private generateSuggestions(content: string): string[] {
    const suggestions: string[] = [];
    
    if (content.includes('button')) {
      suggestions.push('버튼에 hover 효과를 추가해보세요');
    }
    if (content.includes('form')) {
      suggestions.push('폼 검증 기능을 추가해보세요');
    }
    if (content.includes('data-action')) {
      suggestions.push('각 액션에 대한 구체적인 동작을 정의해보세요');
    }
    
    return suggestions;
  }
}

// ============================================================================
// Anthropic 어댑터  
// ============================================================================

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string;
  temperature?: number;
  stream?: boolean;
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicAdapter {
  private systemPrompt: string;

  constructor(systemPrompt?: string) {
    this.systemPrompt = systemPrompt || `You are an expert UI/UX designer specializing in modern web interfaces.

Your task is to create beautiful, functional user interfaces based on user requests.
Always respond with clean, semantic HTML using Tailwind CSS for styling.
Include interactive elements with data-action attributes for user interactions.
Focus on accessibility, responsiveness, and modern design principles.

Guidelines:
- Use semantic HTML elements (header, nav, main, section, article, aside, footer)
- Apply Tailwind CSS classes for styling
- Add data-action attributes to interactive elements
- Include proper ARIA labels where needed
- Design for mobile-first responsive layout
- Use modern color palettes and typography`;
  }

  extractConversationHistory(request: AgentRequest): ConversationMessage[] {
    return request.context?.conversationHistory || [];
  }

  /**
   * Director AgentRequest를 Anthropic API 형식으로 변환
   */
  convertToAnthropic(request: AgentRequest): AnthropicRequest {
    if (request.type !== 'ai_query') {
      throw new Error('Anthropic adapter only supports ai_query requests');
    }

    const messages: AnthropicMessage[] = [];

    // 이전 대화 컨텍스트 추가
    if (request.context?.conversationHistory && request.context.conversationHistory.length > 0) {
      const conversationHistory = this.extractConversationHistory(request);
      messages.push(...conversationHistory.filter(msg => msg.role !== 'system').map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content })));
    }

    // 현재 사용자 메시지 추가
    let userContent = request.payload.message;
    if (request.payload.instructions) {
      userContent += `\n\n추가 지침: ${request.payload.instructions}`;
    }
    if (request.payload.constraints) {
      userContent += `\n\n제약사항: ${JSON.stringify(request.payload.constraints, null, 2)}`;
    }

    messages.push({
      role: 'user',
      content: userContent
    });

    return {
      model: request.metadata?.model as string || 'claude-3-sonnet-20240229',
      messages,
      max_tokens: request.payload.constraints?.maxTokens || 4000,
      system: this.systemPrompt,
      temperature: request.payload.constraints?.temperature || 0.7,
      stream: request.payload.constraints?.stream || false
    };
  }

  /**
   * Anthropic API 응답을 Director AgentResponse로 변환
   */
  convertFromAnthropic(anthropicResponse: AnthropicResponse, requestId: string): AgentResponse {
    const content = anthropicResponse.content[0]?.text || '';
    
    // HTML 콘텐츠에서 UI 정보 추출
    const ui = this.extractUIFromContent(content);
    
    return {
      id: `anthropic-${anthropicResponse.id}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      requestId,
      type: 'success',
      timestamp: Date.now(),
      processingTime: 0,
      status: {
        success: true,
        code: 200,
        message: 'Anthropic response converted successfully'
      },
      data: {
        result: {
          title: this.extractTitleFromContent(content),
          type: 'html',
          content: content,
          ui,
          state: createDefaultSceneState(),
          metadata: {
            tokens_used: anthropicResponse.usage.input_tokens + anthropicResponse.usage.output_tokens,
            model_version: anthropicResponse.model,
            stop_reason: anthropicResponse.stop_reason
          }
        },
        reasoning: `Anthropic ${anthropicResponse.model}이 생성한 UI입니다.`,
        // suggestions: this.generateSuggestions(content)
      },
      metadata: {
        version: '1.0.0',
        provider: 'anthropic',
        // originalFormat: 'anthropic_message',
        correlationId: `anthropic-${Date.now()}`
      }
    };
  }

  private buildConversationHistory(scenes: any[]): AnthropicMessage[] {
    const messages: AnthropicMessage[] = [];
    
    scenes.forEach((scene) => {
      if (scene.metadata?.userInput) {
        messages.push({
          role: 'user',
          content: scene.metadata.userInput
        });
      }
      
      if (scene.ui?.content) {
        messages.push({
          role: 'assistant',
          content: scene.ui.content
        });
      }
    });
    
    return messages;
  }

  // OpenAI와 동일한 유틸리티 메서드들
  private extractUIFromContent(content: string): UIContent {
    // HTML 태그가 있으면 HTML로 처리
    if (content.includes('<') && content.includes('>')) {
      return {
        type: 'html',
        content: content,
        actions: this.extractActionsFromHTML(content)
      };
    }
    
    // JSON 형태인지 체크
    try {
      const parsed = JSON.parse(content);
      return {
        type: 'json',
        content: parsed,
        actions: {}
      };
    } catch {
      // Plain text
      return {
        type: 'html',
        content: `<div class="text-response">${content}</div>`,
        actions: {}
      };
    }
  }
  
  private extractActionsFromHTML(html: string): Record<string, string> {
    const actions: Record<string, string> = {};
    const buttonRegex = /<button[^>]*data-action="([^"]*)"[^>]*>(.*?)<\/button>/gi;
    let match;
    
    while ((match = buttonRegex.exec(html)) !== null) {
      const actionName = match[1];
      const buttonText = match[2].replace(/<[^>]*>/g, '').trim();
      actions[actionName] = buttonText;
    }
    
    return actions;
  }
  
  private extractTitleFromContent(content: string): string {
    return content.split('\n')[0]?.replace(/[#*]/g, '').trim() || 'Untitled';
  }
  
  private extractStateFromContent(): Record<string, any> {
    // 기본 상태 반환
    return {
      visible: true,
      loading: false,
      error: null
    };
  }
  
  private generateSuggestions(): string[] {
    return [];
  }
}

// ============================================================================
// 통합 어댑터 팩토리
// ============================================================================

export type AIServiceProvider = 'openai' | 'anthropic' | 'custom';

export interface AIServiceConfig {
  provider: AIServiceProvider;
  apiKey?: string;
  baseURL?: string;
  model?: string;
  systemPrompt?: string;
}

export class AIServiceAdapterFactory {
  static createAdapter(config: AIServiceConfig) {
    switch (config.provider) {
      case 'openai':
        return new OpenAIAdapter(config.systemPrompt);
      case 'anthropic':
        return new AnthropicAdapter(config.systemPrompt);
      default:
        throw new Error(`Unsupported AI service provider: ${config.provider}`);
    }
  }

  /**
   * 어댑터 호환성 검증
   */
  static validateCompatibility(provider: AIServiceProvider): boolean {
    const supportedProviders: AIServiceProvider[] = ['openai', 'anthropic'];
    return supportedProviders.includes(provider);
  }

  /**
   * 요청 포맷 검증
   */
  static validateRequest(request: AgentRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.id) errors.push('Request ID is required');
    if (!request.type) errors.push('Request type is required');
    if (request.type === 'ai_query' && !request.payload?.message) {
      errors.push('Request message is required for ai_query type');
    }
    if (!request.timestamp) errors.push('Request timestamp is required');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 응답 포맷 검증
   */
  static validateResponse(response: AgentResponse): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!response.id) errors.push('Response ID is required');
    if (!response.requestId) errors.push('Request ID is required');
    if (!response.type) errors.push('Response type is required');
    if (!response.status) errors.push('Response status is required');
    if (!response.data) errors.push('Response data is required');

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
