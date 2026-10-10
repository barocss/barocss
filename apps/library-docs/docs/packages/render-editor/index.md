# Render Editor: source-authoritative scene workbench

Render Editor supplies pure sessions/controllers and reusable React workbenches over the actual public GPU compiler/renderer. Use it when original scene source, camera drafts and whole Apply must remain separate from presented frames.

**Checkpoint:** `5f5ad866205a`; version `0.0.0-experimental`. This is a locally public-configured package. Registry publication is not established. Ordinary workspace imports select source through a TypeScript-capable host. Use the existing dependencies and Node 22+. No custom source condition is required. Compiled release maps are separate.

## Choose the authoring format

Version 0 `gpu-scene` stores Source1 scene text and camera. It supports admitted Source1 objects and an empty scene. Version 1 `mixed-depth` is a separate bounded profile containing one original Sphere scene and one selected native Surface from complete original CAD source.

The original sources/IDs are authority. Display packets, derived poses, GPU programs and rendered images are reconstructed outputs. This package is separate from the React screen renderer in [Render](/packages/render/).

[Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits and errors](./limits)

[Public root](/packages/render-editor/reference#declarations-7ff934513450)

`packages/barocss-render-editor/package.json` (Manifest and version; local source) · `packages/barocss-render-editor/README.md` (Package task notes; local source)
