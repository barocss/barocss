# D1010 — use the original face for settled Section picks

2026-11-13 · FEATURE · P0 rows 05, 15, 16 and 21 · [#2446](https://github.com/barocss/barocss/issues/2446)

- **FAIL, baseline** Right-click on a generated X Section cap selected the original model's body 0 and opened its face context menu. The only visible section body belonged to original body 1.
- **PASS, fixed** Actual desktop WebGPU Studio treats the generated cap as a view surface. Its context menu has no Hole, Hide or Measure action. A regular click does not select a model face. Left and right clicks on the retained original top face select the same native face on body 1.
- **PASS** Hide targets only body `b3`. Undo restores the document. Hole from the retained face writes the original `n3.top` and parent 3, centres the 4 mm bore at [38, 40] mm, and preserves body `b1`. Studio volumes match 4,800 mm³ and 9,600 − 48π mm³ within 1e-7 mm³.
- **PASS** Visual review, 25 focused Studio tests, Model and Studio type-check, driver syntax and diff check.
- **FAIL, earlier implementation** The first source run omitted the Section pick resolver from the hook call. The final run wires the resolver and reports zero page or console errors.
- **NOT_RUN** Mate and Measure interaction, Section from a face plane position, hidden-body section sketch and copy notice, drag and GPU fallback transitions, WebGL2, production build, full suites and mobile.

The qualified path requires settled exact Section geometry and a unique original face name on the original body. When exact provenance is unavailable, a base-body Section click cannot start a geometry action. Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
