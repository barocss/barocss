# D1008 — keep a Chamfer held until every displaced edge is confirmed

2026-11-13 · FEATURE · P0 rows 05, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445)

- **FAIL, baseline** Native File Open refused a two-edge D2 Chamfer after the upstream polygon displaced both names. The original document survived, but there was no usable recovery choice.
- **PASS, fixed** Actual desktop WebGPU Studio showed two independent reference decisions on the same held Chamfer. Confirming the first kept both cuts suppressed and retained the second choice. The partially confirmed bytes reopened at 630 mm³ with exactly one choice.
- **PASS** Confirming the last edge evaluated the full feature and produced 606.858280 mm³. Undo and Redo restored each of the zero-, one- and two-choice states. The fully confirmed native document reopened exactly. Independent equal-setback wedge areas matched within 1e-7 mm³.
- **FAIL, earlier harness** The initial oracle used a tangent-distance formula for an equal-setback chamfer. The corrected triangle formula uses the sine of the included angle.
- **PASS** Visual review, focused Model and Studio tests, Model and Studio type-check, driver syntax and diff check. GPT-6.1 Sol High reviewed the native geometry and reference ownership.
- **NOT_RUN** Varying-radius rematch, multi-edge History repick, shared signatures, duplicate-edge refusal in the browser, production build, full suites and mobile.

The new multi-edge recovery covers Chamfer edges with individual stored signatures. The final choice must pass full evaluation. Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
