---
"@barocss/kit": patch
---

Register the mask gradient `@property` vars (`--baro-mask-linear/radial/conic`, positions and colours) like Tailwind 4.1.13, so `mask-linear-from-*` composes a valid `mask-image` without inline fallbacks. The internal mask variables are renamed from `--tw-mask-*` to `--baro-mask-*`; use `cssVarPrefix: 'tw'` next to a Tailwind build.
