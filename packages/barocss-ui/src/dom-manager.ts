import { AIResponse, ProcessResult, DisplayType } from './types';
import { HandlerFactory, DOMHandler } from './dom-handlers';
import { EffectManager, EffectOptions } from './effect-manager';

export class DOMManager {
  private handlerFactory: HandlerFactory;
  private effectManager: EffectManager;

  constructor() {
    this.handlerFactory = new HandlerFactory();
    this.effectManager = new EffectManager();
  }

  async process(aiResponse: AIResponse): Promise<ProcessResult> {
    if (!aiResponse?.html || typeof aiResponse.html !== 'string' || aiResponse.html.trim().length === 0) {
      const fallback = document.createElement('div');
      fallback.textContent = 'Invalid AI response: empty HTML';
      return { success: false, fallback };
    }

    try {
      // Get appropriate handler for display type
      const handler = this.handlerFactory.getHandler(aiResponse.display.type);
      
      // Create element using type-specific handler
      const element = handler.create(aiResponse);
      
      // Apply entrance effects
      this.applyEntranceEffect(element, aiResponse);

      return {
        success: true,
        element,
        id: aiResponse.context?.id
      };
    } catch (error) {
      const fallback = document.createElement('div');
      fallback.textContent = `Failed to create ${aiResponse.display.type}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return { success: false, fallback };
    }
  }

  private applyEntranceEffect(element: HTMLElement, response: AIResponse): void {
    const entrance = response.effects?.entrance;
    if (!entrance) return;
    
    const options: EffectOptions = {
      duration: response.effects?.duration ?? 300,
      easing: 'ease'
    };
    
    this.effectManager.applyEffect(element, entrance, options);
  }

  remove(elementId: string): Promise<boolean> {
    const el = document.getElementById(elementId);
    if (el?.parentElement) {
      el.parentElement.removeChild(el);
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  update(elementId: string, newAIResponse: AIResponse): Promise<ProcessResult> {
    return this.process(newAIResponse).then(result => {
      if (result.success && result.element) {
        result.element.id = elementId;
      }
      return result;
    });
  }

  // Register custom handler for specific display type
  registerHandler(type: DisplayType, handler: DOMHandler): void {
    this.handlerFactory.registerHandler(type, handler);
  }

  // Get handler factory for advanced usage
  getHandlerFactory(): HandlerFactory {
    return this.handlerFactory;
  }

  // Register custom effect
  registerEffect(name: string, handler: (element: HTMLElement, options: EffectOptions) => void): void {
    this.effectManager.registerEffect(name, handler);
  }

  // Get available effects
  getAvailableEffects(): string[] {
    return this.effectManager.getAvailableEffects();
  }

  // Apply effect manually
  applyEffect(element: HTMLElement, effectName: string, options?: EffectOptions): void {
    this.effectManager.applyEffect(element, effectName, options);
  }
}
