/**
 * Stage
 * Rendering surface that mounts scenes and wires DOM events.
 */

import { Scene } from '../types';
import { UIRenderer, createUIRenderer } from './ui-renderer';
import { Director } from './director';
import { formDataToRecord } from '../utils/form-data-helpers';

export interface StageOptions {
  mount: string | HTMLElement;
  renderer?: UIRenderer;
  director?: Director;
}

export class Stage {
  private container: HTMLElement;
  private renderer: UIRenderer;
  private director: Director | undefined;

  constructor(options: StageOptions) {
    this.container = Stage.resolveContainer(options.mount);
    this.renderer = options.renderer || createUIRenderer(this.container);
    this.director = options.director;

    // Basic DOM delegation to emit custom events
    this.setupEventDelegation();
  }

  mount(): void {
    // No-op for now; renderer is already bound to container via constructor
  }

  async render(scene: Scene): Promise<void> {
    this.renderer.renderScene(scene);
  }

  update(scene: Scene): void {
    this.renderer.updateScene(scene);
  }

  clear(): void {
    this.renderer.clearAll();
  }

  dispose(): void {
    this.renderer.cleanup();
    this.teardownEventDelegation();
  }

  getRenderer(): UIRenderer {
    return this.renderer;
  }

  private static resolveContainer(mount: string | HTMLElement): HTMLElement {
    if (typeof mount === 'string') {
      const el = document.querySelector(mount);
      if (!el) {
        throw new Error(`Stage mount element not found for selector: ${mount}`);
      }
      return el as HTMLElement;
    }
    return mount;
  }

  private handleClick = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const actionEl = (target.closest('[data-action]') as HTMLElement) || null;
    if (!actionEl) return;

    const actionId = actionEl.getAttribute('data-action');
    if (!actionId) return;

    // Bubble a normalized custom event; Director may subscribe externally
    const custom = new CustomEvent('ui-action', {
      detail: {
        action: actionId,
        sceneId: actionEl.closest('[data-scene-id]')?.getAttribute('data-scene-id') || null,
        dataset: { ...actionEl.dataset }
      },
      bubbles: true
    });
    actionEl.dispatchEvent(custom);
  };

  private handleSubmit = (event: Event) => {
    const form = event.target as HTMLFormElement | null;
    if (!form || form.tagName.toLowerCase() !== 'form') return;
    const action = form.getAttribute('data-action') || 'form-submit';
    const sceneId = form.closest('[data-scene-id]')?.getAttribute('data-scene-id') || null;
    const fd = new FormData(form);
    const data = formDataToRecord(fd);

    const custom = new CustomEvent('ui-form-submit', {
      detail: { action, sceneId, data },
      bubbles: true
    });
    form.dispatchEvent(custom);
  };

  private setupEventDelegation(): void {
    this.container.addEventListener('click', this.handleClick);
    this.container.addEventListener('submit', this.handleSubmit);
  }

  private teardownEventDelegation(): void {
    this.container.removeEventListener('click', this.handleClick);
    this.container.removeEventListener('submit', this.handleSubmit);
  }
}

export function createStage(options: StageOptions): Stage {
  return new Stage(options);
}


