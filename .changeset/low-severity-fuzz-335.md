---
"@barocss/kit": patch
"@barocss/browser": patch
"@barocss/server": patch
---

Tidy low-severity fuzz findings (#335), matching Tailwind 4.3.3: `not-`/`group-`/`peer-`/`peer-has-` with an unknown inner variant emit nothing (known ones compound through the variant's own selector, e.g. `not-first` → `:not(:first-child)`); `placeholder:`, `selection:`, `file:` and `marker:` emit Tailwind's selectors without legacy vendor splits, and merged `@property` blocks carry each descriptor once; a selector or at-rule prelude containing `url(` is dropped; class lists split on ASCII whitespace only (a non-ASCII space is part of the class token).
