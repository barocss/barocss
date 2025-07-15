# CSSMA v4 Product Requirements Document (상세)

---

## 1. Engine System (`engine.ts`)

### 1.1 설계 의도
- **단일 진입점**: 모든 클래스명 변환의 시작점. 파싱, 매칭, AST 변환, 수정자 적용을 일관된 흐름으로 처리.
- **확장성**: 플러그인/커스텀 파서/핸들러가 쉽게 개입할 수 있도록 설계.

### 1.2 주요 함수 및 내부 흐름

#### `applyClassName(className, ctx): AstNode[]`
- **입력**: CSS 클래스명(문자열), Context 객체
- **출력**: AST 노드 배열 (Figma 스타일 변환용)
- **내부 단계**:
  1. **파싱**: `parseClassName` 호출 → `{ modifiers, utility }` 반환
  2. **유틸리티 매칭**: `getUtility()`에서 static/functional 매칭
  3. **음수값 처리**: `utility.negative`가 true면 value 앞에 `-` 추가
  4. **핸들러 실행**: 유틸리티 핸들러로 AST 노드 생성
  5. **수정자 적용**: `modifierChain`으로 modifier를 역순 적용
  6. **최종 AST 반환**
- **예시**:
  ```ts
  applyClassName('hover:-inset-x-2', ctx)
  // 1. modifiers: [{type: 'hover'}], utility: {prefix: 'inset-x', value: '2', negative: true}
  // 2. handler: value = '-2'
  // 3. AST: [{type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * -2)'}]
  // 4. modifier 적용: [{...selector: ':hover'}]
  ```
- **확장 포인트**:
  - 플러그인에서 AST 후처리, modifier 체인 커스터마이즈 가능
  - 커스텀 핸들러/파서 삽입 가능

#### `modifierChain(modifiers): Generator`
- **역할**: 가장 바깥쪽(왼쪽)부터 순차적으로 modifier를 적용할 수 있도록 generator 제공
- **예시**:
  ```ts
  for (const mod of modifierChain(['hover', 'focus'])) {
    // 순서: focus → hover
  }
  ```
- **확장 포인트**: 플러그인에서 modifier 체인을 동적으로 조작 가능 (예: 조건부 modifier 삽입)

---

## 2. Parser System (`parser.ts`)

### 2.1 설계 의도
- **유연한 파싱**: Tailwind 문법의 모든 변형(임의값, 커스텀 속성, 음수, 분수, modifier 체인 등)을 지원
- **Registry 기반**: prefix/이름 매칭을 registry에서 동적으로 받아와 파싱

### 2.2 내부 흐름 및 예시

#### Modifier 파싱
- **지원**: group-hover, sm, focus, dark 등 prefix modifier
- **음수 modifier**: `-sm:bg-red-500` → negative: true
- **Registry 기반 prefix 매칭**: 등록된 modifier prefix 목록에서 가장 긴 것부터 매칭
- **예시**:
  ```ts
  // 'hover:focus:bg-red-500'
  // modifiers: [{type: 'hover'}, {type: 'focus'}]
  ```

#### Utility 파싱
- **정확 매칭**: static utility (`inset-x-auto`, `-inset-x-px`)
- **Prefix 매칭**: functional utility (`inset-x-4`, `-inset-x-2`)
- **임의값**: `bg-[red]`, `inset-x-[10px]`
- **커스텀 속성**: `bg-(--my-bg)`
- **분수값**: `inset-x-1/2`
- **음수값**: `-inset-x-2`, `-bg-[red]`
- **예시**:
  ```ts
  // 'hover:focus:-inset-x-[10px]'
  // modifiers: [{type: 'hover'}, {type: 'focus'}]
  // utility: {prefix: 'inset-x', value: '10px', arbitrary: true, negative: true}
  ```

#### 확장 포인트
- 새로운 modifier/utility prefix를 registry에 등록하면 자동 인식
- 파싱 로직 커스터마이즈 가능 (예: 미디어 쿼리, 조건부 파싱 등)
- 임의값/커스텀 속성/분수 등 새로운 문법 추가 가능

#### 주의점
- prefix 매칭 순서(긴 것 우선)가 중요함
- 음수 부호 처리 위치에 따라 static/functional 매칭이 달라질 수 있음

---

## 3. Registry System (`registry.ts`)

### 3.1 설계 의도
- **동적 확장성**: 새로운 유틸리티/수정자 등록만으로 파서/엔진이 자동 인식
- **핸들러 기반**: 각 유틸리티/수정자별로 독립적인 핸들러 제공

### 3.2 Utility/Modifier Registration 상세

