# D383 — Row 10 ③: component patterns of part instances

Tier: **full**, because it adds a document field and public API: three audit rounds with mutation, and one actual run. Owner order "Go to row 10", 2026-10-31. Issues: #2180 (one definition reaching every occurrence), RS7.4; epic #538 stays open. [Qualification](qualification.json).

## What it does

**Making a pattern**
- A part instance (the seed) is repeated along a line (count, spacing, direction) or about an axis (count, angle, axis through an origin).
- The occurrences get stable ids `pat1-1`, `pat1-2`, … and share the seed's definition, so the BOM counts one part placed N times.
- Moving or re-solving the seed carries every occurrence.

**Occurrences**
- An occurrence is driven: no placement boxes, gizmo, Fix, Hide, Remove or Lock. It can still be the fixed side of a mate.
- **Skip** leaves one occurrence out, and **Restore** brings skipped ones back. The skip list survives Save and a fresh Open.

**Refusals** (each refused with a typed reason)
- Out-of-range values: count 2–64, and |angle| × count ≤ 360.
- Removing an occurrence or a seed that a live reference holds. Live references are mates, robot base, joints and frames, variability, drawing scope and balloons, and node part references. Past records such as history and baselines never block.
- A mate that would close a cycle from the seed back to one of its own occurrences.

**Other ways in**
- The model API, the facade (`Assembly.pattern` …) and the agent tools (`pattern_part`, `edit_pattern`, `delete_pattern`).

## Audits ([round 1](review/audit-round1.md), [round 2](review/audit-round2.md), [round 3](review/audit-round3.md))

**Round 1** found 12 defects. The three high ones:
- a mate from a seed to its own occurrence never settled, and nothing said so;
- variants left the occurrences behind;
- Studio's automatic re-solve did not regenerate them.

**Round 2** confirmed those 12 fixed and found 4 new ones:
- a Studio re-solve loop, a regression from the round-1 fix;
- a cycle mate that was kept;
- past records blocking edits;
- a missed node reference.

All six guard mutants were killed.

**Round 3** re-checked only those four, as the coordinator ruled: ACCEPT.

## Verification

- **Tests:** model 2279/2279 (instance patterns 26/26); Studio 572/572. Type checks and the docs tables pass.
- **Inventory:** the regenerated API inventory also records the GPU merge's (D378) exports.
- **Actual [run08](run08/receipt.json):** every Studio step above, plus the BOM (Cube qty 4), a circular pattern and a mated seed's re-solve. The independent oracle passed at each step.
- **Earlier runs:** run01–06 failed on driver mistakes, and those were fixed.

## Follow-ups

- **Cycle-closing mate in Studio.** Studio commits such a mate once (the seed moves once, then "does not settle" is shown), while the model refuses it.
- **`drawing.balloons`** is untested.
- **Edge or datum axes** are not offered.
- **Next:** 10② occurrence paths, then 10④ flexible sub-assemblies and 10① instance looks.
- CI and release NOT_RUN.
