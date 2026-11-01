# Independent audit, round 2, FULL tier: roadmap 10 ⑧

**Verdict: CHANGES_REQUIRED**

## 1. Round-1 probes

`probes1.test.ts`:

| Probe | Result |
|---|---|
| P1 | pass |
| P2 | pass (D→E) |
| P3 | pass |
| P4 | pass |
| P5 | still fails as a pure call: `mergeTurn` is unchanged. The fix sits upstream, where `useStudioChat.ts:78` drops the turn before merging. |

## 2. Replays of the untested guards (code paths)

- **Chat turn ending in a session or after Finish:** dropped. `turnMoved` runs before the merge; the document, ops and selection are discarded. Safe.
- **STEP import, mesh-unit or repair question:** safe.
  - Edit part is refused while `stage`, `meshAsk` or `repairAsk` is set.
  - `beginOpenIntent()` makes older import owners stale.
  - `openedImport` is guarded.
- **Project link check after an open that already completed:** stops, because `owner.scope` is stale. `onLinked` is guarded. Safe.

**HIGH (race, overwrites a project file): a project open still being read when Edit part is clicked.**
- `useProject.ts:129` sets `view.part` and the tag to file B *before* `onOpened` runs.
- The guard at App.tsx:439 returns `openIntent.current`, so the open counts as accepted. The log, autosave and link check of B then run. The session's `beginOpenIntent` never reaches the project's own open request.
- After Finish, autosave writes the assembly into B's autosave. ⌘S writes the assembly over **B.bcad**, expecting B's tag, so the write succeeds.
- Fix: refuse Edit part while a project open is in progress, or make the guard abandon the open and roll back `part` and its tag.

**MEDIUM: an agent version made during a session can land in the assembly's version history.**
- `versions.back()` (useStudioChat.ts:74) runs before the `moved` check.
- During a session the turn carries no version log, so the agent's `make_version` creates a new log with the **part** snapshot (versions/tools.ts:37).
- If Finish happens before that turn ends, the log is merged into the assembly's project history, or replaces it when the assembly has none. A later Restore of that version would open the part in place of the assembly.
- Fix: skip `back()` when the turn moved.

## 3. Side effects

- **"(edited)" rename:** no data loss. Only the instance panels, the link check and link count, and the proposal lock read `source`; BOM and drawings never do. New revision… sets `source` as before. Sources not starting with `./` keep their old "From pin.bcad" label, which is misleading (LOW).
- **Inherited rows:** Save after Finish stores the part as authored. LOW findings:
  - P8: `carryOver` keeps any row field a command rebuilt from the evaluated view, so the assembly's rows would become the part's own. I found no current UI command that does this; chat row tools build on the part as authored.
  - Chat in a session evaluates the part without its inherited rows.
- **P6 (LOW):** the self-containment check compares objects, not values, so a JSON copy of the assembly is accepted.

## 4. Mutation testing (scratch copies, `mutate.mjs`)

| Mutation | Result |
|---|---|
| a: other parts placed twice | killed (edit-in-place) |
| b: revision from the part's drawing only | killed (definitions ×2) |
| c: waiting revision kept | killed (definitions) |
| d: self-containment check off | killed (definitions + edit-in-place) |
| e: `turnMoved` always false | killed (unit test only) |
| unmutated | 0 failures |

Surviving class (no test at all): the call sites of `turnMoved`, the `elsewhere` refusal, the `openedImport`/`onOpened`/`onLinked` guards and the `versions` withholding. Removing any of them leaves every test green.
