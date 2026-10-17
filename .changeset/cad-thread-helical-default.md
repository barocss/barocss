---
"@barocss/cad": minor
---

Threads are helical B-spline faces by default. `threadSolid` builds the helical form unless `form: 'faceted'`
is given. A part document's `thread` feature takes `form: 'helical' | 'faceted'`; one without a form (written
before this release) still builds faceted, so its `.facetK` face names keep resolving. Helical threads name
their faces `.thread#k`, `.end`, `.seat`, `.head`, `.hex0–5` (a nut: `.top`, `.bottom`). An M8×30 bolt's STEP is
273 kB instead of 19.4 MB, and it can be split and checked for interference.
