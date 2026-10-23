# Kernel lane brief: K12 (2026-10-24, after R5)

## Role

This is the same role as kernel.md. You own `packages/barocss-cad/**` and commit directly on the integration branch
`review/cad-gpu-engine-2026-10-14`, in the worktree `.claude/worktrees/barocss-cad-gpu-review-efbb2c`.
- Never amend, rebase or reset there. Check `git status` before committing, and never commit files you did not change.
- The coordinator merges the other lanes into this branch.

## Read first

1. common.md.
2. `decisions.md` D196, the triage of the fuzz's 31 refusals, and the fixes that followed it.
   - D197–D205 are numbered. Later fixes are found by grepping decisions.md for "fuzz".
3. D199, the pole cap. It gives the background for case 170.
4. D212–D233, R5. They tell you where the modules are now:
   - the src folders: brep, core, document, blend, features, sketch, planar-solids and the rest;
   - the modeling closure, which stays at the root.
5. The roadmap's K12 row.

## State

- R5 is done; D233 is its last record.
- The fingerprint script is `packages/barocss-cad/scripts/r5-fingerprint.mjs` (D232). Run
  `pnpm -s build:library && node scripts/r5-fingerprint.mjs [out.jsonl] [jobs]` and compare the printed sha256.
  - It gave 855 cases at D231/D233, sha256 `ef3868df…`.
  - K12 changes behaviour on purpose. Record the new digest and the cases whose lines changed, never a silent change.
- Known pre-existing failure: most demos read `manifest.exports['.'].import`, the dev entry `./src/index.ts`, and fail
  to resolve `./types.js` (D233). Don't count it as a regression.
- The library-docs refusal table (`node apps/library-docs/scripts/refusals.mjs`) must stay current. Run it after any
  change to a bracketed refusal message or to the folder a refusal is raised from, and commit its output with the
  change.

## Queue (K12)

1. **The near-degenerate refusals:** fuzz seed 20261023, cases 25, 51, 74, 85, 110 and 119. D196's method:
   - shrink each case;
   - nudge it four ways by up to 1e-3 mm;
   - compare against the ray oracle.

   Each case ends one of two ways:
   - **a fix:** it builds, with the oracle's volume within e and the expected body count;
   - **a refusal shown correct:** it stays refused, the reason is stated and the code is typed.

   Order the cases by smallest shrunk tree first. One decision record per cause. Several cases may share one.
2. **Case 170:** a pole-safe domain map beside the closed-form sphere∩sphere.
   - An earlier attempt fixed 170 but broke seed 20261024's case 171 (D199's pole cap) on its own.
   - The map must keep 171's quadrature result (363.2931458, method quadrature) and `test/mass-pole-cap.test.mjs`.
3. **After K12, measure first:** the opening-time item on the roadmap's Later list. G11 found evaluation, not drawing,
   slow on open:
   - the 5 box frames, 25–28 s;
   - A9, 16 s;
   - the spring, 10 s;
   - the worm pair, 6–7 s.

   Profile with `evaluateCadPart(…, { profile: true })` (D228, O10) and report where the time goes per feature
   kind. Report only; the coordinator picks the work.

## Verification (tiered, owner)

- **Per fix:**
  - build:library, tsc and lint;
  - the new test for the case;
  - the tests of the module you touched;
  - the fuzz cases named above.
- **Per checkpoint (a few fixes):**
  - the kernel suite with `--test-concurrency=4` through the gate;
  - RB;
  - the fingerprint, with the changed lines listed;
  - cad-model and studio unit suites.

  No browser flow unless a studio-visible behaviour changed. The coordinator runs the window's full flow.
- Heavy runs go through barocss-lanes-guard's gate in the background. Kill only your own PIDs. Use Node 22.

## Report

To the coordinator, per checkpoint:
- the SHA;
- the cases fixed or shown correct;
- the fingerprint delta;
- the suite counts.

Use English to the coordinator. The owner reads the coordinator's Korean.

## Start here (left by the R5 session, 2026-10-24)

- R5's demo comparison is closed by D234 (`33f10d0a6`). No demo that passed before R5.4 fails after it.
- K12 was begun but nothing is committed or verified. The notes and the candidate patch are in `k12-start/`:
  - `notes.md` holds the diagnoses of 51, 74 and 85, and the candidate fix for 110's family.
  - `pole-split.patch` is `throughPole` in `addCut`, plus `test/boolean-through-pole.test.mjs`.

  Apply it with `git apply` on a scratch worktree first. Check it, then port it.
