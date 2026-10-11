# Render Editor app

A private React and shadcn host for `@barocss/render-editor`. The Source studio has top Add Object and Apply tools, a left transform rail, central Canvas, right Outliner above Properties, and a compact bottom timeline. Source and Problems open on request. All panels remain mounted and retain raw inputs; local layout and view state are not saved. The app owns menus, native files, downloads, workspace navigation, and example documents. The module owns source, camera, inventory, diagnostics, and the GPU viewport.

Use Workspace → Enable animation to create an original linear translation clip through one complete Apply. The scene becomes version1 `gpu-scene`; existing version0 files remain supported and mixed-depth files remain separate. The compact timeline provides Play, Pause, seconds scrub and Reset. Key editing uses original object IDs, authored seconds and XYZ positions in scene units. Add captures the selected object's base position; edit the keys to create motion. Key edits stay drafts until Apply accepts the complete scene and keys once. Hidden incomplete key fields require correction or Discard before authoring and file actions.

Playback displays sampled source through the actual Source renderer. Original base source, keys and revision stay unchanged. Pause keeps the sampled pose. Reset restores the applied base scene before unlocking edits and Save. The host stops its clock on loss, stale authority, focus loss and unmount. Save stores the original base source and full key data, not the current pose or clock. Fresh Open rebuilds the same source and track references. Disable animation uses one complete Apply to return to the exact version0 profile. Contextual Help retains raw input and returns to its trigger.

`source-animation-file-flow.mjs --original <real version0 baseline> --edited <real version1 download> --reopened <real key re-edit download> --output <new-directory>` qualifies original source, camera, object IDs and complete keys in actual browser files. The package's `source-animation-flow.mjs` qualifies source/sampler/document/session/controller protocols. Those CPU scripts do not drive a browser or prove visible animation. Native Play/Pause/scrub and actual files are recorded separately. Use the current default desktop only.

Use Duplicate selected in the top tools or Edit menu to create a draft copy. Apply renders it and selects its fresh ID. The copy initially has the same position, Euler rotation, color and dimensions. Move it separately to see both objects. Editing the copy leaves the original unchanged. Existing animation tracks keep their original object references; no track is copied. Hidden incomplete input must be corrected or discarded first.

`scene-object-duplicate-flow.mjs` checks real Source1 duplication and session/controller protocols through ordinary source imports. `scene-object-duplicate-file-flow.mjs --original <real baseline> --edited <actual download> --reopened <fresh re-edit download> --output <new-directory>` checks genuine browser files, original object/camera/clip preservation and independent copy editing. CPU files and injected presentation models are separate from browser/GL evidence.

Select an applied object, then choose Move, Rotate or Uniform scale in the Canvas. Drag a real handle to preview the source transform. Release applies one complete change; Escape cancels. Apply or Discard other drafts before starting. Pivot is the original local source origin, not a certified center. End-on axes, degenerate ring planes or unsupported camera-ray backing dimensions use numeric properties. Rotation uses degrees, X then Y then Z; scale is uniform primitive dimensions, not general affine mesh scaling. File, camera and other authoring actions wait during a gesture. Help retains input and returns focus to its trigger.

Point to an arrow, scale square, or front rotation arc and drag directly. The nearest visible handle highlights under the pointer; its axis stays captured until release. Rear arcs are dimmed. There is no separate XYZ selector toolbar. Rotation follows the grabbed arc tangent and edits the corresponding Source Euler field; orthogonal World/Local quaternion rotation is a separate profile. Box Scale X/Y/Z changes each local size independently. Rounded Box labels those operations Size X/Y/Z and keeps Radius unchanged. Uniform S remains available; Sphere, Cylinder, Capsule and Torus currently support only uniform dimensions. Independent affine Source scaling is a separate engine profile. These controls retain the same accepted source, one-gesture history and actual renderer.

`direct-gizmo-file-flow.mjs --original <real baseline> --edited <actual direct-drag download> --reopened <fresh re-edit download> --output <new-directory>` checks genuine files after direct Move X, Rotate XYZ and independent Box Scale XYZ. It preserves original camera/IDs/unselected objects and checks a fresh X-only size edit. `direct-gizmo-flow.mjs` and `scene-gizmo-flow.mjs` are bounded CPU geometry/protocol checks, separate from actual pointer and GPU frames.

