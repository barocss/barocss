# Kernel lane brief (2026-10-23)

## Role
You own `packages/barocss-cad/**` (the B-rep kernel), plus the kernel side of new kinds and their cad-model and studio
wiring. You commit directly on the integration branch `review/cad-gpu-engine-2026-10-14`, in the worktree
`/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-review-efbb2c`.
- Never amend, rebase or reset there.
- The coordinator merges the other lanes into this branch. Check `git status` before committing, and never commit
  files you did not change.

## Read first
1. common.md (appended above).
2. README §0's kernel block: "Kernel lane: hand-over at FRk8b".
3. decisions.md D164–D175.
4. The kernel section of `notes/codex-handback-2026-10-23.md`.

## State
- Integration has FRk3, FRk4, FRk5 and the Sweep mass correction (REVIEW-K1).
  - FRk3: I/H beams and tapered channels, D172.
  - FRk4: curved and bent members with editor connection, D173/D174.
  - FRk5: native weld gaps and notches, D175.
  - REVIEW-K1: overlapping sweep pieces double-counted mass after union.
- Also in: the shared weld-seam handling that lets beads sit on ordered-trim ends.
- Codex's kernel branch: `codex/cad-kernel-sweep-mass-20261022`, worktree `~/.codex/worktrees/0d2f/barocss`.
  - Read it with git only. Do not work in that worktree.
  - Its FRk6 WIP `abb697f2` (stop receipt `ab25b618`) is NOT in integration.
  - That WIP normalises an isolated adjacent-float Bezier span and restores the prior fitting conditions for the
    general fallback.
  - It is source only, never built or measured. Member5 mass and offset fitting failed before it (`2364ef71`
    failure, evidence `76e08de5`).

## Your queue
1. **FRk6 review and repair.**
   - Read `git show abb697f2 -- packages/barocss-cad/src/brep-mass-quadrature.ts` around lines 389–515.
   - `stripSpanD1` returns a closure, and callbacks are created per element: hoist them (owner rule).
   - Port the corrected source into integration and test:
     - member5 mass against the unchanged 1e-9 criterion; no interval's integral may be dropped;
     - the reversal case;
     - the general fallback;
     - the frame regression set.
   - Then FRk6's speed target: the round-cornered ordered trim ≤ 2 s.
   - Record it as D176.
2. **FRk5 leftovers.** The notch screen/file flow and the WebGPU failure Codex retained. The GPU lane owns the
   viewport; agree the split with the coordinator.
3. **FRk7.** The SubD display folds inside single B-spline faces (`surfaceTriangles`); the pipe clamp's worst is
   88.6°, the target under 25°.
4. **FRk8a.** D158's housing shoulder against the row's Da max, found from the housing's faces.
5. **FRk8b's second half**, only if speed needs it.
6. **FRk9.** Acceptance by the agent (welded table with gussets, caps and beads; tapered-I portal; bent-tube rail),
   with conformance `frk/accept-*`.

## Open for the owner
- Oblique-end weld beads stay refused (BEAD_ANGLE) until there is an independent oracle.
