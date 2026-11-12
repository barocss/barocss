# D831 — Validate separate-body linear pattern inputs before copying

P1, rows 08 and 16. FEATURE. The Separate bodies command checks for a whole-number Count from 2 to 24, including the original, and finite nonzero Spacing. The fields and count handle share the count limits. The Spacing field admits signed distances in this mode. The One body command still passes its inputs to the existing native evaluator.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio committed Count 2.5 as three bodies with X offsets 0, 14 and 28 mm. Spacing 0 committed two coincident bodies. Their native corners, centroids and volumes confirmed both defects. |
| PASS | Current desktop Studio refuses Count 2.5, 1 and 25, and Spacing 0. Apply and Enter cannot commit. Each refusal retains the exact accepted document, body, selection, dirty state and history. The preview color is cleared. |
| PASS | First Undo after Cancel restores the 192 mm³ source. First Redo restores 216 mm³. Count 2 and Spacing −16 mm then produce b1 and b4 at (52, 13, 4.5) and (36, 13, 4.5) mm, with eight native corners and 216 mm³ per body. First Undo and Redo round-trip the exact accepted documents. |
| PASS | The existing Z separate circular pattern passes in actual Studio. Focused Model and Studio tests, types, lint, driver syntax, build, diff check and root visual review pass. |
| FAIL | The first baseline driver compared a native feature ID with a Studio body key. Two later driver attempts compared transient command status or preview color with accepted data. The corrected driver records those fields at the appropriate boundary. |
| NOT_RUN | Actual Count 24 geometry, project Save/fresh Open, other axes, full suites, mobile and other browsers. The Model check verifies 24 authored outputs at the upper count bound. |

Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [#2386](https://github.com/barocss/barocss/issues/2386) remains open for persisted total span. Next D832 checks whether editing One body silently rounds a fractional Count. [Commands and receipt digests](qualification.json).