`scene-gizmo-file-flow.mjs --original <real baseline> --edited <actual gizmo download> --reopened <actual re-edit download> --output <new-directory>` checks actual original IDs, selected transforms, uniform dimensions, exact unselected objects/camera and fresh source re-edit. The package's `scene-gizmo-flow.mjs` checks pure projection/source/controller protocols. Actual pointer and WebGL evidence is separate. Current desktop only; no responsive test campaign.

Use Frame all to fit the applied scene, or Frame selected to focus its selected object. The View menu provides the same commands. Focus the viewport and press Shift-F or F. Text inputs keep their normal editing keys. Pending fields are retained; the commands fit applied geometry. Source, saved camera, keys and history are not changed. Set scene camera explicitly adopts a local view. Empty scenes produce a status message, while an unsafe fit keeps the previous view and reports its actual error.

`scene-framing-flow.mjs` checks the real bounds/camera/controller APIs and independent projected corners. `scene-framing-file-flow.mjs --original <real baseline> --framed <actual navigation-only download> --reopened <fresh navigation-only download> --output <new-directory>` checks exact genuine file bytes and original geometry. CPU protocol models and Node files are separate from actual viewport and browser downloads.

In GPU Scene, drag the Canvas to Orbit, choose Pan or hold Shift, and use the wheel or focused arrows and +/−. Navigation changes only the local view. Select an Outliner row and edit immediately afterward. Scene camera returns to the authored camera; Set scene camera adopts the current view through one complete Apply, with every source/key/raw guard intact. The Camera inspector edits the authored scene camera. Source, transforms and animation use the displayed camera, while Save excludes local navigation. Open and Restore preview return to the authored camera. Legacy explicit camera previews retain their separate Use/Cancel behavior.

`camera-view-file-flow.mjs --original <real file> --used <actual camera download> --reedited <fresh actual re-edit> --output <new-directory>` qualifies actual camera-authored files using current source APIs and the independent compiler. It checks byte-exact original scene source, complete object semantics and every non-camera field. Camera previews, pointer state and layout are absent from files. The package's `scene-camera-flow.mjs` covers pure controller/refusal/lifetime semantics; actual CUA/WebGL proof stays separate. Use only the current desktop screen, with no responsive test campaign.

The mixed app uses compact document/file chrome and a viewport-first workbench. Scene and Projects share one left dock; Object and Camera share the right inspector. Source and Problems open on request below the viewport. Apply and Discard stay visible when Source is closed. Drag the panel separators or focus them and use the arrow keys, Home and End to resize within their bounds. The existing New/Open/Save, workspace and pending/unsaved decisions remain. Help → Editor layout explains the controls. Layout changes do not edit source or create history and are not saved.

`workbench-layout-flow.mjs --layout-file <real unchanged download> --edited-file <real re-edited download> --output <new-directory>` qualifies actual browser files against the prior original native document. CUA separately checks the real viewport, panels, keyboard/pointer resizing, hidden raw guards, camera preview and file picker. The cold script does not drive a browser or prove GL behavior. The GPU Scene app shares the compact workspace design while keeping its version0 authoring and file profile separate from mixed version1.

The GPU Scene app has structured Add/Remove and selected Position, Rotation, primitive dimensions/endpoints and opaque Color controls. These edit original Source1 text through the public compiler. Apply displays the complete draft and commits history only after success. Source and Problems start closed; incomplete object fields remain dirty even when hidden and require correction before file actions. Help explains the supported shapes, units and correction paths. Layout stays local and is not serialized.

`scene-object-flow.mjs --original <actual original download> --edited <actual authored download> --reopened <actual re-edited download> --output <new-directory>` qualifies real browser version0 files using current source imports and the independent public GPU compiler. It checks selected object edits, addition/removal, preserved document identity/camera and fresh re-edit. The package's `scene-object-source-flow.mjs` checks pure source APIs and session guards. Actual GUI/WebGL evidence is separate. Use only the current desktop screen; the owner prohibits repeated responsive screen tests.

## Run

Use the repository's installed Node 22 toolchain and dependencies. This app requires no custom source condition or source alias.

