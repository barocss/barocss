---
"@barocss/kit": patch
---

Tailwind 4.1.13 parity for the last corpus misses: `@container`, `@container/<name>` and `@container-normal` utilities; `@<size>`, `@min-<size>`, `@max-<size>` container variants for every `--container-*` size (3xs…7xl) and arbitrary `@[500px]`, each with an optional `/<name>`; `sr-only`/`not-sr-only` use `clip-path`; `select-*` add `-webkit-user-select`; `justify-self-start`/`end`/`end-safe` emit `flex-start`/`flex-end`.
