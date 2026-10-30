# D349 — Keep a reopened sketch's body and node fields on Finish

Status: **BOUNDED_QUALIFIED**, the second bounded item of roadmap 09 (from D348's audit side note S1). Source commit `e8befb6cc` (4 paths: `useSketchActions.ts`, Studio hook tests, Studio driver, fixture `d349.bcad`). [Qualification](qualification.json), [Korean report](report.ko.md), [independent audit](review/independent-audit.md).

Work split: root judgment, probes and verification on Opus (this session); independent audit on an Opus sub-agent; fix, tests and driver by Sonnet sub-agents from frozen briefs. Root added one test assertion after the audit and fixed the driver's sketch-editor route after run01. Codex "Sol" models were not used.

## Baseline defect (base `94d9b1f70`)

`editSketch` reopens a stored sketch. The in-place branch of `finishSketch` then rebuilt the node from the sketch shapes and kept only `id`. As a result, an **unchanged** reopen→Finish of a sketch drawn on a body dropped `on` and the other node extras:

- [hook probe](probe-before/hook-probe-output.txt) using the actual React hook: keys `bought,held,on` were lost.
- `profileCommands.ts` offers Extrude/Revolve/Sweep **Operation** (Join to body / New body / Cut from body) only when `baseOf` finds the sketch's `on`, so that choice disappeared. The audit's P1 probe confirms this: Operation is not offered on the unfixed hook.
- Actual Studio [run-00](studio/run-00/receipt.json) on the unchanged source failed at step 02. Finish without a change left node 2 with `on` as its only differing key. Errors 0, resources closed.

## Repair

A module-level `keptFields` copies every defined `NODE_EXTRA_FIELDS` key from the stored node. It also copies the stored `on` when the placed node has none; a linked or detached sketch keeps its own placed `on`. No other path changed, and there is no Model, Kernel or schema change.

## Retained failures and corrections

1. The implementation worktree was cut from an older commit `970b39cb8`. Root compared both files against base, found only the D349 hunks, and re-applied them on `94d9b1f70`. The audit also ran the fixed hook on base sources: 4/4.
2. Audit finding: the evaluated==committed document was untested. Root added that assertion.
3. Actual run01 failed at step 07 because of the driver. A sketch consumed by an Extrude has no standalone history button. Steps 01–06 passed: unchanged Finish, the point edit, Operation join/new/cut, Cut 22125, Undo/Redo, Save and fresh Open. The driver now reopens through the consuming Extrude's editor. Its context-3 Extrude HUD step, which was recorded only and needed a consumed sketch to be selected, was replaced by reopen + Escape with no change. run02 is the clean run.

## Verification

- Studio hook tests: 2 new. On the unfixed hook, 2 pass / 2 fail. Affected 37/37: `node scripts/test.mjs sketch-edit-identity sketchIds constraints fill-pattern-candidate`. Types and eslint PASS.
- Audit: P1–P6 6/6, R1 unfixed 2/4, R2 fixed-on-base 4/4.
- Actual [run-02](studio/run-02/receipt.json): one Chrome, three sequential contexts.
  1. Unchanged reopen→Finish: deep-equal, `differingKeys` [].
  2. Point 2 X 30→35: `on`/`id`/plane/sideTags kept.
  3. Extrude HUD offers Operation join/new/cut.
  4. Cut depth 5: volume 22125.
  5. Undo, then Redo, then Save.
  6. Fresh Open, then reopen through the Extrude editor and Finish unchanged: doc equal. Save.
  7. Fresh Open, reopen, Escape: doc equal.
  - Six product reads and six independent Python Fraction oracles PASS (worst delta 1.46e-11).
  - Errors, console and watcher changes 0. All 980 frozen files equal the commit.
  - Root viewed 04/05/09.

## Boundaries

Raw logs, screenshots, HTML snapshots and bundled inspector `.mjs` files are not committed. NOT_RUN: full Kernel/Model/Studio suites, Studio Vite build (the actual run used the dev server), remote CI, perf-bench, release. Limits: one box and one face sketch in the actual flow; suppressed/held/bought are unit scope; a no-op Finish rewrites JSON key order (deep-equal); associative/detached precedence is audit-probe scope; chat `edit_feature` whole-feature replacement keeps only `id` (side note, unchanged).
