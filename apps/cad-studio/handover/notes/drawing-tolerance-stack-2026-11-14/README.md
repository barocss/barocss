# D1256 — Calculate a one-axis drawing tolerance stack

2026-11-14 · FULL · P5, row 25

In Drawing, open **Tolerance stack** below the dimensions. Select at least two independent linear dimensions from the same view and axis. Add or subtract each dimension as an explicit term. The result gives the nominal and both worst-case bounds in model millimetres. It uses raw resolved lengths and the authored numeric deviations, including when the drawing prints inches. Calculations interpret stored numbers by their canonical decimal spelling, add exact decimals, and swap each negative term's endpoints.

The calculator requires a resolved, single-size dimension with positive constituent sizes. It refuses missing or invalid tolerances, fit codes, basic dimensions, repeated terms, exact repeated authored point pairs, and non-model units in the calculation call. It never infers independence from geometry or treats a general note or geometric frame as a size tolerance. A selected term keeps both the dimension ID and its authored measurement identity. A newly authored measurement with the same ID needs an explicit selection. The stack withholds results while the model or drawing projection is out of date, or while the active model is a History prefix or a variant.

Stack terms are local to the Drawing session. They are reset when the document, sheet or drawing scope changes. Open and Save keep the original authored drawing dimensions and tolerances.

- **PASS, actual desktop Studio.** Used three selected Top-view dimensions from an Assembly sheet. The clearance was 90 − 60 − 20 = 10 mm with limits 9.77 to 10.27 mm. Changing the last term to addition gave 50 mm with limits 49.83 to 50.33 mm. The independent decimal oracle enumerated eight endpoint combinations per run. It confirmed the same clearance after Undo, an inch print-unit change, tangent-edge reprojection, and native Save and fresh File Open with the terms selected again.
- **PASS, refusal and recovery.** Studio withheld all numeric results for a duplicate term, missing tolerance, fit, removed term, and unresolved assembly occurrence. The drawing reused the removed dimension ID for a different measurement. The stack required reselection before returning any numeric result. Undo restored the old dimension and the original result after reselection.
- **PASS, focused verification.** 51 Model and 4 Studio drawing-commit tests. The model includes mixed signs, equal nominal values with distinct references, cancellation near zero, invalid units and ambiguous identities. Both package type checks, scoped lint, syntax, production build and links passed. A mutation that fails to reverse negative-term endpoints was detected. The read-only review found integration gaps around repeated IDs and stale projections. The final source uses measurement identity, current projection inputs and the current worker session.
- **NOT_RUN.** Full suites, mobile, general GD&T, statistical and coupled stacks, saving stack definitions, automated chain selection, live curve edits and worker restart in Studio, and live AI. No dedicated issue matched the title search.

D1257 extends the same calculation to the CAD agent's read-only drawing tools. List current dimension IDs, accept explicit signed terms, return the revision and numeric provenance, and qualify the result against the same Studio assembly.

[Commands and receipt hashes](qualification.json).
