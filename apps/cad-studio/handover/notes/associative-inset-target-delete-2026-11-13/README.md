# D869 — Protect the separate target of a linked inset

P0, rows 07, 09 and 16. SMALL repair of the D867 target deletion. The linked inset has native source `n3.top` and separate `on` target `n1`. The Model now refuses a delete whose removal set contains the explicit target of a surviving linked sketch. This check runs before index remapping.

| Result | Check |
| --- | --- |
| FAIL | Actual Studio on the parent deleted target `n1` from History. The original target index then named `n3`. The surviving sketch adopted that body as its explicit target while its native ring still evaluated at 1,280 mm³. The delete had no confirmation. |
| PASS | After the repair, History Delete identified the surviving linked sketch and refused. The accepted document, both reference identities, body results, selection, dirty state and history stayed equal. |
| PASS | An explicit delete of the independent Extrude removed its private linked sketch. A later separate delete of the former target succeeded. The remaining `b3` volume was 11520.000000000005 mm³. Two Undo and two Redo steps restored the exact documents. |
| PASS | Model direct and batch delete refuse immutably. An explicit batch with the linked consumer succeeds. Unrelated deletion and accepted reorder preserve both stable identities. Reorder across either input still refuses. The existing geometry-source and cascade semantics stay on their ordinary paths. |
| PASS | Model 23/23, Studio 46/46, both type checks, scoped lint, driver syntax and diff check. The baseline and fixed desktop runs recorded 355 frozen files through cleanup and zero page errors, console errors, source changes or downloads. |
| NOT_RUN | Explicit source replacement, Save/Open of a later user edit, production build, mobile and full suites. |

[#2324](https://github.com/barocss/barocss/issues/2324) remains open for the explicit source replacement. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