```sh
pnpm --filter @barocss/render-editor-app dev
pnpm --filter @barocss/render-editor-app build
```

The development server uses `http://127.0.0.1:52047` with a strict port. Hash routes use `#/workspace/forms` and `#/workspace/assembly` for the two included scenes. New and opened files receive their own workspace entries.

## File and edit behavior

- Source and camera edits remain drafts until Apply succeeds in the viewport.
- Save, Open, New, and project changes require Apply, Discard, or Cancel when drafts exist. Apply refusal retains the dialog and current scene.
- Save downloads the accepted versioned JSON document. Source text, IDs, source version, and camera are authored data. Shader text, compiler IR, and GPU buffers are excluded.
- Open checks native `File.size` against the module's file limit before reading. Invalid files retain the accepted document, displayed revision, and project route.
- Workspace entries preserve accepted edits in this tab. They do not persist after reload. Save files before closing the tab. A browser unload prompt covers unsaved accepted edits and drafts.
- Keyboard shortcuts use Ctrl or Cmd with N, O, S, Z, or Shift+Z. Editable controls and composition events retain their native keyboard behavior.
- File and edit errors show the failed action and a next step. Optional Details retains the actual error message and code. Error overlays do not resize the preview.
- A refused preview update says Preview unchanged when the previous scene remains displayed. Restore preview is available only when the preview is unavailable and the controller is live. The reusable editor owns preview notices and compiler source errors as separate categories.

The fixtures cover sphere, box, cylinder, torus, and capsule in two different scenes. The current editor supports sourceVersion 1 SDF scenes. CAD, material qualification, and Physics are later provider tasks.

## Native-flow selectors

The native Surface app at `/material.html` also offers Move, Rotate and Scale on the existing Canvas. Click a visible material-bound Surface or choose its body in the left Outliner, then drag its colored handle directly. The active body appears in the Canvas and Properties headers. Click selection uses the actual Viewer's sampled posed-triangle query; it is approximate and adds no selection highlight. Overlapping/ambiguous hits and background keep the current editing target. Original body pins qualify the display reference, so two assets with the same Surface ID remain separate bodies. A drag or a captured gizmo never acts as a body click.

Changing the active body is local context. It does not change the scene revision, history, materials, camera or saved data. You can choose and edit a body after camera navigation. Local navigation is excluded from authored dirty state and saved files. Correct or Discard material/light drafts before changing bodies; selection never silently discards them. Move uses world axes; Rotate and Scale use the captured local axes. XYZ scale changes one display scale component; S changes all three. The pivot is the original source origin. These controls change the native display pose, while the original CAD source and body pins remain intact. A successful release creates one complete scene history entry. Escape restores the applied appearance. A refused restore keeps a pending transform and offers Cancel transform. File, history, target, material, light and camera edits are blocked while a transform is held or pending.

The whole native file stores mm translation, XYZW quaternion and positive nonuniform scale together with the camera, materials and existing global lighting. This body editing context does not add Viewer selection highlighting, exact raster or native-geometry picking, independent Light objects, mesh topology editing or animation tracks. Source1 Canvas object selection remains the separate GPU dependency; native Surface picking does not supply that API.

Properties also edits the active body's Position in mm and independent local Scale XYZ. These six text fields stage a complete pose draft together with material and lighting edits. Use the existing scene Apply once to present and accept the whole draft, or Discard to restore applied values. Current quaternion rotation is preserved; use Canvas rings to rotate. Position must be finite within ±10000mm and each Scale within .001..100. Actual appearance coordinates/normals/Float32 admission can refuse otherwise valid numbers. No clamp or automatic quaternion conversion is applied.

Incomplete or refused numbers stay in the fields outside JSON, with the last valid draft and applied frame kept. Correct all six values before Apply, body/gizmo changes or files. Local navigation and Scene camera reset retain these raw fields. Valid same-value correction keeps lexical input; explicit Discard or a successful complete Apply/Open/history replacement resets fields from the actual pose. Existing empty identity poses stay empty for zero edits and expand all original selected entries only for a genuine change. Original CAD source, body/asset pins, camera and unrelated poses remain intact.

