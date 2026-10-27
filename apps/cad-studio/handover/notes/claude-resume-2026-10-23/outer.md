# Outer lane brief (2026-10-23)

## Role
You own:
- `packages/barocss-cad-model/**`: drawings, BOM, frames, mould, machining, print, chat/v2 tools and team;
- the studio's `src/ui` (not the viewport) and `apps/cad-studio/server`.

Branch `claude/cad-outer-lane-531d5a`, worktree `/Users/user/github/barocss/barocss/.claude/worktrees/studio-mates-cbde0e`.
It is fast-forwarded to integration `99da385a1`. Before each checkpoint, merge the latest integration SHA into your
branch.

## Read first
1. common.md (appended above).
2. README §0's outer block.
3. The last entries of decisions-outer.md: A9 S0, A9 decisions, the outer hand-over.
4. The model section of `notes/codex-handback-2026-10-23.md`.

## State
Integration has Codex's model work:
- the approval, invalidation and worker-weld corrections: REVIEW-M1, M2 and M3;
- the profile and frame consumers;
- part drawing and manufacturing options through v2 (A9-4) and the base drawing drawing every instance (A9-13);
- the v2 manufacturing outputs with inherited shop rows (A9-10 with A9-8);
- row-file provenance (A9-9, rows rule b) and purchase-estimate provenance;
- the G23 print persistence contract;
- A9-7's native cross-part housing context (`housingRef`; a same-part housing is refused at `bearingContext.ts:73`).

Codex's model branch is `codex/cad-model-a99-rows` (worktree `~/.codex/worktrees/c35f/barocss`; read with git only).

## Your queue
1. **The failing Model test.** In Codex's final window, `batch and script report document-only changes: brief,
   material and frame rows` failed: the generated rows are refused with ROWS_NOT_FROM_PERSON (expected false, got true).
   - Fix the test's fixture so its rows come through a person-file path, or correct the test's expectation if the
     refusal is right.
   - Never weaken rule (b).
   - The coordinator's window will tell you whether it still fails at `99da385a1`.
2. **Verify these review findings (model lane review, 2026-10-23) and fix the real ones:**
   - P2: `set_stock` / `set_frame_stock` on a placed part whose parent has inherited stock is refused.
     `rows.ts:50`/`:59` replace the whole list with the part's shop view, which already includes the inherited rows;
     `shopRows.ts:159-160` then reads the missing inherited rows as removed (SHOP_ROW_INHERITED_REMOVE).
     The base part's stock is also replaced wholesale, while other row kinds merge by id.
   - P3: `rows.ts:77` gives bend receipts to every sheet feature whose table has the same digest, including tables
     the person did not load.
   - P3: `bearingDependencyKey` (`bearingContext.ts:90`) defines a nested `walk` closure on the evaluation path
     (owner rule) and puts whole target part documents in the evalMemo key, which is costly during drags. The same
     pattern appears per tool call in `rowSources.ts:56,59,68,74`.
   - P3: `set_stock`, `set_frame_stock` and `set_frame_sections` still advertise a `rows` property that is always
     refused. It spends tool-list characters and invites the agent to try it.
   - P3: `cadMcp.ts` `save()` re-reads and re-parses the whole state file on every save.
   - Not yet checked: whether node kinds other than sheet-base/sheet-contour can carry a `bendTable`
     (`rowSources.ts:22` scans only those two).
3. **REVIEW-A1.** Recovery metadata can report success while the mesh blob's persistence fails silently. Fix it with
   a test.
4. **A9-11.** The actual Studio download flow.
5. **The A9 brief.** Fix the 115 mm³ clash between the default shaft's key and the 6204 (move the key or the bearing).
6. **The A9 acceptance run** (`test/a9-acceptance.test.ts` and `conformance/a9`).
   - It needs A9-7's linked-bearing success, which waits for a real person-supplied row/fit file from the owner.
   - Do not invent or generate one; ask the coordinator to request it.
   - Until then, build everything that does not depend on it.

## Coordinate with the GPU lane
The GPU lane carries Codex's A9-7 UI connection (`8789e468`), which touches studio UI and the BOM CSV. Agree with
them, through the coordinator, which files each of you changes.
