---
layout: home
hero:
  name: BaroCSS Libraries
  text: Build a model. Show a scene. Keep control.
  tagline: Choose a library, follow a task, and check its public API and support boundary.
  actions:
    - theme: brand
      text: Choose a library
      link: /packages/
    - theme: alt
      text: Browse examples
      link: /examples/
    - theme: alt
      text: Read shared concepts
      link: /concepts/coordinates
features:
  - title: Create native geometry
    details: CAD owns the model. Interop prepares copied display data and format adapters.
    link: /packages/cad/
  - title: Draw and inspect
    details: GPU, Canvas2D and Viewer provide distinct rendering and interaction contracts.
    link: /packages/gpu/
  - title: Build an authoring tool
    details: CAD Editor and Render Editor keep native authoring and scene authoring separate.
    link: /packages/cad-editor/
  - title: Render data as UI
    details: Render converts a supported UI document to React. CSS tools retain their existing guides.
    link: /packages/render/
---

## See an actual result

[Browse the example catalog](/examples/) by library, source language or integrated workflow. Edit a complete input, inspect its actual result and follow the selected guide. Use [language practice](/examples/language) for CAD declarations, GPU scene styles and material expressions, or [the integrated CAD-to-GPU example](/examples/integration) for the native-to-display handoff.

## Pick your first task

- [Create and inspect a CAD model](/packages/cad/quickstart).
- [Prepare native model data for a renderer](/packages/cad-interop/quickstart).
- [Draw a GPU scene](/packages/gpu/quickstart).
- [Draw a retained 2D scene](/packages/canvas2d/quickstart).
- [Load a model into Viewer](/packages/viewer/quickstart).
- [Run a bounded Physics step](/packages/physics/quickstart).

## Check availability before you start

This manual describes a fixed local source snapshot. Experimental package configuration does not prove an npm release. Read [versions and availability](/concepts/versions) and the package limits before choosing a host. Existing [CSS documentation](https://barocss.com/guide/) keeps its own release pins.
