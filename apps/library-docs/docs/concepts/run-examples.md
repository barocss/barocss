# Use the interactive examples

Open an example, change its input, and compare the displayed result with its data. Each example includes a complete starting input and a description of the public API it uses.

## Change one input at a time

1. Open the [interactive examples](/playground) and choose a sample.
2. Read its source language or input format above the editor.
3. Change a dimension, color or parameter, then select **Run input**.
4. Compare the picture with **Actual result data**.
5. Select **Reset example** to restore the starting input.

A rejected input does not replace the accepted result. Read its error code and message, correct the candidate, then apply it again. Changing the text alone does not change geometry or draw a new frame.

## Choose a sample

| Sample | What to inspect | Input format |
| --- | --- | --- |
| GPU scene and six shapes | Dimensions, colors, transforms and primitive differences | GPU source1 |
| CAD curve | Evaluated curve, control polygon and original parameter domain | CAD source0 |
| CAD surface | Weighted geometry, sampling grid and triangle mesh | CAD source0 |
| CAD extrusion | Curve plus extrusion vector forming an open Surface | CAD source1 |
| CAD parameters | Typed lengths/scalars and geometry after an edit | CAD source2 |
| Material function samples | Color response to an explicit scalar uniform | Mesh material language |
| Canvas2D rectangle | Logical dimensions and the current scene hit | Host JSON passed to Canvas2D APIs |
| Viewer panel | Native source, display camera, clear and reload | CAD source0 |
| Physics steps | Position and velocity after explicit fixed steps | PhysicsWorldConfig JSON |

The selected CAD sample determines its compiler version. Changing a source header does not change that selection. Use [CAD language](../packages/cad/language) to choose the correct declarations and units.

The [material function gallery](../packages/gpu/function-examples) explains all eleven source functions with complete inputs and result images. The slider supplies `amount` explicitly. A material creates no timer.

## Read coordinates and units

CAD geometry uses millimetres and original U/V domains. A display mesh is a sampled view of that geometry. The examples fit some meshes to the viewport, so changing all dimensions by the same factor can preserve screen size. Read native coordinates as well as the picture.

Canvas2D uses a logical pixel area and an explicit device-pixel ratio. Its hit query returns the identity of geometry in the current accepted scene. The example's probe is a query point; it does not dispatch a pointer event.

Viewer camera operations change the display. They do not edit native CAD source. The [Viewer example](../packages/viewer/examples) explains how to load, fit, clear, reload and release the view.

Physics uses metres and seconds. **Advance 20 steps** adds twenty fixed steps to the current state. Reset first when comparing a result at absolute step20. The diagram projects copied world state onto host Canvas2D; its Y=0 line is a reference, not a collider.

## Use the APIs in your application

Each package's examples show the complete input and public imports needed for its operation. Use a browser host for APIs that mount a canvas, attach controls or access the DOM. GPU, Canvas2D and Viewer drawing require WebGL2. The curve plot and Physics diagram use a browser Canvas2D context.

Source entries require a TypeScript-capable application build. Use the entry and dependency requirements described by the package's [API and availability pages](./versions). Numeric compilation, geometry evaluation and world stepping can run without a display; drawing and browser controls require their own host.

Continue with [CAD examples](../packages/cad/examples), [GPU examples](../packages/gpu/examples), [Canvas2D examples](../packages/canvas2d/examples), [Physics examples](../packages/physics/examples), or [coordinates and units](./coordinates).