#### Static Utility
- **정확한 이름 매칭**: `className === name`
- **고정값 반환**: 등록 시점에 정의된 decls만 반환
- **음수 static도 지원**: `-inset-x-px` 등
- **예시**:
  ```ts
  staticUtility('inset-x-auto', [['inset-inline', 'auto']])
  staticUtility('-inset-x-px', [['inset-inline', '-1px']])
  ```

#### Functional Utility
- **Prefix 매칭**: `className.startsWith(name + '-')`
- **동적 값 처리**: theme, 임의값, 커스텀 속성, 음수, 분수 등
- **핸들러 옵션**:
  - `handleBareValue`, `handleNegativeBareValue`, `supportsArbitrary`, `supportsFraction`, `supportsCustomProperty`, `valueTransform`, `handle`
- **예시**:
  ```ts
  functionalUtility({
    name: 'inset-x',
    prop: 'inset-inline',
    supportsNegative: true,
    supportsFraction: true,
    supportsArbitrary: true,
    handleBareValue: ({ value }) => ...,
    handleNegativeBareValue: ({ value }) => ...,
  });
  ```

#### Modifier Registration
- **Selector/AtRule/Handler**: 다양한 CSS selector/at-rule 조합 지원
- **예시**:
  ```ts
  registerModifier({
    name: 'hover',
    type: 'pseudo',
    match: (mod) => mod.type === 'hover',
    handler: (nodes) => nodes.map(n => ({ ...n, selector: ':hover' })),
  });
  ```

#### 확장 포인트
- 플러그인에서 동적 등록 가능
- 핸들러에서 AST 후처리, 조건부 변환 등 자유롭게 구현 가능

#### 주의점
- static/functional utility의 매칭 방식 차이 주의
- prefix 충돌 방지: 긴 prefix가 먼저 매칭되도록 정렬 필요

---

## 4. Context System (`context.ts`)

### 4.1 설계 의도
- **테마/설정/플러그인 관리의 단일 진입점**
- **깊은 병합**: preset, 사용자 theme, extend 등 계층적 병합 지원

### 4.2 주요 기능 및 예시

#### 테마 해석
- `ctx.theme('colors', 'red', '500')` → 테마 오브젝트에서 값 추출
- **예시**:
  ```ts
  // config = { theme: { colors: { red: { 500: '#ef4444' } } } }
  ctx.theme('colors', 'red', '500') // '#ef4444'
  ```

#### 설정 접근
- `ctx.config('plugins', 'tailwindcss')` 등 config 값 접근

#### 프리셋 확인
- `ctx.hasPreset('colors', 'red')` 등 프리셋 존재 여부 확인

#### 플러그인 지원
- `ctx.plugins` 배열로 확장성 제공

#### 확장 포인트
- themeGetter, configGetter, hasPreset 등 커스터마이즈 가능
- 플러그인에서 context 확장 가능

#### 주의점
- theme/config path 분기 처리에 유의 ('.' 구분자, 배열 등)
- 깊은 병합 시 override/extend 순서 주의

---

## 5. Preset System (`presets/*.ts`)

### 5.1 설계 의도
- **Tailwind CSS와 1:1 매핑**되는 유틸리티 우선 제공
- **카테고리별 프리셋 구조**: background, flexbox-grid, layout, sizing, spacing, typography 등
- **확장성**: 새로운 preset 파일 추가로 커스텀 유틸리티 집합 제공 가능

### 5.2 프리셋별 유틸리티/지원 value type

| Preset 파일         | 주요 유틸리티 예시                | 지원 value type                  |
|---------------------|-----------------------------------|----------------------------------|
| background.ts       | bg-*, bg-linear-*, from-*, ...    | static, arbitrary, custom prop   |
| flexbox-grid.ts     | flex-*, grid-cols-*, gap-*, ...   | static, number, fraction, ...    |
| layout.ts           | block, inline, z-*, ...           | static, number, arbitrary, ...   |
| sizing.ts           | w-*, h-*, min-w-*, ...            | static, number, fraction, ...    |
| spacing.ts          | p-*, m-*, space-x-*, ...          | static, number, negative, ...    |
| typography.ts       | text-*, font-*, leading-*, ...    | static, number, arbitrary, ...   |

### 5.3 유틸리티 정의 및 예시

- 각 preset 파일은 staticUtility/functionalUtility를 사용하여 유틸리티를 등록
- 예시:

```typescript
// flexbox-grid.ts
staticUtility("flex-row", [["flex-direction", "row"]]);
functionalUtility({
  name: "gap-x",
  prop: "column-gap",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => `calc(var(--spacing) * ${value})`,
  handle: (value) => [decl("column-gap", value)],
  handleCustomProperty: (value) => [decl("column-gap", `var(${value})`)],
});
```

### 5.4 핸들러 설계 원칙 (실제 구현 기반)

