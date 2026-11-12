# D800 — Verify clockwise arc extension and desktop snap reach

P1, rows 09 and 15. SMALL. Qualify the temporary guide on a clockwise 270° construction arc. Compare CSS-pixel reach at two camera zooms with desktop device scale 2. The shared test helper retains its default scale of 1.

| Result | Check |
| --- | --- |
| PASS | The actual page and WebGPU canvas report scale 2. At 5.58337 and 4.13627 CSS px/mm, the guide accepts 7 CSS px and refuses 9 CSS px. The two zooms use different world distances for the same CSS thresholds. |
| PASS | Undo and a tool change retire the armed guide. A click beyond the reach uses ordinary grid input and consumes the guide. Escape then preserves the original accepted document. |
| PASS | A radius-10 mm clockwise major arc about (30,30) mm yields the independent continuation (30−5√2, 30−5√2) mm. The stored corner is (22.9289, 22.9289) mm. The source arc and IDs are preserved. Undo and Redo restore the exact sketches. The 2 mm extrusion gives a valid native output of 91.28991042 mm³, in agreement with Studio within 1e-8 mm³. |
| PASS | File Open replaces the document while the guide is armed. The replacement reuses feature ID n0 and has no source arc or guide. A separate armed guide retires on New part. |
| PASS | The default desktop device scale 1 still passes the original D799 flow after the shared helper change. Both type checks, driver syntax and diff check pass. Visual review covers the zoomed guide. |
| FAIL | The first driver waited for a zoom increase that the wheel gesture did not produce. The final driver measures a second scale after a public wheel zoom-out and passes both reach checks. |
| NOT_RUN | Actual source geometry edit after acquisition, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. The issue stays open for the source edit check. [#2317](https://github.com/barocss/barocss/issues/2317).
