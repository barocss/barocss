---
"@barocss/kit": patch
---

`group-has-<v>:` and `peer-has-<v>:` (including `[…]` and `/name` forms) now emit Tailwind 4.1.13's selectors: `:has(*:checked)` instead of a mangled argument, `*` before the pseudo, `[sel]` as `*:is(sel)`, and hover's `@media (hover: hover)` wrap.
