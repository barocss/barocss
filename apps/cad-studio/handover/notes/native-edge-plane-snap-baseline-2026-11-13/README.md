# D863 — Measure straight edge crossing snaps in current Studio

P1, rows 09, 15 and 16. SMALL evidence slice for [#2319](https://github.com/barocss/barocss/issues/2319). The new input is a proposed snap point. The current product still provides model endpoints and midpoints for in-plane edges.

The fixture uses the native edge `n1.side0|n1.side3` from (4.234567, 6.345678, 0) to (4.234567, 6.345678, 10) mm. The independent line equation gives t = 0.3 at Z = 3 mm and the point (4.234567, 6.345678, 3). The line poles, the two native vertices and both unmerged display endpoints match exactly at tessellation qualities 4, 8 and 12. Each quality supplies 12 existing snap candidates at Z = 0 and 10 and zero at Z = 3 and 11 mm.

| Result | Check |
| --- | --- |
| PASS | The baseline driver reproduced the missing crossing cue in actual desktop Studio at Z = 3. The pointer at the oracle projection authored (4, 6) on the 1 mm grid, 0.4177498739353494 mm from the intersection. The independent 2 mm extrusion from the measured rectangle had volume 24.000000000000004 mm³ and eight verified vertices. The source stayed unchanged. Undo restored the exact documents. |
| PASS | At Z = 0, the existing **End** cue authored (4.2346, 6.3457), the current four-decimal placement. At Z = 11, the line extension gave no cue. Cancel restored the unchanged source. |
| PASS | Model 15/15, Studio 6/6, driver syntax and diff check. Desktop WebGPU recorded six snapshots and 823 frozen files through cleanup. It recorded zero page errors, console errors, source changes or downloads. |
| FAIL | Current Studio does not supply the proposed interior crossing at the measured point. |
| NOT_RUN | New crossing implementation, tilted desktop input, isolate and replacement ownership, Save/Open, type checks, production build, mobile and full suites. |

For the next slice, certify the native clamped line and its matching vertices before tessellation. Require a current visible root mesh and signed interior crossing with an independent residual check. The Studio can draw an accepted source body translucent during sketching. Source ownership must distinguish it from a reference body or substituted preview. For the endpoint case, the current control gets its cue from the cap's in-plane edges. The crossing edge alone has no existing endpoint cue when its other endpoint is off the plane.

[#2319](https://github.com/barocss/barocss/issues/2319) remains open. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
