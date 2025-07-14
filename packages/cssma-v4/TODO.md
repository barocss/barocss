# TODO

## 📝 TODO 리스트 (진행상황 체크용)

### 1. 엔진/파서 구조 점검 및 리팩터링 (실제 구현 체크리스트)

**파서(parseClassName, etc) 구현/테스트**
- [ ] className 문자열을 modifier/utility로 정확히 분리 (예: sm:hover:bg-red-500 → modifiers: [sm, hover], utility: bg-red-500)
- [ ] registry 기반 prefix 매칭(가장 긴 prefix 우선, 중복/오탐 방지)
- [ ] 임의값(`bg-[red]`, `w-[33vw]`) 파싱 지원
- [ ] 커스텀 프로퍼티(`bg-(--my-bg)`) 파싱 지원
- [ ] 음수값(`-m-4`, `-w-[10px]`) 파싱 지원
- [ ] 미등록 prefix/패턴/모디파이어는 무시(utility, modifier 모두)
- [ ] 파싱 실패/비정상 입력(예: `foo-bar`, `hover-`) 시 빈 결과 반환
- [ ] 파싱 결과 구조(ParsedModifier[], ParsedUtility) 타입/값 검증
- [ ] 파서 단위 테스트(정상/비정상/경계/조합 케이스)

**엔진(applyClassName, etc) 구현/테스트**
- [ ] 파서 결과를 받아 registry에서 utility handler를 정확히 찾고 실행
- [ ] modifier chain(generator)로 modifier handler를 중첩 적용 (예: sm:hover:bg-red-500)
- [ ] AST 변환 흐름: handler → AST 노드 → modifier handler → 최종 AST
- [ ] context(theme/config/plugins) 전달 및 활용
- [ ] 미등록 utility/모디파이어 입력 시 빈 배열 반환
- [ ] handler 예외 발생 시 내부적으로 무시, 결과에 포함하지 않음
- [ ] modifier/utility 조합/중첩 동작(예: sm:focus:hover:bg-red-500) 테스트
- [ ] AST의 모든 타입(decl, rule, atrule, comment, raw) 생성 지원
- [ ] 실제 사용 예시/스냅샷 테스트 작성

**구조적/확장성 요구사항**
- [ ] registry 동적 조작(등록/해제/조회) 시 파서/엔진이 즉시 반영
- [ ] 플러그인에서 파서/엔진 래핑, AST 후처리 등 확장 가능 구조 보장
- [ ] TypeScript strict mode, public API 타입 명시
- [ ] 성능: 10,000개 클래스 파싱/AST 변환 1초 이내 벤치마크

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
- [ ] bg, bg-color, bg-opacity
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
- [ ] required: `required:border-red-500` → `:required { ... }`
- [ ] invalid: `invalid:border-red-500` → `:invalid { ... }`
- [ ] read-only: `read-only:bg-gray-100` → `:read-only { ... }`
- [ ] empty: `empty:hidden` → `:empty { ... }`
- [ ] enabled: `enabled:bg-white` → `:enabled { ... }`
- [ ] target: `target:bg-yellow-100` → `:target { ... }`
- [ ] default: `default:bg-gray-100` → `:default { ... }`
- [ ] indeterminate: `indeterminate:bg-gray-300` → `:indeterminate { ... }`
- [ ] placeholder-shown: `placeholder-shown:text-gray-400` → `:placeholder-shown { ... }`
- [ ] autofill: `autofill:bg-yellow-100` → `:autofill { ... }`
- [ ] file: `file:bg-gray-100` → `::file-selector-button { ... }`
- [ ] open: `open:bg-gray-100` → `:open { ... }`

**Media Queries (Responsive)**
- [ ] sm: `sm:bg-red-500` → `@media (min-width: 640px) { ... }`
- [ ] md: `md:bg-red-500` → `@media (min-width: 768px) { ... }`
- [ ] lg: `lg:bg-red-500` → `@media (min-width: 1024px) { ... }`
- [ ] xl: `xl:bg-red-500` → `@media (min-width: 1280px) { ... }`
- [ ] 2xl: `2xl:bg-red-500` → `@media (min-width: 1536px) { ... }`

**Dark/Light Mode**
- [ ] dark: `dark:bg-black` → `.dark & { ... }` 또는 `@media (prefers-color-scheme: dark) { ... }`
- [ ] light: `light:bg-white` → `.light & { ... }` 또는 `@media (prefers-color-scheme: light) { ... }`

**Motion/Reduced Motion**
- [ ] motion-safe: `motion-safe:animate-spin` → `@media (prefers-reduced-motion: no-preference) { ... }`
- [ ] motion-reduce: `motion-reduce:animate-none` → `@media (prefers-reduced-motion: reduce) { ... }`

**Print**
- [ ] print: `print:bg-white` → `@media print { ... }`

**Other**
- [ ] rtl: `rtl:text-right` → `[dir="rtl"] & { ... }`
- [ ] ltr: `ltr:text-left` → `[dir="ltr"] & { ... }`
- [ ] supports-[...]: `supports-[display:grid]:grid` → `@supports (display: grid) { ... }`
- [ ] aria-[...]: `aria-checked:bg-blue-500` → `[aria-checked="true"] & { ... }`
- [ ] data-[...]: `data-open:bg-blue-500` → `[data-open="true"] & { ... }`

#### 2-3. 등록/해제 테스트
- [ ] 유틸리티/모디파이어 동적 등록/해제 시 파싱 결과 변화 테스트
- [ ] 중복 등록/충돌 방지 테스트

### 3. 테마/컨텍스트 테스트
- [ ] theme 값 적용(예: colors, spacing, borderRadius 등)
- [ ] 미정의 값 fallback 동작 테스트
- [ ] 프리셋/extend 병합 동작 테스트

### 4. AST → CSS 변환 검증
- [ ] 중첩(modifier, at-rule), deduplication(마지막 선언 우선), !important, custom property 등 변환 테스트
- [ ] AST의 모든 타입(decl, rule, atrule, comment, raw) 변환 테스트

### 5. 실제 사용 예시/통합 테스트
- [ ] 여러 유틸리티/모디파이어 조합(예: sm:hover:bg-red-500 p-4 rounded-lg 등) 테스트
- [ ] 미등록 문법 포함 시 결과 검증(예: foo-bar, unknown-modifier:bg-blue)
- [ ] 동적 registry 조작, 플러그인 확장, 예외 상황 등 통합 테스트

### 6. 문서화/PRD 명시
- [ ] README/문서에 등록 기반 파싱 원칙 명시
- [ ] registry/AST 구조, 확장/등록 방법, 예제 코드, 플러그인 가이드 등 문서화
- [ ] PRD, TODO, 테스트 커버리지, 개발 가이드 최신화

---

> 이 문서는 cssma-v4 개발 및 검증의 기준이 되는 TODO 리스트입니다. 각 항목을 진행/완료할 때마다 체크박스를 업데이트하며, 실제 코드/테스트/문서와 동기화합니다. 