# D355 — Keep a rectangle's side ids when a sketch is reopened

Status: **BOUNDED_QUALIFIED**, the eighth bounded item of roadmap 09. The D354 audit found this as a pre-existing, reproduced correctness defect. Source commit `9c97ec8b9` (5 paths: `select.ts`, Model test, Studio hook case, driver, fixture). [Qualification](qualification.json), [Korean report](report.ko.md), [independent audit](review/independent-audit.md).

## Defect

Reopening a sketch turned its rectangle into an outline through `rectangleOutline`, which dropped the rectangle's `ids`. Finish, even with no change, then handed out fresh side ids. [probe-before/reproduction.txt](probe-before/reproduction.txt) shows the cases:

- A rectangle with a hole went from e1–e4 to e6–e9.
- With a Bézier or a construction line drawn first, ids were renamed to e1–e4.
- A rectangle drawn from its upper-right corner had its fillet silently moved to another corner, with the volume unchanged. The audit reproduced this.
- A construction rectangle lost its flag and became real geometry.

Downstream references either vanished ("The selected edge no longer exists") or silently named another wall.

## Repair

`rectangleOutline` now carries the ids side by side (via `tagsOf`, for any drawing corner) and the construction flag. No other path changed.

## Retained

- **No Studio baseline run.** A temporary revert of `select.ts` was refused by the permission classifier. The reproduction is the Model probes plus the real-hook negative control.
- **Plain case in the hook.** The plain rectangle-with-hole case did not reproduce in the Studio hook, but the Bézier-first order did, so the driver gained a third context that draws that order through the UI.

## Verification

- **Model:** 9 new tests (6 fail without the fix); affected 115/115.
- **Studio:** 1 new real-hook case (fails without the fix); 49/49.
- **Checks:** types, lint and check-docs PASS.
- **Audit:** PASS. Matrix 48/48 keep (base renamed 43); mutants 8/8 killed.
- **Actual [run-01](studio/run-01/receipt.json):** one Chrome, three contexts.
  1. On the fixture (rectangle, hole, extrude, fillet): reopen→Finish with no change keeps the side ids, the fillet and the volume.
  2. A width-70 edit keeps the side ids. Then Undo/Redo, Save, fresh Open, and reopen→Finish again keep them.
  3. Bézier first, then rectangle: e2–e5, Extrude, reopen→Finish keeps e2–e5. Unfixed code renamed these to e1–e4.
  - Errors 0; 985 frozen files equal the commit.

## Boundaries

NOT_RUN: full suites, remote CI and release. Limits:

- A construction rectangle's stored form changes once.
- Test gaps T1 and T2.
- Pre-existing side notes:
  - S1: circle/region role swap.
  - S2: slot centre drift of 3e-16.
  - S3: a parameter-bound rectangle reopened writes null coordinates. This is the next item.
