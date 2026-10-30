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
| <kbd>P</kbd> | Spline | Click points the curve runs smoothly through; it is kept as tangent arcs and keeps its fit points |
| <kbd>T</kbd> | Trim | Click a piece to cut it back to where it crosses others |
| <kbd>E</kbd> | Extend | Click near an open end to run it on to the next piece it meets |
| <kbd>K</kbd> | Split | Click a line, arc or circle to split it in two there |
| <kbd>S</kbd> | Select | Click points and edges (<kbd>Shift</kbd> adds), then constrain them in the panel |
| <kbd>D</kbd> | Dimension | Click an edge, an arc or two points, type the value, <kbd>Enter</kbd>. Double-click a dimension to edit it |

<kbd>X</kbd> toggles construction geometry, which guides the sketch but doesn't become part of the profile.
A tool's key still works while a number box has focus; it leaves the box.

A shape drawn inside another becomes a hole in it, so a rectangle with a circle inside extrudes as a plate with a
bore. Shapes that overlap are refused.

A spline keeps its fit points. After closing it (or reopening the sketch), the **SPLINE** section lists each fit point's
X and Y and its handle: the curve's direction there, in degrees. Type a value and press <kbd>Enter</kbd> (or leave the box)
to apply it; leave a handle empty for the automatic direction. A handle or point that leaves no arc pair the model can build
to the next point is refused. On a closed spline with **Select**, drag a handle end to turn its tangent (whole degrees,
<kbd>Shift</kbd> for 0.1°) or a fit point to move it (grid step, 1 mm by default; <kbd>Shift</kbd> for 0.01 mm). The drag
starts after the pointer moves 3 px, so a plain click still picks. Releasing applies it as one step (none if nothing changed),
<kbd>Escape</kbd> cancels, and a position with no buildable arc pair keeps the last valid one. The arc radius chips are hidden
on a closed spline so they do not cover its handles; lock a radius in the panel grid instead. A spline is driven only by its fit points and handles: a dimension or relation on it, or an
edit of its outline points, turns it into an ordinary outline.

A closed shape inside a hole is not supported in the same sketch. **Finish sketch** refuses it;
draw that shape in a separate sketch.

## Reusing a face and offsetting a shape

When the sketch is on a selected face with zero plane offset and angle, the **FACE** section offers two copy actions:

- **Use its outline** adds the face's outer boundary and holes as sketch shapes.
- **As references** adds those edges as construction shapes. You can snap to them, but they do not form the profile.

These actions and older outline sketches remain copies; they do not follow later face edits automatically.

For an empty face sketch at zero plane offset and angle, choose **Link face outline + inset**.
Use a finite positive **Offset distance** in mm; this creates one inward inset, regardless of **In**/**Out**.
Choose one named planar face of an earlier single exact solid in the same document, with one straight outer loop
and no holes. The linked source defines the profile; the sketch's default Join/Cut body target is stored separately.
Source edits regenerate the outline and inset. Missing or ambiguous sources/faces, curved boundaries and collapsed
insets are refused. Geometry or plane edits detach the link. Reopening or cancelling an edit keeps the stored link.
The link does not support placed parts, assemblies, automatic rematching of duplicated sources or frames following the sketch.

To draw a wall, close a shape and enter **Offset distance** in mm in the **OFFSET** section. Choose **Out** for an
outward copy or **In** for an inward copy. The direction button determines the side; the distance supplies its magnitude.
The current closed shape is used first; otherwise, the newest finished, non-construction closed shape is used.
The original stays, and the region between the nested outlines forms the profile.

With no closed shape, the studio reports **Nothing to offset**. An offset that collapses a shape or reverses an
outline edge is refused as **Cannot offset**; reduce the distance. A refusal leaves the sketch as it was.

## Constraints and dimensions

Pick points or edges with **Select**, then add a constraint from the panel: **Horizontal**, **Vertical**,
**Parallel**, **Perpendicular**, **Equal**, **Coincident**, **Tangent**, **Symmetric** or **Fix**. The
**Dimension** tool adds lengths, distances, radii and angles.

The status line counts what is still free, for example `2 DOF`, until the sketch reads **Fully defined**. A constraint
the others already imply is refused, and the message says why: for example, `Vertical edge 4 is already implied by the
other constraints — adding it would over-define the sketch`. A contradiction can be refused as a proven **Conflict**
when the sketch has only horizontal and vertical straight edges, their lengths, axis distances (dx/dy) and fixed
points (point 1 is fixed at its drawn position) — no arcs, circles or other rules anywhere in the sketch — the values
are more than a few 10⁻⁷ mm from consistent, and the exact search finishes within its budget. Typed lengths stay
locked while the solver moves the rest.

Otherwise a refusal that does not converge says so without claiming a conflict: failure to converge does not prove
one. A refused constraint edit keeps the previous outline. A successful solve keeps its accepted point coordinates
without decimal rounding.

Some constraints are inferred as you draw: an arc that meets a line smoothly is tangent to it, and a radius you lock
keeps it so.

## Using the sketch

After you finish a sketch, the profile feeds a feature:

- <kbd>E</kbd> **Extrude** pulls the profile into a solid. When the part already has a body, **Operation** chooses
  **Join to body**, **New body** or **Cut from body**, and a cut's **Depth** is a **Distance** or **Through all**.
- **Revolve**, **Sweep** and **Loft** are in the command palette (<kbd>Space</kbd>). Revolve turns a profile about an
  axis, sweep runs it along a path, and loft blends from one profile to another.

A profile may run along the Revolve axis on whole straight segments; zero-length edges remain invalid.
It must not cross the axis or touch it inside an arc; a full turn must not pinch to a point between two walls.

A sketch you finished can be reopened from the feature editor, with its constraints. Changes are written back in
place, and the features made from it update.
