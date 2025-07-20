# TODO

## 📝 TODO 리스트 (진행상황 체크용)

### ✅ Completed Major Refactoring

#### Variant System Modularization (Completed)
- [x] **Basic Variants Modularization**
  - [x] pseudo-classes.ts - Basic pseudo-class variants (`:hover`, `:focus`, `:active`, etc.)
  - [x] form-states.ts - Form state variants (`:checked`, `:disabled`, `:required`, etc.)
  - [x] structural-selectors.ts - Structural selector variants (`:first-child`, `:last-child`, etc.)
  - [x] media-features.ts - Media feature variants (`motion-safe`, `print`, `portrait`, etc.)
  - [x] group-peer.ts - Group and peer variants (`group-hover`, `peer-hover`, etc.)
  - [x] attribute-selectors.ts - Attribute selector variants (`rtl`, `ltr`, `inert`, `open`)

- [x] **Advanced Variants Modularization**
  - [x] nth-selectors.ts - Nth-child selector variants (`nth-1`, `nth-last-1`, etc.)
  - [x] functional-selectors.ts - Functional selector variants (`is-[.foo]`, `where-[.bar]`)
  - [x] at-rules.ts - At-rule variants (`supports-[display:grid]`, `layer-[utilities]`, `scope-[.parent]`)
  - [x] group-peer-extensions.ts - Extended group/peer variants (`group-focus`, `peer-active`, etc.)

- [x] **Specialized Variants Modularization**
  - [x] responsive.ts - Responsive breakpoint variants (`sm:`, `md:`, `lg:`, etc.)
  - [x] dark-mode.ts - Dark mode variants with configurable selectors
  - [x] container-queries.ts - Container query variants (`@sm:`, `@container/main:`, etc.)
  - [x] has-variants.ts - Has selector variants (`has-[.child]`, `has-[.foo>.bar]`)
  - [x] negation-variants.ts - Negation variants (`not-hover:`, `not-[open]:`, etc.)
  - [x] universal-selectors.ts - Universal selector variants (`*:`, `**:`)
  - [x] arbitrary-variants.ts - Arbitrary variants (`[&>*]:`, `aria-[pressed=true]:`, etc.)
  - [x] attribute-variants.ts - Attribute variants (`[open]:`, `[dir=rtl]:`, etc.)

- [x] **Testing & Validation**
  - [x] All 148 variant tests pass successfully
  - [x] Modular structure maintains backward compatibility
  - [x] Each variant category has comprehensive test coverage
  - [x] Variant combinations and nesting work correctly

#### Documentation Updates (Completed)
- [x] README.md updated with new variant system architecture
- [x] PRD.md updated with modular variant structure
- [x] TODO.md updated to reflect completed work
- [x] All documentation reflects the new modular structure

### 1. 엔진/파서 구조 점검 및 리팩터링 (실제 구현 체크리스트)

**파서(parseClassName, etc) 구현/테스트**
- [x] className 문자열을 modifier/utility로 정확히 분리 (예: sm:hover:bg-red-500 → modifiers: [sm, hover], utility: bg-red-500)
- [x] registry 기반 prefix 매칭(가장 긴 prefix 우선, 중복/오탐 방지)
- [x] 임의값(`bg-[red]`, `w-[33vw]`) 파싱 지원
- [x] 커스텀 프로퍼티(`bg-(--my-bg)`) 파싱 지원
- [x] 음수값(`-m-4`, `-w-[10px]`) 파싱 지원
- [ ] 미등록 prefix/패턴/모디파이어는 무시(utility, modifier 모두)
- [x] 파싱 실패/비정상 입력(예: `hover-`, `-`, `:`, 빈 문자열 등) 시 빈 결과 반환 (parser.basic.test.ts에서 검증)
- [x] 파싱 결과 구조(ParsedModifier[], ParsedUtility) 타입/값 검증 (strict mode + parser.basic.test.ts에서 검증)
- [x] 파서 단위 테스트(정상/비정상/경계/조합 케이스) 및 엔진 복합 조합 테스트 (parser.basic.test.ts, engine.basic.test.ts에서 검증)

