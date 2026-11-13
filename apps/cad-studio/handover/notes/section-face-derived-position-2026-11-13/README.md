# D1012 — show the face-derived Section position

2026-11-13 · FEATURE · P0 rows 05, 15 and 16 · [#2446](https://github.com/barocss/barocss/issues/2446)

- **FAIL, baseline** Section from a face computed the correct Z = 6 mm plane for the second body's top face. The Section bar omitted the source face and position, and the tooltip described the plane as coincident with the face.
- **PASS, fixed** Desktop WebGPU Studio refuses a generated cap as a source. The original `n3.top` at Z = 12 mm starts halfway to the far model bound at Z = 0 mm. The bar shows `Face n3.top · Z ≤ 6 mm`. Flip shows `Z ≥ 6 mm` at the same position. The kept volumes are 7,200 and 10,400 mm³ within 1e-7 mm³. Selecting X clears the face label. The document is unchanged.
- **PASS** Visual review, 25 focused Studio tests, both type-checks, driver syntax and diff check.
- **FAIL, setup run** The driver first compared the exact axis normal with positive zero instead of negative zero. The corrected baseline reached the missing label.
- **NOT_RUN** Oblique and multiple-face positions in actual Studio, drag, Mate and Measure, production build, full suites and mobile.

The label uses the current plane, so Flip and subsequent movement have the same display source. Desktop QA remains 7/54 and #2446 stays open. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
