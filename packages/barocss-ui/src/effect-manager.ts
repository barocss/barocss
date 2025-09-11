export interface EffectOptions {
  duration?: number;
  delay?: number;
  easing?: string;
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
  [key: string]: unknown;
}

export interface EffectHandler {
  (element: HTMLElement, options: EffectOptions): void;
}

export class EffectManager {
  private effects = new Map<string, EffectHandler>();

  constructor() {
    this.registerDefaultEffects();
  }

  registerEffect(name: string, handler: EffectHandler): void {
    this.effects.set(name, handler);
  }

  applyEffect(element: HTMLElement, effectName: string, options: EffectOptions = {}): void {
    const handler = this.effects.get(effectName);
    if (!handler) {
      console.warn(`Effect '${effectName}' not found. Available effects:`, Array.from(this.effects.keys()));
      return;
    }

    handler(element, {
      duration: 300,
      easing: 'ease',
      direction: 'normal',
      fillMode: 'forwards',
      ...options
    });
  }

  getAvailableEffects(): string[] {
    return Array.from(this.effects.keys());
  }

  private registerDefaultEffects(): void {
    // Fade effects
    this.registerEffect('fadeIn', (element, options) => {
      element.style.opacity = '0';
      element.style.transition = `opacity ${options.duration}ms ${options.easing}`;
      requestAnimationFrame(() => {
        element.style.opacity = '1';
      });
    });

    this.registerEffect('fadeOut', (element, options) => {
      element.style.transition = `opacity ${options.duration}ms ${options.easing}`;
      element.style.opacity = '0';
      setTimeout(() => {
        if (element.parentElement) {
          element.parentElement.removeChild(element);
        }
      }, options.duration);
    });

    // Slide effects
    this.registerEffect('slideInFromTop', (element, options) => {
      element.style.transform = 'translateY(-100%)';
      element.style.transition = `transform ${options.duration}ms ${options.easing}`;
      requestAnimationFrame(() => {
        element.style.transform = 'translateY(0)';
      });
    });

    this.registerEffect('slideInFromBottom', (element, options) => {
      element.style.transform = 'translateY(100%)';
      element.style.transition = `transform ${options.duration}ms ${options.easing}`;
      requestAnimationFrame(() => {
        element.style.transform = 'translateY(0)';
      });
    });

    this.registerEffect('slideInFromLeft', (element, options) => {
      element.style.transform = 'translateX(-100%)';
      element.style.transition = `transform ${options.duration}ms ${options.easing}`;
      requestAnimationFrame(() => {
        element.style.transform = 'translateX(0)';
      });
    });

    this.registerEffect('slideInFromRight', (element, options) => {
      element.style.transform = 'translateX(100%)';
      element.style.transition = `transform ${options.duration}ms ${options.easing}`;
      requestAnimationFrame(() => {
        element.style.transform = 'translateX(0)';
      });
    });

    // Scale effects
    this.registerEffect('scaleIn', (element, options) => {
      element.style.transform = 'scale(0)';
      element.style.transition = `transform ${options.duration}ms ${options.easing}`;
      requestAnimationFrame(() => {
        element.style.transform = 'scale(1)';
      });
    });

    this.registerEffect('scaleOut', (element, options) => {
      element.style.transition = `transform ${options.duration}ms ${options.easing}`;
      element.style.transform = 'scale(0)';
      setTimeout(() => {
        if (element.parentElement) {
          element.parentElement.removeChild(element);
        }
      }, options.duration);
    });

    // Bounce effects
    this.registerEffect('bounceIn', (element, options) => {
      element.style.transform = 'scale(0)';
      element.style.transition = `transform ${options.duration}ms cubic-bezier(0.68, -0.55, 0.265, 1.55)`;
      requestAnimationFrame(() => {
        element.style.transform = 'scale(1)';
      });
    });

    // Zoom effects
    this.registerEffect('zoomIn', (element, options) => {
      element.style.transform = 'scale(0.3)';
      element.style.opacity = '0';
      element.style.transition = `transform ${options.duration}ms ${options.easing}, opacity ${options.duration}ms ${options.easing}`;
      requestAnimationFrame(() => {
        element.style.transform = 'scale(1)';
        element.style.opacity = '1';
      });
    });

    this.registerEffect('zoomOut', (element, options) => {
      element.style.transition = `transform ${options.duration}ms ${options.easing}, opacity ${options.duration}ms ${options.easing}`;
      element.style.transform = 'scale(0.3)';
      element.style.opacity = '0';
      setTimeout(() => {
        if (element.parentElement) {
          element.parentElement.removeChild(element);
        }
      }, options.duration);
    });

    // Rotate effects
    this.registerEffect('rotateIn', (element, options) => {
      element.style.transform = 'rotate(-180deg) scale(0)';
      element.style.opacity = '0';
      element.style.transition = `transform ${options.duration}ms ${options.easing}, opacity ${options.duration}ms ${options.easing}`;
      requestAnimationFrame(() => {
        element.style.transform = 'rotate(0deg) scale(1)';
        element.style.opacity = '1';
      });
    });

    // Flip effects
    this.registerEffect('flipInX', (element, options) => {
      element.style.transform = 'perspective(400px) rotateX(90deg)';
      element.style.opacity = '0';
      element.style.transition = `transform ${options.duration}ms ${options.easing}, opacity ${options.duration}ms ${options.easing}`;
      requestAnimationFrame(() => {
        element.style.transform = 'perspective(400px) rotateX(0deg)';
        element.style.opacity = '1';
      });
    });

    this.registerEffect('flipInY', (element, options) => {
      element.style.transform = 'perspective(400px) rotateY(90deg)';
      element.style.opacity = '0';
      element.style.transition = `transform ${options.duration}ms ${options.easing}, opacity ${options.duration}ms ${options.easing}`;
      requestAnimationFrame(() => {
        element.style.transform = 'perspective(400px) rotateY(0deg)';
        element.style.opacity = '1';
      });
    });
  }
}
