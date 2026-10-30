# D371 independent audit (claude-opus-5-5 sub-agent, one round, 2026-10-31)

The audit was read-only, on a6a1847c3 plus the B2 diff before the audit fixes. The materials are in [../audit](../audit):
- `geo.ts`, an independent rational de Boor and quadrature oracle;
- `p1.ts`, `p1b.ts` and `p2.ts`, the probes;
- `muts.mjs` and `mmuts.mjs`, the mutation sweeps;
- the audit-time logs, `*.audit.txt`;
- the root's after-fix reruns, `*.after-fix.txt` and `muts-k2.mjs`.

**Verdict: CHANGES_REQUIRED.**

## Holds

**Geometry**
- Every sample lies on its ruling segment (≤1e-14), and the boundaries lie on the source edges (≤3e-14).
- Patches join C0 along rulings and the closed seam (≤5e-15). `checkBrep` strict passes.
- Coaxial frusta are exact to 1e-13. Equal and unequal counts, open chains in both orientations, B-splines, arcs, and 32-piece cases are all structurally exact.

**Refusals**
- Refusals are typed and tagged.

**References**
- References are strict: no edgeNamed-style fallback is reachable.
- Moved names are held "could be X" with no substitution; lost names are held "is gone" (through `verifyReferences`); deleting a used parent is refused.

**Consumers**
- The band has no mass. STL works, drawings and the BOM do not crash, flatten and library refuse it, and thickness is refused everywhere.

**Inventory**
- Order-only TypeScript union churn, plus the intended additions.

## Findings and disposition

- **F1 (KERNEL, high): fixed, re-checked by the root.**
  - Problem: a closed band twisted when the loops' seams sat at different angles. A rotated cylinder pair gave 2615.05 against 2980.38 (−12.3%), with no refusal.
  - Fix: B is seamed at the point nearest A's start, then paired by normalized length unless that point is a B joint with equal counts.
  - Root re-check (`p1.after-fix.txt`):
    - a seam at 90° is exact (1e-13), and so is the rotated kernel pipeline;
    - a seam inside a span gives 3.6e-5, because inside a patch the rulings join equal parameters, not equal angles. The user decided to record this as a limit.
- **F2 (KERNEL, medium): fixed, re-checked.** A ruling shrinking to zero between samples (a bowtie) is now refused with `[BAND_TOUCH]` at (4.926, 0, 0). An out-of-plane fold is refused with `[BAND_DEGENERATE]`.
- **F3 (medium): fixed.** An edit is now validated against the features before the band.
- **F4 (medium): fixed.** STEP now records an `omitted` note for the band sheet, and the facade `stepOf` refuses rather than drop it.
- **F5 (tests): fixed.** The root reran the sweeps against the current tests:
  - kernel: 30 killed, plus 4 new seam mutants (K1–K4) killed; M16 is equivalent;
  - model: 23/23 killed.
- **F6 (low): fixed.** Messages are in plain words, and the HUD shows the kernel's pieces and patches.
