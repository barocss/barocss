# Part features

Every command adds a feature to the part's history. Each feature is kept as data — its kind, its values and what it
is built on — so the part can be edited and rebuilt. Start a command from its key, from the shapes in the top bar,
from the **Tools** rail or from the command palette (<kbd>Space</kbd>).

## Shapes

**Box**, **Cylinder**, **Sphere**, **Cone**, **Torus**, **Tube**, **Wedge** and **Polygon prism** make a body from
their sizes. The HUD shows the fields, and the viewport shows handles you can drag.

## Text

**Text** creates an independent solid from an original static `.ttf` file. Enter **Text**, load **Font file**, then
set **Em size**, positive **Height**, **Curve tolerance** and **Tracking**. Preview the result and choose **Apply**.
Em size is the font em height, not its visible letter height. One history feature/output can contain separate
physical bodies, such as letters, dots and Korean components.

Edit the Text feature in history to change the original string or dimensions. Bound dimensions stay bound;
change their numbers in **Parameters**. Undo/Redo and `.bcad` Save/Open keep the recipe and original font bytes,
so reopened text remains editable. Font-bearing templates are currently refused; use a `.bcad` file.

The selected Latin and precomposed Korean examples use outline data, not browser-rendered glyphs. Shaping,
kerning, bidi, Unicode normalization, text embossing and text wrapping are not implemented. Missing glyphs and
unsupported font/profile cases are refused. See [Text from font outlines](/how/text) for the admitted range.

## From a sketch

| Command | What it makes |
|---|---|
| **Extrude** (<kbd>E</kbd>) | Pulls a flat face or a finished sketch along its normal: join, a new body, or a cut to a distance or through all |
| **Revolve** | Turns a finished sketch about an axis: a sketch axis or a straight edge you click |
| **Sweep** | Carries a finished sketch along a curve, square to it as it goes |
| **Pipe** | Carries a finished sketch along a run, a bend and a run |
| **Loft** | A solid through two or more sketches on parallel planes (<kbd>Shift</kbd>-click to pick them) |

