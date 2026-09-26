---
"@barocss/kit": patch
---

Match Tailwind 4.3.3: `scroll-m*-px` / `scroll-p*-px` emit 1px, negative scroll-padding emits nothing, and `border-spacing-*` sets `--baro-border-spacing-x/y` (with `@property`) and composes `border-spacing` from both.
