# D321 source contract: Stop owns one accepted change

Policy B is selected. While the main computation is pending, unsupported independent undoable document edits are refused before acceptance. Camera/FOV movement and opening Model/Render/Drawing workspaces remain available. The refusal is `Change not applied` with an instruction to wait or stop. A callback from an older acceptance scope/document is refused even after the old operation ends.

## Original baseline

`source-baseline.json` identifies the original App by committed Git blob and SHA-256 at e1f2b05d62b8011412a1d8ee9c1cc73256737177. No whole-App archive is needed: that committed blob preserves the original bytes. The earlier real UI execution at 5463dbf32af5dd10670badd0d334c68504615292 is reused from `../stop-operation-intake-2026-10-29/`. The original native worker completed in about 44 ms; its actual terminal result and mass event were retained FIFO before client delivery, then discarded by actual termination. It is controlled pending-client scheduling, not natural slow computation. The committed Stop/Render/Undo/client semantics were compared through the source intake; no new pre-fix current-HEAD runtime was run in this lane.

The original D0 → accepted D1 model → accepted D2 Grid → Stop sequence popped D2's top history entry, left the D1 model, and lost Grid. Existing client epoch protection did not select the correct Undo owner.

## Acceptance and history

The existing `undoFor` remains a transient intent. It now carries the unchanged `{doc, marker}` history entry, the captured acceptance scope/base document, and exact pre-change evaluated input. `setDoc` reads and clears that intent immediately, checks admission, and only then appends Undo, clears Redo, and sets the document. It returns a boolean acceptance result.

All 12 ordinary writer sites perform preflight before staging history and put dirty/marker/selection/other successful follow-up work after acceptance: generic commit, Render, print preview, print direction, Drawing, direct geometry, instances, parts, assembly, reference resolution, robot motion, and robot base. Throwing pure next-document work occurs before the intent is staged. Rejected intents cannot leak a snapshot into a later accepted change. Generic route/chat commits do not gain replacement authority from `whole=true`.

Actual pre-commit model evaluation submissions also admit before submission: command start/build, sketch Finish, delete/separate/reorder/suppress/cascade, and the inline node/bearing edit. Otherwise a rejected later commit could already supersede the owned main request through EngineClient.evaluate. A same-base parameter candidate may update itself; it cannot replace a different pending ordinary owner.

## Private ownership state

`src/state/workOwnership.ts` is Studio-private and has no worker, React, document write, or history-array operation. Tokens are object identities and are not serialized.

- Acceptance reserves an exact history entry, after-document, pre-change evaluated input, and generation before effects run.
- A separate settlement effect observes the existing exact memoized `evaluated` input. Render-only changes release their reservation without running the main evaluation effect.
- The main effect's dependency list remains `[engine, evaluated, parameterEdit, parameterCurrent]`. Acceptance scope is a dependency of mutation callbacks and the separate settlement only. Its dynamic result predicate reads the current run token from a ref.
- Main evaluation binds a reservation only to its exact after-document and changed evaluated input. Initial evaluation, variant/rolled-back views, and unaccepted parameter candidates do not borrow the previous history entry.
- Only the current opaque candidate token may authorize its validated completion across the scope captured before the effect began. The permission surrounds its synchronous accept call and is cleared in `finally`; acceptance consumes the run into a reservation. Old tokens and ordinary runs cannot use it.
- Success, failure, no-result, handoff/no-request paths, and cleanup finish only their own captured run token. An old finally cannot clear a newer run or reservation.

## Stop and workspace lifecycle

If a delayed Stop click arrives after its run has already finished, Stop only clears busy/slow and returns. It does not restart the worker or change caches, scopes, document, or history. This exact UI completion race was not run. For an active run, Stop first captures and invalidates its owner, before restart resolves pending callbacks. It replays a history entry only if the current generation, after-document, exact input, and top entry identity match. The replay captures a local immutable Redo snapshot before queuing its updater and before restoring the document. It uses the existing one-entry Undo/Redo movement, not the generic commit path; it creates no new owner. Dirty remains conservatively true after owned rollback. Recovery uses the existing document effect; no direct recovery clear/write policy is added.

Without an owned accepted change, Stop preserves document and history, marks the old view stale, and says: `The document is unchanged. The view is not up to date.` It does not undo an older accepted edit. New/Open and normal Undo/Redo have separate invalidation. Explicit replacement permission is scoped only around `replaceDoc`; route/chat `whole=true` remains ordinary admission.

Worker provenance is invalidated on this selected Stop path. Accepted result, parameter/route handoff, deferred parameter mass, and body-claim caches are cleared before restart. Old pixels may remain visible as stale; they cannot become fresh solely by a matching content key. Ordinary owned rollback obtains its result from the new worker. Placed result caches are cleared, and an App-private counter reruns only the existing placed effect. A worker-session ref changes synchronously on selected Stop/restart, and checks against it prevent the old placed loop from submitting more work or installing an old map. It is distinct from the history/work generation: Undo/Redo alone does not invalidate the backend session. The counter is not added to the main effect, so an ownerless stopped computation is not automatically restarted. Repair-stage and other restart paths were not refactored or qualified here.

## Proof boundaries

The helper units prove pure decision/identity behavior only. They do not execute App latch consumption, effect scheduling, browser acceptance, dirty/recovery wiring, or native worker/cache provenance. Source inspection covers that wiring; the consumer's actual controlled UI/native-worker evidence is separate. No new Undo/batch/EngineClient API, schema, migration, dependency, timeout release, or guessed MODEL_FIELDS list is introduced.
