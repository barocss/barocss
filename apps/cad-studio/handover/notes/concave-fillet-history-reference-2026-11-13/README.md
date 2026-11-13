# D1003 — replace a held Fillet with a concave edge in History

2026-11-13 · SMALL · P0 rows 05, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445), checklist line 3464

- **PASS** Actual desktop WebGPU Studio opened the valid original R2 Fillet. A second file with only its upstream profile changed lost the signed edge. References showed the original and six alternatives, and the L-shaped stock remained unmodified.
- **PASS** In the Back right view, a real viewport click at [5, 5, 1.5] staged the exact inner edge `n1.side2|n1.side3`. Cancel kept the held document. Apply retained the Fillet ID and R2 and stored the selected edge's signature. Undo restored the exact held geometry and candidate names. Redo restored the confirmed result.
- **PASS** Studio Project Save wrote the exact accepted document. After reload, Project Open rebuilt the same Fillet with no pending choice. Strict native evaluation found one valid output and the R2 cylinder on the Z axis through [7, 7]. Its volume and Studio's volume matched the independent formula `525 + 3(4 − π)` mm³ within 1e-7 mm³.
- **PASS** Visual review, focused Model reference tests, Model type-check, driver syntax and diff check. GPT-6.1 Sol High reviewed the fixture and geometry. Product sources required no change.
- **NOT_RUN** A uniquely displaced non-Split finish edge on File Open, general multi-edge or variable-radius replacement, a live downstream finish on a linked-inset v1 recipe, production build, full suites and mobile.

Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
