# Director Architecture

## 개요

Director는 AI 에이전트가 사용자 인터페이스를 동적으로 생성하고 관리할 수 있는 운영체제 수준의 플랫폼입니다. 이 시스템은 AI와 사용자 간의 상호작용을 원활하게 하며, 실시간으로 UI를 생성, 수정, 제거할 수 있는 환경을 제공합니다.

**중요**: AIAgentOS는 외부 Agent와의 통신 인터페이스만 제공하며, 실제 AI API 호출이나 네트워크 통신은 외부에서 관리됩니다. Third-party Agent 래퍼를 통해 기존 AI 라이브러리와 쉽게 연동할 수 있습니다.

## 패키지 구조

Director는 모듈화된 패키지 구조로 설계되어 있습니다:

```
@barocss/ui (핵심)
├── @barocss/openai (OpenAI 래퍼)
├── @barocss/anthropic (Claude 래퍼)  
└── @barocss/google (향후 추가 가능)
```

### 핵심 패키지 (@barocss/ui)
- **AIAgentOS**: 메인 클래스
- **AgentCommunicationInterface**: Agent 통신 인터페이스
- **ThirdPartyAgent**: Third-party Agent 인터페이스
- **SceneManager**: 씬 관리
- **ContextManager**: 컨텍스트 관리
- **UIRenderer**: UI 렌더링

### AI 제공업체별 래퍼 패키지
- **@barocss/openai**: OpenAI SDK 래퍼
- **@barocss/anthropic**: Anthropic Claude SDK 래퍼
- **@barocss/google**: Google Gemini SDK 래퍼 (향후)

## 핵심 설계 원칙

### 1. 계층화된 아키텍처 (Layered Architecture)
- **통신 인터페이스 계층**: AI 에이전트와의 통신 인터페이스 (실제 연결은 외부에서 관리)
- **상태 관리 계층**: 애플리케이션 상태의 중앙화된 관리
- **UI 관리 계층**: 동적 UI 컴포넌트의 생성 및 관리
- **상호작용 계층 (Interaction Layer)**: 사용자 입력 처리, 상태 관리, 연속 대화
- **렌더링 계층 (Rendering Layer)**: AI 응답을 실제 UI로 변환 및 렌더링

### 2. 이벤트 기반 아키텍처 (Event-Driven Architecture)
- 모든 컴포넌트 간 통신은 이벤트를 통해 이루어짐
- 느슨한 결합으로 확장성과 유지보수성 확보
- 비동기 처리로 성능 최적화

### 3. 상태 불변성 (Immutable State)
- 모든 상태 변경은 불변 객체를 통해 이루어짐
- 예측 가능한 상태 관리
- 디버깅 및 테스트 용이성

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                    Director                             │
├─────────────────────────────────────────────────────────────┤
│  Third-party Agent Layer                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ @barocss/openai │  │@barocss/anthropic│ │@barocss/... │ │
│  │   (OpenAI)      │  │    (Claude)     │ │  (Others)   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Communication Interface Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ThirdPartyAgent  │  │AgentCommAdapter │                  │
│  │   Interface     │  │                 │                  │
│  └─────────────────┘  └─────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│  Scene Management Layer                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Scene Manager   │  │ SubScene Manager│  │ Modal       │ │
│  │                 │  │                 │  │ Manager     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  State Management Layer                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Global State    │  │ Scene State     │  │ SubScene    │ │
│  │ Manager         │  │ Manager         │  │ State Mgr   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Interaction Layer                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Action Handler  │  │ Form Manager    │  │ Event       │ │
│  │                 │  │                 │  │ System      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Rendering Layer                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Hybrid Renderer │  │ Partial Update  │  │ Animation   │ │
│  │                 │  │ Engine          │  │ Engine      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 핵심 컴포넌트

### 1. AIAgentOS (메인 클래스)
- 전체 시스템의 진입점
- 모든 컴포넌트의 조율
- 생명주기 관리
- 단일 API: `request(userInput: string)`

