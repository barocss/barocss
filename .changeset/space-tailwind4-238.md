---
"@barocss/kit": patch
---

`space-x-*` / `space-y-*` (including `-space-*`, `space-*-px`, arbitrary, `(--var)` and `space-*-reverse`) now emit Tailwind 4's form: `:where(& > :not(:last-child))` with the margin on the **end** of every non-last child, plus a registered `@property --baro-space-{x,y}-reverse` (initial 0). Behaviour change from the v3 form (`> :not([hidden]) ~ :not([hidden])`, margin on the **start** of later siblings): hidden children are no longer skipped, and the gap now sits at the end of preceding children rather than the top/start of following ones.
