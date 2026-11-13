# D1007 — reopen a saved unconfirmed finish as a pending decision

2026-11-13 · FEATURE · P0 rows 05, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445)

- **FAIL, baseline** A native file already saved with an unconfirmed rematch opened with its R2 Fillet applied. Studio showed 624.849556 mm³ before approval.
- **PASS, fixed** Actual desktop WebGPU File Open and Project Open restored the authored name and its saved signature and showed the 630 mm³ stock. The prior automatic match was offered as a candidate. Confirmation, Undo, Redo, Save and Project Open after reload retained the exact intended states.
- **PASS** The same inputs refused an unusable dependent repair and retained the accepted document. The verified scope is an individual, signed single edge with a stored unconfirmed replacement.
- **FAIL, earlier focused regression** D1004's shared verifier also changed the Agent O19 fallback for an unrelated edit on a stale input. The agent call now explicitly retains its established rematch policy. A subsequent Studio Open still converts a stored unconfirmed finish to a pending decision.
- **PASS** Visual review, focused Model and Studio tests, both type-checks, driver syntax and diff check.
- **NOT_RUN** Shared signatures, multiple edges and varying-radius migration, a dependent finish on a linked-inset v1 recipe, production build, full suites and mobile.

Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
