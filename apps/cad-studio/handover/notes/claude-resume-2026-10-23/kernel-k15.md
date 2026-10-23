# Kernel lane brief: K15, K14's open robust refusals (2026-10-24)

## Role

Same as kernel-k14.md. You own `packages/barocss-cad/**` and commit directly on integration
(`review/cad-gpu-engine-2026-10-14`, worktree `.claude/worktrees/barocss-cad-gpu-review-efbb2c`).
- Never amend, rebase or reset there.
- Never commit files you did not change.

## Read first

1. common.md.
2. kernel-k14.md: the method, verification and report format, which K15 keeps.
3. decisions.md:
   - D245–D254, K14;
   - D254 above all, which diagnoses what's left;
   - D196, the triage method;
   - D239's open nudge findings.

## State

- The fingerprint is `cf100676`, over 861 cases.
- The kernel suite is 1663/1670. The one failure is the native-split Node assertion. Test names are saved per checkpoint.
- The fuzz has APPROX, from D249. All four seeds (20261023–20261026) have no findings. Refusals are 11/13/18/13.

## Queue

Take the cases in this order, smallest shrunk tree first within each step, with one decision record per cause.

1. **The orientation pair:** 25#62 and 26#115, "orientation: face … sense disagrees with its outer loop". The stitch
   builds a face over a 354° arc against its loop. One cause is likely, so check 26#115 against it.
2. **26#184:** the copies' union leaves 13 edges each used once, in a tilted cylinder's end plane. Rings meet at
   points 0.07 mm apart.
3. **25#49 and 25#148:** shrink and diagnose them first.
4. **The second causes of 25#170 and 26#34 as fuzzed.**
5. **25#190,** the march beside a pole (D250). Two remedies have already failed. Try a third only if it keeps #154
   and D238's 25.
6. **D239's nudge findings and s2#112.**

**Stop** at about 7 causes fixed or when the queue is empty. Then write a closing record:
- the four seeds' table;
- what's still open, and why;
- the fingerprint chain.

## Verification and report

As in kernel-k14.md:
- **Per fix:** a test that fails before the fix, and a `--save` corpus case.
- **Per checkpoint:**
  - the kernel suite with the test-name diff;
  - RB;
  - the fingerprint, with its changed lines;
  - cad-model and studio;
  - the four seeds' counts.

Heavy runs go through the gate. Give each scratch worktree its own node_modules. Kill only your own PIDs. Use Node 22.