The host exposes stable `data-testid` selectors: `open-file`, `save-file`, `scene-file-input`, `draft-dialog`, `draft-apply`, `draft-discard`, `draft-cancel`, `app-error`, `app-error-details`, `accepted-revision`, `presented-revision`, and `project-forms` / `project-assembly`. `app-error` contains task copy; open its Details control to read `app-error-details`. The revision data attributes keep the actual accepted and presented revisions. Selectors refer to real controls and status text. There is no application debug global.


## Mixed document app

Open `/mixed.html#/mixed/surface_study` or `/mixed.html#/mixed/rational_panel` for the separate version 1 mixed document app. The original `/index.html` source editor remains available through Source editor. The Vite build includes both page entries.

The mixed app owns the same shadcn File/Edit/Workspace/Help shell, project routes, native file picker, accepted-only downloads, shortcuts, and Apply/Discard/Cancel guard. New starts from the named Sphere and native Surface profile. Both samples keep complete original source 1 and source 0 text, selected original model/Surface references, rational weights, and an unrendered Curve. Sampling and GPU data remain derived in the module.

Native file size is checked against 524288 bytes before `File.text()`. A late read is refused when the session snapshot or project changes. Open adds a project only after the real controller accepts and presents it. Save downloads `.render-mixed.json`; fresh Open reconstructs the complete mixed frame from authored data. Version 0 scene files use the source editor and are refused here.

Projects stay in this tab. Save a file before closing. Host notices and optional Details appear at the bottom right without resizing the preview or covering Apply, Discard and the camera header. The module owns preview and draft diagnostic notices. Restore preview is offered only when the display is unavailable and the controller is live. No precise picking, materials, Physics, independent poses for multiple assets, or broader mixed shape support is claimed.

The mixed app keeps the file/guard/error/revision selectors described above and adds `render-mixed-editor-app`, `project-surface_study`, and `project-rational_panel`. Accepted and displayed numeric revisions remain in `data-revision`. Use an isolated strict port override for the mixed native flow; the existing 52047 source-editor preview remains unchanged.

## Native source import

Use File→Import CAD source or the Import CAD source button in the mixed app. Choose a plain UTF8 original Source0 text file, inspect all original objects, then explicitly choose a Surface and select Use Surface. The file is limited to64KiB and is checked before reading. A canceled or stale read/selection keeps the current scene and drafts. Use Surface stages the complete original text/model/Surface together; Apply must succeed before the viewport/history changes. Existing Scene/camera/display drafts stay. Replace native draft is required when a pending native source/reference would be replaced.

Use the Native asset Surface selector to change the displayed Surface from the original source; the complete model remains stored. Save stores all original text/objects and the selected reference. Fresh Open rebuilds the selected preview. Only one Sphere and one Surface are shown in this profile; native coordinates use mm with one scene conversion. CAD geometry editing and other CAD file formats are separate workflows.

Contextual Help is Help→Native source import or Help in the import dialog. It preserves drafts and selection. Closing menu Help returns focus to Help; closing import returns focus to Import CAD source. Import file/guard errors show a short next step and optional Details. The focused driver uses isolated52051, preserving existing source/mixed author previews.


## Surface position

Use Help→Surface position for the native Position X/Y/Z fields in the mixed app. Position uses scene units. Each displayed native point is `original coordinate in mm × current conversion ratio + Position`. Original source coordinates, control points, rational weights, knots, and IDs stay unchanged. This is display placement of the selected Surface.

Each axis requires a complete finite number in `[-1000, 1000]`. Raw minus signs, empty text, invalid numbers, and out-of-range values remain in the fields so the user can correct them. Apply is unavailable while an axis is invalid. The actual transformed Surface must also remain within the admitted bounds; a finite input inside the field range can still be refused by complete scene preparation or display admission. A refusal keeps the applied document and preview under the existing controller rules.

Position remains a draft until Apply succeeds. Closing Help returns focus to the persistent Help menu trigger and keeps the raw X/Y/Z text. Native source import keeps unrelated position drafts. Save/Open/New/project navigation use the existing Apply/Discard/Cancel guard: Apply and continue refuses invalid position data, Cancel keeps the raw fields, and Discard restores the applied position. Save serializes applied authored X/Y/Z only; fresh Open restores those values.


