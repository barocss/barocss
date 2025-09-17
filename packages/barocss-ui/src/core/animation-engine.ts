/**
 * Animation Engine
 * 부드러운 전환과 애니메이션 관리
 */

import { AnimationOptions, AnimationState } from '../types';

export interface AnimationEngineOptions {
  defaultDuration: number;
  defaultEasing: string;
  enableGPUAcceleration: boolean;
  respectReducedMotion: boolean;
}

export class AnimationEngine {
  private animations: Map<string, AnimationState> = new Map();
  private options: AnimationEngineOptions;

  constructor(options: Partial<AnimationEngineOptions> = {}) {
    this.options = {
      defaultDuration: 300,
      defaultEasing: 'ease',
      enableGPUAcceleration: true,
      respectReducedMotion: true,
      ...options
    };
  }

  /**
   * 페이드 인 애니메이션
   */
  async fadeIn(element: HTMLElement, duration?: number): Promise<void> {
    return this.animate(element, {
      duration: duration || this.options.defaultDuration,
      easing: 'ease-in',
      properties: {
        opacity: { from: 0, to: 1 }
      }
    });
  }

  /**
   * 페이드 아웃 애니메이션
   */
  async fadeOut(element: HTMLElement, duration?: number): Promise<void> {
    return this.animate(element, {
      duration: duration || this.options.defaultDuration,
      easing: 'ease-out',
      properties: {
        opacity: { from: 1, to: 0 }
      }
    });
  }

  /**
   * 슬라이드 인 애니메이션
   */
  async slideIn(
    element: HTMLElement, 
    direction: 'up' | 'down' | 'left' | 'right', 
    duration?: number
  ): Promise<void> {
    const transforms = this.getSlideTransform(direction, 'in');
    return this.animate(element, {
      duration: duration || this.options.defaultDuration,
      easing: 'ease-out',
      properties: {
        opacity: { from: 0, to: 1 },
        transform: { from: transforms.from, to: transforms.to }
      }
    });
  }

  /**
   * 슬라이드 아웃 애니메이션
   */
  async slideOut(
    element: HTMLElement, 
    direction: 'up' | 'down' | 'left' | 'right', 
    duration?: number
  ): Promise<void> {
    const transforms = this.getSlideTransform(direction, 'out');
    return this.animate(element, {
      duration: duration || this.options.defaultDuration,
      easing: 'ease-in',
      properties: {
        opacity: { from: 1, to: 0 },
        transform: { from: transforms.from, to: transforms.to }
      }
    });
  }

  /**
   * 줌 인 애니메이션
   */
  async zoomIn(element: HTMLElement, duration?: number): Promise<void> {
    return this.animate(element, {
      duration: duration || this.options.defaultDuration,
      easing: 'ease-out',
      properties: {
        opacity: { from: 0, to: 1 },
        transform: { from: 'scale(0.8)', to: 'scale(1)' }
      }
    });
  }

  /**
   * 줌 아웃 애니메이션
   */
  async zoomOut(element: HTMLElement, duration?: number): Promise<void> {
    return this.animate(element, {
      duration: duration || this.options.defaultDuration,
      easing: 'ease-in',
      properties: {
        opacity: { from: 1, to: 0 },
        transform: { from: 'scale(1)', to: 'scale(0.8)' }
      }
    });
  }

  /**
   * 회전 애니메이션
   */
  async rotate(element: HTMLElement, degrees: number, duration?: number): Promise<void> {
    return this.animate(element, {
      duration: duration || this.options.defaultDuration,
      easing: 'ease-in-out',
      properties: {
        transform: { from: 'rotate(0deg)', to: `rotate(${degrees}deg)` }
      }
    });
  }

  /**
   * 색상 변경 애니메이션
   */
  async changeColor(
    element: HTMLElement, 
    fromColor: string, 
    toColor: string, 
    duration?: number
  ): Promise<void> {
    return this.animate(element, {
      duration: duration || this.options.defaultDuration,
      easing: 'ease-in-out',
      properties: {
        backgroundColor: { from: fromColor, to: toColor }
      }
    });
  }

  /**
   * 크기 변경 애니메이션
   */
  async resize(
    element: HTMLElement, 
    fromSize: { width: string; height: string }, 
    toSize: { width: string; height: string }, 
    duration?: number
  ): Promise<void> {
    return this.animate(element, {
      duration: duration || this.options.defaultDuration,
      easing: 'ease-in-out',
      properties: {
        width: { from: fromSize.width, to: toSize.width },
        height: { from: fromSize.height, to: toSize.height }
      }
    });
  }

  /**
   * 커스텀 애니메이션
   */
  async animate(element: HTMLElement, options: AnimationOptions): Promise<void> {
    if (this.options.respectReducedMotion && this.shouldRespectReducedMotion()) {
      // 애니메이션 비활성화 시 즉시 최종 상태로 설정
      this.applyFinalState(element, options.properties);
      return;
    }

    const animationId = this.generateAnimationId();
    const animationState: AnimationState = {
      id: animationId,
      element,
      isRunning: true,
      startTime: performance.now(),
      duration: options.duration,
      easing: options.easing,
      properties: options.properties,
      onComplete: options.onComplete,
      onUpdate: options.onUpdate
    };

    this.animations.set(animationId, animationState);
    this.startAnimation(animationState);

    return new Promise((resolve) => {
      animationState.onComplete = () => {
        resolve();
        if (options.onComplete) {
          options.onComplete();
        }
      };
    });
  }

