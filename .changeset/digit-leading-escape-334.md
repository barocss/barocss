---
"@barocss/kit": patch
---

Escape class names starting with a digit, fixing `2xl:` variants: `2xl:p-4` now emits `.\32 xl\:p-4` (as Tailwind 4.3.3 does) instead of the invalid `.2xl\:p-4` that browsers dropped.