**엔진(applyClassName, etc) 구현/테스트**
- [x] 파서 결과를 받아 registry에서 utility handler를 정확히 찾고 실행 (engine.preset.test.ts에서 검증)
- [x] modifier chain(generator)로 modifier handler를 중첩 적용 (engine.basic.test.ts에서 복합 modifier 조합 검증)
- [x] AST 변환 흐름: handler → AST 노드 → modifier handler → 최종 AST (engine.basic.test.ts, astToCss.basic.test.ts에서 검증)
- [x] context(theme/config/plugins) 전달 및 활용 (engine.basic.test.ts, engine.preset.test.ts에서 검증)
- [x] 미등록 utility/모디파이어 입력 시 빈 배열 반환 (engine.preset.test.ts에서 검증)
- [x] handler 예외 발생 시 내부적으로 무시, 결과에 포함하지 않음 (engine.preset.test.ts에서 검증)
- [x] modifier/utility 조합/중첩 동작(예: sm:focus:hover:bg-red-500) 테스트 (engine.basic.test.ts, engine.preset.test.ts에서 검증)
- [x] AST의 모든 타입(decl, rule, atrule, comment, raw) 생성 지원 (engine.basic.test.ts, engine.preset.test.ts에서 검증)
- [ ] 실제 사용 예시/스냅샷 테스트 작성

