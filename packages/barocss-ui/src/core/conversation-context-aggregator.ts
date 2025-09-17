/**
 * ConversationContextAggregator
 * 이전 대화 Scene들의 컨텍스트를 수집하고 집계하는 클래스
 */

import {
  ConversationChain,
  AggregatedContext,
  SceneContextSummary,
  UserInput,
  AIOutput,
  Scene
} from '../types';

export class ConversationContextAggregator {
  /**
   * 이전 대화 Scene들의 컨텍스트 수집
   */
  aggregateContext(conversationChain: ConversationChain): AggregatedContext {
    return {
      conversation: {
        id: conversationChain.id,
        step: conversationChain.scenes.length,
        totalSteps: conversationChain.metadata.totalSteps
      },
      scenes: conversationChain.scenes.map(scene => ({
        id: scene.id,
        type: scene.type,
        title: scene.title,
        state: scene.state.data,
        userInputs: this.extractUserInputs(scene),
        aiOutputs: this.extractAIOutputs(scene)
      })),
      currentScene: {
        id: conversationChain.currentSceneId,
        context: this.getCurrentSceneContext(conversationChain.currentSceneId, conversationChain)
      },
      global: this.getGlobalState()
    };
  }

  private extractUserInputs(scene: Scene): UserInput[] {
    // Scene의 메타데이터에서 사용자 입력 이력 추출
    if (scene.context?.metadata && 'userInputs' in scene.context.metadata) {
      const userInputs = scene.context.metadata.userInputs;
      return Array.isArray(userInputs) ? userInputs as UserInput[] : [];
    }
    return [];
  }

  private extractAIOutputs(scene: Scene): AIOutput[] {
    // Scene의 메타데이터에서 AI 출력 이력 추출
    if (scene.context?.metadata && 'aiOutputs' in scene.context.metadata) {
      const aiOutputs = scene.context.metadata.aiOutputs;
      return Array.isArray(aiOutputs) ? aiOutputs as AIOutput[] : [];
    }
    return [];
  }

  private getCurrentSceneContext(sceneId: string, conversationChain: ConversationChain): Record<string, any> {
    const currentScene = conversationChain.scenes.find(scene => scene.id === sceneId);
    return currentScene?.context?.data || {};
  }

  private getGlobalState(): Record<string, any> {
    // 전역 상태 반환 (실제로는 ContextManager에서 가져와야 함)
    return {};
  }
}

export function createConversationContextAggregator(): ConversationContextAggregator {
  return new ConversationContextAggregator();
}
