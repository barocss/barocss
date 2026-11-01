# Independent audit 2 (FULL) — instance patterns, row 10 ③

**Verdict: CHANGES_REQUIRED**

In this report, P stands for `/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/row10c/audit2/`. To rerun: `node P/run.mjs [r1v2|r2|…]` and `node P/mut/run-mut.mjs`, both through the gate.

## 1. Round-1 probes rerun

- **No longer fail:** #1, #2, #7, #8, #11, #12.
- **Still fail, but only because they assert the old behaviour or copy the old code:**
  - #4: the full circle is now refused.
  - #5: Open now refuses the bad file.
  - #6: the delete is now refused.
  - #3: the probe copied the old Studio effect.
  - #9: the probe copied the old `axisOf`.
  - #10: Hide is now hidden for copies.
- **Restated against the intended fix in `P/probe-r1v2.ts`:** all 5 pass. #9 is checked against the real `patternEdit` from InstancePattern.tsx.
- **Net:** all 12 round-1 findings are fixed.

## 2–3. New findings

**A1 — HIGH, a regression in Studio.** At useAssembly.ts:114 the effect now re-expands the copies after every solve.
- A cycle (seed → Cap → copy) makes it re-solve without end. After 50 renders the seed is at z 2060, still moving.
- Studio's `finish` (useAssembly.ts:125) only refuses a direct seed↔copy mate, so the cycle can be built in Studio. It can also come from chat or a file.
- Expected: the effect stops, e.g. after the same 4-pass limit, and reports the problem.
- Probe: `P/probe-r2.ts`, "A · Studio effect loop".

**A2 — MEDIUM.** The core reports the cycle but keeps it (edit.ts:38-40).
- The reported text is: "Pattern pat1 does not settle: … Delete one of those mates."
- It names m1, the legitimate Cap-on-copy mate, not m2, the mate that closed the cycle.
- `addMate` still returns the moved document: the seed goes z 20 → 220, then 380 on the next solve.
- Expected: the closing mate is refused with MATE_UNMET and the assembly is left unchanged.
- Probe: "A · cycle".

**C1 — HIGH, a false positive that blocks ordinary edits.** The reference scan (patterns.ts:84-106) treats a frozen BOM baseline as a reference.
- Once a baseline exists, lowering the count, skipping or deleting a copy is refused forever, because `baselines.baselines[0].content.bom.lines[0].parts[2]` lists `pat1-2`.
- The `history[].prompt` text "please skip pat1-2" blocks the skip the same way.
- Records of the past should not count as references: exclude `history`, `baselines`, `proposals`, `ecrs`, `questions`, `brief`, `drafts` and free text.
- Probe: the two "C · false positive" tests.

**C2 — MEDIUM, a reference the scan misses.** `nodes` is excluded from the scan (patterns.ts:84). A base frame whose `follows.part` is `pat1-2` therefore does not stop the copy's removal.
- Expected: the scan also asks `checkPartDelete` (frames/skeleton.ts:126) about each lost copy.
- Probe: "C · missed reference".

## Re-verified with no defect

- **Legitimate assemblies are not flagged as unsettled.** Three were tried: linear, a skew circular pattern with a 37° seed, and a seed tilted with an angle mate. Each had a Cap on a copy. None was reported as "does not settle", and re-solving changes nothing (`P/probe-r2.ts`, B).
- **Open does not refuse valid files.** All 30 model fixtures still open.
- **The Custom axis path in Studio is correct:**
  - A direction that is not exactly an axis is kept.
  - Choosing an axis sends it.
  - The circular origin is never sent.
- **variantOf** now ends in `solveDoc`. For documents without patterns this is equivalent, read from the code. o11-variability, o11-agent and api-assembly all pass.
- **seedMateRefusal** is reached by the core's add/edit/lock, the facade's `lockDoc`, and Studio's `finish` and `lock`. Lock is also hidden for copies.

## 4. Mutation check

Each guard was mutated in a scratch copy, never in the repo, and the repo's test file was bundled against that copy. The unmutated copy passes 22/22.

| Mutant | Failing tests |
|---|---|
| seedMateRefusal → undefined | 2 |
| non-convergence problem dropped | 1 |
| full circle back to count − 1 | 2 |
| read-time check off | 2 |
| reference scan mates-only | 1 |
| skip trim off | 1 |

**All 6 mutants are killed.**

## What I ran (all through gate.sh heavy audit-pat)

- Round-1 probes, the `r1v2` probes and the `r2` probes.
- `node P/mut/run-mut.mjs`.
- The package suites instance-patterns, o11-variability, o11-agent and api-assembly: 37/37.
- The Studio test instance-pattern-draft: 2/2.

No repo files were touched and no browser was used. A1 is reproduced by replaying the effect's exact calls.
