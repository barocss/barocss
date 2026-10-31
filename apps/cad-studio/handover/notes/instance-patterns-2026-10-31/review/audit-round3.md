# Independent audit 3 (targeted: round-2 findings A–D) — **ACCEPT**

P = `/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/row10c/audit3/`. Every run below went through the gate. The repo's test file passes 26/26 on an unmutated copy.

Two round-2 probes in `P/probe-r2.ts` now fail, but only because they assert the old behaviour: the closing mate is now refused, and the old effect code they copied is gone. I restated both in `P/probe-r3.ts`.

| Item | Probe | Regression test | Mutant (scratch copy) | Result |
|---|---|---|---|---|
| A — Studio re-solve loop | `probe-r3` "A · Studio effect": 1 render, 0 writes, problem names pat1 with mates m1, m2 | "audit 2: the studio's automatic re-solve writes once…" | `settleDoc` returns `cur` (the last pass) → killed by "audit 2: a document already unsettled…" | **PASS** |
| B — cycle mate kept, drift | `probe-r3` "B": MATE_UNMET names m2 and pat1, document unchanged, no drift on a second solve | "audit 1: … a cycle through another part …" and "audit 2: a document already unsettled …" | `mated()` skips `throw loose` → killed | **PASS** |
| C — past records block edits | `probe-r2` C ×2: a baseline and a history prompt no longer block | "audit 2: past records and text never block …" | history and baselines put back in the scan list → killed | **PASS** |
| D — frame following a copy | `probe-r2` "C · missed reference": refused | "audit 2: a base frame following a copy's sketch …" | `checkPartDelete` call removed → killed | **PASS** |

Note on A: dropping `|| s.unsettled.length` from `resolved` (edit.ts:58) survives the tests. This is not a defect: the guard is redundant with `settleDoc` returning `expandPatterns(doc)`, so `resolved` still finds nothing to write. Of the two guards, only the `settleDoc` one is pinned by a test.

## Follow-ups (not blocking)

- Studio's `finish`, `edit` and `lock` (useAssembly.ts) do not use B's refusal. A cycle-closing mate made in Studio is committed after one solve, so the seed moves once. Studio then shows "does not settle" and does not drift further, and undo restores it.
- `drawing.balloons` is still unverified, as the implementer said.

## Ran

- `node P/run.mjs`: both probe files.
- `node P/mut/run-mut.mjs`: the unmutated copy and 6 mutants.
