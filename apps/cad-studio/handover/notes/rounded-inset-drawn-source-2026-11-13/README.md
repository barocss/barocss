# D916 — use a rounded rectangle drawn in Studio as an inset source

2026-11-13 · FULL · P1 rows 09 and 16 · [#2232](https://github.com/barocss/barocss/issues/2232) remains open.

Desktop Rectangle followed by four Round actions stores the lower-left arc first. It also stores point, bulge, radius, tangent and H/V data. Accept this representation when those fields agree with the exact native segments at their authored indices. The inset planner sees a temporary cyclic rotation that begins at the lower straight side. The saved source segments, outline indices and side tags retain their authored order. Other outline fields remain outside this recipe.

## Verification

- **PASS** Draw a 20 × 10 mm rectangle in Studio, round all four corners to R2 and Finish. Create the linked inset and 10 mm Extrude from that sketch. The resulting 1 mm inset keeps the four derived arcs. Editing to 2.5 mm removes them and keeps the four derived straight faces. Undo and Redo recover the exact source, constraints, IDs and native results. The native volumes were 534.2477796076936 and 1215.6637061435915 mm³. The independent expected volumes were 534.2477796076939 and 1215.6637061435918 mm³.
- **PASS** Save and fresh File Open preserve the 3277-byte sharp document. File Open refuses a conflicting stored radius and keeps the accepted document and native solid. The existing metadata-free source also passed the authoring regression.
- **PASS** 104 Model tests, 119 Studio tests, both type checks, Studio build, scoped lint, driver syntax and diff checks. An independent source audit checked cyclic order, the Round metadata contract and tolerance. Seven mutation control tests passed and detected all five stored-recipe omissions.
- **FAIL** The first observer used an ambiguous Sketch button locator. The second click at the first corner hit a dimension chip because of the view scale. The final driver scopes the Sketch action to Model commands and zooms before picking the vertices.
- **NOT_RUN** Editing the linked source dimension, more outline constraints, other traversals or planes beyond the native scope, whole suites and mobile.

[Commands and receipt hashes](qualification.json).
