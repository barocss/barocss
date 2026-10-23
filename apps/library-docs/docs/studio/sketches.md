# Sketches

A sketch is a flat profile on a plane. Features such as extrude, revolve and sweep are made from it.

## Start a sketch

Press <kbd>S</kbd> (**Sketch**).

- With nothing picked, the sketch lies on the XY plane.
- With a flat face picked, it lies on that face; the sketch panel says so, for example `SKETCH · Y 0 · on face`.
- In the sketch panel, **Plane offset** lifts the plane along its normal (`SKETCH · Z 5`) and **Plane angle** tips it
  about its X axis (`SKETCH · 30° tilted plane`). The shapes keep their coordinates on the plane.

Finish the sketch with <kbd>Enter</kbd> or **Finish sketch** in the top bar.

## Drawing tools

![A rectangle drawn in a sketch on XY: its two dimensions, its constraints and "Fully defined" in the sketch panel](/shots/studio/sketches/rectangle.jpg)

| Key | Tool | How |
|---|---|---|
| <kbd>R</kbd> | Rectangle | Click two corners |
| <kbd>C</kbd> | Circle | Click the centre, then the radius |
| <kbd>L</kbd> | Line | Click points; click the first point to close. <kbd>A</kbd> switches to arcs |
| <kbd>A</kbd> | Arc | Click the arc's end, move to bend it, click to place. <kbd>L</kbd> goes back to lines |
| <kbd>Q</kbd> | Centre arc | Click the centre, then the start (the radius), then turn to the end and click |
| <kbd>O</kbd> | Slot | Click both centres, then the width |
| <kbd>P</kbd> | Spline | Click points the curve runs smoothly through; it is kept as tangent arcs |
| <kbd>T</kbd> | Trim | Click a piece to cut it back to where it crosses others |
| <kbd>E</kbd> | Extend | Click near an open end to run it on to the next piece it meets |
| <kbd>K</kbd> | Split | Click a line, arc or circle to split it in two there |
| <kbd>S</kbd> | Select | Click points and edges (<kbd>Shift</kbd> adds), then constrain them in the panel |
| <kbd>D</kbd> | Dimension | Click an edge, an arc or two points, type the value, <kbd>Enter</kbd>. Double-click a dimension to edit it |

<kbd>X</kbd> toggles construction geometry, which guides the sketch but doesn't become part of the profile.
A tool's key still works while a number box has focus; it leaves the box.

A shape drawn inside another becomes a hole in it, so a rectangle with a circle inside extrudes as a plate with a
bore. Shapes that overlap are refused.

## Constraints and dimensions

Pick points or edges with **Select**, then add a constraint from the panel: **Horizontal**, **Vertical**,
**Parallel**, **Perpendicular**, **Equal**, **Coincident**, **Tangent**, **Symmetric** or **Fix**. The
**Dimension** tool adds lengths, distances, radii and angles.

The status line counts what is still free, for example `2 DOF`, until the sketch reads **Fully defined**. A
constraint the others already imply is refused, and the message says why: for example, `Vertical edge 4 is already
implied by the other constraints — adding it would over-define the sketch`. One that contradicts them is refused as a
conflict. Typed lengths stay locked while the solver moves the rest.

Some constraints are inferred as you draw: an arc that meets a line smoothly is tangent to it, and a radius you lock
keeps it so.

## Using the sketch

After you finish a sketch, the profile feeds a feature:

- <kbd>E</kbd> **Extrude** pulls the profile into a solid. When the part already has a body, **Operation** chooses
  **Join to body**, **New body** or **Cut from body**, and a cut's **Depth** is a **Distance** or **Through all**.
- **Revolve**, **Sweep** and **Loft** are in the command palette (<kbd>Space</kbd>). Revolve turns a profile about an
  axis, sweep runs it along a path, and loft blends from one profile to another.

A sketch you finished can be reopened from the feature editor, with its constraints. Changes are written back in
place, and the features made from it update.