### 2. Scene Management Layer
- **SceneManager**: 메인 Scene 생명주기 관리
- **SubSceneManager**: SubScene 부분 업데이트 관리
- **ModalManager**: 모달 오버레이 관리
- Scene 간 관계 관리 (부모-자식, 형제)
- 대화형 Scene 체인 관리 (ConversationChain)

### 3. State Management Layer
- **GlobalStateManager**: 전역 상태 관리 (사용자, 앱, 시스템)
- **SceneStateManager**: Scene별 상태 관리 (UI, 폼, 컴포넌트)
- **SubSceneStateManager**: SubScene별 상태 관리 (데이터, 업데이트, 연결)
- 상태 동기화 및 전파 시스템

### 4. Interaction Layer
- **ActionHandler**: 사용자 상호작용 처리
- **FormManager**: 폼 상태 및 유효성 검사
- **EventSystem**: 이벤트 위임 및 라우팅
- AI 연동 및 대화 관리

### 5. Rendering Layer
- **HybridRenderer**: 다중 렌더링 방식 지원 (HTML, 컴포넌트, JSON)
- **PartialUpdateEngine**: 부분 업데이트 및 성능 최적화
- **AnimationEngine**: 애니메이션 및 전환 효과
- **VirtualDOM**: 효율적인 DOM 조작

### 6. Communication Layer
- **AgentCommunicationInterface**: AI 에이전트 통신 인터페이스
- **ThirdPartyAgent**: 기존 AI 라이브러리 연동
- **AgentCommunicationAdapter**: 통신 관리 및 에러 처리

## Interaction Layer (상호작용 계층)

### 1. AIStateManager
- **Scene별 상태 관리**: UI 관련 상태 (폼 데이터, 로딩 상태 등)
- **전역 상태 관리**: 사용자 데이터, 앱 설정 등
- **대화 컨텍스트 관리**: AI와의 연속 대화를 위한 상태
- **상태 수집**: 다음 AI 요청을 위한 상태 데이터 수집

### 2. AIConversationManager
- **연속 대화 처리**: 사용자 액션과 AI 응답 간의 연결
- **상태 전달**: 현재 상태를 AI에게 전달
- **응답 처리**: AI 응답을 받아서 UI 업데이트
- **컨텍스트 유지**: 대화 흐름의 연속성 보장

### 3. ActionHandler (확장)
- **기존 기능**: 사용자 상호작용 처리, 이벤트 위임
- **새로운 기능**: AI 상태와 연동된 액션 처리
- **폼 데이터 수집**: 사용자 입력을 상태로 저장
- **AI 요청 트리거**: 액션 발생 시 AI와의 대화 시작

## Rendering Layer (렌더링 계층)

### 1. HybridUIRenderer
- **다중 렌더링 방식 지원**: HTML, 컴포넌트, JSON 기반
- **AI 응답 파싱**: AI 응답을 UI 정의로 변환
- **Tailwind CSS 적용**: barocss/browser와 연동
- **동적 렌더링**: 실시간 UI 생성 및 업데이트

### 2. AISceneProcessor
- **AI 응답 처리**: 다양한 형태의 AI 응답 파싱
- **UI 타입 감지**: HTML, 컴포넌트, JSON 자동 감지
- **Scene 생성**: AI 응답을 Scene으로 변환
- **액션 매핑**: UI 액션을 AI 대화와 연결


## 데이터 모델

### Context Hierarchy
```
GlobalContext
├── Application Info
├── User Info
└── System Info

SessionContext
├── Navigation History
├── Session State
└── Temporary Data

SceneContext
├── Scene Info
├── Parent-Child Relations
├── Scene State
└── Scene Data

ComponentContext
├── Component Info
├── Props & State
└── Lifecycle State

TemporaryContext
├── Request Data
├── Metadata
└── Expiration
```

### AI State Management
```
AIStateManager
├── Scene States (Map<sceneId, Map<key, value>>)
│   ├── Form Data
│   ├── UI State (loading, error, etc.)
│   └── Component State
├── Global States (Map<key, value>)
│   ├── User Data
│   ├── App Settings
│   └── Theme Preferences
└── Conversation Context (Map<key, value>)
    ├── Last Action
    ├── Step Counter
    └── AI Memory
```

