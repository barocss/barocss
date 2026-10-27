---
layout: home
hero:
  name: BaroCSS CAD
  text: Design manufacturable products with an AI agent
  tagline: A CAD kernel, a document model, a GPU renderer, Studio and Viewer — all in TypeScript, no WASM.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Concepts
      link: /guide/concepts
features:
  - title: CAD
    details: Build solids with the B-rep kernel. Read the modeling, Boolean, mass and exchange-format contracts.
    link: /packages/cad/
  - title: CAD Model
    details: Work with editable documents, assemblies, drawings, materials and the agent's commands.
    link: /packages/cad-model/
  - title: GPU
    details: Draw meshes and scenes with WebGPU and WebGL2. Check each renderer's material, shadow and analysis limits.
    link: /packages/gpu/
  - title: Studio
    details: Sketch, model, assemble and prepare a design in the browser. Follow the guides for each task.
    link: /studio/
  - title: Viewer
    details: Embed a CAD review interface in another app and manage its review state through the SDK.
    link: /packages/viewer/
  - title: AI agent
    details: Describe a change through chat or the agent tools. Read how edits, proposals and autonomy work.
    link: /agent/
---

![The studio with the starter plate](/shots/home/studio.jpg)

## What's in it

| | |
|---|---|
| [CAD](/packages/cad/) | `@barocss/cad`: the B-rep and NURBS kernel, with Booleans, fillets, offsets, mass properties and exchange formats. |
| [CAD Model](/packages/cad-model/) | `@barocss/cad-model`: the editable document above the kernel, with parts, assemblies, drawings, BOMs, processes and robots. |
| [GPU](/packages/gpu/) | `@barocss/gpu`: the renderer for WebGPU scenes, materials, shadows and supported compute analyses. |
| [Studio](/studio/) | The browser app (`apps/cad-studio`): modeling, the viewport, drawings, manufacturing checks and chat. |
| [Viewer](/packages/viewer/) | `@barocss/viewer`: the SDK for embedding a CAD viewer and managing its review state. |
| [AI agent](/agent/) | The studio's tools through chat, an MCP server or a command line. |

## From design to experiments

The current pages cover CAD geometry, manufacturing reports and supported robot motion and load calculations.
Read each feature's limits before using its results; a displayed motion or manufacturing check does not establish
the accuracy of a physical simulation.

The long-term goal adds experiments to the same project: define a supported profile, bind its inputs to a design
revision, run it and compare results. That common input/result workflow is planned, not implemented or verified.
A bounded physical pendulum is the first planned dynamics experiment; its hinge, gravity and inertia path still
needs support confirmation. Structural, thermal and fluid experiments are later plans, not current solver support.

See [Planned experiment evidence](/reference/verification#planned-experiment-evidence) for the separate implementation,
numerical and measurement gates, and [Limits](/reference/limits#planned-physical-experiments) for the current boundaries.

## Status

BaroCSS CAD is unreleased and developed locally. The packages are `0.0.0` versions. The document reader converts
supported older schemas and reports the changes. Save the opened model to keep its current form. Newer schemas and
unknown features are refused; compatibility between all unreleased versions is not guaranteed. See
[Document schema](/reference/document#schema-version).
Everything is written in TypeScript, with no WebAssembly and no geometry libraries underneath.
