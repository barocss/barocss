/**
 * Service Container for Dependency Injection
 * 순환 참조 문제를 해결하기 위한 서비스 컨테이너
 */

import {
  ISceneManager,
  IUIRenderer,
  IDirector,
  IAgentCommunication,
  ISceneRepository,
  ISceneNavigation,
  IConversationManager,
  ISceneRenderer,
  IRenderingEngine,
  IDirectorCore,
  IDirectorContext,
  IAgentManagement
} from '../types';

// 서비스 타입 정의
export type ServiceType = 
  | 'sceneManager'
  | 'uiRenderer' 
  | 'director'
  | 'agentCommunication'
  | 'sceneRepository'
  | 'sceneNavigation'
  | 'conversationManager'
  | 'sceneRenderer'
  | 'renderingEngine'
  | 'directorCore'
  | 'directorContext'
  | 'agentManagement';

export type ServiceInstance = 
  | ISceneManager
  | IUIRenderer
  | IDirector
  | IAgentCommunication
  | ISceneRepository
  | ISceneNavigation
  | IConversationManager
  | ISceneRenderer
  | IRenderingEngine
  | IDirectorCore
  | IDirectorContext
  | IAgentManagement;

// 서비스 팩토리 타입
export type ServiceFactory<T = ServiceInstance> = () => T;

/**
 * 의존성 주입 컨테이너
 */
export class ServiceContainer {
  private services = new Map<ServiceType, ServiceInstance>();
  private factories = new Map<ServiceType, ServiceFactory>();
  private singletons = new Set<ServiceType>();

  /**
   * 서비스 팩토리 등록
   */
  register<T extends ServiceInstance>(
    type: ServiceType, 
    factory: ServiceFactory<T>, 
    singleton: boolean = true
  ): void {
    this.factories.set(type, factory as ServiceFactory);
    if (singleton) {
      this.singletons.add(type);
    }
  }

  /**
   * 서비스 인스턴스 직접 등록
   */
  registerInstance<T extends ServiceInstance>(type: ServiceType, instance: T): void {
    this.services.set(type, instance);
    this.singletons.add(type);
  }

  /**
   * 서비스 조회
   */
  get<T extends ServiceInstance>(type: ServiceType): T | null {
    // 이미 생성된 인스턴스가 있으면 반환
    if (this.services.has(type)) {
      return this.services.get(type) as T;
    }

    // 팩토리로 새 인스턴스 생성
    const factory = this.factories.get(type);
    if (!factory) {
      return null;
    }

    const instance = factory() as T;
    
    // 싱글톤이면 캐시
    if (this.singletons.has(type)) {
      this.services.set(type, instance);
    }

    return instance;
  }

  /**
   * 서비스가 등록되어 있는지 확인
   */
  has(type: ServiceType): boolean {
    return this.services.has(type) || this.factories.has(type);
  }

  /**
   * 서비스 제거
   */
  remove(type: ServiceType): void {
    this.services.delete(type);
    this.factories.delete(type);
    this.singletons.delete(type);
  }

  /**
   * 모든 서비스 제거
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
    this.singletons.clear();
  }

  /**
   * 등록된 서비스 목록 조회
   */
  getRegisteredTypes(): ServiceType[] {
    const types = new Set<ServiceType>();
    this.services.forEach((_, type) => types.add(type));
    this.factories.forEach((_, type) => types.add(type));
    return Array.from(types);
  }
}

// 글로벌 서비스 컨테이너 인스턴스
export const serviceContainer = new ServiceContainer();

/**
 * 서비스 조회 헬퍼 함수
 */
export function getService<T extends ServiceInstance>(type: ServiceType): T | null {
  return serviceContainer.get<T>(type);
}

/**
 * 서비스 등록 헬퍼 함수
 */
export function registerService<T extends ServiceInstance>(
  type: ServiceType, 
  factory: ServiceFactory<T>, 
  singleton: boolean = true
): void {
  serviceContainer.register(type, factory, singleton);
}

/**
 * 서비스 인스턴스 등록 헬퍼 함수 (타입 유연성 개선)
 */
export function registerServiceInstance<T = any>(
  type: ServiceType, 
  instance: T
): void {
  serviceContainer.registerInstance(type, instance as ServiceInstance);
}
