# D347 — Admit untrimmed direct-surface Extend only within the linear tolerance

Status: **BOUNDED_QUALIFIED** for flat parallelogram (affine-in-chord) untrimmed supports, after reproduced wrong successes, one independent audit CHANGES_REQUIRED, one root-found regression and one wording failure in actual run01. Source commit `1dd5eba04` (6 paths: `direct.ts`, `curveSource.ts`, Model README, new Model test, Studio driver, fixture). [Qualification](qualification.json), [Korean report](report.ko.md), [independent audit](review/independent-audit.md).

Work split (owner instruction 2026-10-30): root judgment, review and verification on Opus (this session); independent audit on an Opus sub-agent; source, tests and driver written by Sonnet sub-agents from frozen briefs. Codex "Sol" models were not used.

## Baseline defects (pre-fix source = base `970b39cb8`)

Probes in [probe-before](probe-before/) run the unchanged public `directOps.extendSurface` on the authored oblique nonunit-domain plane `d347` (`A=[7,-11,13], U=[3,4,0], V=[0,0,2]`, u∈[2,5], v∈[-1,3]) against an exact rational oracle (stored binary64 decoded exactly, Greville poles vs affine T, derivative nets).

- Nominal reach 2.5 on all four edges already passed (position ≤ 1.04e-8 mm). The existing positive consumer was not broken for the nominal case.
- Wrong success, tiny reach: collocation is ill-conditioned (‖A⁻¹‖∞ up to 1e13). Actual dense deviation 2.7e-6 mm (1e-4), 1.5e-4 (1e-5), 2.8e-2 (1e-6), already in the unrounded fit (`pre-raw` probe).
- Wrong success, large reach: knots in [0,1] rounded to 9 decimals × total length: 2.8e-7 mm (1000), up to 5e-4 (1e5).
- Wrong success, edge strings outside the union (`'x'`, `'U-MAX'`) silently acted as v-min.
- Unreadable result: `curveSource.num()` wrote exponents (`5e-7`) the source language rejects; `extendSurface` never compiled its new source, so it returned success with the original hidden and the result unreadable/invisible.
- Uncoded errors: Infinity → DIRECT_SOURCE, fit failures → raw `RangeError`.
- The certified `buildInterpolatingSurface` path does not catch the tiny-reach case either (grid residual 1e-14, dense 3e-2; `pre-cert` probe), so switching producers alone is no repair.

## Repair

`extendSurface` now: validates edge and finite positive distance; samples exact domain ends; takes the exact outward partial (`surfaceD1Evaluator`, falling back to the exact iso-curve derivative at an across C0 knot); refuses a vanishing tangent; stores knots in mm (mean chord length per axis) so 9-decimal rounding costs ~1e-9 mm; re-reads the stored source; refuses DIRECT_VALUE when stored grid residual + a first-order conditioning bound `(κu+κv+κuκv)·γ16·M + κuκv·γ16·(M+D)` exceeds 1e-7 mm. The bound is an estimate, not a certificate (the audit found it 86–3.4e4× above actual, never below). `num()` writes plain decimals. Curved supports keep the documented global re-fit; their measured first-order off-sample deviation is appended to the result name (`(±x)`, like `refitCurve`). No Kernel, schema, dependency, WASM, tolerance or global budget change.

## Retained failures and corrections

