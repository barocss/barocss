---
"@barocss/kit": patch
---

`supports-[…]` decodes `_` to a space and `\_` to a literal underscore, as Tailwind 4.3.3 does, so compound and / or / not conditions produce a valid `@supports` prelude.
