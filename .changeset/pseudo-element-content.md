---
"@barocss/kit": patch
---

`before:` and `after:` now create the pseudo-element, as Tailwind does: each rule gets `content: var(--baro-content)` with a registered `@property --baro-content` (initial `""`). `content-none` and `content-[…]` also set `--baro-content`, so they still win.
