---
layout: home
hero:
  name: BaroCSS CAD
  text: Design manufacturable products with an AI agent
  tagline: A B-rep CAD kernel, a document model and a GPU studio — all in TypeScript, no WASM.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Concepts
      link: /guide/concepts
features:
  - title: The studio
    details: Sketch, model, assemble, draw and check a part for manufacturing in the browser — WebGPU where the browser has it, WebGL2 otherwise.
  - title: The agent
    details: Describe what you need and the agent builds it with the same tools you use. Value edits apply directly; anything that changes the part's structure comes to you as a proposal to accept.
  - title: Manufacturing first
    details: Drawings, BOM, CNC, 3D printing, casting, moulding, sheet metal, frames and robots — with sizes from your own shop rows, never invented.
  - title: Correct or refused
    details: The kernel returns an exact, valid body or a typed refusal that says why. It never guesses.
---

![The studio with the starter plate](/shots/home/studio.jpg)

## What's in it

| | |
|---|---|
| [The studio](/studio/tour) | The browser app (`apps/cad-studio`): the model, the viewport, drawings, manufacturing checks and the chat. |
| [The agent](/agent/) | An AI that designs with the studio's own tools, through the chat or as an MCP server and a command line. |
| [`@barocss/cad`](/packages/cad/) | The kernel: exact B-rep and NURBS geometry, Booleans, fillets, offsets, mass properties, STEP, IGES, STL and DXF. |
| [`@barocss/cad-model`](/packages/cad-model/) | The document model above the kernel: parts, assemblies, drawings, BOM, processes, robots and the agent's tools. |
| [`@barocss/gpu`](/packages/gpu/) | The viewer the studio draws with: WebGPU scenes, materials, compute analyses and frame costs. |

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

BaroCSS CAD is unreleased and developed locally. The packages are `0.0.0` versions, and the document schema tracks
the latest version until the first release: there is no migration between unreleased versions.
Everything is written in TypeScript, with no WebAssembly and no geometry libraries underneath.
