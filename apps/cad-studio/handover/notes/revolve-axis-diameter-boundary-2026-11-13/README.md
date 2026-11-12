# D866 — Measure the Revolve axis-diameter boundary

P1, rows 07, 09 and 16. SMALL, measurement only. [#2372](https://github.com/barocss/barocss/issues/2372) proposes an explicit diameter from a sketch point to local Y. The ordinary radial edge edit and full Revolve already support the corresponding geometry. The new saved dimension requires a representation that older readers reject or interpret correctly.

| Result | Check |
| --- | --- |
| PASS | Actual Studio drew an ordinary positive meridian from X = 0 to 6.0003 mm and Y = 0 to 20 mm. Full **Revolve** around **Sketch Y** produced native radius 6.0003 mm and volume 2262.172910910576 mm³. An existing **Edge 1 length** edit to 7 mm produced 3078.7608005179964 mm³. Both match π × radius² × 20 within 1e-7 mm³. |
| PASS | Undo and Redo restored the exact documents. Project Save wrote 1,073 bytes. Fresh File Open and a second radius edit to 8 mm retained the side tags and Revolve reference. The native volume was 4021.238596594934 mm³. |
| PASS | The separate native Model probe checked five strict-valid solids. Positive and negative local X at radii 6 and 7 mm gave 720π and 980π mm³. The translated and tilted fractional profile used world axis (0, 0.8, −0.6), centroid (10, 28, 24) and radius 6.0003 mm. A meridian spanning the axis refused with `GEOMETRY`. |
| FAIL | Actual Studio opened a synthetic schema-3 rule with Ø18 intent and kept radius 7 mm. The rule survived in the accepted document. The editor kept the same six visible constraint rows and solver rank 7, and the native body was identical. A native editor has no authoring path for this synthetic rule. |
| FAIL | The Model admitted the same hypothetical meaning in schema-3 JSON, packed schema 3 and genuine PB0 packed schema 4. The schema-4 packet had two verified blobs. The admitted outline rule generated zero solver terms and the native radius stayed 6.0003 mm. |
| PASS | Model 38/38, Studio 36/36, both type checks, driver syntax and diff check. Desktop Studio recorded six snapshots and 828 frozen files through cleanup, with zero page errors, console errors, source changes or downloads. |
| NOT_RUN | New diameter authoring, desktop negative or tilted meridians, mixed-format consumer changes, production build, mobile and full suites. |

**DEFER_NEW_ADMISSION.** Current ordinary sketch rules can carry the additional bytes without enforcing the new meaning. An unrecognized top-level feature kind refused at Open. The strict `driven-sketch` v1 reader requires a named line-length binding. A new feature or a new driven-sketch version would need its own semantic and lifecycle proof. Schema 5 remains held. [#2372](https://github.com/barocss/barocss/issues/2372) remains open. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
