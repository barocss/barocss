# TODO

## 📝 Current Tasks

### 1. Engine/Parser Structure Validation

**Parser Implementation Check:**
- [ ] Unregistered prefix/pattern/modifiers should be ignored (utility, modifier both)
- [ ] Real usage examples/snapshot tests

**Engine Implementation Check:**
- [ ] Real usage examples/snapshot tests

**Structural/Extensibility Requirements:**
- [ ] Performance: 10,000 class parsing/AST conversion within 1 second benchmark

**Example Test Cases:**
- [ ] `sm:hover:bg-red-500` → @media + :hover + background-color AST
- [ ] `-m-4` → margin: -theme value
- [ ] `foo-bar`(unregistered) → empty result
- [ ] `bg-[color:var(--my-color)]` → background-color: color:var(--my-color)
- [ ] `group-hover:focus:bg-blue-500` → .group:hover & + :focus + background-color

### 2. Utility/Modifier Registration & Testing

#### 2-1. Utility Registration (Tailwind CSS Latest Spec)

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
- [x] bg, bg-color, bg-opacity (registry registration and theme/arbitrary/custom property/negative/unregistered tests completed)
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

#### 2-2. Modifier Registration (Tailwind CSS Latest Spec)

**Each modifier must implement/validate:**
- [ ] Register as ModifierRegistration object in registry (name, type, match, handler, etc.)
- [ ] match function: correctly recognize the modifier prefix
- [ ] handler function: correct AST transformation (nesting, at-rule, selector, etc.)
- [ ] modifier combination/nesting behavior (e.g., sm:hover:bg-red-500)
- [ ] unregistered/typo/abnormal input should be ignored
- [ ] real usage examples/snapshot tests

**Modifiers to implement/test:**

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
- [ ] valid: `valid:border-green-500` → `:valid { ... }`

**Responsive**
- [ ] sm: `sm:bg-red-500` → `@media (min-width: 640px) { ... }`
- [ ] md: `md:bg-blue-500` → `@media (min-width: 768px) { ... }`
- [ ] lg: `lg:bg-green-500` → `@media (min-width: 1024px) { ... }`
- [ ] xl: `xl:bg-yellow-500` → `@media (min-width: 1280px) { ... }`
- [ ] 2xl: `2xl:bg-purple-500` → `@media (min-width: 1536px) { ... }`

**Dark Mode**
- [ ] dark: `dark:bg-gray-900` → `@media (prefers-color-scheme: dark) { ... }` or `.dark { ... }`

**Container Queries**
- [ ] @sm: `@sm:bg-red-500` → `@container (min-width: 640px) { ... }`
- [ ] @md: `@md:bg-blue-500` → `@container (min-width: 768px) { ... }`

**Arbitrary Variants**
- [ ] [&>*]: `[&>*]:bg-red-500` → `& > * { ... }`
- [ ] [aria-pressed=true]: `[aria-pressed=true]:bg-blue-500` → `[aria-pressed="true"] { ... }`
- [ ] [data-state=open]: `[data-state=open]:bg-green-500` → `[data-state="open"] { ... }`

### 3. Performance Optimization & Benchmarking

**Parser Performance**
- [ ] 10,000 class parsing within 1 second
- [ ] Memory usage optimization
- [ ] Cache system efficiency validation

**Engine Performance**
- [ ] AST conversion performance optimization
- [ ] Complex modifier combination performance
- [ ] Large-scale CSS generation performance

### 4. Documentation & Examples

**API Documentation**
- [ ] All public API documentation
- [ ] Usage examples
- [ ] Migration guide

**Test Documentation**
- [ ] Test writing guide
- [ ] Custom utility/modifier writing guide
- [ ] Debugging guide

### 5. Integration Testing

**End-to-End Testing**
- [ ] Real project usage testing
- [ ] Compatibility testing with various build tools
- [ ] Browser compatibility testing

**Performance Testing**
- [ ] Performance testing in large-scale projects
- [ ] Memory leak testing
- [ ] Build time optimization testing