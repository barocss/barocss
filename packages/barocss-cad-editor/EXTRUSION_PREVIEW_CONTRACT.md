# CAD Editor: bounded extrusion preview integration contract

Status: **pre-implementation contract**, NOT a live preview implementation, renderer
acceptance, or performance measurement. Parent [#1729](https://github.com/barocss/barocss/issues/1729).
Native preview/acceptance bridge: #1721 / merged #1722. Native disposal #1743 /
PR #1744 remains a dependency until adopted on `develop`.

## Authority and eligibility

`createCadEditorFeatureSession` remains the only owner of the accepted authored
graph, derived output meshes, saved file, generations and history.
An ephemeral Native preview session is an **advisory sidecar**. Never use its
`accept(token)` as an Editor commit: it can advance its own internal graph
without the Editor's display admission and transaction, violating rollback.
The Editor must still prepare a complete full-native candidate and accept it
only after its existing display validation succeeds.

The sidecar may be created only for a selected existing
`normal-extrusion` feature in the Editor's current accepted graph, with a
qualified region and options. Obtain all input from the Editor-owned accepted
result and declared native display options, not a caller-provided serialized
cache or mesh. Changing graph, selection, generation, display generation,
output set or native options invalidates the sidecar and pending ticket.
Creation/evaluation failures leave Editor authority untouched.

## State machine

```text
IDLE --qualified selection + accepted snapshot--> READY
READY --prepare distance--> PREVIEW_PENDING
PREVIEW_PENDING --new distance--> PREVIEW_PENDING (old ticket invalid)
PREVIEW_PENDING --cancel/refusal/stale--> READY or DISPOSED
PREVIEW_PENDING --full-native apply + full output display admit--> READY (new accepted epoch)
READY/PREVIEW_PENDING --unmount/open/selection change/structural edit--> DISPOSED
```

- Preview distance is validated by the Native provider. No clamp, unit
  conversion, geometry cache serialization, or implicit authoritative edit.
- Preview geometry must pass an isolated, explicitly bounded display preparation
  path; no mutation of current `snapshot.accepted`, `snapshot.display(s)`,
  `pending`, history, dirty/download status, selection, or source bytes.
- A rendered preview is not an accepted mesh or a persisted CAD model.
  Label transient presentation accordingly and retain complete source provenance.
- On Apply, use the existing Editor `stageLengthParameter` / `prepareApply`
  and `acceptCandidate` pipeline with a **new full-native graph evaluation**,
  complete output/display admission and its own Editor token. The Native preview
  ticket is never passed as an Editor acceptance token.
- A failed GPU/display preparation, invalid edit, stale completion, cancellation
  or budget refusal must leave the last accepted model and frame unchanged; if
  visible preview cleanup cannot be guaranteed, report the display as unavailable
  rather than asserting retained pixels.
- Dispose/cancel of Native state must be idempotent and reject late replies.
  Do not integrate against an unadopted disposal contract.

## Required acceptance evidence (not yet run)

1. Native authored fixture with one selected extrusion, distance 2 → preview 3
   → full accepted 3 → preview 4 → full accepted 4; compare selected preview
   geometry against independently evaluated full-native geometry.
2. Two rapid edits, superseded ticket, accept twice/replay, cancellation,
   stale graph revision, selection/output/display-generation changes, invalid
   distance, and malformed caller data all refuse without Editor acceptance.
3. GPU display refusal and mesh/time/memory budget refusal preserve authored
   model/history/source and avoid a false successful preview/commit claim.
4. Undo/Redo and Download/cold Open retain the authoritative full graph and
   accepted revisions, never preview data. Preserve persistent native lineage.
5. Source and compiled Node 22 checks, Editor-owned targeted tests, and genuine
   headed browser/GPU rendering with physical authored file replay are recorded
   separately. CPU receipts, mocked WebGL and source inspection are NOT GPU pixels.

## Boundaries

No shared/root/package-index edits by this spec; no Native/GPU/Viewer code or
solver changes. The sole Integration owner adopts dependencies serially.
Keep #1729 OPEN until the adapter, actual Editor display proof and linked
device gate have independent evidence. This specification is an implementation
guardrail, not a substitute for those results.