In **Loft**, **Guide (copied)** selects one polynomial direct curve. A general B-spline guide (degree 1–5) takes
2–8 ruled sections on parallel planes and must pass through a vertex of each section. The guide is copied; later
curve edits do not update the loft. A single quadratic or cubic Bézier span keeps the two-frame path.
See [Lofts and guides](/how/loft-sweep#one-polynomial-guide-on-height-sections) for the input rules and limits.

## Route bundles

**Route bundle** ties one interior control point on each of two direct curves. Both selected points move by the
same world XYZ displacement; the other control points and curve endpoints stay fixed. It does not translate the
whole curves or solve general mates or free-form curve constraints.

![Two selected curve control points move by the same displacement while endpoints stay fixed](/diagrams/route-bundle-poles.svg)

The diagram uses two unit-weight cubic curves in the world XY plane. Both selected points move by `[8, 5, 0]` mm.
[Open the coordinate diagram at full size](/diagrams/route-bundle-poles.svg).

Prepare two distinct open, clamped cubic curves in millimetres. Each needs its own matching copied **Sweep** and
an independent, positive circular sketch in the default XY plane, without holes or extra regions. Placed or
associative profiles and placed or trimmed curve objects are outside this tool's scope.

1. Select the two direct curves and choose **Route bundle**. If a bundle already exists, open the same tool and
   choose it under **Active bundle**. The tool requires an up-to-date document and no other active edit.
2. For a new bundle, enter **Bundle name**. For each member, choose **Curve**, **Control point**
   and **Copied sweep**. The control point must be interior; use different curves, sweeps and profiles for the two
   members. Enter finite world XYZ coordinates in **Tie anchor**, in mm, then choose **Create**. This prepares a
   draft preview. Wait for **Preview ready. Apply to keep this edit.**, then choose **Apply** to create the bundle.
3. For the accepted bundle, enter **Total translation** in mm and choose **Preview**. Values are measured from the start of this edit, not
   added to the previous preview. The app prepares a preview and then evaluates the complete candidate document.
   Wait for **Preview ready. Apply to keep this edit.**, then choose **Apply** to keep the candidate.
4. Choose **Cancel**, press **Escape**, or close the panel to discard the uncommitted edit. An error clears the
   candidate display and keeps the accepted document. If the document, bindings or draft changes, preview the
   current draft again; an old evaluation reply cannot make it ready to apply.

**Detach** prepares removal of the link while keeping the current curves and copied sweeps. It also needs a
successful check and **Apply**. Reopening a bundle starts a new edit from its accepted state.

The source curve primitives come from the document's direct CAD geometry. They are not complete Studio model
documents. The route helpers create private Studio document candidates; the app owns full-document evaluation
and commit. A valid binding alone does not establish that every resulting sweep can be evaluated.

For the public helpers, see [Route bundles in code](/packages/cad-model/#route-bundles-in-code).

## Holes

![Hole with Copies set to On a circle: four holes previewed round the plate's centre](/shots/studio/features/holes-on-a-circle.jpg)

**Hole** (<kbd>H</kbd>) cuts a round hole into a flat face: through, to a depth, counterbored, countersunk or tapped.
Place it by its centre, or by dimensions from an outline's corner, an edge or another hole. **Copies** makes them
**In a row** or **On a circle**, with a **Count**. On a circle, the first hole must sit away from the circle's centre,
since the copies turn round it.

A tapped hole and a **Fastener** (a bolt, cap screw, nut or washer fitted to a hole's rim) take their sizes from the
fastener sizes you have loaded; without them they are refused with `[FASTENER_SIZE_ROW]`. See
[Shop rows](/studio/rows).

## Modify

| Command | What it does |
|---|---|
| **Fillet** (<kbd>Shift</kbd> <kbd>F</kbd>), **Chamfer** (<kbd>C</kbd>) | Round or bevel the picked edges; a picked face takes all its edges |
| **Face fillet** | Round between two picked faces. Meeting polynomial Bezier sides of a guided loft can use the rolling ball; unsupported free-form pairs are refused. See [Face fillets](/how/fillets) |
| **Shell** | Hollows a body, leaving the picked faces open |
| **Draft** | Tapers the picked side faces for a pull along Z |
| **Offset face** | Moves a flat face along its normal, adding or taking off material |
| **Split** | Cuts a body in two along a plane |
| **Move** (<kbd>G</kbd>), **Rotate** (<kbd>R</kbd>), **Scale**, **Align** (<kbd>A</kbd>) | Place a body: by the gizmo, by typed values, or by putting one face on another |
| **Hollow for printing**, **Fill with a lattice**, **Split to fit the bed** | Prepare a part for 3D printing |
| **Simplify mesh** | Fewer triangles on a mesh body, such as an STL or a scan |

## Patterns and Booleans

- **Linear pattern** (<kbd>P</kbd>), **Circular pattern** and **Mirror** (<kbd>M</kbd>) copy a body in a row, round
  an axis or across a plane. **Duplicate** (<kbd>⌘</kbd> <kbd>D</kbd>) makes one copy.
- **Union** (<kbd>U</kbd>), **Subtract** (<kbd>D</kbd>) and **Intersect** (<kbd>I</kbd>) combine two picked bodies.
  Results can be combined again, and a hole can go into a combined body.

Two bodies that touch only along an edge or at a point stay two bodies after a union; the manufacturing checks warn
that they only touch, and exports keep them as separate pieces.

See [Boolean operations](/packages/cad/robustness#boolean-operations) for the set rules, a tested example, and how the
kernel chooses and runs its prismatic, polyhedral, curved-surface or mixed mesh algorithm.

## Machine elements

**Spur gear** (and helical), **Meshing gear**, **Gear rack**, **Cam**, **Shaft**, **Key**, **Keyway**,
**Dowel pin**, **Retaining ring**, **Bearing**, **Coupling**, **O-ring gland** and **Connector opening**.

**Pulley**, **Sprocket** and **Belt or chain** work from your own belt and chain rows; none are built in.

**Mount** fixes a motor, a servo or a bearing unit to a flat face facing ±X, ±Y or ±Z, as one of your `mounts` rows
says (see [Shop rows](/studio/rows)):

- **Where.** Pick the row, then place its output axis with the two **Axis at** values, and **Turn** it a quarter at a
  time. **Pilot** is **Through**, or a recess of its depth.
- **What it cuts.** Ordinary features: the bolt holes, the pilot and the shaft's clearance hole, or a servo's body cut
  through the face. The row the mount came from stays loaded while it is used.
- **What is refused, never clipped.**
  - A mount that goes off the face, a recess as deep as the plate, or a bearing that isn't loaded or has another bore
    is refused with `[MOUNT_RANGE]`.
  - A face that isn't flat and square to an axis is refused with `[MOUNT_FACE]`.
  - A row that isn't loaded is refused with `[MOUNT_ROW]`.
- **The axis.**
  - The result reports the output axis, for a mate or a tool frame.
  - A concentric mate on the pilot puts a revolute joint on the motor's axis.
  - No frame is made automatically.
- **Loading the rows.** The Library can't load mount rows yet. Attach the file in the chat and ask the agent to load it,
  then run **Mount** from the command palette.
**Fit class** and **Fit pair** (under Inspect) declare tolerance classes and fits, with clearances from your tables.

## Sheet metal, frames and smooth shapes

### Sheet metal

- **Sheet plate** and **Sheet profile** start a sheet-metal part. **Flange** adds a bend along a straight edge, and
  **Corner relief** cuts a corner free.
- **The sheet's rules.** Each part carries its thickness, its bends' inner radius and its K-factor.
  - The prefilled rules (1.5 mm, R = T, K 0.5) are estimates, not material data, and their labels say so.
  - A bend table you load (the `bend` rows; see [Shop rows](/studio/rows)) gives each bend's K instead.
- **The flat pattern.** A sheet body's properties show its **Flat pattern** size. **Show the flat pattern** draws it
  to scale: the outline, and each bend's centre line dashed, up and down in two colours, with its note. **Export flat
  DXF** writes it as DXF 2000 or R12.

### Frames

**Frame**, **Structural member**, **Gusset** and **End cap** build welded frames. See
[Frames and weldments](/studio/frames).

### SubD and the cage editor

**SubD box**, **SubD tube** and **SubD torus** make smooth bodies from a subdivision cage, with exact B-spline faces.

![A SubD box: one smooth body from a box cage](/shots/studio/features/subd-box.jpg)

**Edit cage**, from the command palette, opens the **Cage editor** on a SubD feature:

- **Pick** vertices, edges or faces with <kbd>1</kbd>, <kbd>2</kbd> and <kbd>3</kbd>. Double-click an edge for its
  loop, and Alt-double-click for its ring.
- **Move** what is picked with the gizmo. Holding <kbd>Shift</kbd> as a drag starts extrudes instead.
- **Show** the cage as **Box** or **Smooth** (<kbd>Tab</kbd>).
- **Operations** on the picked items:

  | Operation | Key | What it does |
  |---|---|---|
  | **Extrude** | <kbd>E</kbd> | The picked faces, or boundary edges, out as a new region |
  | **Insert loop** | <kbd>L</kbd> | An edge loop across the ring through the picked edge |
  | **Bridge** | <kbd>B</kbd> | Quads between two boundary loops of as many edges |
  | **Fill** | <kbd>F</kbd> | One face over a hole |
  | **Weld** | <kbd>W</kbd> | The picked vertices merged at their middle; **Weld near** merges those within 0.01 mm |
  | **Crease** | <kbd>C</kbd> | The picked edges made sharp; **Smooth edges** takes creases off |
  | **Delete** | <kbd>⌫</kbd> | The picked faces removed, leaving a hole |

- **Mirror** the cage **Across X**, **Y** or **Z**, or **None**.
- **Checks.** The panel says what the cage's checks flag.
- **Undo, Done and Cancel.** <kbd>⌘</kbd> <kbd>Z</kbd> steps back within the session. **Done** (<kbd>Enter</kbd>)
  writes the cage as one step of the part's history; **Cancel** (<kbd>Esc</kbd>) leaves it as it was.

Moving vertices is a value edit of the feature; changing its faces or creases changes its structure. This matters
for what the agent may change directly (see [Proposals and autonomy](/agent/proposals)).

### From a picture

Attach an image in the chat, such as a logo, a character or an icon, and ask the agent to build it:

- **Tracing.** The studio traces the image into outlines: the background is found, and the foreground is split into a
  few flat colours, each with its holes.
- **Building.** The agent extrudes or inflates a traced layer, at the width you ask for.
- **A draft.** Features made from a picture are a draft. Their dimensions stay unconfirmed until you confirm them,
  and an export says the part is a draft. See [Designing with the agent](/agent/).

## Inspect

**Measure** (<kbd>Shift</kbd> <kbd>M</kbd>) gives distances, angles and sizes between picked faces and edges.
**Interference** shows where bodies overlap, and by how much.

## Editing and the history

- Click a feature in the history to open it in the feature editor, change its values or what it is built on, and
  apply. The features after it rebuild.
- A sketch a feature is made from can be changed in the feature editor too.
- <kbd>⌘</kbd> <kbd>Z</kbd> and <kbd>⇧</kbd> <kbd>⌘</kbd> <kbd>Z</kbd> step back and forward.
- When a change can't be built, the HUD says why before you apply it.
