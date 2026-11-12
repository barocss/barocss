# D806 — Close and extrude an ordinary circle after a gap

P1, rows 09 and 15. FEATURE. A new unbased and unlinked sketch with one independent ordinary circle can use Cut circle gap. The ordinary open arc stays in the draft. A Line chord can close it using the existing endpoint snaps and join.

| Result | Check |
| --- | --- |
| PASS | The baseline radius-10 mm circle finishes as a circle. Its 2 mm native extrusion measures 628.318530718 mm³. |
| PASS | Actual Studio cuts a 4 mm path gap in the ordinary circle. Finish refuses the open remainder and the accepted document stays empty. A Line from the right cut end to the left closes the profile. The stored loop contains one CCW arc and one line, with two side tags. |
| PASS | Undo restores the exact empty document. Redo restores the closed profile. The native 2 mm extrusion is valid and measures 627.2604861886 mm³. The independent circular-segment result is 627.2603649488 mm³. Native centroid (20.0000015, 19.9833312772, 1) mm agrees with (20, 19.9833320044, 1) mm within 5e-5 mm. |
| PASS | Actual project Save, Close project and fresh Open restore the exact 853-byte document and the solid. Final desktop runs have zero page errors, console errors and downloads. |
| PASS | Twelve focused Studio tests, both type checks, production build, driver syntax, diff check, independent Sol High oracle and source review, and visual review pass. The existing ordinary line and construction circle flows pass on the final source. |
| NOT_RUN | Ordinary open-arc gap, per-edit Undo before Finish, full suites, mobile and other browsers. |

The existing closing join assigns the final loop tags. This scope uses a new draft with no downstream references. [Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [#2315](https://github.com/barocss/barocss/issues/2315) remains open.
