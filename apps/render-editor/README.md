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

The fixtures cover sphere, box, cylinder, torus, and capsule in two different scenes. The current editor supports sourceVersion 1 SDF scenes. CAD, material qualification, and Physics are later provider tasks.

## Native-flow selectors

The host exposes stable `data-testid` selectors: `open-file`, `save-file`, `scene-file-input`, `draft-dialog`, `draft-apply`, `draft-discard`, `draft-cancel`, `app-error`, `accepted-revision`, `presented-revision`, and `project-forms` / `project-assembly`. They refer to real controls and status text. There is no application debug global.
