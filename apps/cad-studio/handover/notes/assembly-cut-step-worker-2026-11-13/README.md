# D1026 — carry applied Assembly Cut inputs to STEP

2026-11-13 · FEATURE · P0 rows 05, 13, 16 and 20 · [#2448](https://github.com/barocss/barocss/issues/2448)

Studio's STEP worker omitted the saved Assembly Cut records in transit. Carry them recursively in the STEP request metadata so that the existing exporter can apply each cut in its assembly context.

- **FAIL** On the baseline, the actual STEP export after Apply still had a 12,000 mm³ plate where the expected volume was 12,000 − 80π mm³. Stock and unapplied creation draft matched.
- **PASS** Desktop Studio emitted AP214 B-rep in millimetres for stock, an unapplied creation draft, applied Ø8 and a fresh browser Project reopen. A separate process read the emitted bytes with the repository STEP reader and checked each solid against analytic dimensions and volume. Both 60 × 40 × 5 mm plates have two cap inner loops and inward R4 cylinder faces about [30, 20] only after Apply. Each then measures 11,748.672587712817 mm³ within 1e-6 mm³. The base stays at 28,800 mm³ and all three bodies pass strict B-rep checks. Undo and Redo restore the exact documents. Visual review passes.
- **PASS** 57 CAD Model tests, 15 Studio tests, both type-checks, driver syntax and diff check.
- **NOT_RUN** Third-party STEP reader, Ø12 edit draft in STEP, nested or stale targets in desktop STEP, Drawing, 3MF, production build, full suites and mobile.

Desktop QA remains 9/54 and #2448 stays open. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