1. Implementation round 1: 12 test failures `Parameter is outside the knot domain` (scaled 1·L above the rounded end knot) → end clamp in `gridResidual`; then 2 test-only mistakes (label, `e-` matched `degree-u`).
2. Independent Opus audit CHANGES_REQUIRED ([review](review/independent-audit.md)): 16/1312 accepted random parallelograms exceeded 1e-7 (worst 4.216e-7, offsets ≥1e5) through finite-difference tangent cancellation the grid check cannot see; curved far edge off by 7.07e-4·D; uncoded domain overshoot on ~3–4% of ordinary domains; zero tangent succeeded. All four fixed. The audit's first `para.log` was overwritten by post-fix reruns; its first-run summary is kept in the review and the 16 failures in [para-fails.json](audit/para-fails.json). The first curved run: R=10 D=100 extension 1.44 mm, R=1000 D=10 arc 0.461 mm, far edge 7.07e-4·D.
3. Round 3 first rerun: 112 uncoded `First derivative is not defined` at midpoints → guarded.
4. Root regression: that guard refused a valid C0-creased panel (u-max/u-min, previously accepted) as "no direction" ([c0.ts](verify/c0.ts)). Fixed with the exact iso-curve derivative; after: all four edges succeed (u `(±0.076)`, v `(±0.024)`).
5. Studio Vite build first attempt used a wrong binary path (rc127, nothing built); rerun with the root binary PASS.
6. Actual run01 PASS functionally, root visual FAIL on wording: refusal said "about 8.4 mm off" for a conservative bound. Reworded to "error bound about …"; run02 is the clean run. run01 kept.

## Verification

- Model affected 18 files (every test importing direct/curveSource): 196/196 PASS after the crease fix (`node scripts/test.mjs api-curve-feature-pattern api-sew api-thicken direct-display-domain direct-fill-exact direct-extend-plane direct-trim-region direct-trim-split direct-trim-guards direct-trim-reverse direct.test drawing-current-contract fit loft-guide-command quadratic-feature-pattern route-bundle-admission route-bundle skeleton-reader`); after the wording-only change, direct-extend-plane+direct-trim-guards+fit 46/46 PASS. Types and eslint PASS. New test file: 12 tests (exact plane oracle on four edges, offset 1e5 plane, odd domains, crease, quarter cylinder label factor check, audit regressions, atomic refusals, no-wrong-success property over 11 reaches).
- Audit probes after repair: random parallelograms accepts1182/refusals738/uncoded0, worst accepted deviation 5.609e-9 mm; atomic probe all coded.
- Admitted window for `d347` (observational): u reach 0.01–100 accepted, 1e-3 and ≥700 refused; v similar (the earlier observational window u 0.01–700 / v 0.005–300 predates the added grid term). Refusals at the ends are conservative by design.
- Studio types and Vite build PASS. Kernel `tool.mjs build` PASS at session start; no Kernel source changed.
- Actual Studio [run02](studio/run-02/receipt.json): one Chrome, three sequential contexts. Open authored `.barocad` → zero and 1e-6 refusals (doc/selection unchanged, coded toast) → u-max 2.5 → source hidden byte-identical, new object selected, picks inside original and extension strip hit the result → Undo/Redo → Rename/Undo/Redo → native Save/fresh Open → v-min 2.5 → Undo/Redo → Save/fresh Open. Five native reads pass the independent product-import-free Python Fraction oracle (worst position 1.47e-9 mm, Jacobian lower bounds 140/183.75 minus <1e-6). Errors/console/watch 0; 702 frozen files equal after/after-cleanup and equal commit `1dd5eba04`. Root viewed 04/08/09/10 images.

## Boundaries

Raw logs, screenshots and HTML snapshots are not committed (repository guard: numbers and commands live here). The committed folder keeps probe/driver sources, oracle inputs/outputs, native reads, receipts and saved `.bcad` files; [artifact-manifest.json](artifact-manifest.json) hashes them. Root viewed the uncommitted images during the session.


NOT_RUN: full Kernel/Model/Studio suites, remote CI, release, perf-bench (not a performance change; Extend observed ~4 ms per call). Curved supports are not exact: quarter cylinder R=1000 D=10 still moves the original region up to 0.485 mm (now labelled); exact curved extension is a separately scoped requirement. Trimmed refusal reuses D336 (Model test only here). A collapsed zero-length edge still succeeds. `surfaceIntersection` keeps its own exponent-writing `num` (side note, not changed). Stale refusal toast stays after a later success (existing UI behavior). Hashes are provenance only.
