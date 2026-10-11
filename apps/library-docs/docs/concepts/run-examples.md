# Use the interactive examples

Open a task, edit its complete input and compare the picture with the reported data. Begin with the [example catalog](/examples/) to choose the learning purpose.

## Choose a purpose

| Purpose | What you learn | Where to start |
| --- | --- | --- |
| API operation | Public calls, accepted state, actions, ownership and lifecycle | [Tasks by library](/examples/library) |
| Language practice | Source declarations, expressions, units and diagnostics | [Language examples](/examples/language) |
| Integrated workflow | Data handoff between distinct public library contracts | [CAD-to-GPU example](/examples/integration) |

The library view includes every learning purpose for each primary library. A language exercise can use another library for its display fixture without teaching a complete integration workflow. Shared browser hosts and UI components do not change a sample's purpose.

The existing [playground](/playground) still selects every sample and keeps its deep links. New catalog links open the same admitted inputs in their purpose-specific views.

## Change one input at a time

1. Select a task and read the language or input format above its editor.
2. Follow its guide for the expected operation and result.
3. Change a dimension, color or parameter, then select **Run input**.
4. Compare the picture with **Actual result data**.
5. Select **Reset example** to restore the original input and state.

Typing alone does not replace accepted geometry or paint a new frame. A regular input refusal leaves the accepted result available while its host remains usable. Read the code and message, keep the corrective draft, and submit a new candidate. Device or context failures have their own recovery limits; a retained CPU value is not a guarantee of restored pixels.

## Match the input to the operation

CAD language presets select source0, source1 or source2 explicitly. Their matching version header is part of the source, but editing it does not change the selected compiler option. [CAD language practice](../packages/cad/language-examples) covers weighted parameters, curved extrusion and nonunit Curve domains.

GPU scene presets use their stated source dialect and coordinate rules. Material presets use the indicated mesh or UV material profile. The [function gallery](../packages/gpu/function-examples) teaches independent functions; [GPU compositions](../packages/gpu/composition-examples), [Neon plasma](../packages/gpu/advanced-shader) and [caustics](../packages/gpu/caustics-shader) explain complete expressions and their controls.

Canvas2D, Viewer and Physics API presets can use host JSON or an application controller around public calls. That input is not automatically the package's persisted document format. Actions such as a manual step, Clear, Save or Open have meanings stated in the selected guide. [Unicode labels](../packages/canvas2d/unicode-labels) save in page memory; [diagram labels](../packages/canvas2d/diagram-labels) and [path editing](../packages/canvas2d/path-editing) use actual document files.

## Read coordinates and units

CAD geometry uses millimetres and original U/V domains. A tessellated display mesh is separate sampled data. Some examples fit sampled bounds to a view, so changing size can leave a similarly sized picture. Read native XYZ and parameters as well as rendered pixels. Sampling does not establish a closed Solid.

GPU scenes use their declared scene units and transform rules. Material UV coordinates are dimensionless. Shader phase uses explicit uniform values; **Play shader** starts a host clock and **Pause shader** stops it. Compilation supplies no timer.

Canvas2D uses logical pixels and an explicit DPR. Its public hit returns a semantic node ID and kind. Rectangle probes query that scene; path buttons and control lines are application overlays. Pointer-to-local editing includes the current view and every parent transform.

Viewer camera controls change the display, not native CAD source. Physics uses metres and seconds. **Advance 20 steps** adds twenty steps to the current state; reset before comparing an absolute step20 result. Its Y=0 line is a reference, not a collider.

## Distinguish a library from its browser host

The CAD curve plot and Physics projection use the browser's native Canvas2D context. They do not execute the BaroCSS Canvas2D package. Canvas2D samples use the package's public renderer, display tree and, where needed, its document entry. A second entry in one package is not a second library.

The procedural UV shaders use public GPU compilation, binding and lowering in an app-owned WebGL2 quad host. That host owns drawing, controls, clock and cleanup; it is not automatically a package Engine renderer. Viewer tasks use the view's direct public API. The integrated Surface task specifically teaches the CAD native-to-sampled-packet-to-GPU boundary.

## Use the APIs in your application

Package guides supply complete public imports, inputs and lifecycle. Source entries need a TypeScript-capable application build. Choose the matching source profile and requirements from [versions and availability](./versions); the catalog does not update package APIs or release status.

Browser APIs that mount a view, attach controls or load local fonts need their documented DOM host. GPU, public Canvas2D and Viewer drawing require WebGL2. Native curve and Physics plots need a browser Canvas2D context. Numeric compilation, geometry evaluation and world stepping can run separately from display.

Continue with [CAD examples](../packages/cad/examples), [GPU examples](../packages/gpu/examples), [Canvas2D examples](../packages/canvas2d/examples), [Physics examples](../packages/physics/examples) or [coordinates and units](./coordinates).
