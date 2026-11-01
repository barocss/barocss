# Independent audit, round 2: flexible sub-assemblies (roadmap 10 ④)

**Verdict: ACCEPT.**

## 1. Round-1 probes rerun on the current code (`run1.log`)
- **M1 fixed.** Setting joints on a pattern occurrence is refused with `PATTERN_DRIVEN`.
- **M2 fixed.** Open refuses malformed joints, naming the part and the key. This covers a string, Infinity, an array, a null value and a bare number.
- **L1 fixed.** Each occurrence's problem now names that occurrence.
- **L2 fixed.** A stale key with value 0 is reported the same way by `poseOf`, `jointProblemsOf` and `instanceJointsOf`.
- **L3 fixed.** The header comment is corrected.
- **No regressions.** The pose maths (chain, world, prismatic, limits, offsets), the mates and the import cycle all still pass.
- **Remaining FAIL lines are not defects in this work.** They are:
  - my own invalid probes: the evaluateDoc lane, the lock fixture, and the baseline with both parts fixed;
  - the robot-view gap that was already there before this change.

## 2. Side effects (`run2.log`)
- **Repo fixtures.** I opened all 755 `.bcad`/`.barocad` files in the repo:
  - 623 JSON files open with `readStudioDoc`, with 0 errors.
  - The other 131 are rejected as "not JSON" by `readStudioFile`. They are another format, and none of the errors involve joints.
  - No fixture stores instance `joints`.
- **Nested joints.** Valid joints two levels deep survive Open and reach the outer fold.
- **Zero values.** All-zero valid keys return the very `inst.doc` with no problem. `-0` counts as zero.
- **Cost of the new key check.** About 0.5 ms on a fresh document object and about 0.5 µs when cached.
- **Follow-up only (behaviour change):** `{k: 0}` with limits that exclude 0 now reports "0 degrees, outside its limits" and stays rigid. Before, it was silently rigid. The saved pose really is outside its own limits, so this is arguably correct.

## 3. Mutations
I ran `flexible-subassembly.test.ts` (16 tests) against each mutant in a scratch copy (`mut/`, `runmut.mjs`, `mutation.log`).

| Mutant | Result | Test that failed |
|---|---|---|
| none | 16 pass | – |
| (a) drop `drivenRefusal` | killed | M1 |
| (b) drop the finite check in `valuesProblem` | killed | M2 |
| (c) old cache text with the name in it | killed | L1 |
| (d) all-zero shortcut before the key check | killed | L2 |

The Studio test `instance-joints.test.ts:57` covers the `{!driven && joints}` guard.

## Follow-ups (unchanged from round 1)
- The robot view (`verbs.ts:39`, `robotCore.ts:31`) and the chat `world_bounds` leave out the nested parts of a sub-assembly.
