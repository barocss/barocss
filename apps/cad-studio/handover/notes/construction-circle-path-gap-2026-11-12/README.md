# D804 — Cut a path-length gap in one construction circle

P1, rows 09 and 15. FEATURE. Cut circle gap uses the selected point on one identified construction circle. The gap is measured around the circumference. The remainder is one CCW open arc. The original circle has no endpoints, so its ID retires and both new ends receive fresh IDs.

| Result | Check |
| --- | --- |
| PASS | Existing Trim removes the whole isolated circle. Split leaves a closed two-arc chain of 62.8318530718 mm with zero gap. |
| PASS | The live tool refuses the centre and a gap of one full circumference. Both preview endpoints agree with independent circular coordinates on desktop. A repeated click preserves the remainder. |
| PASS | For radius 10 mm and a 4 mm request, chord readback gives a gap of 4.0000003919 mm. The retained arc measures 58.8318587573 mm, within 1e-5 mm of 20π−4. The saved open arc runs from (18.013308,29.800666) to (21.986695,29.800666) mm with IDs e7 and e6. The old e5 ID retires. |
| PASS | Exact Undo restores the original circle and Redo restores the remainder. The separate stock extrusion is valid at 50 mm³. Project Save, Close project and fresh Open restore the exact 1,087-byte document. |
| FAIL | The first Studio type check found a test-only module alias. The corrected final check passed. |
| PASS | All ten focused Studio tests, both type checks, production build, syntax, diff check, Sol High integration review and visual review pass. The D802 arc and D803 line flows pass on the same final source. The final desktop runs have zero page errors, console errors and downloads. |
| NOT_RUN | Ordinary draft gap and its Finish and Make curves behavior, per-edit Undo before Finish, full suites, mobile and other browsers. |

The geometry retains the existing join distance and rejects stored centre, radius or length drift over 1e-5 mm. [Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [#2315](https://github.com/barocss/barocss/issues/2315) remains open.
