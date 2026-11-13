# D1093 — show the ellipse rim restriction before starting edge Fillet

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Use the existing edge Fillet admission result at the launcher for the selected ellipse rim. The rail, palette and launch handler share the restriction. Explicit Face and Full round searches retain their existing availability.

- **FAIL** Parent desktop Studio lists the ellipse restriction for Chamfer. Fillet omits it for the same selected rim.
- **PASS** Desktop WebGPU creates the ellipse and 10 mm Extrude and selects n1.side[e1]|n1.top by actual canvas click. Both palette rows display the existing ellipse reason. Activating either reports the reason before opening a preview or HUD. The selection and accepted document remain exact.
- **PASS** Studio type check, seven focused Model tests, scoped lint, driver syntax, diff and visual review. The new Studio focused control passes for the ellipse and explicit family members.
- **FAIL** Studio focused group has 16 passes and one inherited failure in the hidden or missing instance pick route. Rebuilding with the immutable parent test and launcher reproduces the failure (13 passes, one failure). The test reports an undefined bodies context.
- **NOT_RUN** Desktop Face and Full round controls, ellipse blend geometry, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