  /**
   * 애니메이션 시작
   */
  private startAnimation(animationState: AnimationState): void {
    const animate = (currentTime: number) => {
      if (!animationState.isRunning) return;

      const elapsed = currentTime - animationState.startTime;
      const progress = Math.min(elapsed / animationState.duration, 1);
      const easedProgress = this.applyEasing(progress, animationState.easing);

      this.updateElementProperties(animationState.element, animationState.properties, easedProgress);

      if (animationState.onUpdate) {
        animationState.onUpdate(easedProgress);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.completeAnimation(animationState);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * 애니메이션 완료
   */
  private completeAnimation(animationState: AnimationState): void {
    animationState.isRunning = false;
    this.animations.delete(animationState.id);

    if (animationState.onComplete) {
      animationState.onComplete();
    }
  }

  /**
   * 요소 속성 업데이트
   */
  private updateElementProperties(
    element: HTMLElement, 
    properties: Record<string, { from: any; to: any }>, 
    progress: number
  ): void {
    Object.entries(properties).forEach(([property, values]) => {
      const currentValue = this.interpolate(values.from, values.to, progress);
      
      if (property === 'transform') {
        element.style.transform = currentValue;
      } else if (property === 'opacity') {
        element.style.opacity = currentValue.toString();
      } else if (property === 'backgroundColor') {
        element.style.backgroundColor = currentValue;
      } else if (property === 'width') {
        element.style.width = currentValue;
      } else if (property === 'height') {
        element.style.height = currentValue;
      } else {
        (element.style as any)[property] = currentValue;
      }
    });
  }

  /**
   * 값 보간
   */
  private interpolate(from: any, to: any, progress: number): any {
    if (typeof from === 'number' && typeof to === 'number') {
      return from + (to - from) * progress;
    } else if (typeof from === 'string' && typeof to === 'string') {
      // 색상 보간 (간단한 구현)
      if (from.startsWith('#') && to.startsWith('#')) {
        return this.interpolateColor(from, to, progress);
      }
      // 기타 문자열은 progress에 따라 from 또는 to 반환
      return progress < 0.5 ? from : to;
    }
    return progress < 0.5 ? from : to;
  }

  /**
   * 색상 보간
   */
  private interpolateColor(from: string, to: string, progress: number): string {
    const fromRgb = this.hexToRgb(from);
    const toRgb = this.hexToRgb(to);
    
    if (!fromRgb || !toRgb) return from;

    const r = Math.round(fromRgb.r + (toRgb.r - fromRgb.r) * progress);
    const g = Math.round(fromRgb.g + (toRgb.g - fromRgb.g) * progress);
    const b = Math.round(fromRgb.b + (toRgb.b - fromRgb.b) * progress);

    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * 헥스 색상을 RGB로 변환
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * 이징 함수 적용
   */
  private applyEasing(progress: number, easing: string): number {
    switch (easing) {
      case 'linear':
        return progress;
      case 'ease-in':
        return progress * progress;
      case 'ease-out':
        return 1 - Math.pow(1 - progress, 2);
      case 'ease-in-out':
        return progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      default:
        return progress;
    }
  }

  /**
   * 슬라이드 변환 가져오기
   */
  private getSlideTransform(direction: string, type: 'in' | 'out'): { from: string; to: string } {
    const transforms = {
      up: { from: 'translateY(100%)', to: 'translateY(0)' },
      down: { from: 'translateY(-100%)', to: 'translateY(0)' },
      left: { from: 'translateX(100%)', to: 'translateX(0)' },
      right: { from: 'translateX(-100%)', to: 'translateX(0)' }
    };

    if (type === 'out') {
      return {
        from: transforms[direction as keyof typeof transforms].to,
        to: transforms[direction as keyof typeof transforms].from
      };
    }

    return transforms[direction as keyof typeof transforms];
  }

  /**
   * 최종 상태 적용
   */
  private applyFinalState(element: HTMLElement, properties: Record<string, { from: any; to: any }>): void {
    Object.entries(properties).forEach(([property, values]) => {
      if (property === 'transform') {
        element.style.transform = values.to;
      } else if (property === 'opacity') {
        element.style.opacity = values.to.toString();
      } else if (property === 'backgroundColor') {
        element.style.backgroundColor = values.to;
      } else if (property === 'width') {
        element.style.width = values.to;
      } else if (property === 'height') {
        element.style.height = values.to;
      } else {
        (element.style as any)[property] = values.to;
      }
    });
  }

  /**
   * 애니메이션 중지
   */
  stopAnimation(element: HTMLElement): void {
    const animation = Array.from(this.animations.values())
      .find(anim => anim.element === element);
    
    if (animation) {
      animation.isRunning = false;
      this.animations.delete(animation.id);
    }
  }

  /**
   * 모든 애니메이션 중지
   */
  stopAllAnimations(): void {
    this.animations.forEach(animation => {
      animation.isRunning = false;
    });
    this.animations.clear();
  }

  /**
   * 애니메이션 ID 생성
   */
  private generateAnimationId(): string {
    return `anim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 감소된 모션 설정 확인
   */
  private shouldRespectReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * 정리
   */
  cleanup(): void {
    this.stopAllAnimations();
  }
}

// 팩토리 함수
export function createAnimationEngine(options?: Partial<AnimationEngineOptions>): AnimationEngine {
  return new AnimationEngine(options);
}
