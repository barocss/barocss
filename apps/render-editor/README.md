# Render Editor app

A private React and shadcn host for `@barocss/render-editor`. The app owns menus, native files, downloads, workspace navigation, and example documents. The module owns source, camera, inventory, diagnostics, and the GPU viewport.

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

The host exposes stable `data-testid` selectors: `open-file`, `save-file`, `scene-file-input`, `draft-dialog`, `draft-apply`, `draft-discard`, `draft-cancel`, `app-error`, `app-error-details`, `accepted-revision`, `presented-revision`, and `project-forms` / `project-assembly`. `app-error` contains task copy; open its Details control to read `app-error-details`. The revision data attributes keep the actual accepted and presented revisions. Selectors refer to real controls and status text. There is no application debug global.


## Mixed document app

Open `/mixed.html#/mixed/surface_study` or `/mixed.html#/mixed/rational_panel` for the separate version 1 mixed document app. The original `/index.html` source editor remains available through Source editor. The Vite build includes both page entries.

The mixed app owns the same shadcn File/Edit/Workspace/Help shell, project routes, native file picker, accepted-only downloads, shortcuts, and Apply/Discard/Cancel guard. New starts from the named Sphere and native Surface profile. Both samples keep complete original source 1 and source 0 text, selected original model/Surface references, rational weights, and an unrendered Curve. Sampling and GPU data remain derived in the module.

Native file size is checked against 524288 bytes before `File.text()`. A late read is refused when the session snapshot or project changes. Open adds a project only after the real controller accepts and presents it. Save downloads `.render-mixed.json`; fresh Open reconstructs the complete mixed frame from authored data. Version 0 scene files use the source editor and are refused here.

Projects stay in this tab. Save a file before closing. Notices and optional Details overlay the workbench without resizing the preview. The module owns preview and draft diagnostic notices. Restore preview is offered only when the display is unavailable and the controller is live. No precise picking, materials, Physics, independent poses for multiple assets, or broader mixed shape support is claimed.

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

## Supported desktop workspace

The minimum supported workspace is **1000 × 760 CSS pixels**. The right inspector has its own scroll area so Surface controls and Source point remain accessible. Source Apply and topbar File actions remain reachable, and the footer keeps Draft changes visible. This is a named desktop layout scope for the bounded native flow. Existing smaller CSS breakpoints do not establish mobile acceptance. No size-blocking overlay is added.

## Duplicate scene

Use File→Duplicate scene or the persistent Duplicate scene toolbar button. Existing drafts first use the current Apply/Discard/Cancel guard. Apply must accept the complete document; invalid hidden position, source, or camera data cannot bypass that check. Cancel in the draft guard keeps the original draft and does not open a copy dialog.

The copy dialog starts with the exact applied title plus ` copy`, without truncation. Enter a nonblank primitive string of at most 128 Unicode code points and 256 UTF-16 code units. Unicode and whitespace are preserved. Duplicate creates a host document ID `scene_` plus a fresh UUID without hyphens, checks it against all workspace document IDs, and calls the pure duplicate helper on accepted data. Only a successful complete controller Open adds the copy to Workspace, selects it, and changes the route.

The copy starts at revision 0 with new history and no prior Undo/Redo. It has an independent document/file identity; its download basename uses its new document ID. Complete original scene/native sources, native model/Surface/asset IDs, asset revision, camera, and display remain unchanged. It retains original native identity rather than creating a new CAD model. The original workspace entry stays available and can be edited separately. The copied project is local and has not been downloaded. Save each document to keep separate files.

The dialog captures accepted/draft snapshot identity, project, file/native generations, and lifecycle state. A changed snapshot or genuine hash navigation refuses duplication; a stale error remains while editing the raw title and requires Cancel/reopen. A preparation/presentation refusal keeps the original document/history/route and retains the dialog/title with task copy and actual error Details. No project is added on refusal. Cancel or Escape preserves current data and returns focus to the persistent Duplicate scene trigger. Other file/native/rename/history actions and shortcuts are guarded while the dialog is open.

Help→Duplicate scene uses the existing Help dialog and persistent Help focus return. Inline Help in the copy dialog keeps the raw title. The actual host selectors are duplicate-scene, duplicate-dialog, duplicate-title, duplicate-confirm, duplicate-cancel, and duplicate-error. Existing rename/file/source selectors are preserved.

Duplicate scene uses the current draft and unsaved-scene guard. Resolve Apply, Discard, or Cancel first. Then download the applied original or explicitly continue before choosing the copy title. Cancel returns focus to Duplicate scene. Open, native import, rename, history, and shortcuts are blocked while the duplicate dialog is open. A refused preview keeps that dialog and does not register or route to the copy.
