# D327 App decomposition source map

Baseline: `1266cdf24943acc5963bf5e346339e32c9f3da41`.
Baseline App: 4,012 lines / 385,325 bytes.
This is a behavior-preserving refactor. It adds no schema, dependency, public package API, callback context, or framework.
Remaining A05 import-format ownership work is not included.

## Central App responsibilities

App retains document dispatch, synchronous docNow assignment, work/save/open ownership refs, exact evaluation handoffs, Undo/Redo/Stop, central document acceptance, and filename/dirty/recovery adoption. Functional state updaters still go directly to React. The same-render Save scope and the final serialized Open/reference-verification current-owner checks remain in App.

Route acceptance retains this synchronous sequence: canChangeDocument, discard, exact evaluated-result handoff, whole-document commit. The original doc-change and unmount effects call the route controller from their original App positions. The late blocked-context assignment, gizmo creation, and guide memo remain after proposal context is known. The mass listener patches the current route ref and stable setter through patchMasses.

## Cohesive modules

- `files/documentFile.ts`: serialized byte read/decode checkpoints, reference-verification dataflow, synchronous encode/download. Every async caller rechecks its owner immediately before adoption.
- `files/importedFile.ts`: existing DWG/STEP/STL/OBJ/IGES/barocad routes, selected before awaiting. Serialized fallback never awaits this helper. Existing import callbacks and format limitations remain unchanged.
- `files/useMeshImport.ts`, `MeshFileDialogs.tsx`: mesh unit questions, diagnosis, recorded repair and existing dialogs. Blob eviction and its repairAsk dependency remain in App. Dialog children preserve unit / export questions / repair DOM order.
- `files/useModelExports.ts`, `ModelExportDialogs.tsx`: model export state, action handlers and questions. Existing source-owner checks and STL generation/cancellation remain in the controller.
- `robot/useRobotExports.ts`, `RobotInspector.tsx`: robot mass/export data and the joints card. App retains useJoints, its subscriptions and motion-contact effect.
- `state/useRouteBundleEditor.ts`: one frozen route draft, sequence/gesture/pointer ownership, worker preview/final evaluation, debounce and display-only guides.
- `state/useCommandPreview.ts`: HUD preview queue, command subscription, delayed full preview and shared drag refs. App retains the effect registration/dependencies and uses the same returned refs for HUD/font/gizmo callers.
- `state/useFeatureHistory.ts`: existing delete, reorder, suppress, separate and cascade validation through central App commit.
- `state/useProposalPreview.ts`: proposal tool operations and ghost state. Model-change reset and diff effect registration remain in App.
- `state/useModelChecks.ts`: reference display loading, keep-out checks and requirement checks with their original independent cleanup guards.
- `sketch/useSketchActions.ts`: sketch placement, outline editing, linked inset and Finish. App owns sketchGeneration, docNow and document acceptance.
- `viewport/useCommandGizmos.ts`: command transform/dimension handles and shared drag refs. Original drag effect positions remain in App.
- `viewport/useModelAppearance.ts`: drawn-array identity, preview precedence, offsets and body/face colours. Original memo dependency identities are passed through.
- `viewport/useRenderPlayback.ts`: animation playback, turntable updates, video recording and image export using the existing viewport.

## Leaf UI and pure helpers

Browser: BodyBrowserRows, RequirementsBrowser, DesignHistory, ReferenceDecisions, ProposalBrowser. Inspector: SelectionInspector, DirectInspector, MeasurementInspector, RobotInspector. Feature UI: FeatureHistoryBar, FeatureHistoryMenu, ModelTools, TemplatePicker, ViewContextMenu. Existing local editor state remains in App where visibility changes must not reset it; SelectionInspector receives the central NodeEditor closure as children.

Pure/helper modules: app/bodyResults, documentChanges, commandState, studioConstants, routeSession, sketchControls, directGeometry; ui/featureIcon. Body/command WeakMaps remain module-private with module lifetime. NodeEditor, PointTest and CursorReadout retain their existing leaf contracts. New modules do not import App.

## Evidence boundary

The root owns all serial builds, types, lint, focused/full Studio tests and native browser qualification. This worker has not run those checks. The first root checkpoint passed types/lint; later checkpoints exposed ordinary missing-input/type/unused-binding errors, which are retained in `/tmp/d327-types-second.txt`, `/tmp/d327-lint-second.txt`, `/tmp/d327-types-third.txt`, and `/tmp/d327-lint-third.txt`. The second lint failure was an incorrect file path in the invocation. These receipts do not certify the final graph. The consumer owns the actual-hook route regression file; its root-reported 6 PASS is separate from geometry and native UI proof.

Final graph build/types/lint, Studio 429 and selected native qualification completed. See README.md and qualification.json for exact run outcomes and exclusions. Root owns commit, push and remote verification.

## Final source freeze

App: 2308 lines / 214011 bytes. The root accepted this cohesive boundary instead of forcing central ownership/evaluation out solely to meet a line target. ViewDisplayControls owns the existing corner-right DOM with domain props; all state, setters, section-start ordering and viewport ownership remain unchanged.

`final-source-profile.json` records App and all new production modules at this checkpoint. This is provenance, not a checksum acceptance test. Final runtime/types/lint/browser evidence remains owned by the root.
