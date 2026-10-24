# Display, sections and analysis

Everything on this page changes how the model is shown, never the model itself. Its controls are:

- **Display**, the popover on the view bar;
- the view bar's other buttons;
- the dock's **Preview & analysis** section.

## Display modes

![The Display popover: the CAD display mode and Isolate selection](/shots/studio/display/display-popover.png)

**CAD display mode** sets how bodies are drawn:

| Mode | What you see |
|---|---|
| Shaded with edges | Shaded surfaces with their edges and curved-face silhouettes |
| Hidden lines removed | Only the visible edges, as on a drawing |
| Hidden lines dashed | Visible edges, and hidden ones dashed |
| Wireframe | Every edge, seen through |
| X-ray | See-through surfaces, so you can see inside an assembly |

In an assembly, **Isolate selection** fades everything but the picked parts. **Restore view** brings the rest back.

Other view settings:

- **Ortho** switches between perspective and orthographic projection.
- **Toggle light or dark theme** switches the colour scheme.
- **Ambient occlusion** shades the corners.
- **Selection filter** chooses what a click picks: anything, or only faces, edges or whole bodies.
- **Snap** sets the step that sketch points, placing and moves land on: 1, 0.5, 0.1, 5 or 10 mm, or off.

## Sections

![A box with a hole cut open by one section plane, its cut faces hatched, the Section bar below](/shots/studio/display/section.jpg)

**Section view** cuts the part open to see inside. The model isn't changed.

- **Section mode** is **Plane**, one plane along X, Y or Z, or from a flat face you click; **Box**, six planes with a
  handle on each face; **Planes**, two or three planes; or **Cut-out**, a corner taken out.
- **Add a section plane** adds one. Each plane's offset can be typed, or dragged by its handle.
- The kept region is where every plane's kept side meets. With two or three planes it can be a cut-out instead: the
  corner where their cut-away sides meet is removed.
- **Reset the section box** puts the box a tenth in from each face of the part.
- Cut faces are capped. **Hatch the cut** draws hatch lines on them, each part's at its own angle.
- **Sketch the section** starts a sketch on the section plane with the cut's outlines in it, ready to extrude,
  revolve or dimension. It needs one plane, since a sketch lies on one plane.

## Preview & analysis

The dock's **Preview & analysis** section shows one preview on the model at a time. Its switch is **None**, **CNC**,
**Print**, **Clearance** or **Analysis**:

- **The switch turns the preview on.** Only the chosen preview's settings show under it.
- **None** shows a one-line hint.

![The Preview & analysis section with Analysis chosen: its Surface and Map choices](/shots/studio/display/preview-analysis.png)

The previews are:

- **CNC** and **Print**: see [Manufacturing](/studio/manufacturing).
- **Clearance**: see [Assemblies](/studio/assemblies).
- **Analysis**: below.

### Analysis

![Zebra stripes on a filleted box](/shots/studio/display/zebra.jpg)

- **Surface:** **Zebra** stripes or a **Curvature** map, for judging how smoothly faces meet. **Overhang** appears for
  a part with a printing process.
- **Map:** a coloured map with a legend that reads the value under the pointer.
  - The maps are **Thickness**, **Draft**, **Access**, **Parting** and **Halves**.
  - **Draft**, **Parting** and **Halves** appear for a part with a pull direction.
  - The maps draw only with WebGPU. On WebGL2 they are disabled, with the reason.
- **The view bar.** **Analyse** and **Maps** step through the same choices.
- **Turning it off.** With no surface analysis and no map, the Analysis preview turns off.

| Map | Colours |
|---|---|
| Thickness | Wall thickness: thin red, nominal green, thick orange, past the thick-section limit purple |
| Draft | Under the least draft red, positive green, negative blue, isoclines white |
| Access | The share a 3-axis mill doesn't reach, in red |
| Parting, Halves | The mould's parting line, then its two halves spread apart |

### 3D annotations

**3D annotations**, a toggle at the right of the section's header, shows the drawing's dimensions and notes on the
model, over any preview but the print and CNC previews. Clicking one picks what it dimensions.

They show only in the Model workspace, and not while an edit is under way, such as a sketch or a running command.

## Frame cost

For diagnosing slow scenes, the viewer can count each body's draw work per display mode: draw calls, triangles, lines
and render passes. This isn't shown in the interface yet. Counts aren't comparable between WebGPU and WebGL2, because
the two draw curved-face silhouettes differently.
