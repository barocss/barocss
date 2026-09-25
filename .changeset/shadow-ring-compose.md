---
"@barocss/kit": patch
---

`shadow-*` now composes with `ring-*` on the same element, as in Tailwind 4: shadow utilities set `--baro-shadow` and emit the shared composite `box-shadow` (with registered `@property` defaults for every layer), so `shadow-sm ring-1` renders both. `shadow-[#color]` now sets the shadow color instead of writing it as a box-shadow.
