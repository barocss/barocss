# CSSMA v4

Tailwind CSS와 호환되는 유틸리티 클래스 시스템으로, CSS 클래스명을 Figma 스타일로 변환하는 라이브러리입니다.

## 🚀 Features

- **Registry-based Parsing**: 등록된 유틸리티만 파싱하여 안전성 보장
- **Static & Functional Utilities**: 고정값과 동적값 처리 모두 지원
- **Tailwind CSS Compatibility**: Tailwind CSS 문법과 호환
- **Arbitrary Values**: `bg-[red]` 형태의 임의값 지원
- **Custom Properties**: `bg-(--my-bg)` 형태의 커스텀 속성 지원
- **Negative Values**: `-inset-x-2` 형태의 음수값 지원

## 📦 Installation

```bash
npm install cssma-v4
```

## 🔧 Usage

### Basic Usage

```typescript
import { applyClassName } from 'cssma-v4';

const ctx = {
  theme: (key: string, value: string) => {
    // 테마 값 반환 로직
    return `var(--${key}-${value})`;
  }
};

// Static Utility
const result1 = applyClassName('inset-x-auto', ctx);
// [{ type: 'decl', prop: 'inset-inline', value: 'auto' }]

// Functional Utility
const result2 = applyClassName('inset-x-4', ctx);
// [{ type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * 4)' }]

// Negative Static Utility
const result3 = applyClassName('-inset-x-px', ctx);
// [{ type: 'decl', prop: 'inset-inline', value: '-1px' }]

// Negative Functional Utility
const result4 = applyClassName('-inset-x-2', ctx);
// [{ type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * -2)' }]
```

### Utility Types

#### Static Utilities

고정된 CSS 값을 반환하는 유틸리티입니다.

```typescript
import { staticUtility } from 'cssma-v4';

// 기본 static utility
staticUtility('inset-x-auto', [['inset-inline', 'auto']]);
staticUtility('inset-x-full', [['inset-inline', '100%']]);

// 음수 static utility (음수 부호까지 포함한 전체 이름)
staticUtility('-inset-x-px', [['inset-inline', '-1px']]);
staticUtility('-inset-x-full', [['inset-inline', '-100%']]);
```

**특징:**
- 정확한 클래스명 매칭 (`className === name`)
- 전달된 값을 무시하고 등록 시점에 정의된 값 반환
- 음수 부호까지 포함한 전체 이름으로 등록

#### Functional Utilities

동적으로 값을 처리하는 유틸리티입니다.

```typescript
import { functionalUtility } from 'cssma-v4';

functionalUtility({
  name: 'inset-x',           // prefix
  prop: 'inset-inline',      // CSS 속성
  supportsNegative: true,     // 음수값 지원
  supportsArbitrary: true,    // 임의값 지원
  supportsCustomProperty: true, // 커스텀 속성 지원
  supportsFraction: true,     // 분수값 지원
  handleBareValue: ({ value }) => {
    // 숫자값 처리: inset-x-4 → calc(var(--spacing) * 4)
    if (/^\d+$/.test(value)) {
      return `calc(var(--spacing) * ${value})`;
    }
    return null;
  },
  handleNegativeBareValue: ({ value }) => {
    // 음수값 처리: -inset-x-2 → calc(var(--spacing) * -2)
    if (/^\d+$/.test(value)) {
      return `calc(var(--spacing) * -${value})`;
    }
    return null;
  }
});
```

**특징:**
- Prefix 기반 매칭 (`className.startsWith(name + '-')`)
- 전달된 값을 동적으로 처리
- 테마, 임의값, 커스텀 속성 등 다양한 값 타입 지원

## 🏗️ Architecture

### Registry System

유틸리티와 수정자를 등록하고 관리하는 시스템입니다.

```typescript
// 유틸리티 등록
registerUtility({
  name: 'my-utility',
  match: (className) => className.startsWith('my-utility-'),
  handler: (value, ctx, token) => {
    // 처리 로직
    return [decl('my-property', value)];
  }
});

// 수정자 등록
registerModifier({
  name: 'hover',
  type: 'pseudo',
  match: (mod) => mod.type === 'hover',
  handler: (nodes, mod, ctx) => {
    // 수정자 처리 로직
    return nodes;
  }
});
```

### Parser System

클래스명을 파싱하여 유틸리티와 수정자로 분리하는 시스템입니다.

```typescript
// 파싱 예시
parseClassName('hover:inset-x-4');
// {
//   modifiers: [{ type: 'hover' }],
//   utility: { prefix: 'inset-x', value: '4', negative: false }
// }
```

## 🐛 Known Issues & Solutions

### Issue 1: Negative Static Utilities Not Matching

**문제:**
- `-inset-x-px`와 같은 음수 static 유틸리티가 제대로 매칭되지 않음

**원인:**
- 파서에서 음수 부호를 미리 제거하여 staticUtility의 정확한 이름과 매칭 불가

**해결책:**
1. Static Utility 정확한 매칭을 우선 시도
2. 매칭되지 않을 때만 음수 부호 제거 후 prefix 매칭

### Issue 2: Prefix Ordering

**문제:**
- `getRegisteredUtilityPrefixes()`가 staticUtility와 functionalUtility의 name을 모두 반환
- staticUtility의 name은 전체 유틸리티 이름이므로 prefix가 아님

**해결책:**
- functionalUtility의 name만 prefix로 사용
- 길이 순서대로 정렬 (긴 prefix가 먼저 매칭되도록)

## 🧪 Testing

```bash
# 전체 테스트 실행
npm test

# 특정 테스트 실행
npm test -- --grep "inset"

# 커버리지 확인
npm run test:coverage
```

### Test Examples

```typescript
// Static Utility Tests
expect(applyClassName('-inset-x-px', ctx)).toEqual([
  { type: 'decl', prop: 'inset-inline', value: '-1px' }
]);

// Functional Utility Tests
expect(applyClassName('inset-x-4', ctx)).toEqual([
  { type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * 4)' }
]);

// Negative Functional Utility Tests
expect(applyClassName('-inset-x-2', ctx)).toEqual([
  { type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * -2)' }
]);
```

## 📚 API Reference

### Core Functions

- `applyClassName(className: string, ctx: CssmaContext): AstNode[]`
- `parseClassName(className: string): { modifiers: ParsedModifier[], utility: ParsedUtility }`
- `registerUtility(util: UtilityRegistration): void`
- `registerModifier(mod: ModifierRegistration): void`

### Helper Functions

- `staticUtility(name: string, decls: [string, string][], opts?: object): void`
- `functionalUtility(opts: FunctionalUtilityOptions): void`

### Types

- `CssmaContext`: 컨텍스트 객체
- `AstNode`: AST 노드 타입
- `ParsedUtility`: 파싱된 유틸리티 타입
- `ParsedModifier`: 파싱된 수정자 타입

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
