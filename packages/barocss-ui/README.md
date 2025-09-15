# Director

AI 에이전트가 사용자 인터페이스를 동적으로 생성하고 관리할 수 있는 운영체제 수준의 플랫폼입니다.

## 🚀 주요 특징

- **계층화된 아키텍처**: 통신, 상태 관리, UI 관리, 사용자 상호작용, 렌더링 계층으로 분리
- **이벤트 기반 통신**: 모든 컴포넌트 간 느슨한 결합으로 확장성 확보
- **실시간 AI 통신**: WebSocket 기반의 실시간 AI 에이전트 통신
- **상태 불변성**: 예측 가능한 상태 관리
- **컨텍스트 관리**: 다층적 컨텍스트 시스템으로 AI에게 풍부한 정보 제공
- **에러 복구**: 자동 재연결 및 에러 복구 메커니즘
- **성능 최적화**: 메모리 관리, 캐싱, 가상화 지원

## 📦 설치

### 핵심 패키지
```bash
npm install @barocss/ui
```

### AI 제공업체별 래퍼 패키지
```bash
# OpenAI 사용시
npm install @barocss/openai openai

# Anthropic Claude 사용시  
npm install @barocss/anthropic @anthropic-ai/sdk

# 둘 다 사용시
npm install @barocss/openai @barocss/anthropic openai @anthropic-ai/sdk
```

## 🎯 빠른 시작

### 기본 사용법

#### 1. Third-party Agent 패턴 (최신 권장) - 기존 AI 라이브러리 직접 사용

```typescript
import OpenAI from 'openai';
import { AIAgentOS } from '@barocss/ui';
import { createOpenAIWrapper } from '@barocss/openai';

// 기존 AI 라이브러리 사용
const openai = new OpenAI({
  apiKey: 'your-openai-api-key'
});

// AIAgentOS와 연동
const director = new AIAgentOS(
  { debug: true },
  createOpenAIWrapper(openai, { model: 'gpt-4' })
);

await director.initialize();

// Agent에 요청 전송
const response = await director.sendRequest({
  id: 'req-1',
  type: 'create_scene',
  payload: { message: 'Hello, create a login form' }
});

console.log(response.data.result);
```

#### Claude 사용 예시

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { AIAgentOS } from '@barocss/ui';
import { createAnthropicWrapper } from '@barocss/anthropic';

const anthropic = new Anthropic({
  apiKey: 'your-claude-api-key'
});

const director = new AIAgentOS(
  { debug: true },
  createAnthropicWrapper(anthropic, { model: 'claude-3-sonnet-20240229' })
);
```

#### 2. Agent Bridge 패턴 - 연계 지점만 설정

```typescript
import { 
  createAIAgentOS, 
  createAgentCommunicationAdapterWithHandlers 
} from '@barocss/ui';

// Agent와의 연계 지점만 설정
const agentComm = await createAgentCommunicationAdapterWithHandlers(
  'My AI Agent',
  {
    // 요청을 Agent에 보낼 때 변환
    request: async (request) => {
      // Director 요청을 실제 Agent 형식으로 변환
      return {
        messages: [
          { role: 'user', content: request.payload?.message || 'Hello' }
        ],
        model: 'gpt-4',
        temperature: 0.7
      };
    },
    
    // Agent 응답을 Director 형식으로 변환
    response: async (agentResponse) => {
      return {
        type: 'success',
        id: `agent-${Date.now()}`,
        requestId: 'original-request-id',
        timestamp: Date.now(),
        processingTime: 1000,
        status: { success: true, code: 200, message: 'OK' },
        data: {
          result: {
            message: agentResponse.choices[0].message.content,
            sceneId: 'generated-scene-id'
          }
        },
        metadata: { version: '1.0.0', agent: 'My AI Agent' }
      };
    },
    
    // 실제 Agent 호출 (사용자가 구현)
    async callAgent(request) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });
      return response.json();
    }
  }
);

const director = createAIAgentOS({ debug: true }, agentComm);
await director.initialize();
```

#### 3. Mock Agent 사용 (개발/테스트)

```typescript
import { createAIAgentOS, createMockAgentCommunicationAdapter } from '@barocss/ui';

// Mock Agent로 테스트
const agentComm = createMockAgentCommunicationAdapter({
  name: 'Test Agent',
  delay: 100,
  errorRate: 0.1,
  capabilities: ['text-generation', 'ui-creation']
});

const director = createAIAgentOS({ debug: true }, agentComm);
await director.initialize();
```

#### 4. Custom Agent 사용 (기존 방식)

```typescript
import { 
  createAIAgentOS, 
  createAgentCommunicationAdapterWithAgent,
  CustomAgent 
} from '@barocss/ui';

