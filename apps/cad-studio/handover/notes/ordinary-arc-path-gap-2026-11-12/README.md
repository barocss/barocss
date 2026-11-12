# D807 — Cut a path-length gap in an ordinary arc

P1, rows 09 and 15. FEATURE. A single, unconstrained ordinary open arc in a new, independent sketch can use Cut arc gap. The existing split preserves the outer ends, assigns two cut ends and keeps both paths ordinary. The existing Finish refusal preserves the draft. Make curves saves both paths as separate native curves.

| Result | Check |
| --- | --- |
| FAIL | The first baseline reader asked for a second derivative at the exact interior knot of a rational semicircle. The native continuity guard refused the request. The reader now evaluates points and measures radius against the independent known center. The unmodified product then passed the baseline. |
| PASS | Baseline Studio offers no gap action for the ordinary arc. Finish preserves the open draft and the accepted empty document. Make curves returns one native radius-10 mm semicircle. |
| PASS | Actual Studio cuts a requested 4 mm at the top of the semicircle. Finish refuses the open result. The accepted document stays empty. Make curves returns two ordinary native curves. Their lengths are 13.7079620128 mm and 13.7079645052 mm. Both agree with 5π−2 mm within 1e-5 mm. Seventeen native parameter samples per arc put the radii within 2e-5 mm of 10 mm. The cut ends give a removed path length of 4.0000003919 mm. |
| PASS | Undo restores the exact empty document. Redo restores both arcs. Actual Save, Close project and fresh Open restore the exact 883-byte document and both visible arcs. |
| PASS | Thirteen focused tests, both type checks, the production build, syntax, diff check, independent Sol High source review, and visual review. The ordinary line and ordinary circle desktop flows pass on the final source. The final browser runs have zero page errors, console errors and downloads. |
| NOT_RUN | Gap placement on a rotated plane, neighbor reference retention, per-edit Undo before Finish, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). The first single-source line, arc and circle cases now have construction and ordinary Studio evidence. [#2315](https://github.com/barocss/barocss/issues/2315) remains open for the recorded validation gaps. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
