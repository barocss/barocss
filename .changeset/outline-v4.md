---
"@barocss/kit": patch
---

Outline utilities follow Tailwind 4. Width utilities (`outline`, `outline-2`, `outline-[3px]` …) set `outline-style` through a registered `--baro-outline-style` (initial `solid`). `outline-none` is `outline-style: none`. New `outline-hidden` keeps a transparent outline in forced-colors mode (the old `outline-none` behaviour). `outline-solid` is added, and `outline-<color>/<alpha>` is now supported.
