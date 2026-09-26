---
"@barocss/server": patch
---

`ServerRuntime.generateCss` now prepends a `:root,:host` block defining the theme `--color-*` vars its output references, so standalone renders stay coloured after theme colours became `var(--color-*)` (#228).
