# CAD Editor entries and transactions

| Public entry | Workspace / release map | Consumer role |
| --- | --- | --- |
| Root | `src/index.ts` / `dist/index.js` | Pure native sessions and public types. |
| `/react` | `src/react/index.tsx` / `dist/react/index.js` | Mounted viewport, inspector and reusable task components. |
| `/styles.css` | `src/styles.css` / `dist/cad-editor.css` | Explicit host stylesheet import. |

## Root factories and errors

`createCadEditorSession(initialDocument:CadDocumentV1,options?:CadEditorSessionOptions):CadEditorSession` validates and copies complete native data. Options select `displayBodyIds` and `view` independently of the document.

`createCadEditorFeatureSession(document:BooleanExtrusionFeatureGraphV0,options:CadEditorFeatureSessionOptions):CadEditorFeatureSession` creates the separate feature-graph session. Options specify native graph admission, selected feature/output slot and bounded mesh profile.

`CadEditorError` carries `code`, bounded message, copied context and actual cause.

## Canonical session reference

| Methods | Arguments and result | Lifetime / refusal |
| --- | --- | --- |
| `getSnapshot()`, `subscribe(listener)` | Copied CPU snapshot; unsubscribe function. | No renderer exposure. |
| `selectSurfacePole`, `selectCurvePole`, `requestSelection`, `resolveSelectionTransition` | Qualified body/coefficient target; transition token and explicit choice. | Stale/unsupported target refuses. |
| `stageSurfacePoleField`, `stageCurvePoleField`, `stageBodyTranslationField` | Field and raw string; retains separate draft. | Native admission occurs at preparation. |
| `setEditTarget`, `setRotationAxis`, `stageBodyRotation`, `setScaleAxis`, `stageBodyScale` | Supported edit mode/axis and raw scalar. | Profile capability governs actual edit. |
| `prepareApply(): CadEditorCandidate \| null` | Whole native candidate or no effective change. | Does not commit authored history. |
| `prepareOpen(text,options?)`, `prepareUndo()`, `prepareRedo()` | Session-bound candidate. | Pending/stale/budget/profile guards apply. |
| `prepareDisplayBodies`, `prepareCurveFocus`, `prepareDocumentView` | Display candidate, retaining native authority. | Only display generation advances after acceptance. |
| `prepareRenameBody(bodyId,name)` | Candidate or no-op. | Canonical body label is separate from native IDs. |
| `acceptCandidate(token)`, `cancelCandidate(token)` | Exact session-local token; acceptance returns snapshot. | Foreign/stale/reused tokens refuse. |
| `serializeAccepted(): CadEditorDownload`, `markDownloaded(token)` | Token, text, suggested filename; started-download status. | Pending excluded; stale capture refuses. |
| `inspectExport`, `exportAccepted`, `inspectCurveLength`, `inspectCurveD2`, `inspectSurfaceD2`, `inspectCurveCurvature`, `inspectSurfaceCurvature` | Accepted revision-qualified reference and query/options. | Original native result; errors preserve authority. |
| `discardPending()`, `dispose()` | Clear raw fields; release CPU session. | Dispose idempotent, later mutations refuse. |

[Exact public canonical session signatures and result fields](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-editor/src/types.ts)

## Feature and React entries

Feature sessions expose the shared candidate/history/download lifecycle plus `selectFeature`, `stageLengthParameter`, `stageBooleanOperation`, `getFaceCorners`, `prepareFaceCornerEdit`, `prepareDisplayOutputs`, `prepareExtrusionTransaction`, `prepareParameterTransaction`, `prepareReferencedFeatureTransaction` and `inspectExtrusionProperties`.

[Feature session types](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-editor/src/feature-types.ts)

React exports `CadEditor`, `CadEditorViewport`, `CadEditorInspector`, `useCadEditorSnapshot`, `CadEditorFeature`, `useCadEditorFeatureSnapshot`, `CadEditorExportReview`, `CadEditorGeometryAnalysis` and `CadEditorBodyRename`, with their public props/receipt types. Hooks subscribe to caller-owned sessions. Receipts distinguish actual native inventory, view and fresh pixels; they are not native document authority.

[React public exports](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-editor/src/react/index.tsx) · [React props and receipt contracts](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-editor/src/react/types.ts)

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-editor/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-editor/README.md)