## Object inspector

Use Help→Object inspector for the mixed editor's local Sphere/Surface editing targets. Sphere shows the actual current name/type and an Edit Source action that focuses the Scene textarea. Surface shows the selected original native Surface reference, Position X/Y/Z, color, and advanced display controls. Camera remains in the common View section. A changed native Surface reference is marked Draft; Applied references follow the accepted document.

Selecting an object row changes the local editing target and matching source tab while focus stays on the row. Explicit Edit Source moves focus to the Scene textarea. Source tabs independently choose which original source to edit. Rows do not perform pixel picking/highlighting or change authoring/history/file authority. No guessed radius, pose, material, or geometry values are added.

Hidden Surface controls remain mounted and retain raw minus signs, empty text, and invalid position drafts. A hidden invalid axis still blocks Apply and the existing file guard's Apply and continue action. Use Edit Surface position in Diagnostics to reveal the Surface controls and focus the first invalid axis. Correct the field or Discard to restore accepted values. Import, Open, Save, project routes, and keyboard guards retain their existing behavior.

## Sphere properties

Select Sphere to edit Radius and Position X/Y/Z in scene units, plus opaque hexadecimal Color. Values come from the actual original Source1 compiler's effective defaults and selector cascade. They stage a narrow source edit; the GPU frame changes only after complete Apply. A source edit preserves original comments, object identity and unrelated properties. This is authored Sphere placement, separate from the native Surface's display Position.

Incomplete, invalid and out-of-range fields stay as typed. Hidden Sphere fields still block Apply, File Apply-and-continue and camera Use view. Diagnostics can reveal and focus the first invalid Sphere field. The last valid Scene source is kept while local inputs are incomplete. Explicit Scene source editing replaces those local field drafts; Discard restores applied properties. Profile refusals keep applied scene/history/frame and correction input. Pending camera navigation disables authoring until Use or Cancel.

Help → Sphere properties explains limits and commit/cancel behavior, returns focus and preserves fields. Save stores applied source, not raw inputs or a guard. Fresh Open reads effective fields again and retains the complete original native model and independent camera/display. This profile still shows one Sphere and one selected native Surface; general Add, picking, gizmos, material/light and animation tools remain separate.

The `sphere-properties-flow.mjs` script checks source/API and actual downloaded files in two phases. CUA drives the real browser on an isolated strict52067 host. Previous author previews remain intact. Browser proof, CPU mock presentation units, affected builds and later integrated acceptance are separate records.

The target defaults to Sphere for each mounted editor. It stays selected through Apply, same-page Open, and project changes; names/references refresh from current document data. A fresh page starts on Sphere. Help closes to the persistent Help menu trigger and preserves raw position text and all other drafts.


## Rename scene

Use Edit→Rename scene or the persistent Rename scene button beside the document title. The dialog starts from the current draft title. Enter a nonblank title of at most 128 Unicode code points and 256 UTF-16 code units. Whitespace and Unicode stay as typed; the input does not truncate or normalize text. Use title stages only the title through the session. It does not render, reset unrelated source/camera/display drafts, or change the native asset association. Cancel or Escape before Use title leaves all session fields unchanged and returns focus to Rename scene.

The header and Workspace labels show the applied title. A pending title replaces the existing document status text with Title draft until Apply succeeds. The active cached project refreshes only from accepted document changes, including Apply, Undo, Redo, and Open. Project keys/routes, original scene/native IDs, source text, display values, and download basename remain unchanged. Downloads still use the document ID. Save stores the applied authored title; fresh Open restores it.

Rename captures the current snapshot and project. If another edit, file action, route change, or disposal makes it stale, Use title refuses without replacing newer drafts. A valid title can be staged while a hidden Surface position field remains invalid. Apply and the file guard still check the complete document and refuse invalid position/source/camera/display input. Discard uses the existing full-draft reset and restores the applied title with the other accepted fields.

Help→Rename scene uses the existing Help dialog and returns focus to the persistent Help menu trigger. Collapsed Help inside Rename scene keeps the raw title and all other drafts. Native import, Open/Save, project navigation, keyboard composition/editing, and cleanup keep their existing behavior. The host controls expose rename-scene, rename-dialog, rename-use, rename-cancel, rename-error, and draft-title test IDs; Title is the accessible textbox label.


