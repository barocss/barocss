# Apply whole source and camera transactions

## Author a Native Light scene

Open **Material Editor → Light workbench** in `apps/render-editor` (`material.html?workbench=lights`). Choose **Start directional workspace** or **Start point workspace**. This route owns a required-WebGPU canvas; unavailable startup is reported rather than treated as an accepted frame. The older `workbench=directional-lights` route remains a compatibility route.

1. Under **Scene bodies**, choose the original body ID. Repeated names or geometry IDs do not merge targets. Selection only changes Inspector context; every body's corrective fields, including hidden bodies, survive row changes without Apply or a history entry.
2. Edit **Origin position (mm)** XYZ or **Scale (dimensionless)** XYZ. Translation is native mm, bounded to −10000..10000; scale is 0.001..100 per axis. The existing raw XYZW quaternion, visibility, complete CAD source and material bindings stay intact. These numeric fields do not edit native geometry or add rotation/visibility controls.
3. Edit **Scene camera**. Eye/target XYZ and near/far use scene units; Up XYZ is dimensionless and retains its authored magnitude; vertical FOV is degrees. These are saved camera edits. To inspect without editing that camera, use the [local viewport controls](#navigate-a-local-viewport-camera).
4. Select or add a light of the chosen kind. Directional XYZ is a raw nonzero direction; point XYZ is final-world position and range is in scene units, unaffected by native mm conversion or body poses. Both kinds edit label, enabled, linear RGB and intensity; ambient remains available with zero lights. Disabled entries still count toward the four-light limit.
5. **Apply** presents all body, camera and light changes together, then accepts one document/history step. Wait for completion before the next operation. A refused field or presentation retains accepted authorship/history and corrective drafts. **Discard** restores all accepted fields. **Undo/Redo** is available after drafts are resolved and uses the same whole-scene transaction.
6. **Save accepted** requests a `.light-scene.json` download of accepted data, even when corrective fields remain. To include those edits, successfully Apply first. In a fresh workspace of the same kind, **Open** the saved file, select the same original body and continue editing. A download request alone does not establish physical persistence.

Open and New ask before leaving unsaved changes/drafts; cancelling retains them. A refused or stale Open also leaves the current scene and fields in place. **New directional** / **New point** deliberately ends the old lifetime and starts another; it is not an atomic backend swap. **Remount accepted scene** retains accepted authorship, clears history and requires a new renderer. Failed or lost presentation does not promise old pixels.

### Navigate a local viewport camera

In either light workspace, choose **Orbit** or **Pan** and drag the viewport. Hold Shift while dragging to pan temporarily. Scroll the wheel or use **Zoom in/out** to change distance. **User view** identifies a local camera; **Scene view** follows the accepted authored camera. These controls use the existing camera admission and scene-coordinate conventions, not native millimetre conversion.

Navigation preserves accepted document bytes and identity, raw corrective fields, dirty/unsaved authorship, Save payload identity, authored revisions and Undo/Redo history. You can inspect while incomplete body/material/light/camera strings remain in the Inspector; those strings are not submitted. **Save accepted** still writes the authored scene camera. A local view alone is not unsaved file content.

**Scene camera** explicitly presents the accepted scene camera without consuming drafts. **Set scene camera** is available only after navigation finishes and all authored fields/session drafts are clean. It stages the acknowledged local camera and performs one ordinary whole-scene Apply, advancing the scene/catalog revision and history once. Resolve corrective fields separately; this action never silently applies them. When the authored camera becomes exactly the local camera, the workspace returns to **Scene view**.

Ordinary Apply and Undo/Redo retain an active local view while their accepted authored cameras follow normal history. Successful Open resets the view to the incoming scene camera; a refused Open retains the current view and accepted/raw state. New workspaces and explicit remounts begin with their scene camera; remount also clears history as described above.

For a custom host, await `session.navigateViewportCamera(camera, session.getSnapshot().version)` or `session.resetViewportCamera(session.getSnapshot().version)`. The existing unsuffixed session exposes `viewportCamera` as an immutable owned camera, or `null` to follow accepted authorship; `viewDirty` identifies a local override, and `pending: 'view'` identifies its pending presentation. Read a fresh version for each operation: navigation advances session/Viewer generations and invalidates earlier prepared candidates, without changing authored revisions. Exact raw-camera equality, including signed zero, is a no-op.

The workbench allows one presentation in flight and accumulates subsequent inputs into one latest desired camera. Authoring/file actions wait during a drag or queued/pending update; a file chooser and Help fence new gestures. Escape, pointer cancellation/capture loss, blur or a changed viewport rectangle stop queued motion. They do not roll back an in-flight or acknowledged view; wait for its outcome, then use **Scene camera** if a reset is wanted. An ordinary refusal retains the last acknowledged view and unlocks controls. Unavailable presentation requires explicit recovery; retained camera metadata does not certify pixels. See [navigation limits and lifecycle](./limits#local-viewport-navigation-limits).

This workflow follows adopted [session ownership](https://github.com/barocss/barocss/blob/f8ddf0d8c2d0f802c98d1a2c55588b4ee3eff8f3/packages/barocss-render-editor/src/native-light-session.ts), [input coalescing](https://github.com/barocss/barocss/blob/f8ddf0d8c2d0f802c98d1a2c55588b4ee3eff8f3/apps/render-editor/src/native-light-navigation.ts) and [workbench controls](https://github.com/barocss/barocss/blob/f8ddf0d8c2d0f802c98d1a2c55588b4ee3eff8f3/apps/render-editor/src/native-light-workbench.tsx). The backend still rebuilds complete render candidates, so this initial control makes no smooth-animation or frame-rate claim.

### Edit scalar material uniforms for a body

Select a visible original body under **Scene bodies**, then use **Body material**. The controls show scalar names, ranges and defaults compiled from that binding's original shader declarations. A hidden body, missing/unqualified binding or material without scalar declarations has no editable uniform controls; selecting it creates no binding or ID. See [Surface B in the existing downloads](./examples#edit-the-existing-amount-uniform-on-surface-b) for a ready example.

Enable **Override** to supply a finite decimal within the declared range. Clear it to omit the property and use the shader default. An explicit override equal to the default is still authored data and differs from omission. Corrective text stays with its own body/uniform while switching bodies or toggling Override; text under a cleared Override is retained locally but is not supplied to the material. Invalid active input refuses the complete Apply and remains available for correction. Successful Apply, Discard, Open, Undo or Redo refreshes fields from accepted authorship.

The edit belongs to the full qualified body binding and its existing embedded material, not a material-ID lookup. Two bodies may repeat a material `documentId` without becoming linked assets: editing one leaves the other's embedded document exact. Original shader source, metadata, target pins and unrelated source/TEN/materials/poses/camera/lights are preserved unless separately edited through their existing controls. This panel adds no shader-source editing or material import/preview.

The existing `createRenderMaterialSession` performs temporary preparation for each embedded binding and is always disposed. Its dirty comparison distinguishes override presence and signed zero (`-0` versus `+0`). Each changed binding prepares one next material revision; unchanged bindings retain theirs. A changed material already at maximum revision refuses before presentation. No separate material history or presentation is committed. Formatting-only changes such as `.40` to `0.4`, with the same override presence and numeric value, remain whole-scene no-ops when nothing else changed.

Material, body, camera and light edits share one whole-scene **Apply**, one presentation transaction and one accepted history entry. Wait while an operation is pending; refusal or a stale operation retains accepted authorship and corrective fields. Resolve drafts before **Undo/Redo**, which restores whole-scene authorship. **Save accepted** includes only accepted embedded materials; successfully Apply first to include an override change. A fresh same-kind **Open** restores the saved bindings and values for re-edit. Physical WebGPU, file and device acceptance remain separate.

This subsection follows the adopted implementation at `ba54ea14ed38163f4b1074a5b2aa0a17158c4bf7`: [field preparation](https://github.com/barocss/barocss/blob/ba54ea14ed38163f4b1074a5b2aa0a17158c4bf7/apps/render-editor/src/native-light-fields.ts), [workbench controls](https://github.com/barocss/barocss/blob/ba54ea14ed38163f4b1074a5b2aa0a17158c4bf7/apps/render-editor/src/native-light-workbench.tsx) and [app contract](https://github.com/barocss/barocss/blob/ba54ea14ed38163f4b1074a5b2aa0a17158c4bf7/apps/render-editor/README.md#body-bound-scalar-material-uniforms-1636).

### Preserve qualified authority and raw values

A body is qualified through its original CAD document ID/revision, body ID, source asset ID/revision and original model/geometry ID. Keep the explicit `nativeOptions.bodyIds` selection and corresponding material targets; never select by a shortened Surface name alone. `createRenderNativeLightRequest` reconstructs the original native source/TEN/material composition from that authority. It does not replace source with sampled meshes or certify a rendered frame.

Use the signed-value codec instead of `JSON.stringify` for authored files. Camera Up, directional vectors and existing pose quaternions retain raw components; validation is not normalization. Numeric `-0` remains distinct from `+0`. Incomplete decimal strings such as `-` or `1e` remain local corrective input and cannot become accepted numbers. See [the exact bounds](./limits#native-light-format-and-bounds).

An empty `display.poses` array is identity intent for the complete selection. Reading/selecting, camera/light-only edits and numeric no-ops leave it empty. The first real numeric body transform expands poses for every selected body, including hidden ones, with identity poses for unchanged bodies. Existing nonempty pose order and each body's raw quaternion remain intact.

The workbench compares the **complete prepared document** through `serializeRenderNativeLightDocument`. If only numeric formatting changed, such as `1.0` to `1`, Apply resets field formatting without a Viewer request, revision change or history entry. A signed-zero or any other body/camera/light change is not a no-op. This comparison is host behavior: calling session `prepareDraft` and committing directly still creates an Apply revision.

### Use one generic async authoring API

The same `parseRenderNativeLightDocument`, `prepareRenderNativeLightDocument`, `serializeRenderNativeLightDocument`, `createRenderNativeLightRequest` and `createRenderNativeLightSession` work for both kinds. `lights.profile` is the discriminator; do not add a separate kind field to the document. Current files use envelope version 2 / `canonical-native-lights`; public authoring names stay unsuffixed.

`createRenderNativeLightSession(canvas, document, {width, height})` is asynchronous and exclusively owns its actual Viewer. Accepted documents, snapshots and prepared candidates are immutable. Stage original text with `setDraftText(text, snapshot.version)`, obtain a fresh version, then `prepareDraft(version)` and **await** `commitPrepared(candidate)`. Preparation alone is CPU qualification. Acceptance follows the actual Viewer acknowledgement. Candidates are session/version-bound and single-use; do not retry a consumed candidate. Reprepare against the current snapshot after correcting a refusal.

`prepareUndo`, `prepareRedo` and `prepareOpen` also require the current version and an awaited commit; history preparation can return `null`. Open preserves the imported revision and starts fresh history. Apply and Undo/Redo advance the scene and light-catalog revision together. A pending operation fences competing mutation. Malformed acknowledgements or indeterminate presentation require explicit disposal/remount, with CPU authority retained.

`getSavePayload()` returns accepted text; after persistence, pass that **exact issued object** to `markSaved(payload)`. Reconstructed, foreign or stale payloads cannot acknowledge the current document. The host owns file reading, cancellation, persistence and status. Dispose the session on closure, and dispose any late session returned after the host has closed. The [shared downloadable host](./examples#native-light-scene-downloads) demonstrates these ownership and pending-operation boundaries without introducing a new package API.

### Keep the workspace kind fixed

Each workspace admits one homogeneous directional or point catalog with zero to four lights plus ambient. Cross-kind Open/Apply and mixed catalogs refuse without replacing accepted data, history or corrective fields. Use **New directional** or **New point** to change kind explicitly.

The generic parser migrates supported legacy directional V1 files through the strict legacy parser; Save writes the current envelope. Generic Open does not accept legacy Native V0. **Import legacy Native scene** is the explicit V0-to-directional conversion, which point workspaces refuse. A directional vector is never reinterpreted as a point position. Migration retains original source/material authority, camera, poses, signed values and omitted overrides.

## Historical Source1 and mixed-depth workflows

## Mount a visible editor

```tsx
import type { RenderEditorSession } from '@barocss/render-editor';
import { createRenderEditorController } from '@barocss/render-editor';
import { RenderEditor } from '@barocss/render-editor/react';
import '@barocss/render-editor/style.css';

// session is a caller-owned validated session.
const mountEditor = (session: RenderEditorSession) => {
  const controller = createRenderEditorController(session);
  return { controller, view: <RenderEditor controller={controller} onError={console.error} /> };
};
```

The React viewport attaches the real source1 GPU presenter. Give the host a defined workspace size. The host owns menus/routes/files and disposes the controller/session when closed. Viewport unmount releases its owned rendering resources, preserving caller CPU authoring.

## Separate draft, preparation and accepted display

Session setters stage source/camera. `prepareDraft('source'|'camera'|'both')` compiles and creates a session-bound candidate. Controller `apply()` presents it before authoring/history acceptance and returns `{ok:true}` or `{ok:false,error}`. Check the returned result.

`presentedRevision` is separate from accepted document revision. A direct headless commit while attached makes explicit recovery necessary before the next visible transaction. Source Apply uses source update; camera Apply uses camera update. Combined changes need compensating recovery if the later update refuses. Failed recovery keeps CPU authority and marks presentation unavailable.

## Edit objects without rewriting unrelated source

`inspectRenderSceneObjects` reads effective public compiler results. `editRenderSceneObjectSource`, `addRenderSceneObjectSource` and `removeRenderSceneObjectSource` use the actual compiler AST and original source ranges. Stage returned source through the session, then Apply the complete draft. Byte-equal effective edits preserve source. Incomplete object input is retained separately through `setDraftObjectSource(null)` and blocks whole Apply/file decisions.

## Navigate a temporary camera

`previewCamera(camera)` presents the accepted source with a temporary camera. It is not authored history or saved state. Use view restores accepted presentation, stages the chosen camera and runs complete Apply once. Cancel view restores accepted presentation and retains drafts. Resolve the preview before file/history/authoring actions. Invalid hidden fields can refuse Use view.

## Prepare a mixed document

```ts
import { parseRenderMixedDocument, prepareRenderMixedDocument,
  serializeRenderMixedDocument } from '@barocss/render-editor';
const qualifyFile = (text: string) => {
  const document = parseRenderMixedDocument(text);
  const prepared = prepareRenderMixedDocument(document);
  return serializeRenderMixedDocument(prepared.document);
};
```

The codec validates schema. Preparation separately compiles both complete original sources, resolves the selected original model/Surface and produces the bounded shared-depth frame. Preserve hidden native inventory and declared source association. Surface placement is original CAD mm × scene units/mm, then authored translation in scene units; this is display placement, not native coefficient editing.

Use `createRenderMixedSession`/`createRenderMixedController` and `RenderMixedEditor` for actual mixed authoring. Native import requires an explicit original Surface choice. Sphere source edits and native Surface display position remain different drafts. `queryRenderMixedSurfacePoint(document,u,v)` queries the applied original Surface in millimetres at original parameters; it is not a rendered pick.

## Own Save/Open and recovery

Serialize accepted authority after resolving pending drafts with Apply/Discard/Cancel. Keep file-read staleness, cancellation and download status in the host. Explicit controller recovery reconstructs the accepted frame through the current provider. Old pixels are not promised after context loss. CPU retained state, current provider frame recovery and actual disk persistence are separate facts.

`packages/barocss-render-editor/package.json` (Manifest and version; local source) · `packages/barocss-render-editor/README.md` (Package task notes; local source)
