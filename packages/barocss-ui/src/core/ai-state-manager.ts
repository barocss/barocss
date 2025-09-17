/**
 * AI State Manager
 * 고급 상태 관리 및 AI 연동
 */

import { 
  SceneState, 
  GlobalState, 
  ConversationContext,
  AIStateData,
  UserAction,
  AIResponseProcessingOptions
} from '../types';
import { generateId, getCurrentTimestamp } from '../utils/id-generator';

export interface AIStateManagerOptions {
  maxHistorySize: number;
  enablePersistence: boolean;
  persistenceKey: string;
  autoCleanup: boolean;
  cleanupInterval: number;
}

export class AIStateManager {
  private sceneStates: Map<string, Map<string, any>> = new Map();
  private globalStates: Map<string, any> = new Map();
  private conversationContexts: Map<string, any> = new Map();
  private actionHistory: UserAction[] = [];
  private options: AIStateManagerOptions;

  constructor(options: Partial<AIStateManagerOptions> = {}) {
    this.options = {
      maxHistorySize: 1000,
      enablePersistence: true,
      persistenceKey: 'ai-state-manager',
      autoCleanup: true,
      cleanupInterval: 30000, // 30초
      ...options
    };

    if (this.options.enablePersistence) {
      this.loadFromStorage();
    }

    if (this.options.autoCleanup) {
      this.setupAutoCleanup();
    }
  }

  // ============================================================================
  // Scene별 상태 관리
  // ============================================================================

  /**
   * Scene 상태 설정
   */
  setSceneState(sceneId: string, key: string, value: any): void {
    if (!this.sceneStates.has(sceneId)) {
      this.sceneStates.set(sceneId, new Map());
    }
    this.sceneStates.get(sceneId)!.set(key, value);
    this.saveToStorage();
  }

  /**
   * Scene 상태 조회
   */
  getSceneState(sceneId: string, key: string): any {
    return this.sceneStates.get(sceneId)?.get(key);
  }

  /**
   * Scene의 모든 상태 조회
   */
  getAllSceneStates(sceneId: string): Record<string, any> {
    const sceneState = this.sceneStates.get(sceneId);
    return sceneState ? Object.fromEntries(sceneState) : {};
  }

  /**
   * Scene 상태 업데이트
   */
  updateSceneState(sceneId: string, key: string, updater: (current: any) => any): void {
    const currentValue = this.getSceneState(sceneId, key);
    const newValue = updater(currentValue);
    this.setSceneState(sceneId, key, newValue);
  }

  /**
   * Scene 상태 일괄 설정
   */
  setSceneStates(sceneId: string, states: Record<string, any>): void {
    if (!this.sceneStates.has(sceneId)) {
      this.sceneStates.set(sceneId, new Map());
    }
    
    Object.entries(states).forEach(([key, value]) => {
      this.sceneStates.get(sceneId)!.set(key, value);
    });
    
    this.saveToStorage();
  }

  /**
   * Scene 상태 초기화
   */
  clearSceneState(sceneId: string): void {
    this.sceneStates.delete(sceneId);
    this.saveToStorage();
  }

  // ============================================================================
  // 전역 상태 관리
  // ============================================================================

  /**
   * 전역 상태 설정
   */
  setGlobalState(key: string, value: any): void {
    this.globalStates.set(key, value);
    this.saveToStorage();
  }

  /**
   * 전역 상태 조회
   */
  getGlobalState(key: string): any {
    return this.globalStates.get(key);
  }

  /**
   * 모든 전역 상태 조회
   */
  getAllGlobalStates(): Record<string, any> {
    return Object.fromEntries(this.globalStates);
  }

  /**
   * 전역 상태 업데이트
   */
  updateGlobalState(key: string, updater: (current: any) => any): void {
    const currentValue = this.getGlobalState(key);
    const newValue = updater(currentValue);
    this.setGlobalState(key, newValue);
  }

  /**
   * 전역 상태 일괄 설정
   */
  setGlobalStates(states: Record<string, any>): void {
    Object.entries(states).forEach(([key, value]) => {
      this.globalStates.set(key, value);
    });
    this.saveToStorage();
  }

  /**
   * 전역 상태 초기화
   */
  clearGlobalState(key: string): void {
    this.globalStates.delete(key);
    this.saveToStorage();
  }

  // ============================================================================
  // 대화 컨텍스트 관리
  // ============================================================================

  /**
   * 대화 컨텍스트 설정
   */
  setConversationContext(key: string, value: any): void {
    this.conversationContexts.set(key, value);
    this.saveToStorage();
  }

  /**
   * 대화 컨텍스트 조회
   */
  getConversationContext(key: string): any {
    return this.conversationContexts.get(key);
  }

  /**
   * 모든 대화 컨텍스트 조회
   */
  getAllConversationContexts(): Record<string, any> {
    return Object.fromEntries(this.conversationContexts);
  }

  /**
   * 대화 컨텍스트 업데이트
   */
  updateConversationContext(key: string, updater: (current: any) => any): void {
    const currentValue = this.getConversationContext(key);
    const newValue = updater(currentValue);
    this.setConversationContext(key, newValue);
  }

