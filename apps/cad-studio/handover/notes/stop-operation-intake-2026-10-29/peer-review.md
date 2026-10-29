# Studio003 peer review

Verdict: **APPROVE_NARROW_P2**.

Approve one discrete issue: **Stop takes back a later accepted Render Grid edit instead of the model change that started the pending computation.** The evidence proves this under controlled delivery of actual native Worker messages. It does not prove natural slow computation or a current-HEAD execution failure.

## Reviewed scope

Read `runs/studio-003-prepared/results.json`, `execution-summary.json`, `derived-facts.json`, `execution-preflight.json`, `harness/studio-stop-worker-delay.mjs`, `harness/studio-stop-probe.mjs`, `research/studio-cancel-invariant.md`, `research/studio-stop-probe-plan.md`, and relevant frozen source. No source change, build, test, browser run, issue action, or external message was performed by this review. Only this review file was written.

Executable baseline: `5463dbf32af5dd10670badd0d334c68504615292`. Preflight records author committed HEAD `b1a9ed8c9dbbbe463fae1600151041870914937d`; App/client/RenderPanel/useVariants/evalMemo match the previous exact committed comparison `73c6085171f7d9b6931c395917742211f0266cbb`. The invariant and preparation record that ordinary evaluation, Render commit, Stop and Undo semantics match the executable baseline. This review does not execute either author HEAD or WIP.

## Hook fidelity

- `harness/studio-stop-worker-delay.mjs:12–20` subclasses the saved native Worker, calls its actual constructor, and registers a message listener before EngineClient assigns `onmessage` (`runtime/5463dbf32/apps/cad-studio/src/engine/client.ts:48–51`). The original Worker continues to compute.
- Hook lines20–24 log actual native message events, then call `stopImmediatePropagation()` and retain the original event object when holding. There is no manufactured payload, geometry replacement, cloned event, or call to the client handler. The log reads payload fields but does not write them.
- Hook lines28–38 arm exactly the next real engine `evaluate` submission and call the native `postMessage` unchanged. Holding begins before that submission is sent.
- All subsequent messages on the selected worker are held in receive order. This includes both the terminal mesh result and deferred mass patch, so the hook does not expose a mass patch to EngineClient before its mesh result. Earlier client-delivered messages are not changed.
- Hook lines40–43 clear the retained events and call actual native `terminate()`. There is **no replay or release path** in this hook. Describe the exercised behavior as FIFO retention followed by discard on termination. Do not claim that replay fidelity was tested.
- The hook changes event delivery scheduling. It does not prove that the browser naturally permits this duration between a successful native result and client delivery. This limit does not invalidate a controlled pending-client test of Stop ownership. The app still follows its actual public control, document, history, and EngineClient restart paths.

## Schedule and observations

Raw results agree with the summary and derived facts:

1. Public Box Apply creates D0 with 2 nodes. A second public Box Apply creates D1 with 4 nodes. Selected real request 6 / revision 6 / epoch 1 has a successful actual native response after 44.100 ms. The hook holds that response and its subsequent mass patch.
2. D1 and D2 snapshots have identical selected request data and identical trace arrays. No new evaluate, message delivery, or termination occurs between them. Public Render → Scene → Grid accepts `grid=true` in D2. D2 nodes and parameters equal D1. The existing Cancel/Stop control remains visible and enabled.
3. Public Stop terminates that real worker and discards 2 held events. The stopped document equals the entire D1 document. It differs from D2 because Grid is removed. The originating second Box remains. No new evaluation is submitted until public Undo.
4. The recovery document after Stop equals D1. Dirty remains true. Public Undo restores the entire D0 document; Redo restores the entire D1 document. A later Grid edit and Undo restore the complete pre-edit Redo document. No page error is recorded; owned context/browser/server cleanup is recorded.

This is a reversible wrong-edit rollback. Do not describe it as permanent data loss, broken history, malformed geometry, or lost native mass. Redo remains available for the Grid edit after Stop. Full stack depth and exact viewport body provenance are not exposed.

## Public contract and source cause

All source paths below are relative to `runtime/5463dbf32/` and use its exact line numbers.

- `apps/cad-studio/src/App.tsx:1764–1765` states that Stop takes back the change that started the computation. The actual public control at3595–3596 says “Stop this computation and take the change back” and calls `cancelWork`. This supports an originating-change contract; there is no inspected public instruction that Stop should Undo the latest unrelated edit.
- `App.tsx:1768–1771` restarts the engine, clears busy/slow/preview state, then calls the current `doUndo` whenever Undo is nonempty. `App.tsx:1773–1776` restores the current top history entry. Neither action checks which edit started the pending evaluation.
- `App.tsx:963–967` commits Render settings through `pushUndo()` and a shallow document update. It therefore places D1 on top of Undo after accepting D2. `apps/cad-studio/src/ui/RenderPanel.tsx:135,328` routes public Grid changes through this callback.
- `App.tsx:783–795` excludes render settings from the evaluated model inputs. `App.tsx:834–845,921` keeps ordinary evaluation alive when its evaluated model remains unchanged. Thus D2 can replace the current history top without replacing D1 computation ownership.
- `apps/cad-studio/src/engine/client.ts:86–96` performs the actual restart and clears pending work/protocol maps. Its epoch check at52 prevents old worker replies from entering the new epoch. These guards protect result delivery, but do not select the edit to take back.

A narrow issue location is `App.tsx:1768–1770`. In the compared author revision this section precedes the unrelated STEP change, so the same location applies according to the recorded source comparison. Do not attach the issue to geometry kernel or mass code.

## Expected behavior and completion criteria

Stop must not silently Undo an unrelated Render edit accepted after the initiating model edit. Fix ownership of the cancellation transaction, or prevent/clearly refuse independent document edits while cancellation would use a single Undo pop. If later independent edits remain accepted, Stop must preserve them and take back only its owning model change, with coherent history and recovery state.

A bounded regression check should use the same actual UI schedule with a controlled pending evaluation: model Apply → accepted Render Grid change → Stop. Assert that Grid is preserved if accepted; assert the defined model rollback; assert consistent Undo/Redo and recovery; assert worker restart discards the old messages. If the chosen fix blocks Grid while pending, assert that no Grid document/history change is accepted. Keep this controlled regression separate from a future natural long-compute scheduling check.

No regression check was run in this peer review. Product acceptance remains **NOT_DECIDED**. Natural slow computation/UI scheduling, current-HEAD runtime behavior, broader editing surfaces, full stack depth, viewport provenance, and release readiness remain **NOT_PROVEN**. Parent duplicate checking and issue filing remain separate actions.
