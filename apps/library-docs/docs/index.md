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
      text: Run visual examples
      link: /playground
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

[Run twenty-one editable examples](/playground): CAD geometry and parameters; GPU scenes and eleven material functions; native Viewer load/clear/reload, Canvas2D rectangle/hit testing and manual Physics steps. Read the [CAD language](/packages/cad/language), [GPU scene language](/packages/gpu/language), [GPU material language](/packages/gpu/material-language) and [function gallery](/packages/gpu/function-examples) beside their inputs.

## Pick your first task

- [Create and inspect a CAD model](/packages/cad/quickstart).
- [Prepare native model data for a renderer](/packages/cad-interop/quickstart).
- [Draw a GPU scene](/packages/gpu/quickstart).
- [Draw a retained 2D scene](/packages/canvas2d/quickstart).
- [Load a model into Viewer](/packages/viewer/quickstart).
- [Run a bounded Physics step](/packages/physics/quickstart).

## Check availability before you start

This manual describes a fixed local source snapshot. Experimental package configuration does not prove an npm release. Read [versions and availability](/concepts/versions) and the package limits before choosing a host. Existing [CSS documentation](https://barocss.com/guide/) keeps its own release pins.