- handleBareValue/handleNegativeBareValue/handleCustomProperty만으로 대부분의 유틸리티를 커버
- handle은 고급/특수 케이스에만 사용
- custom property는 반드시 handleCustomProperty에서 처리
- static/functional utility의 등록 방식 구분(정확 매칭 vs prefix 매칭)
- 예시:

```typescript
functionalUtility({
  name: "col-span",
  prop: "grid-column",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) return `span ${value} / span ${value}`;
    return null;
  },
  handleCustomProperty: (value) => [
    decl("grid-column", `span var(${value}) / span var(${value})`),
  ],
  handle: (value) => {
    if (parseNumber(value))
      return [decl("grid-column", `span ${value} / span ${value}`)];
    return null;
  },
});
```

### 5.5 테스트/확장성

- 모든 유틸리티는 static, number, arbitrary, custom property, negative 등 가능한 모든 조합에 대해 테스트 작성
- 신규 preset 파일 추가 시, 반드시 tests/presets/에 테스트 파일 추가
- 프리셋 확장 시, 기존 preset 구조/핸들러 패턴을 준수

### 5.6 실제 구현 예시 (테스트 기반)

```typescript
expect(applyClassName("bg-linear-[25deg,red_5%,yellow_60%]", ctx)).toEqual([
  { type: "decl", prop: "background-image", value: "linear-gradient(var(--tw-gradient-stops, 25deg,red 5%,yellow 60%))" },
]);
expect(applyClassName("gap-x-(--my-gap-x)", ctx)).toEqual([
  { type: "decl", prop: "column-gap", value: "var(--my-gap-x)" },
]);
expect(applyClassName("w-1/2", ctx)).toEqual([
  { type: "decl", prop: "width", value: "calc(1/2 * 100%)" },
]);
expect(applyClassName("space-x-2", ctx)).toEqual([
  {
    type: "rule",
    selector: "& > :not([hidden]) ~ :not([hidden])",
    nodes: [
      { type: "decl", prop: "--tw-space-x-reverse", value: "0" },
      { type: "decl", prop: "margin-inline-start", value: "calc(var(--spacing) * 2 * calc(1 - var(--tw-space-x-reverse)))" },
      { type: "decl", prop: "margin-inline-end", value: "calc(var(--spacing) * 2 * var(--tw-space-x-reverse))" },
    ],
  },
]);
```

---

## 6. Value Processing Pipeline (핸들러 내부 단계)

### 6.1 처리 단계별 상세
- **Arbitrary Value**: `[red]`, `[10px]` 등 임의값 지원 (공백은 `_`로 대체)
- **Custom Property**: `(--my-bg)` 등 CSS 변수 지원
- **Theme Lookup**: 테마 키 기반 값 변환 (예: spacing scale)
- **Fraction**: `1/2` → `50%` 등 분수 변환
- **Negative Value**: 음수값 변환 및 핸들러 분리 (bare/negative)
- **예시**:
  ```ts
  // functionalUtility 내부
  if (parsedUtility.negative && opts.supportsNegative && opts.handleNegativeBareValue) {
    const bare = opts.handleNegativeBareValue({ value: String(finalValue).replace(/^-/, ''), ctx, token });
    finalValue = bare;
  }
  ```

#### 확장 포인트
- 새로운 값 타입(예: calc, clamp, min/max 등) 지원 가능
- 핸들러에서 AST 대신 CSS 변수/JSX 등 다양한 출력 지원 가능

#### 주의점
- 음수/분수/임의값/커스텀 속성 등 복합 조합 처리에 유의
- 핸들러 내부에서 반환값 타입 일관성 유지

---

## Utility Handler Design: handle, handleBareValue, handleNegativeBareValue, handleCustomProperty

### 목적 및 설계 원칙

CSSMA v4의 `functionalUtility`는 다양한 형태의 값(bare value, negative, arbitrary, custom property 등)에 대해 일관되고 확장성 있게 파싱/변환/AST 생성을 지원합니다. 이를 위해 다음과 같은 핸들러 함수들을 제공합니다:

| 함수명                | 적용 대상                | 반환값      | 목적/역할                                                         |
|----------------------|--------------------------|-------------|-------------------------------------------------------------------|
| handleBareValue      | 일반 값(bare value)      | string/null | 숫자, 분수 등 일반 값의 파싱/변환                                 |
| handleNegativeBareValue | 음수 값(negative value)   | string/null | -로 시작하는 값의 파싱/변환                                       |
| handleCustomProperty | custom property          | AstNode[]   | (--)로 시작하는 커스텀 프로퍼티(`col-span-(--my-span)` 등) 처리   |
| handle               | 모든 값(최종 AST 생성)   | AstNode[]   | 위의 모든 케이스를 직접 분기/처리하고 싶을 때(고급/커스텀)        |

