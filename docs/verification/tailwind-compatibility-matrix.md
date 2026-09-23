# Tailwind CSS compatibility evidence matrix

This matrix records selected inputs. It does not give an overall compatibility rate. A CSS structure result and a browser behavior result are separate findings. `확인됨` applies only to the named input, settings, and state.

## Evidence keys

| Key | Fixture and raw output | Reproduction | BaroCSS commit, reference version, date |
| --- | --- | --- | --- |
| C1 | [`fixtures.ts`](../../packages/barocss/tests/compat/fixtures.ts), [both engines' raw CSS for all 15 inputs](tailwind-4.1.13-output.json), and the [PostCSS structure comparison](../../packages/barocss/tests/compat/compare.test.ts) | With Node 22 and pnpm 9, run `pnpm --filter @barocss/kit exec vitest run tests/compat/compare.test.ts`. Regenerate the raw output with `pnpm --filter @barocss/kit exec vite-node --script tests/compat/export-output.ts ../../docs/verification/tailwind-4.1.13-output.json`. | BaroCSS candidate `6df9af9` (runtime last changed at `94ba909`); `tailwindcss@4.1.13`; 2026-09-23. The harness sets `--spacing: 0.25rem`, red-500 `#ef4444`, and md `48rem` on both sides. BaroCSS Preflight is off. |
| B1 | [`render-compat-fixtures.mjs`](render-compat-fixtures.mjs) generates separate CSS/HTML pages for four named inputs. [Guard's browser report](0.0.4-rc-review.md), [Issue #67 result](https://github.com/barocss/barocss/issues/67#issuecomment-5787601039), and [later mask/ring recheck](https://github.com/barocss/barocss/pull/71#issuecomment-5788063380). | Build the kit with `pnpm --filter @barocss/kit build:library`; run `node docs/verification/render-compat-fixtures.mjs <output-directory>`; serve the directory over local HTTP and compare the generated pages in Chromium. | On 2026-09-23, Guard ran the four pages built before the version change in Chromium 153.0.8010.53, then confirmed that BaroCSS `3240100` emitted byte-identical CSS for those inputs. Guard rechecked mask/ring at `94ba909` in Chromium 153; that recheck does not record a patch version. Reference: `tailwindcss@4.1.13`. Changes after `94ba909` through `6df9af9` were documentation only. |

The JSON contains the exact, unminified CSS from both engines for each single-class fixture. The comparison removes comments and formatting only. It preserves selectors, declarations, nesting, and at-rules. `차이 있음` in the CSS rows means this structure differs; it does not alone prove a visual difference.

## First measured version: Tailwind CSS 4.1.13

| Axis and tested slice | Status | Finding and evidence |
| --- | --- | --- |
| Utility: eight simple single classes (`block`, `hidden`, `overflow-hidden`, `text-center`, `bg-red-500`, `bg-[#ff0000]`, `grid-cols-2`, `field-sizing-content`) | 확인됨 | Parsed CSS structures match for these exact inputs. [C1](#evidence-keys). |
| Utility: `p-4`, `-mt-4` | 차이 있음 | Tailwind inlines `0.25rem`; BaroCSS uses `var(--spacing)`. Computed spacing was not checked. [C1](#evidence-keys). |
| Utility: `inset-ring-2`, `mask-linear-from-50%` | 차이 있음 | CSS property and fallback structures differ. The specified Chromium rendering state matched separately; see the browser rows. [C1](#evidence-keys), [B1](#evidence-keys). |
| Utility: class combinations and arbitrary values beyond `bg-[#ff0000]` | 미검증 | The 15-fixture comparison passes one class per build. [C1](#evidence-keys). |
| Variant: `focus:block`, `hover:block`, `md:block` CSS | 차이 있음 | Focus nesting is flat in BaroCSS. Hover has the same media condition but different nesting. Md uses different query syntax and nesting with the same `48rem` input. [C1](#evidence-keys). |
| Variant: combinations, nested variants, and other breakpoints | 미검증 | These inputs are absent from the comparison. [C1](#evidence-keys). |
| Theme: red-500 and one arbitrary red value | 확인됨 | `bg-red-500` and `bg-[#ff0000]` have matching CSS under the named color setup. [C1](#evidence-keys). |
| Theme: spacing token representation | 차이 있음 | The `p-4` and `-mt-4` values have different CSS references. Browser-computed values remain untested. [C1](#evidence-keys). |
| Theme and defaults: other tokens, other themes, and combinations | 미검증 | No fixture measures them. [C1](#evidence-keys). |
| Basic styles (Preflight) | 범위 밖 | Tailwind input contains `@tailwind utilities` only; BaroCSS has `preflight: false`. [C1](#evidence-keys). |
| Build input: one candidate supplied to Tailwind `compile().build()` and BaroCSS `generateCss()` | 확인됨 | This is the measured CSS generation route. It does not establish equivalent scanning or build integration. [C1](#evidence-keys). |
| Build input: source scanning, plugins, other directives, and integration paths | 미검증 | The harness does not use those paths. [C1](#evidence-keys). |
| Result: parsed CSS structure across the 15 inputs | 차이 있음 | Eight exact structure matches, seven structure differences, and no empty BaroCSS rule. These counts describe only this selected set. [C1](#evidence-keys). |
| Result: `hover:block` browser state | 확인됨 | On desktop, both display `inline-block` before hover and `block` during hover. In touch mode, both remain `inline-block` after a tap. [B1](#evidence-keys). |
| Result: `md:block` browser boundary | 확인됨 | At viewport widths 767, 768, and 769px, both display `none`, `block`, and `block`. The breakpoint input is `48rem` on both sides. [B1](#evidence-keys). |
| Result: `mask-linear-from-50%`, `inset-ring-2` browser state | 확인됨 | In Chromium, the named computed mask or shadow values and 100×100 PNG bytes match for each pair. [B1](#evidence-keys). |
| Result: other computed styles, pixels, and interactions | 미검증 | The browser report covers only the four states above. [B1](#evidence-keys). |
| Environment: Chromium 153.0.8010.53, initial four named states | 확인됨 | The first browser run covered four cases. Md viewport widths are recorded; the other cases use 100×100 probes. The later mask/ring recheck records Chromium 153 without a patch version. [B1](#evidence-keys). |
| Environment: Firefox, WebKit, other viewports, color modes, and themes | 미검증 | No corresponding result is recorded. [B1](#evidence-keys). |

## Next reference: Tailwind CSS 4.3.3

| Version | All axes | Status |
| --- | --- | --- |
| 4.3.3 | Utilities, variants, theme/defaults, build input, CSS/browser results, and environments | 미검증 |

Version 4.3.3 is the next comparison target in the [PM decision](https://github.com/barocss/barocss/discussions/70#discussioncomment-18561456), not a supported version claim. After Issue #67 is complete, propose the 4.3.3 fixture and browser scope for PM priority review.
