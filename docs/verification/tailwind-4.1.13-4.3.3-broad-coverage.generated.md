# Tailwind CSS 4.1.13 and 4.3.3: measured CSS structure

Generated from the [raw CSS records](tailwind-4.1.13-4.3.3-broad-output.json) and the [exact input catalog](../../packages/barocss/tests/compat/coverage-catalog.ts) on 2026-09-23. This is a selected sample, **not a compatibility percentage** or a claim of full version support.

Reference versions: pinned `tailwindcss@4.1.13` and `tailwindcss@4.3.3`. The latter was the npm latest tag on 2026-09-23; see [Tailwind releases](https://github.com/tailwindlabs/tailwindcss/releases) and the [v4.3 release notes](https://tailwindcss.com/blog/tailwindcss-v4-3). BaroCSS source: `fb1bca3`. Environment: Node 22.22.0, pnpm 10.11.0, PostCSS 8.5.6.

## Method and limits

- Each row is one exact class set. Tailwind `compile()` builds that set against the pinned inline theme in the raw JSON. BaroCSS uses `generateCss()` with Preflight off, red-500 `#ef4444`, sm/md/lg breakpoints at 40/48/64rem, and default blur `8px`. Both Tailwind versions use those values.
- Other theme tokens and CSS variable definitions are not aligned or rendered as a complete page. A `different` result can reflect theme setup, variable naming, or generated CSS structure. Inspect the raw CSS before treating it as a product gap.
- PostCSS parsing removes comments and formatting only. It preserves selectors, declaration names and values, rule order, nesting, and at-rules. `match` means these structures are identical. `different` means they are not. A different structure is **not** proof of different browser behavior.
- `unsupported` means Tailwind emitted a CSS rule and BaroCSS emitted no rule for the exact input. `reference-no-rule` means that pinned Tailwind version emitted no rule; it does not establish the feature introduction date.
- For the new `tab-2 md:tab-4` combination, Tailwind 4.3.3 emits `@media (width >= 48rem)` and BaroCSS emits `@media (min-width: 48rem)`. This is a recorded structural difference; this combination has no browser result.
- In the two `scrollbar-gutter-*` and `overflow-*` combinations, Tailwind emits the gutter rule first and BaroCSS emits the overflow rule first. The individual declarations agree, but rule order differs. No browser result was measured for these combinations.
- For `md:scrollbar-auto`, Tailwind 4.3.3 emits `@media (width >= 48rem)` and BaroCSS emits `@media (min-width: 48rem)`. The declaration agrees; the media-query syntax differs. This exact input has no browser result.
- For `@container/`, Tailwind 4.1.13 emits a rule with an empty `container-name` declaration, while 4.3.3 and BaroCSS emit no rule. The 4.1.13 `unsupported` status records the reference rule only; it does not call for adding an empty container name.
- The bare `blur` inputs depend on the explicit `--blur: 8px` token in this fixture. Both pinned Tailwind compilers emit no bare `blur` rule when that token is absent. BaroCSS now emits a rule from its configured default blur theme value. The rule remains structurally different because the engines use different filter variables and Tailwind emits property registration. Browser behavior is unverified.
- The trailing `!` on a utility now sets its declaration to `!important`. The earlier five-input 4.1.13 follow-up keeps its original source-commit record, where `bg-red-500!` was unsupported. This current run measures the corrected output. Browser behavior for the newly added important inputs is unverified.
- The selected `scrollbar-thumb-*` and `scrollbar-track-*` inputs now emit color variables, `scrollbar-color`, registered defaults, and a conditional fallback. Their class declarations and fallback structure match the pinned 4.3.3 compiler in focused tests. BaroCSS hoists root rules before class rules, so the complete CSS structure still differs. No browser result was measured for these color inputs.
- For numeric `inline-*` and `block-*` values, Tailwind uses the inlined `--spacing: 0.25rem` from this fixture. BaroCSS retains `var(--spacing)`. The generated declarations differ in structure. This run does not establish equal computed sizes because it does not render a shared theme.
- For `inline-sm`, Tailwind uses the inlined `--container-sm: 24rem` from this fixture. BaroCSS retains `var(--container-sm)`. This is a structural theme difference, and the browser result is unverified.
- The logical padding and margin `*-0` inputs emit `0px` on both sides under the pinned spacing theme. Nonzero numeric `pbs/pbe/mbs/mbe` inputs retain the same theme-inlining structural difference as other spacing utilities. Their browser results are unverified.
- The selected logical inset static, fraction, arbitrary, and custom-property inputs are compared as exact CSS structures. Nonzero numeric values retain the pinned theme-inlining structural difference. Tailwind 4.3.3 emits a nested `calc()` for negative fractions such as `-inset-bs-1/2`; this is measured compiler output. Browser behavior for these new inputs is unverified.
- Browser evidence is limited to 7 exact Tailwind 4.3.3 inputs listed below. All 4.1.13 browser results in this broad run and the other 4.3.3 inputs are `unverified`. CSS variables and theme output are not separately rendered as a complete page. A syntactic match alone does not establish computed style or visual parity.
- The older [15-input matrix](tailwind-compatibility-matrix.md) and [five-input follow-up](tailwind-4.1.13-followup-output.json) remain separate records with their own settings and browser evidence.

## Selected-input counts

| Axis | Inputs | 4.1 match | 4.1 different | 4.1 unsupported | 4.1 no rule | 4.3 match | 4.3 different | 4.3 unsupported | 4.3 no rule |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| layout | 28 | 24 | 4 | 0 | 0 | 24 | 4 | 0 | 0 |
| sizing | 12 | 7 | 5 | 0 | 0 | 6 | 6 | 0 | 0 |
| spacing | 16 | 5 | 11 | 0 | 0 | 5 | 11 | 0 | 0 |
| flex-and-grid | 20 | 18 | 2 | 0 | 0 | 18 | 2 | 0 | 0 |
| typography | 16 | 9 | 7 | 0 | 0 | 9 | 7 | 0 | 0 |
| backgrounds | 10 | 6 | 4 | 0 | 0 | 6 | 4 | 0 | 0 |
| borders | 11 | 3 | 8 | 0 | 0 | 3 | 8 | 0 | 0 |
| effects | 9 | 1 | 8 | 0 | 0 | 1 | 8 | 0 | 0 |
| filters | 10 | 0 | 10 | 0 | 0 | 0 | 10 | 0 | 0 |
| transforms | 8 | 3 | 5 | 0 | 0 | 3 | 5 | 0 | 0 |
| transitions | 8 | 2 | 6 | 0 | 0 | 2 | 6 | 0 | 0 |
| interactivity | 8 | 6 | 2 | 0 | 0 | 6 | 2 | 0 | 0 |
| svg-and-accessibility | 14 | 9 | 5 | 0 | 0 | 10 | 4 | 0 | 0 |
| variants | 21 | 0 | 21 | 0 | 0 | 10 | 11 | 0 | 0 |
| container-queries | 4 | 3 | 0 | 1 | 0 | 3 | 0 | 0 | 1 |
| syntax | 18 | 12 | 4 | 0 | 2 | 13 | 3 | 0 | 2 |
| v4.2-and-v4.3 | 126 | 0 | 1 | 0 | 125 | 85 | 33 | 0 | 8 |
| combinations | 8 | 0 | 8 | 0 | 0 | 1 | 7 | 0 | 0 |
| Total selected inputs | 347 | 108 | 111 | 1 | 127 | 205 | 131 | 0 | 11 |

## Exact inputs

| Axis / family | Role | Exact class set | 4.1.13 CSS | 4.3.3 CSS | 4.1 browser | 4.3 browser | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| layout / display | representative | `block` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/display) |
| layout / display | representative | `inline` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/display) |
| layout / display | representative | `inline-block` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/display) |
| layout / display | representative | `flex` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/display) |
| layout / display | representative | `inline-flex` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/display) |
| layout / display | representative | `grid` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/display) |
| layout / display | representative | `inline-grid` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/display) |
| layout / display | representative | `hidden` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/display) |
| layout / display | representative | `contents` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/display) |
| layout / display | representative | `flow-root` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/display) |
| layout / position-and-inset | representative | `static` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/position) |
| layout / position-and-inset | representative | `fixed` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/position) |
| layout / position-and-inset | representative | `absolute` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/position) |
| layout / position-and-inset | representative | `relative` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/position) |
| layout / position-and-inset | representative | `sticky` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/position) |
| layout / position-and-inset | representative | `inset-0` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/position) |
| layout / position-and-inset | representative | `top-4` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/position) |
| layout / position-and-inset | representative | `left-2` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/position) |
| layout / position-and-inset | boundary | `inset-x-2` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/position) |
| layout / position-and-inset | boundary | `top-[10%]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/position) |
| layout / overflow | representative | `overflow-auto` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/overflow) |
| layout / overflow | representative | `overflow-hidden` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/overflow) |
| layout / overflow | representative | `overflow-scroll` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/overflow) |
| layout / overflow | representative | `overflow-x-scroll` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/overflow) |
| layout / overflow | representative | `overflow-y-auto` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/overflow) |
| layout / overflow | representative | `overflow-visible` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/overflow) |
| layout / overflow | boundary | `overscroll-contain` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/overflow) |
| layout / overflow | boundary | `overflow-clip` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/overflow) |
| sizing / width-and-height | representative | `w-0` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/width) |
| sizing / width-and-height | representative | `w-full` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/width) |
| sizing / width-and-height | representative | `w-screen` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/width) |
| sizing / width-and-height | representative | `w-1/2` | match | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/width) |
| sizing / width-and-height | representative | `min-w-0` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/width) |
| sizing / width-and-height | representative | `max-w-sm` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/width) |
| sizing / width-and-height | representative | `h-0` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/width) |
| sizing / width-and-height | representative | `h-full` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/width) |
| sizing / width-and-height | representative | `min-h-screen` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/width) |
| sizing / width-and-height | representative | `size-12` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/width) |
| sizing / width-and-height | boundary | `w-[37px]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/width) |
| sizing / width-and-height | boundary | `aspect-square` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/width) |
| spacing / padding-and-margin | representative | `p-4` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | representative | `px-4` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | representative | `py-2` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | representative | `m-4` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | representative | `mx-auto` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | representative | `mt-2` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | representative | `gap-4` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | representative | `gap-x-2` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | boundary | `p-0` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | boundary | `p-px` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | boundary | `p-[3px]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | boundary | `pt-[3px]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | boundary | `m-0` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | boundary | `m-auto` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | boundary | `-mt-4` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| spacing / padding-and-margin | boundary | `gap-0` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| flex-and-grid / flexbox | representative | `flex-row` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/flex) |
| flex-and-grid / flexbox | representative | `flex-col` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/flex) |
| flex-and-grid / flexbox | representative | `flex-wrap` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/flex) |
| flex-and-grid / flexbox | representative | `flex-1` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/flex) |
| flex-and-grid / flexbox | representative | `flex-none` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/flex) |
| flex-and-grid / flexbox | representative | `grow` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/flex) |
| flex-and-grid / flexbox | representative | `shrink-0` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/flex) |
| flex-and-grid / flexbox | representative | `items-center` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/flex) |
| flex-and-grid / flexbox | representative | `justify-between` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/flex) |
| flex-and-grid / flexbox | representative | `self-end` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/flex) |
| flex-and-grid / flexbox | boundary | `order-last` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/flex) |
| flex-and-grid / flexbox | boundary | `basis-1/2` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/flex) |
| flex-and-grid / grid | representative | `grid-cols-2` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/grid-template-columns) |
| flex-and-grid / grid | representative | `grid-cols-12` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/grid-template-columns) |
| flex-and-grid / grid | representative | `grid-rows-2` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/grid-template-columns) |
| flex-and-grid / grid | representative | `col-span-2` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/grid-template-columns) |
| flex-and-grid / grid | representative | `row-span-2` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/grid-template-columns) |
| flex-and-grid / grid | representative | `auto-cols-fr` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/grid-template-columns) |
| flex-and-grid / grid | boundary | `grid-cols-none` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/grid-template-columns) |
| flex-and-grid / grid | boundary | `col-start-1` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/grid-template-columns) |
| typography / type-and-text | representative | `text-xs` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | representative | `text-base` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | representative | `text-xl` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | representative | `font-normal` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | representative | `font-semibold` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | representative | `leading-none` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | representative | `text-center` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | representative | `text-right` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | representative | `uppercase` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | representative | `italic` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | representative | `underline` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | representative | `truncate` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | boundary | `text-[14px]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | boundary | `leading-[1.7]` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | boundary | `whitespace-nowrap` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| typography / type-and-text | boundary | `break-all` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-size) |
| backgrounds / background | representative | `bg-red-500` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/background-color) |
| backgrounds / background | representative | `bg-transparent` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/background-color) |
| backgrounds / background | representative | `bg-cover` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/background-color) |
| backgrounds / background | representative | `bg-center` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/background-color) |
| backgrounds / background | representative | `bg-no-repeat` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/background-color) |
| backgrounds / background | representative | `bg-linear-to-r` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/background-color) |
| backgrounds / background | representative | `from-red-500` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/background-color) |
| backgrounds / background | representative | `to-transparent` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/background-color) |
| backgrounds / background | boundary | `bg-[#ff0000]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/background-color) |
| backgrounds / background | boundary | `bg-red-500/50` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/background-color) |
| borders / border-and-outline | representative | `border` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/border-width) |
| borders / border-and-outline | representative | `border-2` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/border-width) |
| borders / border-and-outline | representative | `border-red-500` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/border-width) |
| borders / border-and-outline | representative | `rounded` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/border-width) |
| borders / border-and-outline | representative | `rounded-lg` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/border-width) |
| borders / border-and-outline | representative | `rounded-full` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/border-width) |
| borders / border-and-outline | representative | `outline` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/border-width) |
| borders / border-and-outline | representative | `outline-2` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/border-width) |
| borders / border-and-outline | boundary | `border-0` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/border-width) |
| borders / border-and-outline | boundary | `rounded-[8px]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/border-width) |
| borders / border-and-outline | boundary | `outline-offset-2` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/border-width) |
| effects / shadow-and-opacity | representative | `shadow` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/box-shadow) |
| effects / shadow-and-opacity | representative | `shadow-md` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/box-shadow) |
| effects / shadow-and-opacity | representative | `opacity-50` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/box-shadow) |
| effects / shadow-and-opacity | representative | `mix-blend-multiply` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/box-shadow) |
| effects / shadow-and-opacity | representative | `ring-2` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/box-shadow) |
| effects / shadow-and-opacity | representative | `inset-ring-2` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/box-shadow) |
| effects / shadow-and-opacity | boundary | `opacity-0` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/box-shadow) |
| effects / shadow-and-opacity | boundary | `opacity-100` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/box-shadow) |
| effects / shadow-and-opacity | boundary | `shadow-[0_4px_8px_#0002]` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/box-shadow) |
| filters / filter-and-backdrop | representative | `blur` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/filter) |
| filters / filter-and-backdrop | representative | `blur-sm` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/filter) |
| filters / filter-and-backdrop | representative | `brightness-50` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/filter) |
| filters / filter-and-backdrop | representative | `grayscale` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/filter) |
| filters / filter-and-backdrop | representative | `backdrop-blur-sm` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/filter) |
| filters / filter-and-backdrop | boundary | `grayscale-0` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/filter) |
| filters / filter-and-backdrop | boundary | `blur-[3px]` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/filter) |
| filters / filter-and-backdrop | boundary | `backdrop-brightness-50` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/filter) |
| filters / filter-and-backdrop | combination | `blur brightness-50` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/filter) |
| filters / blur-default-variant | representative | `hover:blur` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/filter-blur) |
| transforms / transform | representative | `rotate-45` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transform) |
| transforms / transform | representative | `scale-95` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transform) |
| transforms / transform | representative | `translate-x-2` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transform) |
| transforms / transform | representative | `skew-x-6` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transform) |
| transforms / transform | representative | `origin-center` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transform) |
| transforms / transform | boundary | `-translate-y-1` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transform) |
| transforms / transform | boundary | `rotate-[13deg]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transform) |
| transforms / transform | boundary | `scale-0` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transform) |
| transitions / transition-and-animation | representative | `transition` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transition-property) |
| transitions / transition-and-animation | representative | `transition-colors` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transition-property) |
| transitions / transition-and-animation | representative | `duration-300` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transition-property) |
| transitions / transition-and-animation | representative | `ease-in-out` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transition-property) |
| transitions / transition-and-animation | representative | `delay-150` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transition-property) |
| transitions / transition-and-animation | representative | `animate-spin` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transition-property) |
| transitions / transition-and-animation | boundary | `duration-0` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transition-property) |
| transitions / transition-and-animation | boundary | `transition-none` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/transition-property) |
| interactivity / interaction | representative | `cursor-pointer` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/cursor) |
| interactivity / interaction | representative | `pointer-events-none` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/cursor) |
| interactivity / interaction | representative | `select-none` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/cursor) |
| interactivity / interaction | representative | `touch-pan-x` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/cursor) |
| interactivity / interaction | representative | `scroll-smooth` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/cursor) |
| interactivity / interaction | representative | `resize-none` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/cursor) |
| interactivity / interaction | boundary | `cursor-not-allowed` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/cursor) |
| interactivity / interaction | boundary | `pointer-events-auto` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/cursor) |
| svg-and-accessibility / svg-and-screen-reader | representative | `fill-red-500` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/fill) |
| svg-and-accessibility / svg-and-screen-reader | representative | `stroke-red-500` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/fill) |
| svg-and-accessibility / svg-and-screen-reader | representative | `stroke-2` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/fill) |
| svg-and-accessibility / svg-and-screen-reader | representative | `sr-only` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/fill) |
| svg-and-accessibility / svg-and-screen-reader | representative | `not-sr-only` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/fill) |
| svg-and-accessibility / svg-and-screen-reader | boundary | `fill-none` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/fill) |
| svg-and-accessibility / svg-and-screen-reader | boundary | `stroke-[3px]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/fill) |
| svg-and-accessibility / stroke-arbitrary-width-and-color | representative | `stroke-[1.5px]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/stroke-width) |
| svg-and-accessibility / stroke-arbitrary-width-and-color | representative | `stroke-[2rem]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/stroke-width) |
| svg-and-accessibility / stroke-arbitrary-width-and-color | representative | `stroke-[50%]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/stroke-width) |
| svg-and-accessibility / stroke-arbitrary-width-and-color | representative | `stroke-[length:var(--stroke-width)]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/stroke-width) |
| svg-and-accessibility / stroke-arbitrary-width-and-color | boundary | `stroke-[rebeccapurple]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/stroke-width) |
| svg-and-accessibility / stroke-arbitrary-width-and-color | boundary | `stroke-[color:var(--stroke-color)]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/stroke-width) |
| svg-and-accessibility / stroke-arbitrary-width-and-color | combination | `stroke-2 hover:stroke-[3px]` | different | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/stroke-width) |
| variants / state-and-structural | representative | `hover:block` | different | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| variants / state-and-structural | representative | `focus:block` | different | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| variants / state-and-structural | representative | `active:block` | different | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| variants / state-and-structural | representative | `disabled:opacity-50` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| variants / state-and-structural | representative | `group-hover:block` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| variants / state-and-structural | representative | `peer-checked:block` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| variants / state-and-structural | representative | `first:block` | different | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| variants / state-and-structural | representative | `last:block` | different | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| variants / state-and-structural | representative | `odd:bg-red-500` | different | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| variants / state-and-structural | representative | `dark:bg-red-500` | different | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| variants / state-and-structural | boundary | `focus-visible:block` | different | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| variants / state-and-structural | boundary | `not-hover:block` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| variants / state-and-structural | boundary | `has-[input:checked]:block` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| variants / responsive-and-arbitrary | representative | `sm:block` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| variants / responsive-and-arbitrary | representative | `md:block` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| variants / responsive-and-arbitrary | representative | `lg:block` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| variants / responsive-and-arbitrary | representative | `max-md:hidden` | different | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| variants / responsive-and-arbitrary | representative | `md:hover:block` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| variants / responsive-and-arbitrary | boundary | `hover:focus:block` | different | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| variants / responsive-and-arbitrary | boundary | `[&>p]:block` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| variants / responsive-and-arbitrary | boundary | `md:focus-visible:block` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| container-queries / inline-size-container | representative | `@container` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| container-queries / inline-size-container | representative | `@container/sidebar` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| container-queries / inline-size-container | boundary | `@container/card-grid` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| container-queries / inline-size-container | boundary | `@container/` | unsupported | reference-no-rule | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| syntax / arbitrary-and-negative | representative | `min-w-[13px]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/adding-custom-styles) |
| syntax / arbitrary-and-negative | representative | `h-[27px]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/adding-custom-styles) |
| syntax / arbitrary-and-negative | representative | `border-[#ff0000]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/adding-custom-styles) |
| syntax / arbitrary-and-negative | representative | `grid-cols-[1fr_2fr]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/adding-custom-styles) |
| syntax / arbitrary-and-negative | representative | `inset-[3px]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/adding-custom-styles) |
| syntax / arbitrary-and-negative | representative | `mt-[-2px]` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/adding-custom-styles) |
| syntax / arbitrary-and-negative | boundary | `-translate-x-1/2` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/adding-custom-styles) |
| syntax / arbitrary-and-negative | boundary | `bg-(--custom-color)` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/adding-custom-styles) |
| syntax / important-modifier | representative | `bg-red-500!` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| syntax / important-modifier | representative | `p-4!` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| syntax / important-modifier | representative | `block!` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| syntax / important-modifier | boundary | `!bg-red-500` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| syntax / important-modifier | boundary | `!p-4` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| syntax / important-modifier | boundary | `hover:bg-red-500!` | different | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| syntax / important-modifier | boundary | `bg-[#ff0000]!` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| syntax / important-modifier | boundary | `!bg-red-500!` | reference-no-rule | reference-no-rule | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| syntax / important-modifier | boundary | `bg-red-500!!` | reference-no-rule | reference-no-rule | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| syntax / important-modifier | combination | `bg-red-500 bg-red-500!` | match | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| v4.2-and-v4.3 / logical-properties | representative | `pbs-4` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| v4.2-and-v4.3 / logical-properties | representative | `mbs-6` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| v4.2-and-v4.3 / logical-properties | representative | `inline-full` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| v4.2-and-v4.3 / logical-properties | representative | `block-24` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| v4.2-and-v4.3 / logical-properties | representative | `inset-bs-2` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| v4.2-and-v4.3 / logical-properties | representative | `inset-e-4` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| v4.2-and-v4.3 / inset-inline-start | representative | `inset-s-0` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-inline-start | representative | `inset-s-auto` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-inline-start | representative | `inset-s-full` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-inline-start | representative | `inset-s-1/2` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-inline-start | boundary | `-inset-s-px` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-inline-start | boundary | `inset-s-[7px]` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-inline-start | boundary | `inset-s-(--offset)` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-inline-end | representative | `inset-e-px` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-inline-end | representative | `inset-e-full` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-inline-end | representative | `inset-e-1/2` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-inline-end | boundary | `inset-e-0` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-inline-end | boundary | `-inset-e-2` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-inline-end | boundary | `inset-e-(--offset)` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-inline-end | combination | `inset-e-4 hover:inset-e-0` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-block-start | representative | `inset-bs-auto` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-block-start | representative | `inset-bs-px` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-block-start | representative | `inset-bs-1/2` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-block-start | boundary | `inset-bs-0` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-block-start | boundary | `-inset-bs-1/2` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-block-start | boundary | `inset-bs-[13px]` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-block-end | representative | `inset-be-8` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-block-end | representative | `inset-be-auto` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-block-end | representative | `inset-be-full` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-block-end | boundary | `inset-be-0` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-block-end | boundary | `-inset-be-full` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / inset-block-end | boundary | `inset-be-(--offset)` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/top-right-bottom-left) |
| v4.2-and-v4.3 / padding-block-start | representative | `pbs-px` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| v4.2-and-v4.3 / padding-block-start | representative | `pbs-[13px]` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| v4.2-and-v4.3 / padding-block-start | boundary | `pbs-0` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| v4.2-and-v4.3 / padding-block-start | boundary | `pbs-(--gap)` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| v4.2-and-v4.3 / padding-block-start | combination | `pbs-4 hover:pbs-8` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| v4.2-and-v4.3 / padding-block-end | representative | `pbe-8` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| v4.2-and-v4.3 / padding-block-end | representative | `pbe-px` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| v4.2-and-v4.3 / padding-block-end | representative | `pbe-[3px]` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| v4.2-and-v4.3 / padding-block-end | boundary | `pbe-0` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| v4.2-and-v4.3 / padding-block-end | boundary | `pbe-(--gap)` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/padding) |
| v4.2-and-v4.3 / margin-block-start | representative | `mbs-auto` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/margin) |
| v4.2-and-v4.3 / margin-block-start | representative | `mbs-px` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/margin) |
| v4.2-and-v4.3 / margin-block-start | representative | `-mbs-px` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/margin) |
| v4.2-and-v4.3 / margin-block-start | representative | `mbs-[17px]` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/margin) |
| v4.2-and-v4.3 / margin-block-start | boundary | `mbs-0` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/margin) |
| v4.2-and-v4.3 / margin-block-start | boundary | `-mbs-6` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/margin) |
| v4.2-and-v4.3 / margin-block-start | boundary | `mbs-(--gap)` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/margin) |
| v4.2-and-v4.3 / margin-block-end | representative | `mbe-2` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/margin) |
| v4.2-and-v4.3 / margin-block-end | representative | `mbe-auto` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/margin) |
| v4.2-and-v4.3 / margin-block-end | representative | `mbe-px` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/margin) |
| v4.2-and-v4.3 / margin-block-end | representative | `-mbe-px` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/margin) |
| v4.2-and-v4.3 / margin-block-end | boundary | `mbe-0` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/margin) |
| v4.2-and-v4.3 / margin-block-end | boundary | `mbe-(--gap)` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/margin) |
| v4.2-and-v4.3 / inline-size | representative | `inline-auto` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/inline-size) |
| v4.2-and-v4.3 / inline-size | representative | `inline-px` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/inline-size) |
| v4.2-and-v4.3 / inline-size | representative | `inline-screen` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/inline-size) |
| v4.2-and-v4.3 / inline-size | representative | `inline-sm` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/inline-size) |
| v4.2-and-v4.3 / inline-size | representative | `inline-1/2` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/inline-size) |
| v4.2-and-v4.3 / inline-size | boundary | `inline-0` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/inline-size) |
| v4.2-and-v4.3 / inline-size | boundary | `inline-1.5` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/inline-size) |
| v4.2-and-v4.3 / inline-size | boundary | `inline-[37px]` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/inline-size) |
| v4.2-and-v4.3 / inline-size | boundary | `inline-(--logical-size)` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/inline-size) |
| v4.2-and-v4.3 / inline-size | combination | `inline-full md:inline-1/2` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/inline-size) |
| v4.2-and-v4.3 / block-size | representative | `block-full` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/block-size) |
| v4.2-and-v4.3 / block-size | representative | `block-screen` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/block-size) |
| v4.2-and-v4.3 / block-size | representative | `block-lh` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/block-size) |
| v4.2-and-v4.3 / block-size | representative | `block-3/4` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/block-size) |
| v4.2-and-v4.3 / block-size | boundary | `block-0` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/block-size) |
| v4.2-and-v4.3 / block-size | boundary | `block-1.5` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/block-size) |
| v4.2-and-v4.3 / block-size | boundary | `block-[12px]` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/block-size) |
| v4.2-and-v4.3 / block-size | boundary | `block-(--logical-size)` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/block-size) |
| v4.2-and-v4.3 / block-size | combination | `block-24 hover:block-full` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/block-size) |
| v4.2-and-v4.3 / new-utilities | representative | `scrollbar-auto` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| v4.2-and-v4.3 / new-utilities | representative | `scrollbar-thin` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| v4.2-and-v4.3 / new-utilities | representative | `scrollbar-none` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| v4.2-and-v4.3 / new-utilities | representative | `scrollbar-gutter-stable` | reference-no-rule | match | unverified | [verified-match](https://github.com/barocss/barocss/pull/84#issuecomment-5791909812) | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| v4.2-and-v4.3 / new-utilities | representative | `@container-size` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| v4.2-and-v4.3 / new-utilities | boundary | `@container-size/sidebar` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| v4.2-and-v4.3 / new-utilities | boundary | `font-features-["tnum"]` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| v4.2-and-v4.3 / new-utilities | boundary | `scrollbar-thumb-red-500` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| v4.2-and-v4.3 / font-feature-settings | representative | `font-features-['smcp','onum']` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-feature-settings) |
| v4.2-and-v4.3 / font-feature-settings | representative | `font-features-(--my-features)` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-feature-settings) |
| v4.2-and-v4.3 / font-feature-settings | boundary | `font-features-unknown` | reference-no-rule | reference-no-rule | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-feature-settings) |
| v4.2-and-v4.3 / font-feature-settings | combination | `font-features-['tnum'] md:font-features-['smcp']` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/font-feature-settings) |
| v4.2-and-v4.3 / scrollbar-width-variants | representative | `md:scrollbar-auto` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-width) |
| v4.2-and-v4.3 / scrollbar-width-variants | representative | `hover:scrollbar-thin` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-width) |
| v4.2-and-v4.3 / scrollbar-width-variants | boundary | `scrollbar-[3px]` | reference-no-rule | reference-no-rule | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-width) |
| v4.2-and-v4.3 / scrollbar-width-variants | combination | `scrollbar-none overflow-auto` | different | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-width) |
| v4.2-and-v4.3 / scrollbar-gutter | representative | `scrollbar-gutter-auto` | reference-no-rule | match | unverified | [verified-match](https://github.com/barocss/barocss/pull/84#issuecomment-5791909812) | [Tailwind](https://tailwindcss.com/docs/scrollbar-gutter) |
| v4.2-and-v4.3 / scrollbar-gutter | representative | `scrollbar-gutter-both` | reference-no-rule | match | unverified | [verified-match](https://github.com/barocss/barocss/pull/84#issuecomment-5791909812) | [Tailwind](https://tailwindcss.com/docs/scrollbar-gutter) |
| v4.2-and-v4.3 / scrollbar-gutter-variants | representative | `hover:scrollbar-gutter-stable` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| v4.2-and-v4.3 / scrollbar-color | representative | `scrollbar-thumb-transparent` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-color) |
| v4.2-and-v4.3 / scrollbar-color | representative | `scrollbar-track-red-500` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-color) |
| v4.2-and-v4.3 / scrollbar-color | representative | `scrollbar-thumb-current` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-color) |
| v4.2-and-v4.3 / scrollbar-color | representative | `scrollbar-track-transparent` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-color) |
| v4.2-and-v4.3 / scrollbar-color | representative | `scrollbar-thumb-red-500/50` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-color) |
| v4.2-and-v4.3 / scrollbar-color | boundary | `scrollbar-thumb-[#123456]` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-color) |
| v4.2-and-v4.3 / scrollbar-color | boundary | `scrollbar-track-(--track-color)` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-color) |
| v4.2-and-v4.3 / scrollbar-color | boundary | `scrollbar-track-red-500/25` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-color) |
| v4.2-and-v4.3 / scrollbar-color | boundary | `scrollbar-thumb-never` | reference-no-rule | reference-no-rule | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-color) |
| v4.2-and-v4.3 / scrollbar-color | combination | `scrollbar-thumb-red-500 scrollbar-track-red-500` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-color) |
| v4.2-and-v4.3 / scrollbar-color-variants | representative | `hover:scrollbar-thumb-red-500` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-color) |
| v4.2-and-v4.3 / size-container | representative | `@container-size/card` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| v4.2-and-v4.3 / size-container | boundary | `@container-size/card-grid` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| v4.2-and-v4.3 / size-container | boundary | `@container-size/` | reference-no-rule | reference-no-rule | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |
| v4.2-and-v4.3 / zoom | representative | `zoom-0` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/zoom) |
| v4.2-and-v4.3 / zoom | representative | `zoom-75` | reference-no-rule | match | unverified | [verified-match](https://github.com/barocss/barocss/pull/84#issuecomment-5791345702) | [Tailwind](https://tailwindcss.com/docs/zoom) |
| v4.2-and-v4.3 / zoom | representative | `zoom-100` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/zoom) |
| v4.2-and-v4.3 / zoom | representative | `zoom-125` | reference-no-rule | match | unverified | [verified-match](https://github.com/barocss/barocss/pull/84#issuecomment-5791345702) | [Tailwind](https://tailwindcss.com/docs/zoom) |
| v4.2-and-v4.3 / zoom | boundary | `zoom-[1.1]` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/zoom) |
| v4.2-and-v4.3 / zoom | boundary | `zoom-[80%]` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/zoom) |
| v4.2-and-v4.3 / zoom | boundary | `zoom-(--scale)` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/zoom) |
| v4.2-and-v4.3 / zoom | boundary | `zoom-1.5` | reference-no-rule | reference-no-rule | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/zoom) |
| v4.2-and-v4.3 / zoom | boundary | `zoom-auto` | reference-no-rule | reference-no-rule | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/zoom) |
| v4.2-and-v4.3 / zoom | combination | `zoom-100 hover:zoom-125` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/zoom) |
| v4.2-and-v4.3 / zoom | combination | `zoom-75 tab-2` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/zoom) |
| v4.2-and-v4.3 / tab-size | representative | `tab-0` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/tab-size) |
| v4.2-and-v4.3 / tab-size | representative | `tab-2` | reference-no-rule | match | unverified | [verified-match](https://github.com/barocss/barocss/pull/84#issuecomment-5791345702) | [Tailwind](https://tailwindcss.com/docs/tab-size) |
| v4.2-and-v4.3 / tab-size | representative | `tab-4` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/tab-size) |
| v4.2-and-v4.3 / tab-size | boundary | `tab-[12px]` | reference-no-rule | match | unverified | [verified-match](https://github.com/barocss/barocss/pull/84#issuecomment-5791345702) | [Tailwind](https://tailwindcss.com/docs/tab-size) |
| v4.2-and-v4.3 / tab-size | boundary | `tab-(--size)` | reference-no-rule | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/tab-size) |
| v4.2-and-v4.3 / tab-size | boundary | `tab-1.5` | reference-no-rule | reference-no-rule | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/tab-size) |
| v4.2-and-v4.3 / tab-size | boundary | `tab-none` | reference-no-rule | reference-no-rule | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/tab-size) |
| v4.2-and-v4.3 / tab-size | combination | `tab-2 md:tab-4` | reference-no-rule | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/tab-size) |
| combinations / same-element-classes | combination | `block p-4` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| combinations / same-element-classes | combination | `flex items-center gap-4` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| combinations / same-element-classes | combination | `bg-red-500 hover:bg-red-500` | different | match | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| combinations / same-element-classes | combination | `hidden md:block` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| combinations / same-element-classes | combination | `rounded-lg border shadow-md` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| combinations / same-element-classes | combination | `p-0 p-4` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| combinations / scrollbar-gutter-and-overflow | combination | `overflow-auto scrollbar-gutter-stable` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-gutter) |
| combinations / scrollbar-gutter-and-overflow | combination | `overflow-scroll scrollbar-gutter-both` | different | different | unverified | unverified | [Tailwind](https://tailwindcss.com/docs/scrollbar-gutter) |

## Focused browser evidence

Guard compared separately scoped Tailwind CSS 4.3.3 and BaroCSS stylesheets in Headless Chrome 153 on macOS 15.6.1. The [zoom and tab check](https://github.com/barocss/barocss/pull/84#issuecomment-5791345702) used BaroCSS commit `5a20ae7`; the [scrollbar-gutter check](https://github.com/barocss/barocss/pull/84#issuecomment-5791909812) used exact HEAD `82ababe`. Both used local fixtures with linked dependencies, not a fresh frozen install.

For the gutter inputs, both sides had `clientWidth: 160px`. The macOS overlay scrollbar did not show a measurable reserved gutter, so these results establish computed property values and pairwise metrics only. They do not establish visible spacing parity across platforms.

| Exact input | Computed property | Both computed values | Both measured widths | Source |
| --- | --- | --- | --- | --- |
| `scrollbar-gutter-stable` | scrollbar-gutter | `stable` | clientWidth: 160px | [Guard](https://github.com/barocss/barocss/pull/84#issuecomment-5791909812) |
| `scrollbar-gutter-auto` | scrollbar-gutter | `auto` | clientWidth: 160px | [Guard](https://github.com/barocss/barocss/pull/84#issuecomment-5791909812) |
| `scrollbar-gutter-both` | scrollbar-gutter | `stable both-edges` | clientWidth: 160px | [Guard](https://github.com/barocss/barocss/pull/84#issuecomment-5791909812) |
| `zoom-75` | zoom | `0.75` | element width: 75px | [Guard](https://github.com/barocss/barocss/pull/84#issuecomment-5791345702) |
| `zoom-125` | zoom | `1.25` | element width: 125px | [Guard](https://github.com/barocss/barocss/pull/84#issuecomment-5791345702) |
| `tab-2` | tab-size | `2` | element width: 100px | [Guard](https://github.com/barocss/barocss/pull/84#issuecomment-5791345702) |
| `tab-[12px]` | tab-size | `12px` | element width: 100px | [Guard](https://github.com/barocss/barocss/pull/84#issuecomment-5791345702) |

## Unmeasured axes

| Axis | Topic | Status | Source |
| --- | --- | --- | --- |
| base styles | Preflight reset and defaults | unverified | [Tailwind](https://tailwindcss.com/docs/preflight) |
| theme | Default theme and custom theme variable combinations | unverified | [Tailwind](https://tailwindcss.com/docs/theme) |
| directives | @apply and @reference | unverified | [Tailwind](https://tailwindcss.com/docs/functions-and-directives) |
| directives | @utility with static, functional, and default values | unverified | [Tailwind](https://tailwindcss.com/docs/adding-custom-styles) |
| directives | @variant with stacked and compound selectors | unverified | [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4-3) |
| build input | Source scanning and @source | unverified | [Tailwind](https://tailwindcss.com/docs/detecting-classes-in-source-files) |
| build input | Plugins, transforms, and integration paths | unverified | [Tailwind](https://tailwindcss.com/docs/installation/using-vite) |
| composition | Class ordering, conflicting utilities, and specificity | unverified | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes) |
| browser | Computed styles and pixels for new CSS differences | unverified | [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) |
| browser | Firefox, WebKit, modes, viewports, and runtime lifecycle | unverified | [Tailwind](https://tailwindcss.com/docs/responsive-design) |

## Reproduce

Use Node 22.22.0 and pnpm 10.11.0. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @barocss/kit exec vitest run tests/compat/coverage.test.ts
pnpm --filter @barocss/kit exec vite-node --script tests/compat/export-broad-output.ts ../../docs/verification/tailwind-4.1.13-4.3.3-broad-output.json
pnpm --filter @barocss/kit exec vite-node --script tests/compat/export-broad-report.ts ../../docs/verification/tailwind-4.1.13-4.3.3-broad-output.json ../../docs/verification/tailwind-4.1.13-4.3.3-broad-coverage.generated.md
```

The test compares all raw CSS strings and structure fingerprints with the checked-in records. Review any changed record before accepting it.
