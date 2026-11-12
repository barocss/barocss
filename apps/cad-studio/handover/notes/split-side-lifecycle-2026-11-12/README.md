# D788 — Preserve the authored Split side through Move and project Open

P1, rows 08, 12 and 16. SMALL qualification of an existing path. The driver opens the 60 × 30 × 10 mm stock from the tracked linear cut fixture, selects it in the desktop viewport and authors Split X24. It picks the positive solid by position and authors a +40 mm Y Move. D468 covers Move on an unsplit prism. D720 covers temporary Section.

| Result | Check |
| --- | --- |
| PASS | The two public Split outputs are `n2/0` and `n2/1`. Move consumes only the positive side. The resulting keys are `b2_negative` and `b3`. Editing X24 → X30 preserves the exact authored Move parent and the two active outputs. |
| PASS | The X60 tangent edit is refused at Split `n2` with `SELECTION`. The accepted document, bodies and history stay fixed. First Undo restores X24. First Redo restores X30. Project Save writes 1,075 bytes. After reload, Open restores the exact document and a further edit to X36 succeeds. |
| PASS | Seven independent checks compare the vertices, six oriented planes, closed strict B-reps, volume and centroid with two analytic boxes. Studio volumes and centroids match at an absolute tolerance of 1e-8. The negative/moved-positive volumes are 7,200/10,800 mm³ at X24, 9,000/9,000 mm³ at X30 and 10,800/7,200 mm³ at X36. A separate Sol High source probe verifies the cap loop areas and side mapping for this geometry. |
| PASS | Driver syntax, Model type check, 25/25 focused Model tests and diff check. Desktop visual review covers tangent refusal, project Open and the post-Open edit. Zero browser errors and downloads on the passing run. |
| FAIL | The first desktop driver omitted the body pick before Split. Studio reported that one selected body is required. The corrected driver selects the stock through the viewport. |
| NOT_RUN | Full suites, mobile, other browsers, oblique or curved geometry, additional splits and general reference evolution. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. The core parametric features epic remains open. [#534](https://github.com/barocss/barocss/issues/534).
