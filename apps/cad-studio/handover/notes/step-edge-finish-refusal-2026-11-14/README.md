# D1184 — Explain why a STEP edge finish was refused

2026-11-14 · FEATURE · P0 desktop QA, rows 07, 13 and 21 · [#2466](https://github.com/barocss/barocss/issues/2466), checklist lines 859–860

The historical lid edge is a sharp boundary. Its outward normals meet at about 59.04° at (45, 0, 11.5). For the reproduced failure patterns, Studio shows advice for the current edge operation in the preview. The Fillet message asks for another edge. The Chamfer message explains the unsupported face pair and gives supported examples. Kernel codes and details remain available. The kernel and its acceptance remain unchanged.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio, exact local `lid-no-gap.step`: R1/R2 Fillet suggested moving bodies apart or overlapping them. Distance 1/2 Chamfer showed a generic failure. The first post-fix driver passed the four notice checks and the volume check, then used the wrong surface classifier for the bottom blend. |
| PASS | Current desktop Studio picked the same native boundary. Both Fillet refusals and both Chamfer refusals showed actionable copy with Kernel detail collapsed. Apply stayed disabled and Cancel kept the accepted document. Root checked both screenshots. |
| PASS | A real pick on the same body's bottom edge at (45, 0, 0) accepted an R1 Fillet. Strict B-rep gave one solid, native volume 1197.8539816486257 mm³ and centroid (45.00000000000539, 5.00855758739598, 6.027045665851768). The volume and centroid agree with an independent quarter-round subtraction within 1e−7 mm³ and 1e−7 mm. Undo restored the original import and Redo restored the accepted Fillet. Root checked the applied screenshot. |
| PASS | Read-only native geometry audit, 19 focused Studio tests, Studio type check, scoped lint, browser-script syntax, frozen-source checks and production build. |
| NOT_RUN | A Studio run of the separate genuinely tangent STEP seam, further curved-face finishing capability, fresh Open of the positive control, full suites, CI and mobile. |

Keep #2466 open for the live removal and radius-mode cases. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
