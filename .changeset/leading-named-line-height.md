---
"@barocss/kit": patch
---

Fix `leading-none|tight|snug|normal|relaxed|loose` referencing an undefined `--line-height-*` variable. They now emit the Tailwind `--leading-*` theme var with a value fallback (1, 1.25, 1.375, 1.5, 1.625, 2), so they render a real line-height. Numeric/arbitrary/custom-property `leading-*` are unchanged.
