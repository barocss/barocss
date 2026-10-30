# D349 independent audit (claude-opus-5-5 sub-agent, 2026-10-30)

Scope given: the fixed `finishSketch` in-place branch (`keptFields`) and the new tests in `apps/cad-studio/test/sketch-edit-identity.test.ts`, read and run in the implementation worktree; the base worktree read-only. Probes are in [../audit](../audit); raw outputs were not saved, and the numbers below are the auditor's reported observations.

**Verdict: PASS**, no blocking findings.

## Findings

1. **Low, process.** The implementation worktree was cut from `970b39cb8`, five commits behind base `94d9b1f70`. Its only changes were the two D349 files. The auditor ran the fixed hook and the real test file against base sources ([r2.test.ts](../audit/r2.test.ts)): 4/4 PASS. **Root:** compared both files against base and found only the D349 hunks, then copied them onto `94d9b1f70`. The old tree was not adopted.
2. **Low, tests.** No test asserted that the evaluated document and the committed document carry the same fields; probe P2 showed they do. The associative/detached precedence is untested; synthetic probe P4 shows that `placedNode.on` wins when `base` is set and that the stored `on` is kept when it is null. The test helper's un-suppress-in-a-copy is unnecessary and hides nothing. **Root:** added the evaluated==accepted assertion to D349 test 1.
3. **Info.** An unchanged reopen→Finish keeps the node deep-equal but writes `id` before `on`, so the JSON text differs. The actual run02 records this as `differingKeys: []`, `docEqual: false`. Not functional.

## Field review

- `on`: in-place edits cannot change plane or placement (`onPlace` is only given to new sketches), so the stored `on` stays consistent. Associative sketches always get `placedNode.on`. A stale `on` (body gone) is kept and offers no Operation, the same as before the edit (P5). A brand-new face sketch writes the same key set and `on` (P6).
- `sigs`, `rematched`, `held`: sketch nodes never own these in practice (`references.ts` covers fillet/chamfer/shell/draft…). Carrying them follows the `NODE_EXTRA_FIELDS` convention (`part.ts` associative inset, D348).
- `suppressed`, `bought`: previously cleared silently by an edit; keeping them is right.

## Side note (outside D349)

Chat `edit_feature` with a whole `feature` (`packages/barocss-cad-model/src/chat/part/features.ts`) keeps only `id` from the old node, and drops `on` unless the agent supplies it. It is arguably intended as a full replacement.

## Commands the auditor reported

- Fixed worktree `node scripts/test.mjs sketch-edit-identity`: 4/4.
- Probes P1–P6 ([audit349.test.ts](../audit/audit349.test.ts), [run.mjs](../audit/run.mjs)): 6/6. P1 realistic `on` only: unfixed `on` undefined and Operation not offered; fixed `on` kept and Operation offered.
- R1, the real tests on the unfixed hook: 2 pass / 2 fail (missing bought, held, on, suppressed).
- R2, the fixed hook on base: 4/4.
