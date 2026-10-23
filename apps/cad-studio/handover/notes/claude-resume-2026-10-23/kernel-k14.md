# Kernel lane brief: K14, a fresh fuzz round (2026-10-24, after K13)

## Role

The role is the same as kernel.md, kernel-k12.md and kernel-k13.md. You own `packages/barocss-cad/**` and commit
directly on the integration branch `review/cad-gpu-engine-2026-10-14`, in the worktree
`.claude/worktrees/barocss-cad-gpu-review-efbb2c`.
- Never amend, rebase or reset there.
- Check `git status` before committing, and never commit files you didn't change.

## Read first

1. common.md.
2. decisions.md:
   - D196, the triage method;
   - D235–D239, K12, including D239's open nudge findings;
   - D242–D244, K13's speed work.
3. `packages/barocss-cad/scripts/rb/fuzz.mjs`'s header: the L4 fuzz, seeded CSG trees against the ray oracle.
4. The roadmap's K14 row.

## State

- The fingerprint is `b6e18fab` (scripts/r5-fingerprint.mjs, 855 cases).
- The kernel suite is 1656/1663, with only the native-split demo's Node-version assertion failing.
- Test names are saved per checkpoint. Diff them every time.
- The fuzz's seeds 20261023 and 20261024 are triaged. Every queued case is built or shown correct, apart from:
  - D239's nudge findings, still open: 51, 85, 74, 25, 110 and 110's quadrature giving up;
  - s2#112, still refused at its root ("an arc does not lie in its plane").

## Queue (K14)

1. **Measure where robustness stands now.**
   - Run the fuzz at two fresh seeds, 20261025 and 20261026, at 200 cases each, through the gate in the background.
   - Report per seed:
     - the OK, KNOWN, REFUSED (by code), WRONG, INVALID, CRASH and TIMEOUT counts;
     - the same for 20261023 and 20261024 rerun at today's tip.
   - A **WRONG, INVALID or CRASH is the top priority:** shrink it, fix it, and add it to the corpus with `--save`.
2. **Triage the new refusals by D196's method:** shrink each case, nudge it four ways by up to 1e-3 mm, and check
   against the oracle. Then sort each into one of three classes:
   - an exact contact, which is a correct refusal;
   - a near-degenerate case;
   - a robust refusal of a valid generic input, which is a kernel weakness.

   Record the table as one decision.
3. **Fix the robust refusals first,** smallest shrunk tree first, then the near-degenerate ones. Keep one decision
   record per cause.
4. **Then D239's open nudge findings and s2#112,** if the fixes above haven't already closed them.
5. **Stop** when every new robust refusal is built or explained, or after about 8 fixes. Then report.

## Verification (tiered)

- **Per fix:**
  - build:library, type-check and lint;
  - the case's new test;
  - the touched modules' tests;
  - the fuzz cases involved.
- **Per checkpoint (a few fixes):**
  - the kernel suite at concurrency 4 through the gate, with the name diff;
  - RB;
  - the fingerprint, listing the cases whose lines changed (refused → valid is expected);
  - the cad-model and studio unit suites.

  No browser flow unless something studio-visible changes.
- Heavy runs go through barocss-lanes-guard's gate, in the background.
- Kill only your own PIDs. Use Node 22.
- Each scratch worktree gets its own node_modules.
- If you change a bracketed refusal message, or the folder a refusal is raised from, regenerate the docs refusal
  table with `node apps/library-docs/scripts/refusals.mjs` and commit it with the change.

## Report

To the coordinator, in English, per checkpoint:
- the SHA;
- the fuzz counts;
- the cases fixed or shown correct;
- the fingerprint delta;
- the suite counts and the name diff.
