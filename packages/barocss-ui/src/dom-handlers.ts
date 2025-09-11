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
    windowFrame.className = 'barocss-window-frame fixed top-4 right-4 w-96 h-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50';
    windowFrame.setAttribute('data-display-type', 'window');
    windowFrame.setAttribute('data-context-id', aiResponse.context.id);

    // Basic window structure - LLM can override with custom classes
    const titleBar = document.createElement('div');
    titleBar.className = 'barocss-window-titlebar flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg';
    
    const contentArea = document.createElement('div');
    contentArea.className = 'barocss-window-content p-4 h-full overflow-auto';
    
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
    modalBackdrop.className = 'barocss-modal-backdrop w-full h-full';
    modalBackdrop.setAttribute('data-display-type', 'modal');
    modalBackdrop.setAttribute('data-context-id', aiResponse.context.id);

    const modalDropPanel = document.createElement('div');
    modalDropPanel.className = 'barocss-modal-drop-panel fixed inset-0 bg-black/50';

    const modalContainer = document.createElement('div');
    modalContainer.className = 'barocss-modal-container absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 max-w-2xl w-[90%] min-w-80';
    
    const aiContent = this.parseHtml(aiResponse.html);
    modalContainer.appendChild(aiContent);
    
    modalBackdrop.appendChild(modalDropPanel);
    modalBackdrop.appendChild(modalContainer);

    return modalBackdrop;
  }
}

// Overlay handler - provides basic overlay structure, LLM fills content
class OverlayHandler extends BaseDOMHandler {
  create(aiResponse: AIResponse): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'barocss-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40';
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
    container.className = 'barocss-inline inline-block p-2 bg-blue-50 border border-blue-200 rounded-md';
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
