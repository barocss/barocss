# 렌더링 시스템 설계

## 개요

렌더링 시스템은 Director의 UI를 실제 DOM으로 변환하고 관리하는 핵심 시스템입니다. 시나리오 분석을 통해 도출된 다양한 렌더링 요구사항을 충족하도록 설계되었습니다.

## 핵심 개념

### 렌더링 방식
- **HTML 렌더링**: AI가 생성한 HTML 문자열을 직접 DOM에 삽입
- **컴포넌트 렌더링**: 재사용 가능한 컴포넌트 기반 렌더링
- **JSON 렌더링**: 구조화된 JSON 데이터를 UI로 변환
- **하이브리드 렌더링**: 상황에 따라 최적의 렌더링 방식 선택

### 렌더링 최적화
- **부분 업데이트**: 전체 Scene 대신 변경된 부분만 업데이트
- **가상 DOM**: 효율적인 DOM 조작을 위한 가상 DOM 시스템
- **애니메이션**: 부드러운 전환 효과와 사용자 경험 향상
- **성능 모니터링**: 렌더링 성능 실시간 모니터링

## 시스템 아키텍처

### 1. Hybrid Renderer

```typescript
interface HybridRenderer {
  // 렌더링 방식 선택
  render(content: RenderContent, container: HTMLElement, options?: RenderOptions): void
  renderHTML(html: string, container: HTMLElement, options?: HTMLRenderOptions): void
  renderComponents(components: ComponentDefinition[], container: HTMLElement, options?: ComponentRenderOptions): void
  renderJSON(json: any, container: HTMLElement, options?: JSONRenderOptions): void
  
  // 부분 업데이트
  updateElement(selector: string, content: string | HTMLElement): void
  updateSubScene(subSceneId: string, content: any): void
  updateModal(modalId: string, content: any): void
  
  // 렌더링 정리
  destroy(container: HTMLElement): void
  cleanup(): void
}
```

### 2. Partial Update Engine

```typescript
interface PartialUpdateEngine {
  // DOM 업데이트
  updateElement(selector: string, content: string | HTMLElement): void
  updateAttribute(selector: string, attribute: string, value: any): void
  updateStyle(selector: string, styles: Record<string, any>): void
  updateText(selector: string, text: string): void
  
  // SubScene 업데이트
  updateSubSceneContent(subSceneId: string, content: any): void
  updateSubSceneState(subSceneId: string, state: Partial<SubSceneState>): void
  
  // 배치 업데이트
  batchUpdate(updates: UpdateOperation[]): void
  
  // 업데이트 최적화
  debounceUpdate(selector: string, delay: number): void
  throttleUpdate(selector: string, interval: number): void
}
```

### 3. Animation Engine

```typescript
interface AnimationEngine {
  // 기본 애니메이션
  fadeIn(element: HTMLElement, duration?: number): Promise<void>
  fadeOut(element: HTMLElement, duration?: number): Promise<void>
  slideIn(element: HTMLElement, direction: 'up' | 'down' | 'left' | 'right', duration?: number): Promise<void>
  slideOut(element: HTMLElement, direction: 'up' | 'down' | 'left' | 'right', duration?: number): Promise<void>
  
  // 커스텀 애니메이션
  animate(element: HTMLElement, keyframes: Keyframe[], options?: AnimationOptions): Promise<void>
  animateProperty(element: HTMLElement, property: string, from: any, to: any, duration?: number): Promise<void>
  
  // 전환 애니메이션
  transition(from: HTMLElement, to: HTMLElement, type: TransitionType): Promise<void>
  morph(from: HTMLElement, to: HTMLElement): Promise<void>
  
  // 애니메이션 제어
  pause(element: HTMLElement): void
  resume(element: HTMLElement): void
  stop(element: HTMLElement): void
  reverse(element: HTMLElement): void
}
```

### 4. Virtual DOM System

```typescript
interface VirtualDOM {
  // 가상 노드 생성
  createElement(tag: string, props?: Record<string, any>, children?: VNode[]): VNode
  createTextNode(text: string): VNode
  createComponent(component: ComponentDefinition, props?: Record<string, any>): VNode
  
  // 가상 DOM 조작
  diff(oldVNode: VNode, newVNode: VNode): Patch[]
  patch(patches: Patch[], container: HTMLElement): void
  
  // 가상 DOM 렌더링
  render(vnode: VNode, container: HTMLElement): void
  update(vnode: VNode, container: HTMLElement): void
}
```

