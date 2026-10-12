# Render Editor: source-authoritative scene workbench

Render Editor supplies pure sessions/controllers and reusable React workbenches over the actual public GPU compiler/renderer. Use it when original scene source, camera drafts and whole Apply must remain separate from presented frames.

**Checkpoint:** `5f5ad866205a`; version `0.0.0-experimental`. This is a locally public-configured package. Registry publication is not established. Ordinary workspace imports select source through a TypeScript-capable host. Use the existing dependencies and Node 22+. No custom source condition is required. Compiled release maps are separate.

## Choose the authoring format

Version 0 `gpu-scene` stores Source1 scene text and camera. It supports admitted Source1 objects and an empty scene. Version 1 `mixed-depth` is a separate bounded profile containing one original Sphere scene and one selected native Surface from complete original CAD source.

The original sources/IDs are authority. Display packets, derived poses, GPU programs and rendered images are reconstructed outputs. This package is separate from the React screen renderer in [Render](/packages/render/).

## Native Light workbench: bodies, camera and lights

The current Native Light path is a separate source-authoritative profile for one to four selected native Surfaces, authored materials and a homogeneous catalog of zero to four directional **or** point lights plus ambient. In the Render Editor app, open **Material Editor → Light workbench**, then explicitly choose **Start directional workspace** or **Start point workspace**. Select an original body, edit its position in mm and dimensionless scale, edit the authored Scene camera and lights, then use one complete **Apply**, **Undo/Redo**, **Save accepted** and fresh same-kind **Open**.

Use the unsuffixed `RenderNativeLightDocument` and `RenderNativeLightSession` with `parseRenderNativeLightDocument`, `prepareRenderNativeLightDocument`, `serializeRenderNativeLightDocument`, `createRenderNativeLightRequest` and asynchronous `createRenderNativeLightSession`. The catalog profile chooses the backend; the saved envelope's version 2 / `canonical-native-lights` is a file compatibility tag. Original CAD source, qualified body identities, material source/overrides, raw camera and poses remain authority. Derived TEN requests, execution buffers and frames are reconstructed.

**Native Light source checkpoint:** `7cd383eecd5f7a9379bd73f0f90fc60e2a1ac60b`, including the generic workbench, authored camera and numeric body fields. The earlier checkpoint above describes the historical Source1/mixed-depth documentation. This source availability does not establish registry publication, physical WebGPU/file acceptance or a fix for the still-open [arrow-control report #1573](https://github.com/barocss/barocss/issues/1573).

Start with the [Native Light workflow](./guides#author-a-native-light-scene), [complete downloadable scenes and shared host](./examples#native-light-scene-downloads), and [Native Light bounds and refusals](./limits#native-light-format-and-bounds). The Source1 and mixed-depth workflows remain separate supported profiles.

[Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits and errors](./limits)

`packages/barocss-render-editor/package.json` (Manifest and version; local source) · `packages/barocss-render-editor/README.md` (Package task notes; local source)
