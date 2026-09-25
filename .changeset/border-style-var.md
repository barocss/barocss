---
"@barocss/kit": patch
---

Border width utilities (`border`, `border-t`, `border-2`, `border-[3px]` …) now set `border-style` through a registered `--baro-border-style` (initial `solid`), like Tailwind 4, so bare borders render without a preflight reset. `border-dashed`/`dotted`/`none` still override it.