// Custom Agent 설정
const customAgent: CustomAgent = {
  type: 'custom',
  name: 'My Custom Agent',
  implementation: {
    sendRequest: async (request) => {
      // 커스텀 Agent 로직
      const response = await fetch('/api/my-agent', {
        method: 'POST',
        body: JSON.stringify(request)
      });
      return response.json();
    },
    isConnected: () => true
  }
};

// Agent와 함께 Adapter 생성
const agentComm = await createAgentCommunicationAdapterWithAgent(customAgent);
const director = createAIAgentOS({ debug: true }, agentComm);
await director.initialize();
```

// Agent에 요청 전송
const response = await director.sendRequest({
  id: 'req-1',
  type: 'create_scene',
  timestamp: Date.now(),
  priority: 'normal',
  source: 'user',
  context: director.getCurrentContext(),
  metadata: {
    version: '1.0.0',
    correlationId: 'corr-1',
    parentRequestId: null,
    tags: ['example']
  },
  payload: {
    sceneType: 'window',
    title: 'My Scene',
    component: {
      type: 'div',
      name: 'MyComponent',
      props: { className: 'my-component' }
    }
  }
});

console.log('Agent response:', response);
```

### 고급 사용법

```typescript
import { 
  createAIAgentOS, 
  initializeAIAgentOS,
  SystemEvent 
} from '@barocss/ui';

const director = createAIAgentOS({
  debug: true,
  communication: {
    websocket: {
      url: 'ws://localhost:8080/agent',
      reconnect: true,
      maxReconnectAttempts: 10
    }
  },
  performance: {
    maxScenes: 200,
    gcThreshold: 0.7
  }
});

// 이벤트 구독
director.subscribeToEvents((event: SystemEvent) => {
  switch (event.type) {
    case 'agent_response':
      console.log('Agent responded:', event.data);
      break;
    case 'memory_warning':
      console.warn('Memory usage high:', event.data);
      break;
  }
});

// 컨텍스트 구독
const unsubscribe = director.subscribeContext('global.user', (user) => {
  console.log('User updated:', user);
});

await director.initialize();
```

## 🏗️ 아키텍처

### 계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    Director                             │
├─────────────────────────────────────────────────────────────┤
│  Communication Layer                                       │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Agent Gateway   │  │ Message Router  │                  │
│  └─────────────────┘  └─────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│  State Management Layer                                    │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Context Store   │  │ State Manager   │                  │
│  └─────────────────┘  └─────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│  UI Management Layer                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Scene Manager   │  │ Component Store │  │ Layout      │ │
│  │                 │  │                 │  │ Manager     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Interaction Layer                                         │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Action Handler  │  │ Event Dispatcher│                  │
│  └─────────────────┘  └─────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│  Rendering Layer                                           │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Virtual DOM     │  │ DOM Renderer    │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 핵심 컴포넌트

#### 1. Context Manager
애플리케이션의 모든 컨텍스트를 중앙에서 관리

```typescript
// 컨텍스트 조회
const userContext = director.getContext('global.user');

// 컨텍스트 설정
director.setContext('global.user.id', 'user-123');

// 컨텍스트 구독
const unsubscribe = director.subscribeContext('global.user', (user) => {
  console.log('User updated:', user);
});
```

#### 2. Agent Communication
AI 에이전트와의 실시간 통신

```typescript
// 요청 전송
const response = await director.sendRequest(request);

// 스트리밍 요청
const stream = await director.sendStreamRequest(request);
for await (const chunk of stream) {
  console.log('Stream chunk:', chunk);
}
```

#### 3. Scene Management
UI 컴포넌트의 생명주기 관리

```typescript
// 씬 생성 요청
const createSceneRequest = {
  type: 'create_scene',
  payload: {
    sceneType: 'window',
    title: 'My Scene',
    component: {
      type: 'div',
      name: 'MyComponent',
      props: { className: 'my-component' }
    }
  }
};
```

## 📋 API 참조

### AIAgentOS 클래스

#### 메서드

- `initialize()`: Director 초기화
- `shutdown()`: Director 종료
- `isReady()`: 초기화 상태 확인
- `sendRequest(request)`: Agent에 요청 전송
- `sendStreamRequest(request)`: 스트리밍 요청 전송
- `getContext(path)`: 컨텍스트 조회
- `setContext(path, value)`: 컨텍스트 설정
- `updateContext(path, updater)`: 컨텍스트 업데이트
- `subscribeContext(path, callback)`: 컨텍스트 구독
- `subscribeToEvents(callback)`: 시스템 이벤트 구독
- `getConnectionState()`: 연결 상태 조회
- `getStats()`: 시스템 통계 조회

### 요청 타입

#### CreateSceneRequest
```typescript
{
  type: 'create_scene',
  payload: {
    sceneType: 'window' | 'modal' | 'popover' | 'overlay' | 'page',
    title: string,
    component: ComponentDefinition,
    parentSceneId?: string,
    position?: Position,
    size?: Size,
    props?: Record<string, any>,
    state?: Record<string, any>
  }
}
```

