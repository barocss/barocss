# Part features

Every command adds a feature to the part's history. Each feature is kept as data — its kind, its values and what it
is built on — so the part can be edited and rebuilt. Start a command from its key, from the shapes in the top bar,
from the **Tools** rail or from the command palette (<kbd>Space</kbd>).

## Shapes

**Box**, **Cylinder**, **Sphere**, **Cone**, **Torus**, **Tube**, **Wedge** and **Polygon prism** make a body from
their sizes. The HUD shows the fields, and the viewport shows handles you can drag.

## From a sketch

| Command | What it makes |
|---|---|
| **Extrude** (<kbd>E</kbd>) | Pulls a flat face or a finished sketch along its normal: join, a new body, or a cut to a distance or through all |
| **Revolve** | Turns a finished sketch about an axis: a sketch axis or a straight edge you click |
| **Sweep** | Carries a finished sketch along a curve, square to it as it goes |
| **Pipe** | Carries a finished sketch along a run, a bend and a run |
| **Loft** | A solid through two or more sketches on parallel planes (<kbd>Shift</kbd>-click to pick them) |

## Holes

**Hole** (<kbd>H</kbd>) cuts a round hole into a flat face: through, to a depth, counterbored, countersunk or tapped.
Place it by its centre, or by dimensions from an outline's corner, an edge or another hole. **Copies** makes them
**In a row** or **On a circle**, with a **Count**.

A tapped hole and a **Fastener** (a bolt, cap screw, nut or washer fitted to a hole's rim) take their sizes from the
fastener sizes you have loaded; without them they are refused with `[FASTENER_SIZE_ROW]`. See
[Shop rows](/studio/rows).

## Modify

| Command | What it does |
|---|---|
| **Fillet** (<kbd>Shift</kbd> <kbd>F</kbd>), **Chamfer** (<kbd>C</kbd>) | Round or bevel the picked edges; a picked face takes all its edges |
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

## Machine elements

**Spur gear** (and helical), **Meshing gear**, **Gear rack**, **Cam**, **Shaft**, **Key**, **Keyway**,
**Dowel pin**, **Retaining ring**, **Bearing**, **Coupling**, **O-ring gland** and **Connector opening**.

**Pulley**, **Sprocket** and **Belt or chain** work from your own belt and chain rows; none are built in.
**Fit class** and **Fit pair** (under Inspect) declare tolerance classes and fits, with clearances from your tables.

## Sheet metal, frames and smooth shapes

- **Sheet plate**, **Sheet profile**, **Flange** and **Corner relief** build sheet-metal parts that carry the sheet's
  thickness, bend radius and K-factor.
- **Frame**, **Structural member**, **Gusset** and **End cap** build welded frames. See
  [Frames and weldments](/studio/frames).
- **SubD box**, **SubD tube** and **SubD torus** make smooth bodies from a subdivision cage, with exact B-spline faces.

## Inspect

**Measure** (<kbd>Shift</kbd> <kbd>M</kbd>) gives distances, angles and sizes between picked faces and edges.
**Interference** shows where bodies overlap, and by how much.

## Editing and the history

- Click a feature in the history to open it in the feature editor, change its values or what it is built on, and
  apply. The features after it rebuild.
- A sketch a feature is made from can be changed in the feature editor too.
- <kbd>⌘</kbd> <kbd>Z</kbd> and <kbd>⇧</kbd> <kbd>⌘</kbd> <kbd>Z</kbd> step back and forward.
- When a change can't be built, the HUD says why before you apply it.