## Unsaved scene

New, Open, project switching, and Source editor navigation first resolve drafts with the existing Apply/Discard/Cancel dialog. They then check the active project's opened/downloaded file association against the accepted document. A newly created local scene has no file association. Fresh examples and files start with their existing baseline association. Save uses its existing draft guard and download path without this extra confirmation.

If the applied scene has no current file copy, the Unsaved scene dialog names that scene and the pending action. Download copy uses the actual accepted-only Blob/anchor download and stays in the dialog. Successful initiation updates the known file association and the dialog snapshot baseline; it does not automatically navigate or open a picker. The button then says Continue. Before a download it says Continue without downloading. Either continuation requires its own explicit click and executes only the frozen action. Continuing without downloading does not clear the unsaved marker.

Cancel or Escape keeps accepted data/history, raw source/position/title drafts, current route, and preview, and returns focus to a persistent Open/New/Source editor or clicked project control. A download failure preserves the dialog and save association and shows task copy plus the actual error in Details. The scene snapshot, project, file/native generations, and disposal state are checked before Download/Continue. Genuine hash navigation invalidates the pending intent, keeps its error, and requires Cancel/reopen. Other actions, reads, imports, rename, history, and shortcuts are blocked while the dialog is open. Invalid file and real preview refusals still use the existing controller authority after explicit continuation.

Help→Unsaved scene uses the current Help dialog and persistent Help focus return; inline Help keeps all raw drafts. The existing browser beforeunload warning is preserved, including Source editor navigation without a file copy. This is tab-local loss prevention, not operating-system/crash recovery, durable storage confirmation, or full commercial validation. The bounded native flow uses the named 1000×760 desktop workspace.

Selectors: unsaved-dialog, unsaved-download, unsaved-continue, unsaved-cancel, unsaved-error, and unsaved-status for successful download initiation. Error Details retains app-error-details. Existing title1136 and file/source controls remain; Source point1143 and Duplicate1153 are separate tasks and are not added by this change.

## Source point

Use the Surface row and Source point in the right inspector. Enter U/V in the actual selected applied Surface's current knot domains, then Inspect. U and V are dimensionless original Source0 Surface parameters, not texture UV or sample-grid indices. XYZ is evaluated from the original CAD Surface in millimeters. Pending source, selected-reference, and Position drafts are not queried.

Query inputs and results are local and ephemeral. An accepted document-context change through Apply, Undo, Redo, Open, or project navigation clears old results. Query U/V does not mark the authored document dirty and does not independently block scene Apply or File actions; the existing source/camera/position guards still apply. Inspect changes no original source, native reference, history, view, display, or authored file bytes. It performs no geometry edit, projection, picking, pixel read, or renderer marker insertion.

Original-source evaluation uses the existing CAD Float64 path. The GPU preview is sampled, approximate display geometry; the query does not certify pixel or native/display equality, global geometry accuracy, or devices beyond the actual bounded flow. Help→Source point uses the existing dialog and returns focus to the persistent Help trigger while preserving draft text.

## Native Surface scene on the Material Canvas

Open `material.html`. The reference Surface first loads through the existing native Viewer. **Create Scene** declares two original Surface assets and applies their complete native scene on that same Canvas. The Source, Canvas and Inspector stay in three compact panes. Material target selects an authored Surface material in the Inspector.

Material and lighting drafts share **Apply scene**, **Discard** and one scene Undo/Redo history. Invalid input keeps the applied scene and editable raw text. Source, supplied uniforms, original CAD assets and revisions, camera, lighting, visibility and static body poses are stored in `.native-scene.json`. Material-only mode retains its separate `.material.json` format. Scene files have a 2 MiB limit. Open validates the complete scene and refuses a display scale or background that differs from this mounted preview.

Drag to orbit, Shift + drag to pan, and use the wheel to zoom. Navigation changes only the local viewport. Body selection, authoring, Apply, Undo/Redo and Save remain available after Orbit. Apply and history preserve the displayed camera. **Scene camera** resets the local view without consuming drafts or adding history. **Set scene camera** adopts the displayed camera through one complete Apply and requires a clean authored scene. Save excludes local navigation. A successful Open/New uses the incoming authored camera; a failed replacement retains the prior view and drafts. File transitions and dialogs end held pointer controls. The Viewer remains mounted when entering scene mode or creating another scene; the appearance method requires an already mounted supported backend.