#### UpdateSceneRequest
```typescript
{
  type: 'update_scene',
  payload: {
    sceneId: string,
    updates: {
      title?: string,
      component?: Partial<ComponentDefinition>,
      props?: Record<string, any>,
      state?: Record<string, any>,
      position?: Position,
      size?: Size
    }
  }
}
```

#### UserActionRequest
```typescript
{
  type: 'user_action',
  payload: {
    action: string,
    target: string,
    data: Record<string, any>,
    event: UserEvent
  }
}
```

#### AIQueryRequest
```typescript
{
  type: 'ai_query',
  payload: {
    query: string,
    context: AIContext,
    options: AIQueryOptions
  }
}
```

### 응답 타입

#### SuccessResponse
```typescript
{
  type: 'success',
  status: { success: true, code: number, message: string },
  data: {
    result: any,
    context?: ContextUpdate,
    sideEffects?: SideEffect[]
  }
}
```

#### ErrorResponse
```typescript
{
  type: 'error',
  status: { success: false, code: number, message: string },
  data: {
    error: {
      code: string,
      message: string,
      details?: any,
      stack?: string
    },
    recovery?: RecoveryAction[]
  }
}
```

#### PartialResponse
```typescript
{
  type: 'partial',
  status: { success: true, code: number, message: string },
  data: {
    chunk: any,
    progress: number,
    total?: number
  }
}
```

## 🔧 설정

### 기본 설정

```typescript
const config = {
  version: '1.0.0',
  environment: 'development',
  debug: false,
  
  communication: {
    websocket: {
      url: 'ws://localhost:8080/agent',
      reconnect: true,
      maxReconnectAttempts: 5,
      reconnectInterval: 1000
    },
    rest: {
      baseUrl: 'http://localhost:8080/api',
      timeout: 30000,
      retries: 3
    }
  },
  
  state: {
    persistence: true,
    storage: 'localStorage',
    maxHistory: 100
  },
  
  ui: {
    theme: 'auto',
    animations: true,
    transitions: true
  },
  
  performance: {
    maxScenes: 100,
    cleanupInterval: 60000,
    gcThreshold: 0.8
  },
  
  security: {
    encryption: false,
    validation: true,
    sanitization: true
  }
};
```

## 🐛 디버깅

### 개발자 도구

```typescript
import { AIAgentOSDevTools } from '@barocss/ui';

// 브라우저 콘솔에서 사용 가능
console.log('Stats:', AIAgentOSDevTools.getStats());
console.log('Context:', AIAgentOSDevTools.getContext('global.user'));
AIAgentOSDevTools.setContext('global.user.id', 'debug-user');
```

### 이벤트 모니터링

```typescript
director.subscribeToEvents((event) => {
  console.log('System event:', event);
  
  // 특정 이벤트 필터링
  if (event.type === 'context_change') {
    console.log('Context changed:', event.data);
  }
});
```

## 🚨 에러 처리

### 에러 타입

- `AIAgentOSError`: 기본 에러 클래스
- `ContextError`: 컨텍스트 관련 에러
- `SceneError`: 씬 관리 관련 에러
- `CommunicationError`: 통신 관련 에러
- `ValidationError`: 검증 관련 에러

### 에러 복구

```typescript
try {
  const response = await director.sendRequest(request);
} catch (error) {
  if (error instanceof CommunicationError) {
    // 통신 에러 처리
    console.error('Communication failed:', error.message);
    
    // 자동 재연결 시도
    if (error.code === 'CONNECTION_LOST') {
      await director.initialize();
    }
  }
}
```

## 📊 성능 모니터링

### 통계 조회

```typescript
const stats = director.getStats();
console.log('Connection state:', stats.connectionState);
console.log('Communication stats:', stats.communicationStats);
console.log('Context debug info:', stats.contextDebugInfo);
```

### 메모리 모니터링

```typescript
director.subscribeToEvents((event) => {
  if (event.type === 'memory_warning') {
    console.warn('Memory usage high:', event.data.usage);
    
    // 메모리 정리 로직
    // 예: 오래된 씬들 제거
  }
});
```

## 🔒 보안

### 데이터 검증

```typescript
// 요청 검증 활성화
const config = {
  security: {
    validation: true,
    sanitization: true
  }
};
```

### 암호화

```typescript
// 통신 암호화 활성화
const config = {
  security: {
    encryption: true
  }
};
```

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 📞 지원

- 이슈 리포트: [GitHub Issues](https://github.com/barocss/barocss/issues)
- 문서: [Documentation](https://barocss.dev/docs)
- 커뮤니티: [Discord](https://discord.gg/barocss)

---

**Director**로 AI와 함께하는 미래의 UI 개발을 시작하세요! 🚀
