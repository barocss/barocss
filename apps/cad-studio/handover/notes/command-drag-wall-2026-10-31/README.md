# D368 — A command handle drag no longer jumps on late refusals (roadmap 20 ②)

Status: **BOUNDED_QUALIFIED**. This is the user-observed "fillet arrow value jumps while dragging" (row 20 ②), reproduced and fixed at the 09→B1 boundary. Source commit `58f9e045f` (5 paths). [Qualification](qualification.json), [Korean report](report.ko.md), [independent audit](review/independent-audit.md).

## Defect (reproduced at model level)

The real `useCommandPreview` and `useCommandGizmos` hooks were driven by a fake kernel with a limit of 6.5, step 0.5 and start 3 ([probe-before](probe-before/)):

- **A. Drag +7 mm.** The value settled at 6.5, 6 and 5 at 5, 60 and 150 ms latency, not at the limit.
- **B. Out, then back to a valid 5.** The value stayed at 4: a late refusal of an abandoned value reset the current one.
- **C. Past the limit, back, then out to a valid 5.5.** At 60 ms it stayed stuck at 3, because the sign-only wall never cleared. At 150 ms it jumped to 6.5 while the pointer was at 4.

## Repair

- **Stale refusals.** A refusal resets only the values it was for. A stale refusal records a bound `bad`, the nearest refused value.
- **Clamping.** Values short of `bad` are still tried; clamping starts only at or beyond `bad`.
- **Bisect.** A bisect step converges on the limit. It continues after release, and Apply waits for it.
- **No reversals.** A stale success never moves the last good value back. A pointer held past the bound keeps the step in flight, so the value moves one way and settles.

## Retained failures and corrections

1. **Independent Opus audit: CHANGES_REQUIRED.**
   - F1, medium-high: the first fix added a back-and-forth while the pointer was held past the bound (4 ↔ 5.5 at 60 ms; 10 ↔ 6 for a rolled preview). HEAD had stayed steady. Fixed.
   - F2: the tests checked only final values. Fixed with sequence, later-validity and stale-failure tests.
   - F3: the bisect continues after release. Stated as intended.

   Fixed in one round, with no second audit (owner time concern).
2. **Actual run01**, on the first-fix source before the F1 round: A, B and C passed. D failed: while moving back from 14, the value went 7.5 → 9 → 7.5. The 9 was a probe at the pointer's own value, shown as "evaluating…" and then refused.
   - Root decision: a value can only be checked by being shown, so one evaluating probe at or below the pointer is allowed. Back-and-forth is not.
3. **Run02** failed in the driver. In B the field showed 6.5 with the pointer at 6.20: the field shows the previous move's value one frame late. The same lag is in run01's B samples.
   - The driver now compares the field with the larger of this pointer and the previous one.
   - This loosens only the "shown ≤ pointer" bound. The oscillation bound is unchanged: at most one increase while moving in, and only while evaluating.
   - Replaying the new checks on run01's samples ([replay-inward.py](audit/replay-inward.py)): B passes, and fails without the lag bound at samples 11 and 13. D passes both.
   - A browser negative control on the HEAD source is NOT_RUN. The stale-reset and back-and-forth regressions are caught by `command-drag-wall` (7/11 fail on HEAD; the F1 mutants are killed).
4. **Run03 passed.**

## Verification

- **Studio:** `command-drag-wall` 20 cases; full suite 546/546. Types PASS, lint PASS.
- **Actual [run-03](studio/run-03/receipt.json):** one Chrome, two contexts. The fixture is a box with an R8 round, so a second fillet is refused at r ≥ 8 (largest accepted 7.9).
  - A: drag out and hold settles at 7.5.
  - B: back to 4.
  - C: out to 6.5, not stuck.
  - D: fast out to 14, then back, settles at 4.
  - Apply: the document radius equals the shown 4.0; the closed-form volume oracle passes 2/2.
  - Undo/Redo, Save, fresh Open: equal.
  - Errors 0. All 674 frozen files equal the commit.

## Boundaries

- One evaluating probe can show a value that is then refused.
- A limit that rises during the same drag is followed only through an in-flight success.
- The edit-fillet handle has no `max`.
- An off-grid start value snaps on the first move.
- Other handle commands are covered by unit tests only.
- NOT_RUN: model suites (no model change), CI, release.
