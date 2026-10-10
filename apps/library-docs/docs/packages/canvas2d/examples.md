# Canvas2D task examples

| Task | Existing example | What to observe |
| --- | --- | --- |
| Change a rectangle | `packages/barocss-canvas2d/consumer/rect.html` (Rectangle consumer; local source) | Explicit size submission, hit route and cold Open. |
| Reopen an editable tree | `packages/barocss-canvas2d/consumer/display-tree.html` (Display tree consumer; local source) | Fresh canvas staging before live replacement. |
| Build and edit a rounded path | `packages/barocss-canvas2d/consumer/round-rect.html` (Rounded rectangle consumer; local source) | Commands, pixels and editable document reconstruction. |
| Prepare text | `packages/barocss-canvas2d/README.md` (Browser text task notes; local source) | Browser-font raster output becomes an owned image asset; it is not DOM text. |
| Save source and image bytes | `examples/canvas2d-scene/document-v1.html` (Document v1 host; local source) | Download/Open with asset hashes and fresh canvas. |

Use the `examples/workspace-source/README.md` (shared source host; local source) for ordinary workspace import resolution. The older `examples/canvas2d-scene/server.mjs` serves explicit compiled examples after the relevant build. Source-host execution and compiled-consumer execution are different checks. These links preserve existing task examples; this manual build does not rerun their browser receipts.

`packages/barocss-canvas2d/package.json` (Manifest and version; local source) · `packages/barocss-canvas2d/README.md` (Package task notes; local source)
