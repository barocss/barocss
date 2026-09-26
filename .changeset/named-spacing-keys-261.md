---
"@barocss/kit": patch
---

Named `theme.spacing` keys (e.g. `theme.extend.spacing.gutter`) now work in spacing-scale utilities, as in Tailwind 4: `p-gutter` → `padding: var(--spacing-gutter)`, `-mt-gutter` → `calc(var(--spacing-gutter) * -1)`. Covers padding, margin, gap, inset/top/start/…, space-x/y, size/w/h/min-*/max-*, and scroll-m/scroll-p. Built-in keywords (`w-full`, `m-auto`, `*-px`) keep precedence; numeric spacing is unchanged.
