# D790 — Preserve a Shell's generated Split cap on edit and File Open

P0, rows 08, 12 and 16. SMALL fix to Model reference ownership. The driver opens 60 × 30 × 10 mm stock. It authors a Split with an explicit +X normal, hides the positive body and picks the exposed cap in the desktop viewport. Shell uses a 2 mm wall. The linear-cut fixture supplies stock only.

| Result | Check |
| --- | --- |
| FAIL | With the plane normal reversed, the native Shell rejected the missing `n2.cut.side1` at `n3`. Standalone Studio File Open replaced the missing cap with the same-facing original wall `n1.side1` at X60 and built the Shell there. The Sol High source probe reproduced the same substitution through the chat edit path. |
| PASS | Model keeps the exact generated Split face name for an eligible feature reference. The chat edit refuses if the name disappears from the parent body. Standalone File Open retains the stored reference and marks its Shell held. Both unmodified Split solids are displayed at 9,000 mm³, with X centroids 15 and 45 mm and the stable passthrough body keys. |
| PASS | Public Split X24 → X30 retains the authored cap. Native strict B-rep and Studio volume and centroid match independent outer-box and cavity arithmetic at 1e-8. Shell volumes are 3,768 and 4,632 mm³. The reversed live edit retains the exact accepted document, geometry and history. First Undo/Redo retain the expected X24 and X30 states. |
| PASS | Project Save and cold Open recover the exact accepted X30 document from 1,452 bytes and the same native cap. The separately prepared reversed file verifies the missing-cap case through File Open. Visual review covers the live refusal, accepted Project Open and held standalone file. |
| PASS | Driver syntax, Model and Studio type checks, 65/65 focused Model tests, direct chat edit and File Open regression, and diff check. Zero browser errors and downloads in the passing run. |
| FAIL | The first driver read the strict topology report's wrong field. The first fixed run expected a suppressed feature's stable body key to disappear. The final driver checks `valid`, the authored passthrough output and its independent physical measurements. |
| NOT_RUN | Full suites, mobile, other browsers, ambiguous native cap descendants, general topology evolution and repair of already-confirmed legacy substitutions. |

[Commands and receipt digests](qualification.json). D791 checks the separately reproduced two-descendant Split cap. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. Both native reference and topology issues retain broader scope. [#1659](https://github.com/barocss/barocss/issues/1659), [#1658](https://github.com/barocss/barocss/issues/1658).
