# D887 — Verify an oblique midpoint sketch in desktop Studio

P1, rows 09, 15 and 16. SMALL qualification for [#2371](https://github.com/barocss/barocss/issues/2371). The existing D862 product path passes this oblique consumer. This decision adds an actual desktop regression.

The 20 × 5 × 5 mm native stock used normal (0, 0.6, 0.8). Its supports had signed stations 5 and 10 mm. The midpoint frame used origin (0, 4.5, 6) mm, X (1, 0, 0) and Y (0, 0.8, −0.6). Independent corner calculations used these authored axes.

| Result | Check |
| --- | --- |
| PASS | Physical Top and Bottom picks at different interior cap locations and in both orders returned the same origin and positive normal. The independently evaluated source was 500 mm³ and the midpoint was 2.5 mm from each cap. |
| PASS | A native fractional stock with start 2.0002 mm and height 8.0004 mm used the same oblique direction. Its binary64 supports failed the exact-parallel rule. Studio refused the pair and retained the document, selection, bodies and history. |
| PASS | Studio stored an independent Rectangle at local (24, 1) and (30, 5) mm. A +3 mm Extrude produced 72.00000000000001 mm³ between stations 7.5 and 10.5 mm. The eight native corners matched the independent calculation within 1e-9 mm. Original stock geometry stayed exact. |
| PASS | Undo/Redo and 1,401-byte project Save and fresh File Open retained the sketch frame, native stock and separate solid. The D862 axial desktop regression also passed, including its separate extrusion, source movement and reopened width edit. |
| PASS | Independent geometry review, 98 focused Model tests, 38 focused Studio tests, driver syntax and diff check. The oblique and axial desktop runs recorded 7 and 16 states respectively. |
| NOT_RUN | Faceted and mixed/three-pick desktop admission, tessellation-quality sweep, build, full suites and mobile. |

[#2371](https://github.com/barocss/barocss/issues/2371) stays open. D888 will check the current native admission boundary with real faceted and mixed selections. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
