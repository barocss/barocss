# Tailwind CSS compatibility baseline

This is a measured sample, not a compatibility percentage. The older README claim of “95%+” had no named Tailwind version or measurement method.

## Version and scope

| Item | Baseline |
| --- | --- |
| Tailwind reference | `tailwindcss@4.1.13`, pinned in `packages/barocss/package.json` and `pnpm-lock.yaml` |
| BaroCSS target | `@barocss/kit@0.0.3`; first measured at commit `4462645`. Later combined commits are listed below. |
| Tailwind API | `compile()` with `@tailwind utilities`; one candidate passed to `build()` per fixture |
| Shared test values | Inline `--spacing: 0.25rem`, `--color-red-500: #ef4444`, `--breakpoint-md: 48rem`; BaroCSS uses matching color and breakpoint theme values |
| Compared output | Generated CSS rules and required Tailwind property rules. PostCSS parsing removes comments and formatting only. Selectors, declarations, nesting, and at-rules remain in the comparison. |
| Outside this sample | Preflight, source scanning, plugins, full theme output, multiple-class ordering, browser lifecycle, responsive behavior in a browser, and computed styles |

The repository already has v4-oriented utilities and variant notes, so v4 is a useful first reference. Version 4.1.13 is an exact, reproducible starting point. It is not a claim that every Tailwind v4 release works. A proposed release target is Tailwind CSS 4.3.3, which the [upstream package](https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/package.json) identifies as a later v4 release. Before claiming that target, run the same fixtures against 4.3.3, add broader cases, and check browser behavior. Keep the measured 4.1.13 baseline separate from that proposed target.

Run the sample from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @barocss/kit exec vitest run tests/compat/compare.test.ts
```

The fixture list is in [`tests/compat/fixtures.ts`](../tests/compat/fixtures.ts). A `match` means the parsed CSS output has the same structure for that fixture. A `different` result means the output structure differs. It does not by itself prove a visual difference. `unsupported` means Tailwind emitted a rule and BaroCSS emitted no rule.

## Initial results at `4462645`

Of the 15 selected fixtures, 8 have matching output structure, 6 have different output structure, and 1 has no BaroCSS rule. This is a sample result, not a compatibility rate.

| Area | Candidate | Result | Observation |
| --- | --- | --- | --- |
| Display | `block`, `hidden` | Match | Same rule and declaration. |
| Layout | `overflow-hidden` | Match | Same rule and declaration. |
| Typography | `text-center` | Match | Same rule and declaration. |
| Color | `bg-red-500`, `bg-[#ff0000]` | Match | Same color declaration with the test theme. |
| Grid | `grid-cols-2` | Match | Same column definition. |
| Form | `field-sizing-content` | Match | Same rule and declaration. |
| Spacing | `p-4`, `-mt-4` | Different | Tailwind inlines `0.25rem`. BaroCSS emits `var(--spacing)`. The BaroCSS browser runtime injects theme variables, but this test does not compare computed values. |
| Focus | `focus:block` | Different | Tailwind keeps a nested `&:focus` rule. BaroCSS emits a flat `:focus` selector. This comparison does not flatten nesting. |
| Hover | `hover:block` | Different | Tailwind adds `@media (hover: hover)`. BaroCSS does not. |
| Breakpoint | `md:block` | Different | Tailwind emits nested `@media (width >= 48rem)`. BaroCSS emits a flat `@media (min-width: 48rem)`. The test does not compare browser behavior. |
| Ring | `inset-ring-2` | Different | Tailwind and BaroCSS use different custom properties and shadow declarations. Tailwind also emits `@property` rules. |
| Mask | `mask-linear-from-50%` | Unsupported | Tailwind emits a mask rule and supporting properties. BaroCSS emitted no CSS at the initial commit. |

These 15 fixtures are selected examples. Their counts must not be used as a compatibility rate.

## Output differences and priority at `4462645`

Priority describes the risk shown by the emitted CSS. It is not a measured count of affected users. Low means syntax differs without a confirmed behavior change. Medium means conditions or declarations differ and need a browser check. High means BaroCSS emits no rule for a valid Tailwind candidate.

| Input | Tailwind 4.1.13 output | BaroCSS output | Cause and likely effect | Priority |
| --- | --- | --- | --- | --- |
| `p-4` | `padding: calc(0.25rem * 4)` | `padding: calc(var(--spacing) * 4)` | BaroCSS resolves spacing through its runtime theme variable. With `--spacing: 0.25rem`, these values agree. The rule output alone does not set that variable. | Low |
| `-mt-4` | `margin-top: calc(0.25rem * -4)` | `margin-top: calc(var(--spacing) * -4)` | Same variable dependency as `p-4`. | Low |
| `focus:block` | `.focus\:block { &:focus { display: block } }` | `.focus\:block:focus { display: block }` | Nested and flat selectors express the same state for this input. Browser verification is still outside this sample. | Low |
| `hover:block` | Nested `:hover` plus `@media (hover: hover)` | Flat `:hover` with no media condition | BaroCSS can apply the rule where the Tailwind hover media query does not match. | Medium |
| `md:block` | `@media (width >= 48rem)` inside the class rule | `@media (min-width: 48rem)` around the class rule | The equivalent range syntax and nesting differ. Both use the same 48rem theme value. Browser behavior has not been checked. | Low |
| `inset-ring-2` | Uses `--tw-inset-ring-color` with `currentcolor` fallback and emits `@property` rules | Sets `--baro-inset-ring-color: rgb(59 130 246 / 0.5)` and uses BaroCSS shadow variables | The default ring color and property model differ. This can change the visible ring. | Medium |
| `mask-linear-from-50%` | Emits a mask rule and supporting `@property` rules | Empty CSS at the initial commit | No BaroCSS utility handler was found for this candidate. | High |

## Follow-up changes in the combined commits

Commit `b60ff82` makes the mask utility emit a rule for percentage positions, including `mask-linear-from-50%`. It uses variable fallbacks because BaroCSS does not emit Tailwind's global `@property` defaults. The utility rule is present, but its full CSS structure still differs from Tailwind. The inset ring now uses `currentcolor` and fallbacks for shadow variables that may be absent. Its full property model still differs from Tailwind.

Core commit `a749cd4` adds `@media (hover: hover)` to `hover:block`. Tailwind keeps this condition inside a nested `:hover` rule. BaroCSS emits `@media (hover: hover) { .hover\:block:hover { display: block } }`. The condition now appears in both outputs. The CSS structures remain different, and computed styles have not been checked in a browser.

With Core commits `d590939` and `a749cd4` plus `b60ff82` in a temporary combined tree, the same 15 fixtures show 8 matching structures and 7 different structures. No fixture emits an empty BaroCSS rule. All 18 comparison tests pass. This is not a compatibility rate or a final integrated-tree result. `hover:block`, `inset-ring-2`, and the mask utility still need browser behavior checks. The spacing and selector format differences remain visible until computed-style comparison confirms their behavior.

Tailwind documents its [CSS compilation flow](https://tailwindcss.com/docs/installation/using-postcss), [theme directives](https://tailwindcss.com/docs/functions-and-directives), and [v4 changes](https://tailwindcss.com/docs/upgrade-guide). The [Tailwind source](https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/src/index.ts) defines the `compile()` and `build()` API used by this test.
