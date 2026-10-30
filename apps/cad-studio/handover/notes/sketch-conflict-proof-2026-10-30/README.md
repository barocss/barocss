# D350 — Prove rectilinear sketch conflicts exactly

Status: **BOUNDED_QUALIFIED**, the third bounded item of roadmap 09 (conflict versus nonconvergence diagnostics). Source commit `b3157a614` (7 paths: new `sketch/conflict.ts`, `profile.ts`, Model tests, Studio driver, fixture `d350.bcad`, two docs pages). [Qualification](qualification.json), [Korean report](report.ko.md), [independent audit](review/independent-audit.md).

Work split: root judgment, probes and verification on Opus (this session); independent audit on an Opus sub-agent; proof, tests, docs, audit follow-ups and driver by Sonnet sub-agents from frozen briefs. Root fixed the driver oracle's threshold and re-ran the audit mutants. Codex "Sol" models were not used.

## Baseline (base `fbbe7e671`)

DOF and redundancy were already distinguished (`Under-defined · n DOF`, `… already implied … would over-define`). Every contradiction, provable or not, was reported with the kernel's nonconvergence text: "Bounded local solve did not meet fixed residual tolerances; this is not an inconsistency proof". The Studio docs, however, promised "One that contradicts them is refused as a conflict". [probe-before/conflict.ts](probe-before/conflict.ts) shows four provable cases (rectangle 60/50; an L with 60 against 40+30; dx 60 against a length of 50; a length of 30 against dy 20) and a non-rectilinear triangle 10/10/30. Actual Studio [run-00](studio/run-00/receipt.json) showed the same nonconvergence text for Edge 3 = 50 against 60 (errors 0, resources closed).

## Repair

The proof runs only after the kernel's NONCONVERGENCE. `rectilinearConflict` admits a class:

- straight edges only, no circles;
- lengths only on H/V-locked edges;
- rules only `fix`, `dx` or `dy`, with canonical integer indices.

Within the class, each axis becomes difference constraints for every sign choice of the absolute values. These cover the point-1 anchor, the H/V equalities, fixed points, lengths and dx/dy. Every equation is relaxed to ±4×1e-7. Per equation, the kernel's acceptance stays within 1e-7 for the anchor, fixes and H/V; within 1e-7 plus about 1e-11 for lengths; and within about 3e-7 for dx/dy. The relaxed region therefore contains everything the kernel could accept.

The search uses Bellman–Ford over exact BigInt dyadic weights and prunes on partial infeasibility, with a cap of 4096 feasibility checks. A conflict is proven only when no sign choice on some axis is feasible. The reason then reads "Conflict: no shape meets all of these constraints (proven for horizontal and vertical edges, their lengths, axis distances and fixed points)". Otherwise the nonconvergence message is unchanged. The docs state the class, the band and the budget. There is no Kernel, schema or UI code change.

## Retained failures and corrections

1. The first implementation was cut from an older base. Its files matched base, so nothing was copied. Root then compared the ported files.
2. The driver oracle's feasibility threshold was wrong: 2·TOL instead of 4·TOL for the rectangle's four-equation cycle. Root fixed it before run00; the verdicts for the probed cases were unchanged.
3. The independent audit returned CHANGES_REQUIRED for docs and tests only.
   - It found no false proof: 0 in 18,000 cases compared with an independent oracle, and 0 in 3,600 kernel-property cases.
   - The docs overclaimed: a contradiction inside the band, a sketch with another rule, and an exhausted budget all fall back to the nonconvergence message.
   - The exactness test was non-discriminating (the float32 mutant survived), and there was no anchor-only test (the no-anchor mutant survived).
   - Direct callers could use malformed indices.
   - All of these were fixed. Root re-ran mutants m2 and m7 against the new tests: both are now caught ([output](audit/mutant-check-after-followup.txt)).
4. Run01 passed on the pre-follow-up source. Because `conflict.ts` then changed, run02 is the qualifying run.

## Verification

- **Model:** the new test file has 15 tests (the first version's negative control was 7 pass / 5 fail without the wiring). Affected `node scripts/test.mjs sketch- editFields engine fit`: 102/102. Types and eslint PASS.
- **Studio:** `node scripts/test.mjs constraints sketchIds sketch-edit-identity`: 32/32, with no expectation changed. Types PASS.
- **Actual [run-02](studio/run-02/receipt.json):** one Chrome, two contexts.
  1. Edge 3 = 50 against 60 gives **Conflict**, with the shape and document unchanged.
  2. Edge 3 = 60 gives "already implied".
  3. Edge 2 = 40 is accepted (volume 18000 → 24000).
  4. Edge 3 = 45 gives **Conflict**.
  5. The triangle's Edge 3 = 30 keeps the nonconvergence text, with no Conflict claim.
  6. Undo/Redo, then Save.
  7. After a fresh Open, Edge 3 = 50 gives **Conflict**.
  - Three product reads and three independent Python Fraction oracles passed.
  - Errors, console errors and watcher changes were 0; 761 frozen files equal the commit.
  - Root viewed run01's 02 and 06 images. Run02's receipts carry the same texts.

## Boundaries

Raw logs, screenshots, HTML and bundles are not committed. NOT_RUN: full suites, docs site build, remote CI, perf-bench and release. Limits:

- The proof covers rectilinear sketches only; contradictions within the band and exhausted budgets are not proven.
- The worst budget case is about 0.6 s, synchronous, at n=62.
- The panel shows the reason without the dimension label (existing behaviour).
- `solveOutline` still throws on a fractional dx point (pre-existing, unreachable from the UI).
- A reopened standalone sketch far from the bodies is framed off-screen (existing framing; side note).