The private `native-scene-flow.mjs` driver checks app host composition against source and actual public SDK output. Its presenter callbacks model CPU transaction boundaries; they do not prove Canvas rendering. `--verify-files <first> <second> --output <new-directory>` qualifies separately captured browser downloads. Public library formats, limits and provider code remain unchanged. Object picking, mesh topology tools, gizmos, animation, renderer first-mount and recovery acceptance are separate work.

## Supported desktop workspace

The minimum supported workspace is **1000 × 760 CSS pixels**. The right inspector has its own scroll area so Surface controls and Source point remain accessible. Source Apply and topbar File actions remain reachable, and the footer keeps Draft changes visible. This is a named desktop layout scope for the bounded native flow. Existing smaller CSS breakpoints do not establish mobile acceptance. No size-blocking overlay is added.

## Duplicate scene

Use File→Duplicate scene or the persistent Duplicate scene toolbar button. Existing drafts first use the current Apply/Discard/Cancel guard. Apply must accept the complete document; invalid hidden position, source, or camera data cannot bypass that check. Cancel in the draft guard keeps the original draft and does not open a copy dialog.

The copy dialog starts with the exact applied title plus ` copy`, without truncation. Enter a nonblank primitive string of at most 128 Unicode code points and 256 UTF-16 code units. Unicode and whitespace are preserved. Duplicate creates a host document ID `scene_` plus a fresh UUID without hyphens, checks it against all workspace document IDs, and calls the pure duplicate helper on accepted data. Only a successful complete controller Open adds the copy to Workspace, selects it, and changes the route.

The copy starts at revision 0 with new history and no prior Undo/Redo. It has an independent document/file identity; its download basename uses its new document ID. Complete original scene/native sources, native model/Surface/asset IDs, asset revision, camera, and display remain unchanged. It retains original native identity rather than creating a new CAD model. The original workspace entry stays available and can be edited separately. The copied project is local and has not been downloaded. Save each document to keep separate files.

The dialog captures accepted/draft snapshot identity, project, file/native generations, and lifecycle state. A changed snapshot or genuine hash navigation refuses duplication; a stale error remains while editing the raw title and requires Cancel/reopen. A preparation/presentation refusal keeps the original document/history/route and retains the dialog/title with task copy and actual error Details. No project is added on refusal. Cancel or Escape preserves current data and returns focus to the persistent Duplicate scene trigger. Other file/native/rename/history actions and shortcuts are guarded while the dialog is open.

Help→Duplicate scene uses the existing Help dialog and persistent Help focus return. Inline Help in the copy dialog keeps the raw title. The actual host selectors are duplicate-scene, duplicate-dialog, duplicate-title, duplicate-confirm, duplicate-cancel, and duplicate-error. Existing rename/file/source selectors are preserved.

Duplicate scene uses the current draft and unsaved-scene guard. Resolve Apply, Discard, or Cancel first. Then download the applied original or explicitly continue before choosing the copy title. Cancel returns focus to Duplicate scene. Open, native import, rename, history, and shortcuts are blocked while the duplicate dialog is open. A refused preview keeps that dialog and does not register or route to the copy.

## Camera controls

Use Orbit/Pan in the existing mixed viewport. Left drag or focused canvas arrows orbit around the current camera target. Pan mode or Shift-drag/Shift-arrows moves eye and target together along the actual camera basis. Wheel and +/- zoom; a positive wheel delta moves farther, and + moves nearer. The canvas is keyboard-focusable. Escape cancels the temporary view.

A gesture starts from the applied camera or the last admitted view preview and displays the applied scene only. It does not apply source, Surface position, or other drafts. The View preview label distinguishes the temporary camera; numeric camera fields show that preview and are disabled. Source/native/display controls remain mounted and keep raw values while disabled. Other host file/navigation/import/rename/history actions and shortcuts are blocked until Use view or Cancel view.

