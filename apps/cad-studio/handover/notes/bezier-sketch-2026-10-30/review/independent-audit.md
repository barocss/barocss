# D354 independent audit (claude-opus-5-5 sub-agent, 2026-10-30)

The audit read and probed the uncommitted D354 tree on 2cea9944b. Probes, mutants and before/after outputs are in [../audit](../audit).

**Verdict: CHANGES_REQUIRED** (two required items, several lower ones). The core claim holds.

## Holds (auditor's runs)

- **Exact evaluation.** De Casteljau and its tangent are exact against rational Bernstein for dyadic inputs (0/6400 mismatches), and within 2.27·eps·max|pole| otherwise.
- **Mapping.** `bezierCurve` maps poles bitwise like `outlineCurve` on six planes.
- **Kernel evaluation.** The kernel's evaluation of the made curve agrees within 4.98e-10 mm, which is the source's 1e-9 decimal rounding. Exponent formatting starts only at 1e21, beyond the kernel's 1e6 bound.
- **Downstream paths.** The real hook's Make curves produced a degree-3 source. profileOf, joinOpen, trim/split/extend, offset (refused), DXF (skipped), snaps and settle did not crash. Volumes were unchanged, Save/Open kept the data byte for byte, and reopen→Finish left the node identical.

## Findings and disposition

1. **Required:** a malformed stored Bézier (no poles, 2 or 5 poles, NaN) reached the sketcher and crashed snaps or Make curves. **Fixed:** `wellFormedBezier` guards reopen and every pole consumer.
2. Select or Dimension could not reach the profile past a current or trailing Bézier. **Fixed** in `startPicking`.
3. Construction mode made a Bézier a construction shape. **Fixed:** the flag is stripped.
4. Degenerate curves were accepted, and Loft admitted them. **Fixed:** `bezierError` refuses them in the tool, the panel and Make curves.
5. A Make curves failure (a pole beyond 1e6) gave no message. **Fixed:** a "Cannot make curves" toast.
6. The docs overstated behaviour. **Fixed:** linked sketches, not the editable current shape after reopen, not a trim boundary, no DXF, 1e-9 decimal form.
7. **#2051 §2 status:** the dashed polygon vs the solid curve and the curve not interpolating P1 are shown in the UI. The evaluation, tangent and coefficient evidence is in the oracle and the Model tests, not in a UI readout.
8. **Required:** 10 of 13 mutants survived. **Fixed:** the tests now kill all non-equivalent mutants (10 of 13 originals, two equivalent; 11 of 11 new).

## Side note: a pre-existing, high-impact defect, the next item (D355)

Reopen→Finish renames a rectangle's wall ids: `startPicking` → `rectangleOutline` drops `ids`. Downstream references are silently retargeted. A construction line drawn first, a hole, or a Bézier drawn first all trigger it.
