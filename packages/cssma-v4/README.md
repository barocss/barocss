# cssma-v4

Tailwind CSS 스타일의 유틸리티 클래스 기반 CSS 파서 및 변환기

---

## 소개

**cssma-v4**는 유틸리티 클래스(Tailwind CSS 스타일)를 파싱하여, 미리 등록된 유틸리티/모디파이어만 AST로 변환하고, 이를 표준 CSS 코드로 출력하는 고성능 파서/엔진입니다.

- **등록 기반 파싱**: registry에 등록된 유틸리티/모디파이어만 인식
- **AST 기반 변환**: 파싱 결과를 AST로 변환, CSS로 출력
- **테마/컨텍스트 지원**: theme/config/context 기반 동적 값 지원
- **확장성**: 플러그인/외부 패키지에서 registry, theme, AST 등 확장 가능
- **TypeScript 100% 지원**: 엄격한 타입, public API 제공

---

## 주요 구조

### 1. Registry 시스템
- 유틸리티/모디파이어 각각 별도 배열(`utilityRegistry`, `modifierRegistry`)
- 각 엔트리: `{ name, match, handler, ... }`
- 동적 등록/해제/조회 가능, 플러그인 확장 지원

### 2. AST 시스템
- 파싱 결과는 AST(Abstract Syntax Tree)로 반환
- AST 타입 예시:
  ```ts
  type AstNode =
    | { type: 'decl'; prop: string; value: string }
    | { type: 'atrule'; name: string; params: string; nodes: AstNode[] }
    | { type: 'rule'; selector: string; nodes: AstNode[] }
    | { type: 'comment'; text: string }
    | { type: 'raw'; value: string };
  ```
- AST → CSS 변환: `astToCss(ast)`

### 3. Context/Theme
- `createContext(config)`로 theme/config/plugins 병합
- `ctx.theme('colors', 'red', 500)` 등 경로 기반 값 조회

---

## 프리셋/유틸리티 선언 패턴 (staticUtility & functionalUtility)

cssma-v4는 Tailwind 스타일의 선언적 유틸리티 등록을 지원합니다. 

### 1. 고정값 유틸리티: staticUtility

```ts
// display: block
staticUtility('block', [['display', 'block']]);
// display: none
staticUtility('hidden', [['display', 'none']]);
// isolation: isolate
staticUtility('isolate', [['isolation', 'isolate']]);
```

### 2. 동적 유틸리티: functionalUtility

```ts
// z-index: themeKeys, 음수, 값 유효성 검사, 커스텀 핸들러
functionalUtility({
  name: 'z',
  supportsNegative: true,
  themeKeys: ['--z-index'],
  handleBareValue: ({ value }) => /^\d+$/.test(value) ? value : null,
  handle: (value) => [decl('z-index', value)],
  description: 'z-index utility',
  category: 'layout',
});

// grid-column span: 커스텀 AST 생성
functionalUtility({
  name: 'col-span',
  handleBareValue: ({ value }) => /^\d+$/.test(value) ? value : null,
  handle: (value) => [decl('grid-column', `span ${value} / span ${value}`)],
  description: 'grid-column span utility',
  category: 'grid',
});

// background-color: theme/arbitrary/custom property/음수/분수 지원
functionalUtility({
  name: 'bg',
  prop: 'background-color',
  themeKey: 'colors',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  description: 'background-color (theme, arbitrary, custom property, negative, fraction 지원)',
  category: 'color',
});
```

#### 주요 옵션
- `themeKey`, `themeKeys`: theme에서 값 조회 (여러 key 지원)
- `supportsArbitrary`, `supportsCustomProperty`, `supportsNegative`: 임의값/커스텀 프로퍼티/음수 지원
- `handleBareValue`: 값 유효성 검사/후처리 (null 반환 시 무시)
- `handle`: 최종 AST 커스텀 생성 (없으면 기본 decl)
- `prop`: 기본 decl용 (handle 미사용 시)

---

## 사용 예시

```ts
import { applyClassName } from './core/engine';
import { createContext } from './core/context';

const config = {
  theme: { colors: { red: { 500: '#f00' } } }
};
const ctx = createContext(config);
const ast = applyClassName('hover:bg-red-500', ctx);
// ast → [{ type: 'rule', selector: ':hover', nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }] }]
```

---

## 확장/플러그인 개발

- `registerUtility`, `registerModifier`로 유틸리티/모디파이어 동적 등록/해제
- 플러그인에서 registry, theme, AST 후처리 등 확장 가능
- 공식 API/가이드 제공 예정

---

## 테스트/문서화

- 테스트 커버리지 90% 이상 목표
- mutation test, 통합 테스트, 동적 registry 조작 등 포함
- 문서: registry 구조, AST 타입, context 사용법, 확장/플러그인 가이드, 예제 코드 등 제공

---

## PRD/개발 가이드
- [PRD 상세 보기](./PRD.md)
- [TODO 진행상황](./TODO.md)

---

## 라이선스
MIT