Use view restores the applied frame first, stages the shown camera in place of any manual camera draft, and applies the complete authored candidate once. The short Replaces camera draft notice identifies that replacement. If original source, camera/profile, or hidden position validation refuses Use view, the applied frame and existing raw drafts remain, with the captured camera staged for correction. Cancel view restores the applied frame before clearing the temporary view and retains any manual camera draft. A retained restoration refusal stays pending. Save after successful Use view stores the applied camera; the normal accepted-undownloaded guard then applies.

Pointer/wheel/keyboard input is coalesced for one preview call per animation frame. Pending input and pointer capture are canceled after an external session/preview change, resize, focus loss, context loss, disposal, or unmount. Input never carries a prior gesture into a new document. Zoom wheel input is bounded before exponentiation; actual camera poses are not silently clamped. Existing GPU/profile admission can refuse entering/clipping the Sphere or invalid view limits. A retained refusal keeps the last good displayed view. This adds no Viewer, renderer, camera object, picking, native geometry change, or new projection model.

Help→Camera controls and the viewport Help button use the existing host Help dialog and return focus to the persistent Help menu trigger. Help preserves the temporary view and all drafts. The reusable viewport has a local Help fallback when no host callback is supplied. Controls fit the bounded 1000×760 desktop workspace; this does not establish mobile support. Test IDs: camera-orbit, camera-pan, camera-use-view, camera-cancel-view, camera-controls-help, camera-view-state, and existing mixed-canvas.

The compact mixed layout uses 4–6px panel/field spacing, 32px menu, 30px document and 20px status bars. Default left/right docks are 180/240px (minimum 160/220px). The viewport header is 44px and bottom strip 24px. Measured drawer bounds still retain at least 220px of real canvas height. Density changes remain local UI state and do not change authoring or scene files.


In Native Scene, Object → Duplicate body or the top Duplicate button copies the selected visible Surface. It copies its entire original source asset and material with independent IDs, preserves its quaternion and nonuniform pose, and applies one complete scene change before selecting the copy. The copy initially overlaps the original; drag its Move handle or change Position to separate it. Apply or Discard drafts before duplicating. At four source assets or four displayed bodies, Duplicate is disabled. Undo/Redo and complete native files reconstruct the real inventory. Camera navigation remains local; duplication keeps the displayed camera. Open resets retained identity context only after success.


Object → Remove body and the top Remove button remove the selected Native Surface through one whole scene change. Its material and pose are removed, and its full source asset is removed only when no other native body references it. The last editable Surface is protected. Apply or Discard drafts first. Undo/Redo reconstruct the real inventory and qualified references; camera navigation stays local. Whole native Save/Open preserves the remaining original source and independently editable bodies.


Object → Add Surface and the top Add Surface button import one actual Surface from an original CAD source file up to64KiB. The dialog retains the complete source and lists actual Model/Surface choices. Select the Surface and press Add; the new source asset, body and material have independent identities. The new object starts at its source origin with identity pose and copies the selected applied material. Move it after adding. All existing objects, source, transforms, materials, lighting and authored camera remain intact, with genuine refreshed native targets. Add uses one whole scene change before activating the new body. Failed, canceled or stale reads keep the scene and prior dialog candidate. Apply or Discard drafts first; existing four-asset/display/material limits apply. Undo/Redo and complete native files reconstruct original source and the new editable Surface.


Native Scene opens with the Canvas as the main workspace. The right Outliner sits above Transform, Lighting and Material properties. View → Show Material Source or the top Source button reveals the advanced shader editor. Source stays mounted when hidden; raw text, invalid values, session and file guards remain active. Layout is local to this tab and excluded from saved files. Apply, history and Open keep the local panel state. The redundant material toolbar and CPU sample are hidden in Native Scene; the real scene Apply/Discard and Diagnostics stay available. The 256px inspector keeps the current desktop Canvas within the existing rotation backing-size budget. Material-only mode retains its existing layout.


Native Canvas keyboard commands: click the Canvas, then W for Move, E for Rotate, R for Scale or F to Frame. Mode and framing commands affect only the local workbench. Text fields, menus and dialogs retain their keys. Active or refused pose previews and transform Help block these commands. Existing handle Arrow/Enter/Space/Escape and Ctrl/Cmd Save/Open/history remain available.
