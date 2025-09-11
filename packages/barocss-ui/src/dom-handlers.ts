import { AIResponse, DisplayType } from './types';

export interface DOMHandler {
  create(aiResponse: AIResponse): HTMLElement;
}

// Base handler for common HTML parsing
class BaseDOMHandler implements DOMHandler {
  protected parseHtml(html: string): HTMLElement {
    const container = document.createElement('div');
    container.innerHTML = html;
    const element = container.firstElementChild as HTMLElement | null;
    if (!element) {
      throw new Error('Failed to parse AI HTML into a single element.');
    }
    return element;
  }

  create(aiResponse: AIResponse): HTMLElement {
    return this.parseHtml(aiResponse.html);
  }
}

// Window handler - provides basic window structure, LLM fills content
class WindowHandler extends BaseDOMHandler {
  create(aiResponse: AIResponse): HTMLElement {
    const windowFrame = document.createElement('div');
    windowFrame.className = 'barocss-window-frame';
    windowFrame.setAttribute('data-display-type', 'window');
    windowFrame.setAttribute('data-context-id', aiResponse.context.id);

    // Basic window structure - LLM can override with custom classes
    const titleBar = document.createElement('div');
    titleBar.className = 'barocss-window-titlebar';
    
    const contentArea = document.createElement('div');
    contentArea.className = 'barocss-window-content';
    
    // Let LLM generate the actual content and styling
    const aiContent = this.parseHtml(aiResponse.html);
    contentArea.appendChild(aiContent);
    
    windowFrame.appendChild(titleBar);
    windowFrame.appendChild(contentArea);

    return windowFrame;
  }
}

// Modal handler - provides basic modal structure, LLM fills content
class ModalHandler extends BaseDOMHandler {
  create(aiResponse: AIResponse): HTMLElement {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'barocss-modal-backdrop';
    modalBackdrop.setAttribute('data-display-type', 'modal');
    modalBackdrop.setAttribute('data-context-id', aiResponse.context.id);

    const modalContainer = document.createElement('div');
    modalContainer.className = 'barocss-modal-container';
    
    // Let LLM generate the actual content and styling
    const aiContent = this.parseHtml(aiResponse.html);
    modalContainer.appendChild(aiContent);
    
    modalBackdrop.appendChild(modalContainer);

    return modalBackdrop;
  }
}

// Overlay handler - provides basic overlay structure, LLM fills content
class OverlayHandler extends BaseDOMHandler {
  create(aiResponse: AIResponse): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'barocss-overlay';
    overlay.setAttribute('data-display-type', 'overlay');
    overlay.setAttribute('data-context-id', aiResponse.context.id);
    
    // Let LLM generate the actual content and styling
    const aiContent = this.parseHtml(aiResponse.html);
    overlay.appendChild(aiContent);
    
    return overlay;
  }
}

// Inline handler - minimal structure, LLM handles everything
class InlineHandler extends BaseDOMHandler {
  create(aiResponse: AIResponse): HTMLElement {
    const container = document.createElement('div');
    container.className = 'barocss-inline';
    container.setAttribute('data-display-type', 'inline');
    container.setAttribute('data-context-id', aiResponse.context.id);
    
    // Let LLM generate the actual content and styling
    const aiContent = this.parseHtml(aiResponse.html);
    container.appendChild(aiContent);
    
    return container;
  }
}

// Embedded handler - minimal structure, LLM handles everything
class EmbeddedHandler extends BaseDOMHandler {
  create(aiResponse: AIResponse): HTMLElement {
    const container = document.createElement('div');
    container.className = 'barocss-embedded';
    container.setAttribute('data-display-type', 'embedded');
    container.setAttribute('data-context-id', aiResponse.context.id);
    
    // Let LLM generate the actual content and styling
    const aiContent = this.parseHtml(aiResponse.html);
    container.appendChild(aiContent);
    
    return container;
  }
}

export class HandlerFactory {
  private handlers = new Map<DisplayType, DOMHandler>();

  constructor() {
    this.registerHandler('window', new WindowHandler());
    this.registerHandler('modal', new ModalHandler());
    this.registerHandler('overlay', new OverlayHandler());
    this.registerHandler('inline', new InlineHandler());
    this.registerHandler('embedded', new EmbeddedHandler());
  }

  registerHandler(type: DisplayType, handler: DOMHandler): void {
    this.handlers.set(type, handler);
  }

  getHandler(type: DisplayType): DOMHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      console.warn(`No specific handler for display type: ${type}. Using inline handler.`);
      return this.handlers.get('inline')!; // Fallback to inline handler
    }
    return handler;
  }
}