## 데이터 모델

### Render Content

```typescript
interface RenderContent {
  type: 'html' | 'components' | 'json' | 'scene'
  content: string | ComponentDefinition[] | any
  metadata?: RenderMetadata
}

interface RenderMetadata {
  id: string
  version: number
  timestamp: number
  source: 'ai' | 'user' | 'system'
  dependencies?: string[]
  styles?: string[]
  scripts?: string[]
}
```

### Component Definition

```typescript
interface ComponentDefinition {
  id: string
  type: string
  name: string
  props: Record<string, any>
  children?: ComponentDefinition[]
  events?: Record<string, string>
  styles?: Record<string, any>
  lifecycle?: ComponentLifecycle
}

interface ComponentLifecycle {
  onMount?: () => void
  onUnmount?: () => void
  onUpdate?: (props: Record<string, any>) => void
  onRender?: () => void
}
```

### Update Operation

```typescript
interface UpdateOperation {
  type: 'element' | 'attribute' | 'style' | 'text' | 'subscene' | 'modal'
  target: string
  content: any
  options?: UpdateOptions
}

interface UpdateOptions {
  animation?: AnimationOptions
  debounce?: number
  throttle?: number
  batch?: boolean
}
```

### Animation Options

```typescript
interface AnimationOptions {
  duration: number
  easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear' | string
  delay?: number
  fill?: 'none' | 'forwards' | 'backwards' | 'both'
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
  iterations?: number | 'infinite'
}
```

## 렌더링 파이프라인

### 1. HTML 렌더링 파이프라인

```typescript
interface HTMLRenderPipeline {
  // 1. HTML 파싱
  parseHTML(html: string): ParsedHTML
  
  // 2. 스타일 적용
  applyStyles(html: ParsedHTML, styles: Record<string, any>): StyledHTML
  
  // 3. 이벤트 바인딩
  bindEvents(html: StyledHTML, events: Record<string, string>): EventBoundHTML
  
  // 4. DOM 삽입
  insertToDOM(html: EventBoundHTML, container: HTMLElement): void
  
  // 5. 생명주기 실행
  executeLifecycle(html: EventBoundHTML): void
}
```

### 2. 컴포넌트 렌더링 파이프라인

```typescript
interface ComponentRenderPipeline {
  // 1. 컴포넌트 해석
  resolveComponents(components: ComponentDefinition[]): ResolvedComponent[]
  
  // 2. 의존성 해결
  resolveDependencies(components: ResolvedComponent[]): ResolvedComponent[]
  
  // 3. 컴포넌트 렌더링
  renderComponents(components: ResolvedComponent[]): RenderedComponent[]
  
  // 4. DOM 생성
  createDOM(components: RenderedComponent[]): HTMLElement[]
  
  // 5. 이벤트 바인딩
  bindComponentEvents(components: RenderedComponent[]): void
}
```

### 3. JSON 렌더링 파이프라인

```typescript
interface JSONRenderPipeline {
  // 1. JSON 스키마 검증
  validateSchema(json: any, schema: JSONSchema): ValidationResult
  
  // 2. 컴포넌트 매핑
  mapToComponents(json: any, mapping: ComponentMapping): ComponentDefinition[]
  
  // 3. 컴포넌트 렌더링
  renderComponents(components: ComponentDefinition[]): RenderedComponent[]
  
  // 4. DOM 생성
  createDOM(components: RenderedComponent[]): HTMLElement[]
}
```

## 성능 최적화

### 1. 렌더링 최적화

```typescript
interface RenderOptimization {
  // 렌더링 배치
  batchRender(operations: RenderOperation[]): void
  
  // 지연 렌더링
  lazyRender(container: HTMLElement, threshold: number): void
  
  // 가상화
  virtualizeList(container: HTMLElement, items: any[], itemHeight: number): void
  
  // 메모이제이션
  memoizeRender(content: RenderContent): RenderedContent
}
```

### 2. DOM 최적화

```typescript
interface DOMOptimization {
  // DOM 조작 최소화
  minimizeDOMOperations(updates: UpdateOperation[]): UpdateOperation[]
  
  // 리플로우 최적화
  optimizeReflow(operations: UpdateOperation[]): UpdateOperation[]
  
  // 리페인트 최적화
  optimizeRepaint(operations: UpdateOperation[]): UpdateOperation[]
  
  // 메모리 관리
  cleanupUnusedElements(): void
}
```

