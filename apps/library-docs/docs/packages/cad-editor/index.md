# CAD Editor: original native authoring

**New to the editor?** Start with [your first model in the UI](./first-model): load a bounded pocket sample, change its depth, inspect a named output, undo, and save/reopen authored dimensions. No internal graph IDs or code are required. Continue with [a round post](./round-post) for diameter-driven modeling and native-versus-preview precision, then [fuse an L-bracket](./l-bracket) with two qualified rectangular extrusions.

CAD Editor provides pure editing sessions and reusable React components. Use it to stage native control-point fields, prepare a complete qualified candidate, display it, and then accept the actual native edit.

**Checkpoint:** `5f5ad866205a`; version `0.0.0-experimental`. This is a locally public-configured package. Registry publication is not established. Ordinary workspace imports select source through a TypeScript-capable host. Use the existing dependencies and Node 22+. No custom source condition is required. Compiled release maps are separate.

The root has no React/DOM/clock initialization. The `/react` entry owns a Viewer/canvas and display controls while mounted. The caller retains and disposes the CPU session.

## Choose an authoring mode

The canonical document mode retains complete original Source0 assets and asset-qualified Curve/Surface bodies. Display is a separately chosen subset. The Boolean-extrusion feature mode retains an authored graph, shared/referenced outputs and parameter transactions. Do not replace either source authority with display mesh or pixels.

[Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits and errors](./limits)

`packages/barocss-cad-editor/package.json` (Manifest and version; local source) · `packages/barocss-cad-editor/README.md` (Package task notes; local source)
