# Independent audit round 2 (FULL tier): row 10 ②a nested references

**Verdict: CHANGES_REQUIRED** (one high finding)

## 1. The round-1 probes (p1–p4), rerun
- **13 of 15 pass.** H1, H2 (joints, declaredContact), M3 (delete, ground) and M4 (a whole name with "/") are fixed.
- **Two still fail, both by design.** The fixes changed the outcome those two probes expected, and both new outcomes are correct:
  - p2 test 9 is now refused with plain words: `[VALUE] p2 in the assembly names two parts: p2 (by id) and p1 (by name p2)`.
  - p2 test 10: reading a file with the id `a/b` is now refused, naming the id.
- **p3 test 2:** a positional end is stored as `p1/p2` + `n1.bottom`. After the sibling grows, the sub-assembly stays at z = 5 with no problem.

## 2. The implementer's flagged risk: confirmed (HIGH)
- **Where:** `assembly/edit.ts:198`, where `mated()` calls `canonicalRef` (`:72–80`) on a **stored** mate's ends. editMate and chat edit_mate both reach it.
- **Probe:** `audit2/p5-stale-edit.test.ts`. It stores a mate in host form, `p1` + `n3.bottom`, as a file saved before ②a would hold it.
  - **Stale case** (nested p1 gained a feature since the save): solveDoc correctly reports "…pick the face again". But `editMate({distance: 6})`, and the chat `edit_mate {flip: true}`, both succeed. The end is rewritten to **`p1/p1` · `n3.bottom`**, a face of a different nested part, and the sub-assembly moves to z = 16. That is a silent re-aim.
  - **Fresh case:** the end is converted to `p1/p2`. That happens to be correct, but the edit cannot tell a fresh end from a stale one, and the solver tells the user to pick again.
- **Expected:** editMate never converts a stored end. It refuses with the same words as the solve problem ("p1 is a sub-assembly … pick the face again"). Keep `canonicalRef` for the new ends in addMate only.
- **Test gap:** nested-references.test.ts has no editMate case with a stored host-form end. Add both the stale and the fresh case.

## 3. Side effects of hostOf on plain top-level assemblies: none found
- I compared the HEAD sources (git archive) with the working tree on all 8 `samples/robots/*.bcad`.
- What I compared: solveDoc problems, jointsOf, poseOf, URDF, MJCF, SDF, declaredContact for every pair, and rebuildReport loops.
- The JSON is **byte-identical** (86,234 bytes each; `audit2/head.json` and `now.json`).
- The existing tests also pass: 14 files including robot-joints, robot-loop, o24a-loops, o24d-*, api-rs6-loop-motion, team-assembly, o10-rebuild, clearance-map, robot-sdf-usd, api-robot and rs1-samples, plus nested-references. **100/100**.

## 4. Mutation: run on a scratch copy (`audit2/mut`), checked against nested-references.test.ts (19 tests)

| Mutant | Result | Test that kills it |
|---|---|---|
| M1 `canonicalRef` returns ref unconverted | KILLED (1 fail) | H1 stored in path form |
| M2a host table full again | KILLED (3) | tablesFor own-only; H1 ×2 |
| M2b host-form problem words dropped | KILLED (1) | H1 saved host-form problem |
| M3 joints.ts `placed.has(m.a.part)` | KILLED (1) | H2 robot joints |
| M4 facade whole-name-first removed | KILLED (1) | M4 facade |
| M5 `/`-id refusal disabled | KILLED (1) | L5 |

The unmutated copy passes 19/19.

## What I ran
- p1–p5 via `audit2/run.mjs`.
- `cmp-head.ts` / `cmp-now.ts`, with outputs in head.json and now.json.
- `audit2/mutate.py`.
- `TEST_CONCURRENCY=4 node scripts/test.mjs …` (the 14 files above).

Everything heavy ran through the gate on Node 22. The repo is untouched; Studio was not run.
