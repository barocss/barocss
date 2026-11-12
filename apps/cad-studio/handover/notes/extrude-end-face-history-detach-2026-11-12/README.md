# D842 — Detach a saved Extrude to face in History

P1, rows 07, 08 and 16. FEATURE for a saved D840 recipe. **Detach to Distance** reads the exact height from the current native lowering in the Studio worker. It stages a normal Distance extrusion with the same stable feature ID and sketch. The draft drops the end-face reference and its metadata. Apply uses the existing whole-document validation and history path. Reset and Close retain the saved relation.

| Result | Check |
| --- | --- |
| PASS | Desktop WebGPU moves the bound target from Z20 to Z30. The inspector reports Distance 30 mm in the detach draft. Reset restores the named end face. One Apply preserves both native bodies, their caps, eight corners per body and the 3000 mm³ extrusion volume. |
| PASS | A real Worker result resolves to 30 mm after the inspector closes. Delivering it leaves the document, bodies, selection, dirty flag and history exact. First Undo after the real Apply restores the bound relation. First Redo restores fixed Distance. |
| PASS | Moving the target to Z40 leaves the extrusion at Z30. The 813-byte project reopens after reload. A further target move to Z50 leaves the extrusion at Z30 and 3000 mm³. |
| PASS | A Model check keeps a downstream Translate on the same feature ID and verifies exact native feature equivalence at conversion. The current-distance query refuses an invalid target or a node without an active bound end. |
| PASS | Model 130/130, Studio 92/92 and the final Worker lifecycle 16/16 pass. Both type checks, scoped lint, driver syntax, production build, diff check and root visual review pass. |
| FAIL | Full App.tsx lint reports the same pre-existing unused `_k` as the clean parent. |
| NOT_RUN | Saved Distance-to-face conversion, same-ID replacement with a held creation preview, other sketch frames, independent STEP, full suites, mobile and other browsers. |

[Issue #2308](https://github.com/barocss/barocss/issues/2308) remains open. D843 qualifies one common rigid translation of the bound sketch and target. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
