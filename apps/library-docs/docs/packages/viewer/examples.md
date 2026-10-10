# Viewer task examples

| Task | Existing host | Key boundary |
| --- | --- | --- |
| Native load / controls / point query | [Viewer scene](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/viewer-scene/README.md) | CSS pick vs original millimetre point. |
| Canonical document | [Document Viewer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/viewer-document/README.md) | Original document bodies remain qualified. |
| Multiple sources | [Model set](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/viewer-model-set/README.md) | Model/geometry namespaces are separate. |
| Clear and reuse | [Clear example](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/viewer-clear/README.md) | Real blank GPU frame, retained view, superseded load. |
| Independent Face assets | [Qualified Faces](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/viewer-qualified-face-scene/README.md) | Source pins, shared display depth and bounded screen/native queries. |
| Physics cloth | [Cloth Viewer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/viewer-cloth-scene/README.md) | Caller simulation metre positions converted once for display. |

Use the [shared source consumer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/workspace-source/README.md) for ordinary source import and cleanup. Older specific hosts declare their own source or compiled resolution and ports; read that host's README before running it. These links identify existing runnable tasks. This manual does not renew all gallery, GPU or device acceptance.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-viewer/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-viewer/README.md)