**구조적/확장성 요구사항**
- [x] registry 동적 조작(등록/해제/조회) 시 파서/엔진이 즉시 반영 (engine.preset.test.ts에서 검증)
- [x] 플러그인에서 파서/엔진 래핑, AST 후처리 등 확장 가능 구조 보장 (README.md, PRD.md, registry/engine 구조에 공식적으로 명시, 실제 동적 registry 조작 테스트 등)
- [x] TypeScript strict mode, public API 타입 명시 (tsconfig.json strict: true, src/core/* 내 주요 타입/함수 export, README/PRD에 타입 명시)
- [x] 성능: 10,000개 클래스 파싱/AST 변환 1초 이내 벤치마크 (engine.basic.test.ts에 벤치마크 테스트 추가)

**예시 테스트 케이스**
- [ ] `sm:hover:bg-red-500` → @media + :hover + background-color AST
- [ ] `-m-4` → margin: -theme value
- [ ] `foo-bar`(미등록) → 빈 결과
- [ ] `bg-[color:var(--my-color)]` → background-color: color:var(--my-color)
- [ ] `group-hover:focus:bg-blue-500` → .group:hover & + :focus + background-color

### 2. 유틸리티/모디파이어 등록 및 테스트
#### 2-1. 유틸리티 등록 (Tailwind CSS 최신 스펙 기준)

**Layout**
- [ ] container
- [ ] box-decoration, box-border, box-content
- [ ] display (block, inline-block, flex, grid, etc)
- [ ] float, clear
- [ ] isolation
- [ ] object-fit, object-position
- [ ] overflow, overflow-x, overflow-y
- [ ] overscroll, overscroll-x, overscroll-y
- [ ] position (static, fixed, absolute, relative, sticky)
- [ ] top, right, bottom, left, inset, inset-x, inset-y
- [ ] visibility
- [ ] z (z-index)

**Flexbox & Grid**
- [ ] flex, flex-row, flex-col, flex-wrap, flex-nowrap, flex-wrap-reverse
- [ ] flex-grow, flex-shrink, flex-auto, flex-initial, flex-none
- [ ] order
- [ ] grid, grid-cols, grid-rows, grid-flow, auto-cols, auto-rows
- [ ] gap, gap-x, gap-y
- [ ] justify, justify-items, justify-self
- [ ] align, align-items, align-self, align-content, place-content, place-items, place-self

**Spacing**
- [ ] p, px, py, pt, pr, pb, pl
- [ ] m, mx, my, mt, mr, mb, ml
- [ ] space-x, space-y
- [ ] divide-x, divide-y

**Sizing**
- [ ] w, min-w, max-w
- [ ] h, min-h, max-h

**Typography**
- [ ] font, font-sans, font-serif, font-mono
- [ ] text, text-size, text-color, text-opacity
- [ ] font-weight, font-style, font-variant, font-smoothing
- [ ] tracking (letter-spacing), leading (line-height)
- [ ] list, list-inside, list-outside, list-decimal, list-disc, list-none
- [ ] placeholder, placeholder-opacity
- [ ] text-align, text-justify, text-decoration, text-underline, text-overline, text-line-through
- [ ] text-transform, text-ellipsis, text-clip, text-wrap, text-balance

**Backgrounds**
- [x] bg, bg-color, bg-opacity (registry 등록 및 theme/임의값/커스텀 프로퍼티/음수값/미등록 테스트 완료)
- [ ] bg-gradient, bg-gradient-to-t/r/b/l, bg-gradient-to-tr, etc
- [ ] bg-none, bg-fixed, bg-local, bg-scroll
- [ ] bg-repeat, bg-no-repeat, bg-repeat-x, bg-repeat-y, bg-repeat-round, bg-repeat-space
- [ ] bg-size, bg-auto, bg-cover, bg-contain
- [ ] bg-position, bg-bottom, bg-center, bg-left, bg-right, bg-top

**Borders**
- [ ] border, border-x, border-y, border-t, border-b, border-l, border-r
- [ ] border-color, border-opacity
- [ ] border-style, border-solid, border-dashed, border-dotted, border-double, border-none
- [ ] border-width
- [ ] rounded, rounded-t, rounded-b, rounded-l, rounded-r, rounded-full, rounded-none

**Effects**
- [ ] shadow, shadow-inner, shadow-outline, shadow-none
- [ ] opacity
- [ ] mix-blend, mix-blend-mode
- [ ] bg-blend, bg-blend-mode

**Filters**
- [ ] filter, filter-none
- [ ] blur, brightness, contrast, drop-shadow, grayscale, hue-rotate, invert, saturate, sepia, backdrop

**Tables**
- [ ] table, table-row, table-cell, table-auto, table-fixed, table-caption, table-header-group, table-footer-group, table-column, table-column-group, table-row-group, table-row, table-cell, table-empty-cells, table-layout

**Transitions & Animation**
- [ ] transition, transition-none, transition-all, transition-colors, transition-opacity, transition-shadow, transition-transform
- [ ] duration, delay, ease, animate, animate-spin, animate-ping, animate-pulse, animate-bounce

**Transforms**
- [ ] transform, transform-none
- [ ] scale, scale-x, scale-y
- [ ] rotate
- [ ] translate, translate-x, translate-y
- [ ] skew, skew-x, skew-y

**Interactivity**
- [ ] appearance
- [ ] cursor
- [ ] outline, outline-none, outline-white, outline-black, outline-offset
- [ ] pointer-events
- [ ] resize
- [ ] select
- [ ] touch-action
- [ ] user-select
- [ ] will-change

**SVG**
- [ ] fill, stroke, stroke-width

**Accessibility**
- [ ] sr-only, not-sr-only

#### 2-2. 모디파이어 등록 (Tailwind CSS 최신 스펙 기준, 실제 구현 체크리스트)

**각 모디파이어별로 다음을 반드시 구현/검증:**
- [ ] registry에 ModifierRegistration 객체로 등록 (name, type, match, handler 등)
- [ ] match 함수: 해당 modifier prefix를 정확히 인식하는지 테스트
- [ ] handler 함수: AST 변환이 올바른지(중첩, at-rule, selector 등) 테스트
- [ ] modifier 조합/중첩 동작(예: sm:hover:bg-red-500) 테스트
- [ ] 미등록/오타/비정상 입력 시 무시되는지 테스트
- [ ] 실제 사용 예시/스냅샷 테스트 작성

**구현/테스트해야 할 모디파이어 목록:**

**Pseudo-classes**
- [ ] hover: `hover:bg-red-500` → `:hover { ... }`
- [ ] focus: `focus:bg-blue-500` → `:focus { ... }`
- [ ] active: `active:bg-green-500` → `:active { ... }`
- [ ] visited: `visited:text-purple-500` → `:visited { ... }`
- [ ] disabled: `disabled:opacity-50` → `:disabled { ... }`
- [ ] checked: `checked:bg-black` → `:checked { ... }`
- [ ] focus-visible: `focus-visible:outline` → `:focus-visible { ... }`
- [ ] focus-within: `focus-within:bg-gray-100` → `:focus-within { ... }`
- [ ] first: `first:mt-0` → `:first-child { ... }`
- [ ] last: `last:mb-0` → `:last-child { ... }`
- [ ] odd: `odd:bg-gray-100` → `:nth-child(odd) { ... }`
- [ ] even: `even:bg-gray-200` → `:nth-child(even) { ... }`
- [ ] group-hover: `group-hover:bg-blue-500` → `.group:hover & { ... }`
- [ ] group-focus: `group-focus:bg-blue-500` → `.group:focus & { ... }`
- [ ] peer-hover: `peer-hover:bg-blue-500` → `.peer:hover ~ & { ... }`
- [ ] peer-focus: `peer-focus:bg-blue-500` → `.peer:focus ~ & { ... }`
- [ ] required: `