### 호출 우선순위 및 동작 흐름

1. **Arbitrary Value** (`[value]`)
   - handle가 있으면 handle 호출 → AstNode[] 반환
   - 없으면 decl(prop, value)
2. **Custom Property** (`(--my-prop)`)
   - handleCustomProperty가 있으면 handleCustomProperty 호출 → AstNode[] 반환
   - 없으면 decl(prop, var(--my-prop))
3. **Bare Value** (숫자, 분수 등)
   - handleNegativeBareValue(음수) → handleBareValue(양수) 순서로 호출
   - 없으면 decl(prop, value)

### 실전 예시: col-span

```ts
functionalUtility({
  name: 'col-span',
  prop: 'grid-column',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) return `span ${value} / span ${value}`;
    return null;
  },
  handleCustomProperty: (value) => [decl('grid-column', `span var(${value}) / span var(${value})`)],
  handle: (value) => {
    if (parseNumber(value)) return [decl('grid-column', `span ${value} / span ${value}`)];
    return null;
  },
  description: 'grid-column span utility (number, arbitrary, custom property 지원)',
  category: 'grid',
});
```

### Best Practice: 언제 어떤 함수를 써야 하나?
- **일반적인 유틸리티**는 handleBareValue/handleNegativeBareValue/handleCustomProperty만으로 충분합니다.
- **handle**은 arbitrary value 등 모든 케이스를 직접 분기 처리하고 싶을 때만 사용하세요.
- **custom property**는 반드시 handleCustomProperty에서 처리하세요. (Tailwind 호환)
- **세 함수(handleBareValue, handleNegativeBareValue, handleCustomProperty)를 모두 쓸 필요는 없습니다.**
  - 예: 음수 지원이 필요 없으면 handleNegativeBareValue는 생략
  - custom property 지원이 필요 없으면 handleCustomProperty는 생략
  - handle은 고급/특수 케이스에만 사용

### 결론
- **핸들러 함수는 유틸리티의 특성에 맞게 필요한 것만 정의**하면 됩니다.
- Tailwind CSS와 100% 호환을 원한다면, custom property는 반드시 handleCustomProperty에서 처리하세요.
- handleBareValue/handleNegativeBareValue/handleCustomProperty만으로 대부분의 유틸리티를 커버할 수 있습니다.

---

## 7. Testing & Integration

### 7.1 테스트 카테고리 및 예시
- **Parser**: 다양한 클래스명 파싱 결과 검증
- **Registry**: 유틸리티/수정자 매칭 및 핸들러 동작 검증
- **Engine**: 실제 AST 변환 결과 검증
- **Integration**: 복합 클래스명, modifier 체인, 플러그인 등 통합 테스트
- **예시**:
  ```ts
  // engine.test.ts
  test('hover:focus:-inset-x-[10px]', () => {
    const ctx = createContext({});
    const result = applyClassName('hover:focus:-inset-x-[10px]', ctx);
    // AST, selector, value 모두 올바른지 검증
  });
  ```

#### 확장 포인트
- 플러그인/커스텀 preset 테스트 케이스 추가
- E2E 테스트: 실제 Figma 스타일 변환까지 검증

#### 주의점
- static/functional/임의값/음수/분수 등 모든 조합 테스트 필요
- modifier 체인, 중첩 modifier 등 edge case 테스트 강화

---

## 8. Performance & 확장성

### 8.1 Registry/Parser/Context 최적화
- **Registry**: prefix 캐싱, 긴 prefix 우선 매칭, Set 활용
- **Parser**: 불필요한 문자열 분할 최소화, 조기 반환
- **Context**: theme/config 캐싱, 깊은 병합 최적화

### 8.2 플러그인 시스템
- **동적 확장**: 플러그인에서 유틸리티/수정자/테마/핸들러 동적 등록 가능
- **커스텀 파서/핸들러**: 플러그인에서 파싱/핸들러 로직 오버라이드 가능

### 8.3 미래 확장
- **조건부 유틸리티**: 미디어 쿼리, 상태 기반 유틸리티 등
- **런타임 테마**: 동적 테마 변경, 사용자 정의 테마 지원
- **고급 CSS 변수 최적화**: 중복 CSS 변수 제거, 최적의 변수 네이밍

#### 주의점
- 플러그인/동적 확장 시 네이밍 충돌, prefix 중복 방지
- 성능 저하 방지: 캐싱, 조기 반환, 불필요한 연산 최소화

---

**이 문서는 신규/외부 기여자도 전체 구조와 확장 포인트, 설계 의도, 실제 사용 시나리오까지 명확히 이해할 수 있도록 각 항목별로 상세하게 기술되어 있습니다.** 