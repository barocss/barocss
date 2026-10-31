# Independent audit 1 (FULL) — instance patterns, row 10 ③ / #2180 / RS7.4

**Verdict: CHANGES_REQUIRED**

Probes live in `/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/row10c/audit1/` (P = that folder). To rerun: `node P/run.mjs [math|model|axis]` through the gate. Every finding below has a probe that fails today.

## Findings

1. **HIGH — a mate from the seed to its own occurrence (directly, or through a cycle) diverges, and nothing reports it.** edit.ts:161-168 stops after 4 passes without raising anything, and `mated()` accepts the mate. In one case the seed drifts z 20 → 70 → 110, moving further on every later solve. In the other, seed → Cap → pat1-1 ends with Cap at z 360 while the occurrence's top is at 400, and `problems` is `[]`. Expected: the mate is refused, or a problem is reported when the loop has not converged. Probe: `P/probe-model.ts` "3 · seed to its own occurrence" and "3 · a cycle".
2. **HIGH — a variant does not re-expand the patterns.** At variability.ts:139-141, `variantOf` calls `solveAssembly`, not `solveDoc`. With a mate binding gap=30 the seed lands at z 40 and the occurrences stay at 15. With a parameter binding h=35 the seed has h=35 and the occurrences keep 20. A component binding on the seed has the same gap. Every variant BOM and export is therefore wrong. Probe: `P/probe-model.ts` "4 · a variant …" (2 cases).
3. **HIGH — the Studio re-solve effect does not re-expand.** At useAssembly.ts:104-112 the effect writes `r.instances` back without `withPatterns`. If you type or drag a mated seed (App.tsx:895/1712), the mate pulls the seed back to z 10 but its occurrences stay at the typed z 60. Probe: `P/probe-model.ts` "4 · Studio re-solve effect". It replays commitInstances followed by the effect's own calls.
4. **MEDIUM — a circular pattern that closes a full circle puts its last occurrence on the seed.** The bound at patterns.ts:70 is `angle·(count−1) ≤ 360`, so count 4 at 120° places k=3 at 360°, the same spot as the seed. That gives 2 coincident solids and a BOM quantity of 4 for 3 positions. The test at instance-patterns.test.ts:~170 asserts this as correct. Expected bound: `angle·count ≤ 360`, or `angle·(count−1) < 360`. Probe: `P/probe-math.ts` "a full circle".
5. **MEDIUM — Open does not validate patterns.** No check runs on `readStudioDoc`, and expandPatterns (patterns.ts:46) trusts the file. A file pattern with count 5000 expands to 5000 instances on the first solve; `dir [0,0,0]` gives NaN positions. Expected: `check()` runs on read or before expanding. Probe: `P/probe-model.ts` "6 · Open".
6. **MEDIUM — pattern ids are reused, which retargets references that are not mates.** Deleting a pattern (and lowering count or skipping) only guards mates (patterns.ts:76-81, 129-136). A `robot.frames.tcp.link = 'pat1-2'` survives the delete. The next pattern then gets id `pat1` again (`nextFreeId` at :103 only looks at pattern ids), and the tool frame silently moves onto a different part. `robot.base` has the same problem. Probe: `P/probe-model.ts` "2 · id reuse".
7. **LOW — pattern ids can collide with instance ids.** If a file holds an instance with id `pat1-1`, the expansion produces the duplicate ids `p1, pat1-1, pat1-2, pat1-1`. Cause: patterns.ts:103 does not check instance ids. Probe: "2 · id collision".
8. **LOW — lowering count below a skipped k is refused.** Going from count 5 with skip [4] to count 3 fails with PATTERN_VALUE (patterns.ts:72). Studio's Apply sends count only, so the user just gets a refusal toast. Expected: skip entries ≥ count are dropped. Probe: "2 · count lowered".
9. **LOW (Studio) — Apply rewrites the direction.** InstancePattern.tsx:12/40: `axisOf` maps any direction other than +X/+Y/+Z to X, and Apply always sends it. Changing only Count on a chat-made `[-1,0,0]` or `[0,3,4]` pattern rewrites dir to `[1,0,0]`. Probe: `P/probe-studio-axis.ts` (the function is copied verbatim).
10. **LOW (Studio) — Hide on an occurrence does nothing.** InstancePanel.tsx:53 → commitInstances → withPatterns regenerates the occurrence and drops `hidden`. It still pushes an undo entry and marks the document dirty. Either hide the button, or say that hiding is the seed's. Probe: "4 · an occurrence's Hide".
11. **LOW — the refusal code differs between core and facade.** The core's `lockPart` refuses an occurrence with PATTERN_DRIVEN. The facade's `assembly.lock('Pin 2')` (assemblyCore.ts:48-58, `lockDoc`) refuses with `[ASSEMBLY] Pin 2 is fixed…`. Studio's MatePanel LockRow (MatePanel.tsx:51) is still offered for occurrences and gives the same generic words. Probe: "3 · facade lock".
12. **LOW — flatten keeps a stale field.** `flattenAssembly` (flatten.ts:19) clears instances but keeps `instancePatterns`. Probe: "4 · flattenAssembly".

## Checked with no defect found

- Linear placement: unit(dir) and negative spacing are correct.
- Circular placement is correct against an independent Rodrigues/Euler model, to under 1e-6 mm. Cases covered:
  - a skew axis through an offset origin, with a seed rotated about all three axes;
  - a negative angle;
  - a seed at Y = ±90° (gimbal).
- Near the gimbal (Y 89.9999° + 0.0001°) the error is 2e-6 mm at 10 mm, from eulerOf's snap. This is informational only.
- Ids stay stable through count up/down and skip/restore.
- PATTERN_REFERENCED guards mates.
- Model guards on occurrences: placePart, lockPart, makeIndependent, and addMate when both sides are fixed.
- In chat, snap_part, delete_mate and other `changed` paths go through solveDoc, so they re-expand.
- In Studio, insert, library insert and the commitParts/commitAssembly paths are wrapped. Duplicating an occurrence strips `pattern`/`grounded`.
- The existing suite passes: `node scripts/test.mjs instance-patterns` → 13/13.

## Ran (all through gate.sh heavy audit-pat)

- `node P/run.mjs math`: 5 pass, 1 fail (#4).
- `node P/run.mjs model`: 12 fail (#1–3, 5–8, 10–12).
- `node P/run.mjs axis`: 1 fail (#9).
- The package test above.

No browser was used. The Studio findings (#3, #9, #10) are reproduced from the exact code paths they cite.
