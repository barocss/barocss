# Browser-risk triage for selected Tailwind CSS 4.3.3 inputs

This note prioritizes differences already present in the [347-input raw comparison](tailwind-4.1.13-4.3.3-broad-output.json). It adds no inputs and makes no compatibility-rate claim. The pinned comparison used Tailwind CSS 4.3.3 and BaroCSS source `a5c0835`, with Preflight disabled. All five browser results below are **unverified**.

| Exact input | Measured CSS difference | Potential effect to check |
| --- | --- | --- |
| `border` | Tailwind emits `border-style: var(--tw-border-style)` and `border-width: 1px`, with an initial solid style; BaroCSS emits only `border-width: 1px`. | Whether a border is painted when this is the only border utility. |
| `border-2` | Tailwind emits the same solid-style default and `border-width: 2px`; BaroCSS emits only the width. | Whether a 2px border is painted, and whether an explicit style utility still wins in combinations. |
| `outline` | Tailwind emits a solid-style default and `outline-width: 1px`; BaroCSS emits `outline-style: solid` without a width. | Whether the visible outline width agrees. |
| `outline-2` | Tailwind emits a solid-style default and `outline-width: 2px`; BaroCSS emits only the width. | Whether a 2px outline is painted, and whether an explicit style utility still wins in combinations. |
| `not-hover:block` | Both emit a `:not(:hover)` rule; Tailwind also emits an `@media not (hover: hover)` fallback. | Whether the display state agrees on a device without hover capability. |

These are declaration and conditional-rule differences, not measured browser failures. The raw record stores both exact CSS outputs and their fingerprints. A fix must preserve combinations with explicit border and outline styles, and should be checked against the pinned compiler before the raw comparison is regenerated. Browser evidence needs the exact code commit, browser version, viewport, device capabilities, theme, and computed results. The previously blocked local fixture URL and registry-dependent Playwright route are not acceptable substitutes for such evidence.
