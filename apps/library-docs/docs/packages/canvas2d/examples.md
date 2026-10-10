# Canvas2D task examples

| Task | Existing example | What to observe |
| --- | --- | --- |
| Change a rectangle | [Rectangle consumer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-canvas2d/consumer/rect.html) | Explicit size submission, hit route and cold Open. |
| Reopen an editable tree | [Display tree consumer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-canvas2d/consumer/display-tree.html) | Fresh canvas staging before live replacement. |
| Build and edit a rounded path | [Rounded rectangle consumer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-canvas2d/consumer/round-rect.html) | Commands, pixels and editable document reconstruction. |
| Prepare text | [Browser text task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-canvas2d/README.md) | Browser-font raster output becomes an owned image asset; it is not DOM text. |
| Save source and image bytes | [Document v1 host](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/canvas2d-scene/document-v1.html) | Download/Open with asset hashes and fresh canvas. |

Use the [shared source host](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/workspace-source/README.md) for ordinary workspace import resolution. The older `examples/canvas2d-scene/server.mjs` serves explicit compiled examples after the relevant build. Source-host execution and compiled-consumer execution are different checks. These links preserve existing task examples; this manual build does not rerun their browser receipts.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-canvas2d/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-canvas2d/README.md)