  /**
   * 대화 컨텍스트 초기화
   */
  clearConversationContext(key: string): void {
    this.conversationContexts.delete(key);
    this.saveToStorage();
  }

  // ============================================================================
  // 상태 수집 (AI 요청용)
  // ============================================================================

  /**
   * 특정 Scene의 상태 수집
   */
  collectStateForAI(sceneId: string): AIStateData {
    return {
      sceneState: this.getAllSceneStates(sceneId),
      globalState: this.getAllGlobalStates(),
      conversationContext: this.getAllConversationContexts()
    };
  }

  /**
   * 모든 상태 수집
   */
  collectAllStates(): AIStateData {
    return {
      sceneState: {},
      globalState: this.getAllGlobalStates(),
      conversationContext: this.getAllConversationContexts()
    };
  }

  /**
   * 상태 요약 생성
   */
  generateStateSummary(): {
    totalScenes: number;
    totalGlobalStates: number;
    totalConversationContexts: number;
    lastActivity: number;
    memoryUsage: number;
  } {
    const totalScenes = this.sceneStates.size;
    const totalGlobalStates = this.globalStates.size;
    const totalConversationContexts = this.conversationContexts.size;
    const lastActivity = this.actionHistory.length > 0 
      ? this.actionHistory[this.actionHistory.length - 1].timestamp 
      : 0;
    
    // 메모리 사용량 추정
    const memoryUsage = this.estimateMemoryUsage();

    return {
      totalScenes,
      totalGlobalStates,
      totalConversationContexts,
      lastActivity,
      memoryUsage
    };
  }

  // ============================================================================
  // 사용자 액션 관리
  // ============================================================================

  /**
   * 사용자 액션 기록
   */
  recordUserAction(action: UserAction): void {
    this.actionHistory.push({
      ...action,
      id: action.id || generateId('action'),
      timestamp: action.timestamp || getCurrentTimestamp()
    });

    // 히스토리 크기 제한
    if (this.actionHistory.length > this.options.maxHistorySize) {
      this.actionHistory = this.actionHistory.slice(-this.options.maxHistorySize);
    }

    this.saveToStorage();
  }

  /**
   * 액션 히스토리 조회
   */
  getActionHistory(limit?: number): UserAction[] {
    if (limit) {
      return this.actionHistory.slice(-limit);
    }
    return [...this.actionHistory];
  }

  /**
   * 특정 Scene의 액션 히스토리 조회
   */
  getSceneActionHistory(sceneId: string, limit?: number): UserAction[] {
    const sceneActions = this.actionHistory.filter(action => action.sceneId === sceneId);
    if (limit) {
      return sceneActions.slice(-limit);
    }
    return sceneActions;
  }

  /**
   * 액션 히스토리 정리
   */
  clearActionHistory(): void {
    this.actionHistory = [];
    this.saveToStorage();
  }

  // ============================================================================
  // AI 응답 처리
  // ============================================================================

  /**
   * AI 응답 처리
   */
  async processAIResponse(
    response: any, 
    options: AIResponseProcessingOptions = {}
  ): Promise<void> {
    const {
      renderMode = 'html',
      updateMode = 'replace',
      preserveState = true
    } = options;

    try {
      // AI 응답에서 상태 업데이트 추출
      if (response.data?.result?.state) {
        this.updateStatesFromAI(response.data.result.state);
      }

      // AI 응답에서 컨텍스트 업데이트 추출
      if (response.data?.result?.context) {
        this.updateContextsFromAI(response.data.result.context);
      }

      // AI 응답에서 전역 상태 업데이트 추출
      if (response.data?.result?.globalState) {
        this.updateGlobalStatesFromAI(response.data.result.globalState);
      }

    } catch (error) {
      // eslint-disable-next-line
      console.error('[AIStateManager] Failed to process AI response:', error);
    }
  }

  /**
   * AI에서 받은 상태 업데이트
   */
  private updateStatesFromAI(aiStates: Record<string, any>): void {
    Object.entries(aiStates).forEach(([sceneId, states]) => {
      if (typeof states === 'object' && states !== null) {
        this.setSceneStates(sceneId, states);
      }
    });
  }

  /**
   * AI에서 받은 컨텍스트 업데이트
   */
  private updateContextsFromAI(aiContexts: Record<string, any>): void {
    Object.entries(aiContexts).forEach(([key, value]) => {
      this.setConversationContext(key, value);
    });
  }

  /**
   * AI에서 받은 전역 상태 업데이트
   */
  private updateGlobalStatesFromAI(aiGlobalStates: Record<string, any>): void {
    Object.entries(aiGlobalStates).forEach(([key, value]) => {
      this.setGlobalState(key, value);
    });
  }

  // ============================================================================
  // 상태 동기화 및 전파
  // ============================================================================

