# D367 — A robot sweep that runs out of budget is not a contact (#2229)

Status: **BOUNDED_QUALIFIED**. This is a reproduced false result, fixed at the 09→B1 boundary under the owner rule. Source commit `da54e1d41` (20 paths). [Qualification](qualification.json) (with the #2229 acceptance items met and not met), [Korean report](report.ko.md), [independent audit](review/independent-audit.md).

## Defect (reproduced)

`sweepPath` folded "sample budget spent" into its "step too small means contact" branch. So a motion that never touches reported contact, and `sweepTimed` turned it into a time of impact. Reproduced cases ([probe-before](probe-before/out.txt), [probe-before C](probe-before/out_c.txt)):

- **Graze.** The chain-2r arm with a post 1e-5 mm beyond its reach gave `toi` 0.76 s. The same result reported a least clearance of 1.21e-5 mm.
- **Long motion.** A 1e-2 mm gap over 30 turns of a continuous joint gave `toi` 144.6 s.
- **Small budget.** With a 5 mm gap and `maxSamples` from 1 to 10, contact was reported.

## Repair

- **New outcome.** Budget exhaustion is now its own inconclusive result, `exhausted` (s, values, samples; segment and t for timed sweeps), with no `contact` and no `toi`.
- **Unchanged results.** True contacts and clear results are unchanged: 1165 recorded calls across 19 test files gave identical results before and after.
- **Every consumer says "not certified".** This covers:
  - check_path (open and closed chains) and sweep_path, and their chat summaries and contract;
  - sweepClosed and the RM6 duty check (the margin is the least clearance met);
  - the rb9 captive rung;
  - Studio's Check path line and the motion toast, with no tint.
- **Budget policy.** `maxSamples` must be a whole number from 1 to 10,000,000; anything else is refused.
- **Crossing seats.** A crossing seat that runs out of budget is now exhausted, not clear.

## Retained failures

1. Independent Opus audit: CHANGES_REQUIRED (small). It found:
   - no budget policy (Infinity hung);
   - no end-to-end test of the exhausted summary;
   - a weak segment assertion;
   - low items: docs, the RM6 value 0, the crossing-cap `break`.

   All were fixed in one round. Given the owner's time concern there was no second audit; the root verified the result instead.
2. Actual run01 failed in the driver: the "Clear waypoints" locator. The graze step had already passed.
3. Run02 failed in the driver: it waited for the toast before pressing Play, but App sweeps a motion only when it plays.
4. Run03 passed.

## Verification

- **Model:** full suite 2208/2208; targeted 309/309. Types and lint PASS.
- **Studio:** robot tests 33/33. Types PASS.
- **Docs:** inventory, refusals, agent tools and check-docs PASS.
- **Actual [run-03](studio/run-03/receipt.json):** one Chrome, two contexts.
  1. The graze reads "Not certified: … at t 1.655 s (segment 2 of 2)" with no tint.
  2. The collision reads "Contact wall – b at 69.1 %" as before.
  3. Playing the saved graze motion shows the "not certified" toast, with no tint.
  4. After Save and a fresh Open, the graze reads the same.
  - Errors 0. All 290 frozen files equal the commit.

## Boundaries

- The step-branch contact keeps its absolute bound, d ≤ tol + 1e-12·rate. This is nanometre scale and pre-existing.
- The crossing-cap branch has no test that reaches it.
- In closed loops the budget is per chord; this is undocumented.
- Studio rounds a 1e-5 mm clearance to "0.00 mm".
- NOT_RUN: full Studio suite, CI, release.
