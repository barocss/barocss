# D883 — Snap to a native box after a Z quarter-turn

P1, rows 09, 10 and 16. FEATURE qualification for [#2333](https://github.com/barocss/barocss/issues/2333).

The D882 native box check now accepts exact authored multiples of 90° about Z within the kernel angle range. X and Y rotation must be zero. The existing placement matrix maps the authored bounds and face names to world stations. The existing native edge, visibility and source ownership checks then qualify the accepted world-space mesh.

The desktop fixture used the local edge (0, 0, 0) to (10, 0, 0) mm. A +90° Z rotation followed by translation (20.25, 30.5, 0) mm gives XY endpoints (20.25, 30.5) and (20.25, 40.5) mm and midpoint (20.25, 35.5) mm. An unrotated sibling shared the definition.

| Result | Check |
| --- | --- |
| FAIL | D882 product baseline. The independent native edge and displayed bounds were correct. The rotated End and Middle cues were absent. The midpoint click used (20, 36) mm. Rectangle used the grid corner (20, 31) mm and the sibling midpoint (60.75, 54.25) mm. The 2 mm Extrude produced 1,894.875 mm³. |
| PASS | Actual desktop Studio WebGPU. Both rotated endpoints and the rotated midpoint showed their respective cue within 0.02 CSS px of the independently projected point. Clicking the midpoint put (20.25, 35.5) mm into the draft. Cancel retained the original document. |
| PASS | The rotated endpoint (20.25, 30.5) and unrotated sibling midpoint (60.75, 54.25) mm became the finished Rectangle corners. Native Extrude produced 1,923.75 mm³ and all eight expected corners within 1e-8. Both placed sources and the existing root solid stayed exact. Undo/Redo and a 3,152-byte browser project Save and fresh Open retained the result. |
| PASS | The complete D882 translated desktop flow passed again. Focused actual evaluation verifies +90°, −90° and 180° packets. It refuses 89.999°, X/Y rotations and a wrong packet with coincident world bounds. Independent source review, focused tests, type checks, build, scoped lint, syntax and diff check passed. |
| NOT_RUN | Additional angles in desktop, new source revision, full occurrence lifecycle, other source shapes, full suites and mobile. |

[#2333](https://github.com/barocss/barocss/issues/2333) remains open. D884 will use Studio's New revision workflow to check a source change under the same occurrence and body keys, with a held placed Worker reply. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
