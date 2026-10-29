# D327 mesh import/repair extraction

Status: source ready for main integration and source-only review. Types/lint/tests/native browser are **NOT_RUN by this worker**. Only new useMeshImport.ts, MeshFileDialogs.tsx and these scoped notes were written; no App or other worker source was edited.

Fixed source `1266cdf24943acc5963bf5e346339e32c9f3da41` copy ranges and typed API are in [contract.json](contract.json). The hook owns unit question/scaled mesh, worker stage and repair question state plus existing stop/open/check/apply/edit/remove handlers and repair blob record helper. Inputs are current StudioDoc, existing EngineClient, central revision allocator, FriendlyError notice and two central App acceptance callbacks. Existing public setters/actions remain available to the STEP/general-file router and DEV reset.

App onOpened must preserve the original replaceDoc → filename → dirty → delayed viewport fit order, after hook clears the repair question and before the original success notice. onCommit receives the original next document and false argument. Worker part reads still use the read lane and one allocated revision in the same position. No captured values or generation/async policy were added. stopStage still restarts the engine and clears stage with the exact existing notice.

An optional ReactNode children slot between the two questions preserves the original unit → model export dialogs → repair DOM order. The two dialog blocks preserve labels/classes/roles, unit size formatting, options, repair step/result invalidation, check/apply controls, closed-only as-is action, remove-repair and cancel handling. App keeps its blob eviction effect (doc/undo/redo/evaluatedRef and repairAsk dependency), mesh badges/selection rendering and stage work bar; those were not copied into the hook.

This is a source-only extraction. It does not fix known A05 nonserialized formats, delayed stage callbacks or repair/import async ownership. No new runtime dependency, geometry algorithm, schema or capability is introduced. Root/main own final integration and serialized validation; no heavy command, browser, test, commit or push was run here.
