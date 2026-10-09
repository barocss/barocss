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

Projects stay in this tab. Save a file before closing. Notices and optional Details overlay the workbench without resizing the preview. The module owns preview and draft diagnostic notices. Restore preview is offered only when the display is unavailable and the controller is live. No precise picking, materials, Physics, per-asset placement, or broader mixed shape support is claimed.

The mixed app keeps the file/guard/error/revision selectors described above and adds `render-mixed-editor-app`, `project-surface_study`, and `project-rational_panel`. Accepted and displayed numeric revisions remain in `data-revision`. Use an isolated strict port override for the mixed native flow; the existing 52047 source-editor preview remains unchanged.

## Native source import

Use File→Import CAD source or the Import CAD source button in the mixed app. Choose a plain UTF8 original Source0 text file, inspect all original objects, then explicitly choose a Surface and select Use Surface. The file is limited to64KiB and is checked before reading. A canceled or stale read/selection keeps the current scene and drafts. Use Surface stages the complete original text/model/Surface together; Apply must succeed before the viewport/history changes. Existing Scene/camera/display drafts stay. Replace native draft is required when a pending native source/reference would be replaced.

Use the Native asset Surface selector to change the displayed Surface from the original source; the complete model remains stored. Save stores all original text/objects and the selected reference. Fresh Open rebuilds the selected preview. Only one Sphere and one Surface are shown in this profile; native coordinates use mm with one scene conversion. CAD geometry editing and other CAD file formats are separate workflows.

Contextual Help is Help→Native source import or Help in the import dialog. It preserves drafts and selection. Closing menu Help returns focus to Help; closing import returns focus to Import CAD source. Import file/guard errors show a short next step and optional Details. The focused driver uses isolated52051, preserving existing source/mixed author previews.