  /**
   * 상태 동기화
   */
  syncStates(sourceSceneId: string, targetSceneId: string, mapping?: Record<string, string>): void {
    const sourceStates = this.getAllSceneStates(sourceSceneId);
    
    if (mapping) {
      Object.entries(mapping).forEach(([sourceKey, targetKey]) => {
        const value = sourceStates[sourceKey];
        if (value !== undefined) {
          this.setSceneState(targetSceneId, targetKey, value);
        }
      });
    } else {
      // 모든 상태 복사
      this.setSceneStates(targetSceneId, sourceStates);
    }
  }

  /**
   * 상태 전파
   */
  propagateState(key: string, value: any, targetScenes: string[]): void {
    targetScenes.forEach(targetSceneId => {
      this.setSceneState(targetSceneId, key, value);
    });
  }

  // ============================================================================
  // 정리 및 유지보수
  // ============================================================================

  /**
   * Scene 정리
   */
  cleanupScene(sceneId: string): void {
    this.sceneStates.delete(sceneId);
    
    // 해당 Scene과 관련된 액션 히스토리도 정리
    this.actionHistory = this.actionHistory.filter(action => action.sceneId !== sceneId);
    
    this.saveToStorage();
  }

  /**
   * 모든 Scene 정리
   */
  cleanupAllScenes(): void {
    this.sceneStates.clear();
    this.actionHistory = [];
    this.saveToStorage();
  }

  /**
   * 자동 정리 설정
   */
  private setupAutoCleanup(): void {
    setInterval(() => {
      this.performAutoCleanup();
    }, this.options.cleanupInterval);
  }

  /**
   * 자동 정리 수행
   */
  private performAutoCleanup(): void {
    const now = getCurrentTimestamp();
    const maxAge = 24 * 60 * 60 * 1000; // 24시간

    // 오래된 액션 히스토리 정리
    this.actionHistory = this.actionHistory.filter(
      action => now - action.timestamp < maxAge
    );

    // 사용하지 않는 Scene 상태 정리
    const sceneIds = Array.from(this.sceneStates.keys());
    sceneIds.forEach(sceneId => {
      const sceneActions = this.getSceneActionHistory(sceneId);
      const lastAction = sceneActions[sceneActions.length - 1];
      
      if (lastAction && now - lastAction.timestamp > maxAge) {
        this.cleanupScene(sceneId);
      }
    });

    this.saveToStorage();
  }

  /**
   * 메모리 사용량 추정
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    // Scene 상태 크기
    this.sceneStates.forEach(sceneState => {
      totalSize += JSON.stringify(Object.fromEntries(sceneState)).length;
    });

    // 전역 상태 크기
    totalSize += JSON.stringify(Object.fromEntries(this.globalStates)).length;

    // 대화 컨텍스트 크기
    totalSize += JSON.stringify(Object.fromEntries(this.conversationContexts)).length;

    // 액션 히스토리 크기
    totalSize += JSON.stringify(this.actionHistory).length;

    return totalSize;
  }

  // ============================================================================
  // 영속성 관리
  // ============================================================================

  /**
   * 스토리지에 저장
   */
  private saveToStorage(): void {
    if (!this.options.enablePersistence) return;

    try {
      const data = {
        sceneStates: Object.fromEntries(
          Array.from(this.sceneStates.entries()).map(([id, states]) => [
            id, 
            Object.fromEntries(states)
          ])
        ),
        globalStates: Object.fromEntries(this.globalStates),
        conversationContexts: Object.fromEntries(this.conversationContexts),
        actionHistory: this.actionHistory
      };

      localStorage.setItem(this.options.persistenceKey, JSON.stringify(data));
    } catch (error) {
      // eslint-disable-next-line
      console.warn('[AIStateManager] Failed to save to storage:', error);
    }
  }

  /**
   * 스토리지에서 로드
   */
  private loadFromStorage(): void {
    if (!this.options.enablePersistence) return;

    try {
      const data = localStorage.getItem(this.options.persistenceKey);
      if (!data) return;

      const parsed = JSON.parse(data);

      // Scene 상태 복원
      if (parsed.sceneStates) {
        Object.entries(parsed.sceneStates).forEach(([sceneId, states]) => {
          this.sceneStates.set(sceneId, new Map(Object.entries(states as Record<string, any>)));
        });
      }

      // 전역 상태 복원
      if (parsed.globalStates) {
        this.globalStates = new Map(Object.entries(parsed.globalStates));
      }

      // 대화 컨텍스트 복원
      if (parsed.conversationContexts) {
        this.conversationContexts = new Map(Object.entries(parsed.conversationContexts));
      }

      // 액션 히스토리 복원
      if (parsed.actionHistory) {
        this.actionHistory = parsed.actionHistory;
      }

    } catch (error) {
      // eslint-disable-next-line
      console.warn('[AIStateManager] Failed to load from storage:', error);
    }
  }

  /**
   * 정리
   */
  cleanup(): void {
    this.sceneStates.clear();
    this.globalStates.clear();
    this.conversationContexts.clear();
    this.actionHistory = [];
    
    if (this.options.enablePersistence) {
      localStorage.removeItem(this.options.persistenceKey);
    }
  }
}

// 팩토리 함수
export function createAIStateManager(options?: Partial<AIStateManagerOptions>): AIStateManager {
  return new AIStateManager(options);
}
