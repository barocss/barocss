---
work_id: physics-world-p3-2276
artifact_type: separate-recorder-integration-contract
status: authored_not_run
owner_role: bounded-recorder-integration
source_request: qualify recorder ownership and exact restore continuation under a separate fixed budget
last_updated: 2026-11-02
---

# P3 recorder integration contract

This is a separate, postqualification integration check. It does not spend or
extend the original 47-constructor / 4182-attempt control budget. It does not
activate the package or expand the admitted physical profile. No run is
authorized by this document alone. An explicit, hash-matched execution freeze
and the parent runner command are required.

Use the unchanged original four-sphere/two-disjoint-hinge fixture and empty
accepted commands only. Require completed source, repeat, native emitted main
qualification and the bounded controls result before execution.

Run one SOURCE graph, then one native emitted graph. Each graph creates one
World directly and one through `restorePhysicsRecording`. SOURCE must bundle
the staged root and replay entries together, with one private recording-owner
registry. Native must import the actual staged published `dist/index.js` and
`dist/replay.js`, whose recording-owner and error-class modules are shared.
No source fallback, serialization, or deserialization is permitted.

Per graph, record four accepted empty steps, restore those four frames, and
continue both the original and restored recorders by one accepted empty step.
This gives ten accepted physical steps and two World constructors per graph:
four constructors and twenty accepted physical steps in total.

At the saved S4 checkpoint, call the direct World step and a method cached
before recorder attachment. Both must refuse with `WORLD_OWNED`. A second
recorder attachment must also refuse with `WORLD_OWNED`. Submit one malformed
recorder command targeting a missing body. It must refuse with
`INVALID_COMMAND` and preserve the public state and recording exactly. These
are three additional refused World-step implementation entries per graph;
attachment is a separate operation, not a World step. Count all calls.

Per graph: two direct World-step calls, both refused; seven explicit recorder
step calls, six accepted and one refused; four internal restore recorder-step
calls, all accepted. Total World-step implementation entries are thirteen,
ten accepted and three refused. The two graphs therefore make twenty-six
entries, twenty accepted and six refused. Do not count refused entries as
accepted physical steps or omit them from attempted-call totals.

Internal restore constructor/step counts are source-bound counts from the
frozen `restoreRecording` implementation: one constructor and one recorder
step per admitted frame. The runner records the four-frame input, successful
restore, returned S4 cursor, and exact reconstructed public state. Native
internal calls have no new observer hook. Report this count boundary; do not
label it a new instrumented native trace. Explicit calls have durable counters
before invocation. A partial or thrown restore remains incomplete and must
not be reported as four successful internal steps.

Mutate a saved recording copy, including nested model, frame commands, final
body state, and identity data. The live recording and World must remain
unchanged. Restore the pristine recording. Compare the restored S4 state and
recording exactly, including signed zero. Continue both recorders to S5 and
compare their public states, raw body bytes, and saved recordings exactly.
Check each returned S1-S5 state against its authenticated original saved bank
row and the qualified observed SOURCE comparison receipt. This is public
output/certificate reuse. It does not observe replay reconstruction's internal
phase outputs or add a new independent numerical oracle.

Dispose both recorders and both Worlds on every reached normal exit. Preserve
cleanup errors separately from the first failure. Stop at the first mismatch,
unknown error, resource failure, or unresolved certificate reuse. Do not run
the native graph after a failed SOURCE graph. Store fresh-ID receipts, bounded
records, exact before/after state, zero-sign sidecars, and the first failure.
Each child has a 180-second limit. Fixed evidence is bounded at 32 MiB and
failure evidence at 8 MiB. No dependency installation, original archive edit,
production source edit, remote write, deployment, or release is part of this
check.
