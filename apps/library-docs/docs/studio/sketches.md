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
| <kbd>I</kbd> | Ellipse | Click the centre, the end of the first axis, then a point that sets the other semi-axis; it is kept as tangent arcs and keeps its definition |
| <kbd>O</kbd> | Slot | Click both centres, then the width |
| <kbd>P</kbd> | Spline | Click points the curve runs smoothly through; it is kept as tangent arcs and keeps its fit points |
| <kbd>B</kbd> | Bézier | Click control points: three make a quadratic, a fourth a cubic; the curve does not pass through the middle points |
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

An ellipse is drawn with three clicks: the centre, the end of the first axis (which sets **Rx** and the angle), and any point whose
distance from that axis line sets **Ry**. A dashed circle and then the ellipse follow the pointer; <kbd>Escape</kbd> drops the
draft. The **ELLIPSE** section then lists **Centre X**, **Centre Y**, **Rx**, **Ry** (semi-axes in mm) and **Angle** (the Rx axis,
degrees anticlockwise from +X); type a value and press <kbd>Enter</kbd> (or leave the box) to apply it, and a value the model
cannot build shows the reason and changes nothing. The profile is a closed outline of 192 tangent arcs through 96 points of the
true ellipse, so it extrudes, cuts and keeps its side names whatever you edit; it stays within 1e-5 of the longer semi-axis of
the true ellipse (0.0005 mm at Rx 50), and its area is within 1e-5 of π·Rx·Ry. An ellipse narrower than 1 : 5 is refused (draw a
slot or a spline instead), as is one whose points or arc centres leave ±10000 mm or whose arcs are under 0.01 mm radius (a large,
narrow ellipse has far arc centres: 5000 × 1000 mm is refused, 5000 × 4000 mm is fine). Make curves turns it into the exact ellipse: one degree-2
rational curve (the circle's four quarter spans mapped by the ellipse's axes), not the outline's arcs. The outline's radius
labels, joints and arc pairs are not listed while it is an ellipse (the Constraints list shows one "Ellipse · 192 tangent arcs" row), and a dimension on it is refused (the solver takes 64
segments); moving one of its outline points, or rounding a corner, turns it into an ordinary outline of 192 arcs, which Make
curves refuses. The angle is stored between 0° and 360° (−90° becomes 270°), and an angle that is not a usable number is refused.
The definition is kept only when the ellipse is the sketch's main shape: as a hole or an extra region it becomes a plain 192-arc
outline when you finish the sketch, and Make curves then refuses it. Fillets and chamfers on an ellipse's side edges (the
edges of the faces made from a kept ellipse outline) are refused with a reason, because each of the 192 arcs is a face and the
rounding would take minutes: fillet a circle or a slot instead, or make the shape from the exact curve with Make curves. The edges
of other faces of the same body, and of an ellipse hole (a plain arc outline after Finish), are not refused. This covers extrudes, revolves and sweeps of the ellipse. A document made before this limit, with a fillet or chamfer on an ellipse's side edges, still opens and evaluates, slowly (minutes per such fillet).

A Bézier curve is drawn from its control points: the dashed control polygon joins them and the solid curve runs from the
first to the last, leaving along the first leg and arriving along the last. It does not pass through the middle points. The
third click makes a quadratic; a fourth makes it cubic and ends it. A click on the previous point is ignored, and poles that
make no curve (all on one point, or both ends on one point with every pole on a line) are refused with the reason. While it is
the current shape the **BÉZIER** section lists each **Control point** X and Y; type a value and press <kbd>Enter</kbd> (or
leave the box) to apply it. An edit that would leave no curve shows the reason and changes nothing.

What holds for a Bézier curve:

- It is kept with the sketch and comes back when an ordinary (non-linked) sketch is reopened. Once another shape is drawn, or
  after a reopen, it is shown but is no longer the editable current shape: its control points are not listed in the panel.
- It is never part of the profile, so it never needs to close; **Finish sketch** still needs a closed profile.
- It is not a trim, split or extend boundary, and is not offset or constrained.
- It is always a Bézier curve: the Construction mode does not make it a construction line.
- It is not written to a DXF export.
- **Make curves of the sketch** turns it into one polynomial curve, exact up to the 1e-9 mm decimal form of the curve source,
  which a Loft can copy as its **Guide** (a single quadratic or cubic span keeps the two-frame path). Degenerate curves, and
  coordinates beyond 1e6 mm, are refused with a message.

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

## Bands

A **band** is the closed outline that wraps two or more convex shapes, such as a belt round pulleys. Draw the shapes
(rectangles, circles, slots and convex outlines), pick them with the **Band** tool, set the optional **Offset** (mm, the
band stands off the shapes by that much) and **Width** (mm, empty makes a filled band; a width makes a strip), and press
**Make band**. The picked shapes become construction shapes, the band's sources. The outline is exact: arcs of the
sources joined by common outer tangents.

The band is regenerated from its sources wherever the sketch is used. Move a source, change a source's radius or centre
(in the sketch or as a feature value of the Extrude), or bind a value to a parameter, and the body follows. Its walls keep their
names while the shape of the outline stays the same (a source that wins twice names its second piece by the source before it, for example `b1_e1-e2`, so the names do not swap when the sources move round). A band sketch holds only the band and its construction sources: draw other
shapes in their own sketch. A band that cannot be made is refused by name (for example **Sketch 1 band b1: sources e1 and
e2 overlap**: sources that overlap, touch, lie inside one another or are not convex) and the sketch's body is not kept as it
was. A band is not available to the agent, and not in a linked sketch.

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
place, and the features made from it update. A reopened sketch keeps its main profile: a circle stays the main profile
even when you edit or dimension a rectangle beside it, or the circle itself.

Reopening a sketch whose values are bound shows each at its parameter's current value. Finishing keeps each binding whose value
you left as it was. A rectangle's or circle's bound value stays bound when you change its other sizes (changing the height keeps a
bound width), and becomes a plain number only when you change that value itself. In an outline of points, a binding stays only
while the outline's other points are unchanged: move a corner, add or remove points or swap the main shape and the bindings in that
outline become plain numbers. Finish says which. A driving dimension edited from the feature editor
follows the same rule, without a notice. If the sketch uses a parameter the document no longer has, or one with no finite value,
it won't reopen and says which one.