### 3. 애니메이션 최적화

```typescript
interface AnimationOptimization {
  // GPU 가속
  enableGPUAcceleration(element: HTMLElement): void
  
  // 애니메이션 풀링
  poolAnimations(): void
  
  // 프레임 드롭 방지
  preventFrameDrops(): void
  
  // 애니메이션 우선순위
  prioritizeAnimations(animations: Animation[]): Animation[]
}
```

## 이벤트 시스템

### 1. 렌더링 이벤트

```typescript
interface RenderEvent {
  type: 'render:start' | 'render:complete' | 'render:error' | 'render:update'
  target: string
  content: RenderContent
  timestamp: number
  duration?: number
  error?: string
}

interface UpdateEvent {
  type: 'update:start' | 'update:complete' | 'update:error'
  target: string
  operation: UpdateOperation
  timestamp: number
  duration?: number
  error?: string
}
```

### 2. 애니메이션 이벤트

```typescript
interface AnimationEvent {
  type: 'animation:start' | 'animation:complete' | 'animation:end' | 'animation:cancel'
  target: string
  animation: Animation
  timestamp: number
  duration?: number
}
```

## 사용 예시

### 1. 기본 HTML 렌더링

```typescript
// HTML 렌더링
const htmlContent = `
  <div class="shopping-mall">
    <h1>온라인 쇼핑몰</h1>
    <div class="product-list">
      <div class="product-item">상품 1</div>
      <div class="product-item">상품 2</div>
    </div>
  </div>
`;

renderer.renderHTML(htmlContent, document.getElementById('app'), {
  styles: { 'shopping-mall': { backgroundColor: '#f5f5f5' } },
  events: { 'product-item': 'click:selectProduct' }
});
```

### 2. 컴포넌트 렌더링

```typescript
// 컴포넌트 렌더링
const components = [
  {
    id: 'header',
    type: 'Header',
    name: 'ShoppingMallHeader',
    props: { title: '온라인 쇼핑몰', user: 'john@example.com' },
    events: { 'logout': 'handleLogout' }
  },
  {
    id: 'product-list',
    type: 'ProductList',
    name: 'ProductList',
    props: { products: products, onSelect: 'handleProductSelect' },
    children: [
      {
        id: 'product-item',
        type: 'ProductItem',
        name: 'ProductItem',
        props: { product: product, onClick: 'handleProductClick' }
      }
    ]
  }
];

renderer.renderComponents(components, document.getElementById('app'));
```

### 3. 부분 업데이트

```typescript
// SubScene 부분 업데이트
const subSceneUpdate = {
  type: 'html',
  content: '<div class="updated-product-list">업데이트된 상품 목록...</div>'
};

partialUpdateEngine.updateSubSceneContent('product-list', subSceneUpdate);

// 특정 요소 업데이트
partialUpdateEngine.updateElement('#product-count', '총 15개 상품');
partialUpdateEngine.updateStyle('#product-list', { backgroundColor: '#e8f5e8' });
```

### 4. 애니메이션

```typescript
// 페이드 인 애니메이션
animationEngine.fadeIn(document.getElementById('product-list'), 500);

// 슬라이드 전환
animationEngine.slideIn(document.getElementById('new-product'), 'right', 300);

// 커스텀 애니메이션
animationEngine.animate(document.getElementById('product-item'), [
  { transform: 'scale(1)', opacity: 1 },
  { transform: 'scale(1.1)', opacity: 0.8 },
  { transform: 'scale(1)', opacity: 1 }
], {
  duration: 200,
  easing: 'ease-in-out',
  iterations: 3
});
```

### 5. 배치 업데이트

```typescript
// 배치 업데이트
const updates = [
  { type: 'element', target: '#product-count', content: '총 20개 상품' },
  { type: 'style', target: '#product-list', content: { backgroundColor: '#f0f8ff' } },
  { type: 'attribute', target: '#search-input', content: { placeholder: '상품 검색...' } }
];

partialUpdateEngine.batchUpdate(updates);
```

이러한 렌더링 시스템을 통해 시나리오에서 요구하는 다양한 UI 렌더링과 상호작용을 효율적으로 처리할 수 있습니다.
