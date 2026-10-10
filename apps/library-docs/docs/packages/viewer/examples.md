# Viewer task examples

| Task | Existing host | Key boundary |
| --- | --- | --- |
| Native load / controls / point query | `examples/viewer-scene/README.md` (Viewer scene; local source) | CSS pick vs original millimetre point. |
| Canonical document | `examples/viewer-document/README.md` (Document Viewer; local source) | Original document bodies remain qualified. |
| Multiple sources | `examples/viewer-model-set/README.md` (Model set; local source) | Model/geometry namespaces are separate. |
| Clear and reuse | `examples/viewer-clear/README.md` (Clear example; local source) | Real blank GPU frame, retained view, superseded load. |
| Independent Face assets | `examples/viewer-qualified-face-scene/README.md` (Qualified Faces; local source) | Source pins, shared display depth and bounded screen/native queries. |
| Physics cloth | `examples/viewer-cloth-scene/README.md` (Cloth Viewer; local source) | Caller simulation metre positions converted once for display. |

Use the `examples/workspace-source/README.md` (shared source consumer; local source) for ordinary source import and cleanup. Older specific hosts declare their own source or compiled resolution and ports; read that host's README before running it. These links identify existing runnable tasks. This manual does not renew all gallery, GPU or device acceptance.

`packages/barocss-viewer/package.json` (Manifest and version; local source) · `packages/barocss-viewer/README.md` (Package task notes; local source)
