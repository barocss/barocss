---
work_id: D583
artifact_type: tool-call-context-qualification
status: fixed-and-qualified-for-independent-model-calls
last_updated: 2026-11-10
---

# D583 — Keep tool options with their invocation

P0, B09, rows 04 and 16. Bounded FULL qualification of overlapping typed tool calls on independent CAD documents. [#2398](https://github.com/barocss/barocss/issues/2398).

The original Model stored `because` and `response_format` in module variables. A native 40 mm plate could be scaled to 60 mm without a reason while another call supplied one. An overlapping call without a reason could also make an authorized edit fail. Response detail followed whichever call last set the shared mode. The same state leak could authorize a nested batch edit or suppress the default detail of a later DXF import. The deterministic tests control evaluation order and keep both documents independent.

The dispatcher captures each call's own enumerable options before awaiting an evaluation. All existing acceptance and summary routes use that snapshot. Each batch or proposal operation gets its own options. Scripts still forward their reason and request concise child results where those arguments are supported. A hidden or inherited property cannot supply a reason or response mode. The grouped tool schemas, native evaluation, proposal and autonomy gates, and serial stdio queue keep their existing contracts.

Actual desktop Studio submits two public Chat turns over a controlled loopback transport. The test service uses the real grouped Model, native evaluation, and a barrier to complete a companion call first. Studio keeps the original 40 mm plate after the refused result and applies the 60 mm candidate with its own reason. The known dimensions give 6,400 and 21,600 mm³. Studio verifies volume, centroid, the visible hard requirement, first Undo and Redo, project Save and fresh public Open. The separate local-file MCP control verifies ordered replies, native file preservation on refusal, and readback after the permitted edit.

- **PASS** — focused Model and Studio tests, actual desktop and local MCP, targeted mutations, lint, both type checks and Studio build.
- **FAIL** — nine focused cases on the original Model. The original desktop harness stopped when its native producer accepted the first reasonless result. An intermediate implementation also accepted a hidden reason. The added legacy regression now passes.
- **NOT_RUN** — live providers, overlapping public Studio chat turns, shared-document concurrent writes, whole Model/kernel suites and whole B09 acceptance.

The experimental `./chat/toolKit` wildcard exposure drops `setCall`, `because` and `responseFormat`, changes the internal `accept` and `PartHandler` signatures, and exposes the internal `CallOptions` type. The generated before/after inventories isolate those six keys. The checked-in broad inventory already fails IV001 at the parent and retains its separate refresh scope.

[Commands and receipts](qualification.json). Whole CAD remains **NOT_MEASURED**. Next is D584, P0 B09, rows 04 and 16, to bind each AI task's inputs, owned scope and verification duties to its spec revision. [#2399](https://github.com/barocss/barocss/issues/2399).