### AI Response Format
```
AgentResponse
├── type: 'success' | 'error' | 'partial'
├── data
│   └── result
│       ├── ui (AISceneDefinition)
│       │   ├── type: 'html' | 'components' | 'scene'
│       │   ├── content?: string (HTML + Tailwind)
│       │   ├── components?: ComponentDefinition[]
│       │   ├── scene?: SceneDefinition
│       │   ├── actions?: Record<string, string>
│       │   ├── state?: Record<string, any>
│       │   └── context?: Record<string, any>
│       └── message?: string
└── metadata
```

### Request/Response Flow
```
User Input → AIAgentOS.request() → SceneManager → ContextAggregator → AIRequestBuilder → AgentCommunication → AI Agent
                ↓
AI Agent → AgentCommunication → AISceneProcessor → SceneManager → HybridUIRenderer → DOM
                ↓
SceneManager ← (새 Scene 생성) ← AISceneProcessor
```

### AI UI Generation Flow
```
1. User Input ("로그인 폼을 만들어줘")
   ↓
2. SceneManager.request() (대화 체인 관리)
   ↓
3. ContextAggregator (이전 대화 컨텍스트 집계)
   ↓
4. AIRequestBuilder (AI 요청 생성)
   ↓
5. AgentCommunication → AI Agent
   ↓
6. AI Response (HTML/Components/JSON)
   ↓
7. AISceneProcessor (파싱 및 타입 감지)
   ↓
8. SceneManager (새 Scene 생성 및 체인에 추가)
   ↓
9. HybridUIRenderer (렌더링)
   ↓
10. DOM (최종 렌더링)
```

### Conversation Chain Flow
```
1. director.request("첫 번째 요구사항")
   ↓
2. Root Scene 생성 + AI 요청 + Scene 생성
   ↓
3. director.request("두 번째 요구사항")
   ↓
4. 이전 대화 컨텍스트 포함 + AI 요청 + 새 Scene 생성
   ↓
5. director.request("세 번째 요구사항")
   ↓
6. 모든 이전 대화 컨텍스트 포함 + AI 요청 + 새 Scene 생성
   ↓
7. 계속 반복...
```

## 통신 프로토콜

### Third-party Agent 통신
```typescript
// Third-party Agent 인터페이스
interface ThirdPartyAgent {
  name: string;
  type: string;
  sendRequest(request: AgentRequest): Promise<AgentResponse>;
  sendStreamRequest?(request: AgentRequest): Promise<AsyncIterable<AgentResponse>>;
  isConnected(): boolean;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
  getStats?(): Record<string, any>;
}

// Director 요청/응답 형식
interface AgentRequest {
  id: string;
  type: 'create_scene' | 'update_scene' | 'delete_scene' | 'navigate' | 'user_action' | 'ai_query' | 'custom';
  payload: any;
  context: ContextHierarchy;
  metadata: RequestMetadata;
}

interface AgentResponse {
  id: string;
  requestId: string;
  type: 'success' | 'error' | 'partial' | 'redirect';
  data: any;
  status: ResponseStatus;
  metadata: ResponseMetadata;
}
```

## 보안 및 성능

### 보안
- 데이터 검증 및 검증
- 입력 값 살균화
- 접근 권한 관리

### 성능
- 메모리 관리 및 가비지 컬렉션
- 가상화 및 지연 로딩
- 캐싱 전략

## 확장성

### 플러그인 시스템
- 커스텀 액션 핸들러
- 커스텀 렌더러
- 커스텀 통신 프로토콜

### 마이크로프론트엔드 지원
- 모듈 격리
- 독립적 배포
- 서비스 간 통신

## 개발자 경험

### 디버깅 도구
- 실시간 상태 모니터링
- 이벤트 추적
- 성능 프로파일링

### 테스트 지원
- Mock 객체 제공
- 테스트 유틸리티
- 통합 테스트 프레임워크

## 마이그레이션 전략

### 기존 시스템과의 호환성
- 점진적 마이그레이션
- 레거시 API 지원
- 데이터 변환 도구

### 롤백 계획
- 체크포인트 시스템
- 자동 롤백
- 데이터 복구
