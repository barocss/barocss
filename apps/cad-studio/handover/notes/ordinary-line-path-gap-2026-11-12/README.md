# D805 — Keep an ordinary line gap through Finish and Make curves

P1, rows 09 and 15. FEATURE. A new unlinked sketch with one independent ordinary open line can use Cut line gap. The two fragments retain their ordinary role. Finish keeps the draft open and explains the open chain. Make curves explicitly creates the two direct curves.

| Result | Check |
| --- | --- |
| PASS | The existing Finish refuses the original ordinary 30 mm line and leaves the accepted document empty. Make curves produces one native 30 mm curve. |
| PASS | The desktop cuts a 4 mm gap in a new ordinary line. Finish shows the open-chain refusal and preserves the two visible segments and the accepted document. Make curves produces two native curves with lengths 13.0000014 mm and 12.9999986 mm. Their endpoint separation is 4 mm within 1e-5 mm. |
| PASS | The first native curve runs from (20,20,0) to (30.400001,27.800001,0) mm. The second runs from (33.600001,30.200001,0) to (44,38,0) mm. Undo returns the exact empty document and Redo returns both curves. Project Save, Close project and fresh Open restore the 856-byte document. Both curves are visible after Open. |
| PASS | All eleven focused Studio tests, both type checks, production build, driver syntax, source review, diff check and visual review pass. Existing construction circle, line and arc desktop flows pass on the same final source. Final runs have zero page errors, console errors and downloads. |
| NOT_RUN | Ordinary circular or arc gap, a repaired closed profile after a gap, per-edit Undo before Finish, full suites, mobile and other browsers. |

The ordinary input is one straight open polygon in a new unbased, unlinked draft. Identifiers are assigned using the existing sketch convention. The existing Finish, Make curves and file schema remain authoritative. [Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [#2315](https://github.com/barocss/barocss/issues/2315) remains open.
