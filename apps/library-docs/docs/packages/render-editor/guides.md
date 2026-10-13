# Apply whole source and camera transactions

## Author a Native Light scene

Open **Material Editor → Light workbench** in `apps/render-editor` (`material.html?workbench=lights`). Choose **Start directional workspace** or **Start point workspace**. This route owns a required-WebGPU canvas; unavailable startup is reported rather than treated as an accepted frame. The older `workbench=directional-lights` route remains a compatibility route.

With workspace dependencies installed, run `pnpm --filter @barocss/render-editor-app dev` from the repository and open `http://127.0.0.1:52047/material.html?workbench=lights`. Choose **Start directional workspace** or **Start point workspace**. This is the existing local app entry point; this Manual site does not host the editor. Required WebGPU startup must succeed before interaction. The command and route follow the adopted [app script](https://github.com/barocss/barocss/blob/ee461c114d34c02fae513b2adff84313e3466109/apps/render-editor/package.json) and [route](https://github.com/barocss/barocss/blob/ee461c114d34c02fae513b2adff84313e3466109/apps/render-editor/src/material-main.tsx).

1. Under **Scene bodies**, choose the original body ID. Repeated names or geometry IDs do not merge targets. Selection only changes Inspector context; every body's corrective fields, including hidden bodies, survive row changes without Apply or a history entry.
2. Edit **Origin position (mm)** XYZ or **Scale (dimensionless)** XYZ. Translation is native mm, bounded to −10000..10000; scale is 0.001..100 per axis. Position/scale edits retain the existing raw XYZW quaternion, visibility, complete CAD source and material bindings. For orientation, use the separate [Rotate by controls](#rotate-a-body-by-degrees). Display transforms do not edit native geometry or add visibility controls.
3. Edit **Scene camera**. Eye/target XYZ and near/far use scene units; Up XYZ is dimensionless and retains its authored magnitude; vertical FOV is degrees. These are saved camera edits. To inspect without editing that camera, use the [local viewport controls](#navigate-a-local-viewport-camera).
4. Select or add a light of the chosen kind. Directional XYZ is a raw nonzero direction; point XYZ is final-world position and range is in scene units, unaffected by native mm conversion or body poses. Both kinds edit label, enabled, linear RGB and intensity; ambient remains available with zero lights. Disabled entries still count toward the four-light limit.
5. **Apply** presents all body, camera and light changes together, then accepts one document/history step. Wait for completion before the next operation. A refused field or presentation retains accepted authorship/history and corrective drafts. **Discard** restores all accepted fields. **Undo/Redo** is available after drafts are resolved and uses the same whole-scene transaction.
6. **Save accepted** requests a `.light-scene.json` download of accepted data, even when corrective fields remain. To include those edits, successfully Apply first. In a fresh workspace of the same kind, **Open** the saved file, select the same original body and continue editing. A download request alone does not establish physical persistence.

Open and New ask before leaving unsaved changes/drafts; cancelling retains them. A refused or stale Open also leaves the current scene and fields in place. **New directional** / **New point** deliberately ends the old lifetime and starts another; it is not an atomic backend swap. **Remount accepted scene** retains accepted authorship, clears history and requires a new renderer. Failed or lost presentation does not promise old pixels.

### Select a body from the Canvas

Choose a **Scene bodies** row, or click an admitted visible material-bound body with the primary left pointer and no modifiers. The complete original binding identifies the Inspector target even when geometry IDs repeat. A background miss keeps the current row. Selection retains every body's unfinished fields, accepted scene, history, Save authority and local view; it does not apply a transform or highlight material.

A click allows at most **3 CSS pixels of observed maximum excursion**. Small jitter submits no camera update. Once that threshold is crossed, navigation receives the complete movement from pointerdown and the gesture stays a drag even if it returns near its origin. Shift-drag remains temporary Pan. Modifiers, wheel/key interruption, pointer cancellation, active-drag capture loss, blur or Escape invalidate click selection. The normal delayed capture-release event after pointerup is expected and does not cancel its pending read.

Wait for the identity read before another authoring or file operation. Help, a chooser, pending work and an unavailable viewport fence new queries. Cancelling input does not cancel an already submitted query; controls unlock when it settles, and stale completion cannot select another workspace. See [selection limits](./limits#canvas-body-selection-limits) and the [owned Native Light API](./api#native-light-document-and-session). The actual [session query](https://github.com/barocss/barocss/blob/ee461c114d34c02fae513b2adff84313e3466109/packages/barocss-render-editor/src/native-light-session.ts) and [input transport](https://github.com/barocss/barocss/blob/ee461c114d34c02fae513b2adff84313e3466109/apps/render-editor/src/native-light-navigation.ts) are distinct from physical pointer/GPU acceptance.

### Duplicate or remove a body

Select a **Scene bodies** row, resolve all authored/corrective drafts with **Apply** or **Discard**, then choose **Duplicate body** or **Remove body**. Finish navigation and pending operations, close Help and file choosers first. Each command accepts one whole-scene history entry after the renderer acknowledges it; there is no separate staged inventory edit to Apply. **Undo/Redo** restores the whole scene and retains the local view.

A duplicate gets independent body, complete original source-asset and embedded material identities while keeping the original pose and raw material values. It initially **overlaps the original**. The new row becomes selected after acknowledgement; use the existing position or rotation controls to move it. This is an independent copy, not a linked instance. **Remove body** selects the first surviving editable row and keeps any source asset still referenced by another native body, including an unselected sibling. The last editable material-bound visible Surface cannot be removed.

A ready refusal retains accepted authorship, the saved marker and history, and clears only the command's own temporary draft. If loss or cleanup refusal requires **Body command recovery**, do not try to Apply an unseen inventory draft. **Save accepted** still exports accepted data; use **Discard** when ready or **Remount accepted scene**. Remount keeps accepted authorship but resets history and requires another renderer; it does not establish that old pixels were restored.

See [body command limits](./limits#body-duplicate-and-remove-limits), the adopted [qualified derivation helper](https://github.com/barocss/barocss/blob/59232cc621a8a7851e578d1891ffcd7f931cfc54/apps/render-editor/src/native-light-bodies.ts), [owned workbench controls](https://github.com/barocss/barocss/blob/59232cc621a8a7851e578d1891ffcd7f931cfc54/apps/render-editor/src/native-light-workbench.tsx) and [both-kind software flow](https://github.com/barocss/barocss/blob/59232cc621a8a7851e578d1891ffcd7f931cfc54/apps/render-editor/native-light-workbench-flow.mjs). Physical GPU/files and [#1573](https://github.com/barocss/barocss/issues/1573) remain separate verification gates.

### Add a Surface from an original CAD file

Start from a ready Light workspace and select a visible, material-bound **Scene bodies** row. Resolve all corrective drafts with **Apply** or **Discard**, finish navigation and pending work, and close Help. Choose **Add Surface…**, then **Choose CAD source**. The chooser accepts `.barocad`, `.barocss` and `.txt` hints; the actual CAD parser decides whether the source is valid.

The dialog shows the compiled model ID and original Surface/Curve inventory. Choose a real **Surface to add**, then click **Add Surface**. Inspection alone changes no scene or history. The new body copies the captured selected body's accepted embedded material, independently of repeated material IDs or binding-array order. It retains the **complete original source**, including unselected objects, comments and numeric spelling; it does not convert the file into a tessellated mesh.

Native XYZ uses **millimetres**, with the scene's existing `mmToSceneUnit` conversion. The new body starts with identity pose at its source origin and may be outside the current view. After acknowledgement selects its new row, use **Frame selected**, then the existing position, rotation or material controls. Other bodies, materials, camera and lights stay intact. Add immediately accepts **one whole-scene history entry** after the renderer acknowledges it; no second Apply is needed for the addition. **Undo/Redo** restores the whole scene. **Save accepted**, fresh same-kind Open and normal editing use the same document workflow above.

A canceled/empty chooser or failed later read keeps the previous inspected candidate while the dialog remains open. **Cancel** can close during a pending read; late completion cannot revive it, although the file promise itself is not aborted. Once Add is submitted, Cancel, Escape and outside-close are fenced until it settles. A ready refused Add retains the candidate for correction/retry and preserves accepted authorship/history. If **Body command recovery** is reported, close the dialog when Add has settled, then use the existing Discard or accepted-scene remount recovery; retained metadata does not certify restored pixels.

See [Surface file limits](./limits#original-surface-file-addition-limits), the adopted [private dialog](https://github.com/barocss/barocss/blob/4a8fdbda774228bd0c0c5da504b74a080dfc2630/apps/render-editor/src/native-light-surface-add-dialog.tsx), [qualified addition helper](https://github.com/barocss/barocss/blob/4a8fdbda774228bd0c0c5da504b74a080dfc2630/apps/render-editor/src/native-light-bodies.ts), [owned transaction](https://github.com/barocss/barocss/blob/4a8fdbda774228bd0c0c5da504b74a080dfc2630/apps/render-editor/src/native-light-workbench.tsx) and [both-kind software flow](https://github.com/barocss/barocss/blob/4a8fdbda774228bd0c0c5da504b74a080dfc2630/apps/render-editor/native-light-workbench-flow.mjs). These software checks do not establish physical file persistence, GPU rendering or a fix for [#1573](https://github.com/barocss/barocss/issues/1573).

### Rotate a body by degrees

Select a **Scene bodies** row, then use **Rotate by** under Body transform. Choose **X**, **Y** or **Z** and **Local body axes** or **World axes**. Enter signed degrees from **−360 to 360** and click **Stage rotation**, or use **−90° / +90°** for a quarter turn around the chosen axis. The initial command is local Z, 90°. Rotation is about the **body origin**; its position and scale stay fixed.

These are relative turns, not absolute Euler fields. Each command adds to the current draft orientation. Local rotation follows the body's current axes; world rotation follows the fixed scene axes. Imported orientation is never decomposed or silently normalized. **Advanced quaternion (read-only)** shows the actual draft XYZW values when needed. Zero and full-turn commands (**+0, −0, +360, −360**) preserve the exact existing quaternion and omitted identity pose.

Command preferences alone do not dirty or save the scene. Unfinished angle text survives row changes and a refused command; staging leaves other corrective fields intact. Correct an invalid selected position/scale before staging. Other incomplete scene fields still block whole-scene **Apply**. A stage makes no presentation or history entry: **Apply** accepts the complete draft once, then **Undo/Redo** restores it. Successful Apply/Open/Undo/Redo, or Discard, restores accepted fields and resets command preferences. **Save accepted** excludes staged rotation; Apply first, then Save, fresh Open in the same light kind, reselect the body and rotate again.

Finish active navigation, pending work and file choosers, and close Help before rotating. Stale selection or an unavailable lifetime cannot retarget a command. See [rotation limits](./limits#body-rotation-controls), the adopted [private staging helper](https://github.com/barocss/barocss/blob/8b1b7f85a4d51aa42d86590f02d251f81960d382/apps/render-editor/src/native-light-fields.ts) and [degree controls](https://github.com/barocss/barocss/blob/8b1b7f85a4d51aa42d86590f02d251f81960d382/apps/render-editor/src/native-light-workbench.tsx). These software-qualified controls do not establish a fix for the physical gizmo report [#1573](https://github.com/barocss/barocss/issues/1573).

### Navigate a local viewport camera

In either light workspace, choose **Orbit** or **Pan** and drag the viewport. Hold Shift while dragging to pan temporarily. Scroll the wheel or use **Zoom in/out** to change distance. **User view** identifies a local camera; **Scene view** follows the accepted authored camera. These controls use the existing camera admission and scene-coordinate conventions, not native millimetre conversion.

To recover an off-screen object, choose its **Scene bodies** row and click **Frame selected**. **Frame all** fits the visible material-bound Surfaces together. These buttons fit accepted original geometry, including its display rotation, nonuniform scale, translation and millimetre conversion; unfinished Inspector fields stay untouched. Framing keeps the current viewing direction, raw Up and FOV, centers conservative control-hull corners with a **1.2 visual margin**, and chooses local near/far clips. It does not move the body or change its authored scene camera.

Hidden, unbound, missing or ambiguous selected bodies and an empty bound population refuse. A fit that cannot satisfy the actual camera limits, projection margin or clipping of every corner also refuses rather than clamps. Repeating a successful command with the same accepted scene, acknowledged camera, body scope and CSS/backing dimensions makes no presentation. Finish active operations and close Help/file choosers before framing. The adopted [private fitter](https://github.com/barocss/barocss/blob/3f63934215c10633b4f36ca6e10d7ba0a13cb1b6/apps/render-editor/src/native-light-framing.ts) and [Frame controls](https://github.com/barocss/barocss/blob/3f63934215c10633b4f36ca6e10d7ba0a13cb1b6/apps/render-editor/src/native-light-workbench.tsx) reuse the existing local-camera ownership described below; the Frame commands themselves add no shortcut or Canvas picking.

Navigation preserves accepted document bytes and identity, raw corrective fields, dirty/unsaved authorship, Save payload identity, authored revisions and Undo/Redo history. You can inspect while incomplete body/material/light/camera strings remain in the Inspector; those strings are not submitted. **Save accepted** still writes the authored scene camera. A local view alone is not unsaved file content.

**Scene camera** explicitly presents the accepted scene camera without consuming drafts. **Set scene camera** is available only after navigation finishes and all authored fields/session drafts are clean. It stages the acknowledged local camera and performs one ordinary whole-scene Apply, advancing the scene/catalog revision and history once. Resolve corrective fields separately; this action never silently applies them. When the authored camera becomes exactly the local camera, the workspace returns to **Scene view**.

Ordinary Apply and Undo/Redo retain an active local view while their accepted authored cameras follow normal history. Successful Open resets the view to the incoming scene camera; a refused Open retains the current view and accepted/raw state. New workspaces and explicit remounts begin with their scene camera; remount also clears history as described above.

For a custom host, await `session.navigateViewportCamera(camera, session.getSnapshot().version)` or `session.resetViewportCamera(session.getSnapshot().version)`. The existing unsuffixed session exposes `viewportCamera` as an immutable owned camera, or `null` to follow accepted authorship; `viewDirty` identifies a local override, and `pending: 'view'` identifies its pending presentation. Read a fresh version for each operation: navigation advances session/Viewer generations and invalidates earlier prepared candidates, without changing authored revisions. Exact raw-camera equality, including signed zero, is a no-op.

The workbench allows one presentation in flight and accumulates subsequent inputs into one latest desired camera. Authoring/file actions wait during a drag or queued/pending update; a file chooser and Help fence new gestures. Escape, pointer cancellation/capture loss, blur or a changed viewport rectangle stop queued motion. They do not roll back an in-flight or acknowledged view; wait for its outcome, then use **Scene camera** if a reset is wanted. An ordinary refusal retains the last acknowledged view and unlocks controls. Unavailable presentation requires explicit recovery; retained camera metadata does not certify pixels. See [navigation limits and lifecycle](./limits#local-viewport-navigation-limits).

This workflow follows adopted [session ownership](https://github.com/barocss/barocss/blob/f8ddf0d8c2d0f802c98d1a2c55588b4ee3eff8f3/packages/barocss-render-editor/src/native-light-session.ts), [input coalescing](https://github.com/barocss/barocss/blob/f8ddf0d8c2d0f802c98d1a2c55588b4ee3eff8f3/apps/render-editor/src/native-light-navigation.ts) and [workbench controls](https://github.com/barocss/barocss/blob/f8ddf0d8c2d0f802c98d1a2c55588b4ee3eff8f3/apps/render-editor/src/native-light-workbench.tsx). The backend still rebuilds complete render candidates, so this initial control makes no smooth-animation or frame-rate claim.

### Edit scalar material uniforms for a body

Select a visible original body under **Scene bodies**, then use **Body material**. The controls show scalar names, ranges and defaults compiled from that binding's original shader declarations. A hidden body, missing/unqualified binding or material without scalar declarations has no editable uniform controls; selecting it creates no binding or ID. See [Surface B in the existing downloads](./examples#edit-the-existing-amount-uniform-on-surface-b) for a ready example.

Enable **Override** to supply a finite decimal within the declared range. Clear it to omit the property and use the shader default. An explicit override equal to the default is still authored data and differs from omission. Corrective text stays with its own body/uniform while switching bodies or toggling Override; text under a cleared Override is retained locally but is not supplied to the material. Invalid active input refuses the complete Apply and remains available for correction. Successful Apply, Discard, Open, Undo or Redo refreshes fields from accepted authorship.

The edit belongs to the full qualified body binding and its existing embedded material, not a material-ID lookup. Two bodies may repeat a material `documentId` without becoming linked assets: editing one leaves the other's embedded document exact. Original shader source, metadata, target pins and unrelated source/TEN/materials/poses/camera/lights are preserved unless separately edited through their existing controls. The scalar controls add no free-form shader-source editor. To transfer an existing portable material, use the explicit Import/Export workflow below.

The existing `createRenderMaterialSession` performs temporary preparation for each embedded binding and is always disposed. Its dirty comparison distinguishes override presence and signed zero (`-0` versus `+0`). Each changed binding prepares one next material revision; unchanged bindings retain theirs. A changed material already at maximum revision refuses before presentation. No separate material history or presentation is committed. Formatting-only changes such as `.40` to `0.4`, with the same override presence and numeric value, remain whole-scene no-ops when nothing else changed.

Material, body, camera and light edits share one whole-scene **Apply**, one presentation transaction and one accepted history entry. Wait while an operation is pending; refusal or a stale operation retains accepted authorship and corrective fields. Resolve drafts before **Undo/Redo**, which restores whole-scene authorship. **Save accepted** includes only accepted embedded materials; successfully Apply first to include an override change. A fresh same-kind **Open** restores the saved bindings and values for re-edit. Physical WebGPU, file and device acceptance remain separate.

This subsection follows the adopted implementation at `ba54ea14ed38163f4b1074a5b2aa0a17158c4bf7`: [field preparation](https://github.com/barocss/barocss/blob/ba54ea14ed38163f4b1074a5b2aa0a17158c4bf7/apps/render-editor/src/native-light-fields.ts), [workbench controls](https://github.com/barocss/barocss/blob/ba54ea14ed38163f4b1074a5b2aa0a17158c4bf7/apps/render-editor/src/native-light-workbench.tsx) and [app contract](https://github.com/barocss/barocss/blob/ba54ea14ed38163f4b1074a5b2aa0a17158c4bf7/apps/render-editor/README.md#body-bound-scalar-material-uniforms-1636).

### Import and export a body material

In either Light workspace, select an eligible visible original body through its **Scene bodies** row or Canvas. Resolve all scene drafts and wait for pending work to finish, then choose **Import material…** in **Body material** and select a `.material.json` file. Import captures that existing full body binding before opening the chooser. It copies only the portable shader source and supplied uniforms; destination material identity, title, revision and target pins remain owned by the selected binding. Repeated material `documentId` values do not link bodies or change the other embedded material.

A valid import stages source and uniforms together in the private form, then displays the scalar names, ranges and defaults from the actual compiler. It does not present, accept a revision, add history or mark the scene saved. Original shader text, override omission versus explicit defaults and signed zero remain authored values. An identical import is a no-op. Inspect the fields and press **Apply** once to accept the whole scene; a changed embedded material and scene advance once through their existing preparation/session authority. **Undo/Redo** uses the same scene history. **Save accepted**, then **Open** in a fresh workspace of the same kind, preserves the accepted material for re-editing.

Cancel, an empty selection, malformed/oversized data or a stale read leaves prior accepted data and fields intact. Changing the selected row away and back invalidates the earlier chooser. A failed later Apply retains the staged material and corrective fields for correction. Import requires a clean ready scene; it never silently consumes unrelated drafts or creates a binding. See [portable-material limits](./limits#portable-material-transfer-limits).

**Export accepted material** requests a signed-value `.material.json` download named from the selected accepted material's existing ID. It can be used while corrective fields remain, but excludes all staged material changes. It does not save the scene, clear its unsaved state or change history. The owned download link and object URL are cleaned up even if transport fails; a download request does not certify physical persistence.

The [adopted app controls](https://github.com/barocss/barocss/blob/f4d66c12781e370d1d6ab0e214cd911079313eba/apps/render-editor/src/native-light-workbench.tsx) and [atomic binding preparation](https://github.com/barocss/barocss/blob/f4d66c12781e370d1d6ab0e214cd911079313eba/apps/render-editor/src/native-light-fields.ts) reuse the [existing material APIs](./api#portable-material-authority). Controlled software checks cover both light kinds; physical file, pointer, focus, GPU and device recovery acceptance remains separate under #1577/#1573.

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
