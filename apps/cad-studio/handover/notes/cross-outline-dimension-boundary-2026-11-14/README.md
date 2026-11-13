# D1097 — explain the cross-outline point selection limit

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Treat a closed inactive outline vertex as a distinct viewport hit when the active sketch pick misses. Select and Dimension leave the current outline and first point in place and show the applicable limit. The existing Active outline control can switch the reopened editor. A normal canvas pick clears this guidance without clearing unrelated solver messages.

- **FAIL** Parent desktop Studio gives no guidance when the second point of a new sketch belongs to a separate outline.
- **PASS** Desktop WebGPU highlights the inactive vertex and shows the distance constraint limit for a new two-rectangle sketch, then in both orders after fresh native Open. The first point and current outline stay active. The next valid point opens the same-outline 15 mm editor and clears the guidance. Shift Select shows the selection limit and retains the first point. Finish retains the exact accepted document.
- **PASS** Studio type check, 35 focused tests, scoped lint, driver syntax, diff and visual review. Independent source review caught a potential history regression from auto-activating an outline; the delivered path leaves outline activation to the existing control.
- **NOT_RUN** Coincident or near-overlapping targets where existing active geometry captures the hit, additional outline types and viewports, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
