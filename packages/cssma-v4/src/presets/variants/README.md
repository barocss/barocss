# CSSMA v4 Variant System: 조합/누적 규칙 설계

## 1. Variant Chain의 본질
- variant chain: 여러 variant가 순서대로 적용된 것 (ex. `group-hover:not-hover:has-[.child]:*:`)
- 각 variant는 자신의 역할만 명확히 정의 (modifySelector, astHandler, wrap)
- 조합별 함수가 아니라, 각 variant가 "앞/뒤 variant"를 참고해 selector를 조정

---

## 2. 핵심 규칙 (Tailwind v4 완전 호환 목표)

### (1) Selector 누적/override
- 기본: variant chain을 왼→오로 순차 누적 (modifySelector)
- 단, **universal/not/has/arbitrary** 등은 "앞 variant"가 group-hover/peer-hover 등일 때
  - `{ selector, override: true }`로 반환 → 이후 누적 중단
  - (ex. `group-hover:*` → `&:is(:where(.group):hover > *)`)
- engine.ts에서 override가 반환되면 selector 누적을 즉시 중단

### (2) AST wrapping 규칙
- 단일 pseudo/universal/not/has/arbitrary: rule로 wrapping
- 복합 조합(2개 이상, group/peer/has/not 등 포함): style-rule로 wrapping
- at-rule이 있으면 selector wrapping 없이 그대로 유지

### (3) 각 variant의 역할
- **group-hover/peer-hover**: selector를 `:is(:where(.group):hover *)` 등으로 변환
  - 뒤에 universal/not/has/arbitrary가 오면, universal/not/has/arbitrary가 override로 selector 완성
- **universal/not/has/arbitrary**: 앞에 group-hover/peer-hover가 있으면 override, 아니면 누적
- **responsive/dark 등 at-rule**: AST를 at-rule로 감싸고 selector는 그대로 유지
- **compoundModifier**: 정말 예외적 상황(동시 등장시 특별 AST 필요)만 사용

### (4) selector의 & 처리
- selector는 항상 &로 시작 (engine에서 보장)
- override 시에도 & prefix를 유지

---

## 3. 예시 (Tailwind v4와 동일하게)

| Variant Chain                      | Selector 결과 (Tailwind v4)                |
|------------------------------------|---------------------------------------------|
| `group-hover:*:bg-red-500`         | `&:is(:where(.group):hover > *)`            |
| `group-hover:not-hover:bg-red-500` | `&:is(:where(.group):hover *):not(:hover)`  |
| `peer-hover:has-[.child]:bg-red-500`| `&:is(:where(.peer):hover ~ *):has(.child)` |
| `sm:group-hover:*:bg-red-500`      | `@media (min-width: 640px) { &:is(:where(.group):hover > *) { ... } }` |
| `not-hover:focus:bg-red-500`       | `&:not(:hover):focus`                       |
| `*:[data-avatar]:rounded-full`     | `:is(.\*\:[data-avatar]\:rounded-full > *)[data-avatar]` |

---

## 4. 시뮬레이션: selector 누적/override 동작

### (A) group-hover:*:bg-red-500
1. base: `&`
2. group-hover: `&:is(:where(.group):hover *)`
3. *: override → `&:is(:where(.group):hover > *)` (이후 누적 중단)

### (B) group-hover:not-hover:bg-red-500
1. base: `&`
2. group-hover: `&:is(:where(.group):hover *)`
3. not-hover: override → `&:is(:where(.group):hover *):not(:hover)`

### (C) peer-hover:has-[.child]:bg-red-500
1. base: `&`
2. peer-hover: `&:is(:where(.peer):hover ~ *)`
3. has-[.child]: override → `&:is(:where(.peer):hover ~ *):has(.child)`

### (D) sm:group-hover:*:bg-red-500
1. base: `&`
2. sm: at-rule wrapping (AST만 감쌈)
3. group-hover: `&:is(:where(.group):hover *)`
4. *: override → `&:is(:where(.group):hover > *)`

### (E) not-hover:focus:bg-red-500
1. base: `&`
2. not-hover: `&:not(:hover)`
3. focus: `&:not(:hover):focus`

---

## 5. 구현 전략
- 각 variant는 "앞/뒤 variant"를 참고해 selector를 조정
- universal/not/has/arbitrary는 앞에 group-hover/peer-hover가 있으면 override
- engine.ts에서 override가 반환되면 selector 누적을 중단
- compoundModifier는 정말 예외적 상황에만 사용

---

## 6. 확장성/유지보수성
- 새로운 variant 추가 시, 조합별 함수가 아니라 위 규칙만 따르면 됨
- Tailwind v4의 모든 selector 조합을 커버 가능
- selector/AST 구조가 바뀌어도 규칙만 수정하면 전체 시스템이 일관되게 동작 