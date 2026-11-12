# D796 — Verify a clockwise arc midpoint after Trim

P1, rows 09 and 15. SMALL. Verify the adopted snap on an XZ plane at Y = −7 mm with the grid off. Trim the construction source and check its new midpoint in the same Studio workflow. Product source is unchanged.

| Result | Check |
| --- | --- |
| PASS | The clockwise 270° arc from (0,10) to (10,0) mm shows Middle at the independently projected point (10 + 5√2, 10 + 5√2) mm. Escape clears the cue and preserves the opened document. Re-entering the sketch starts without a cue. A new placement stores (17.0711, 17.0711) mm. |
| PASS | Trim at (2,16) mm leaves the arc from (16,18) to (10,0) mm. The crossing line is unchanged. The old location no longer shows Middle. The next rectangle stores (19.4868, 6.8377) mm from the surviving arc at (10 + 3√10, 10 − √10) mm. The first rectangle and the original profile retain their geometry and side tags. Undo and Redo restore the exact documents. |
| PASS | The 2 mm extrusion gives a valid native output of 145.87429514 mm³. The 24 native vertices match the three independent rectangle prisms on Y = −7 and Y = −9 mm within 1e-8 mm. Studio reports the same volume within 1e-8 mm³. Project Save and reload/Open retain the exact 3,056-byte document and volume. The desktop run has zero page errors, console errors and downloads. |
| PASS | Independent Sol High review of the arc, plane and volume calculations, both type checks, driver syntax, and diff check. Visual review covers the changed Middle cue and the reopened extrusion. |
| NOT_RUN | Isolated old-candidate rejection after Trim. The first rectangle has an endpoint at the previous location and competes for the cue. Ordinary closed profile and pending-arc acquisition through real pointer input, document replacement while the cue is visible, full suites, mobile and other browsers also remain untested here. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. The wider acceptance remains open. [#2387](https://github.com/barocss/barocss/issues/2387).
