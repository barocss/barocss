<script setup>
import ModelMates from '../.vitepress/components/algorithms/ModelMates.vue';
import ModelArm from '../.vitepress/components/algorithms/ModelArm.vue';
import ModelLayout from '../.vitepress/components/algorithms/ModelLayout.vue';
</script>

# Assemblies, robots and drawings

Three things the document model does on top of the kernel's solids: it places parts by their mates, reads a mated
assembly as a robot and moves it, and lays out a drawing with its dimensions. The code is in
`packages/barocss-cad-model/src`: `assembly/`, `robot/` and `drawing/`. How to use them is on
[Assemblies and mates](/studio/assemblies), [Robots](/studio/robots), [Drawings](/studio/drawings) and
[@barocss/cad-model](/packages/cad-model/); this page explains how they compute.

The figures run small cases from the package's tests and samples: a pin on the starter plate, the `arm-2r` and
`four-bar` sample robots, and the bolt-circle plate of the conformance case `r14/layout-bolt-circle`. Where a figure
shows a number, it is the package's own, recorded by running it, or computed in the page with a copy of its code that
gives the same results.

## The three at a glance

| Part | What it computes | Method | Source |
|---|---|---|---|
| Mates | Each part's placement from its mates; what it can still do | Closed form: rotation from directions, then position from linear rows; nothing iterated | `assembly/mates.ts` |
| Joint tree | Links and joints from the mates | Free twists: the null space of the mates' constraint rows | `robot/joints.ts` |
| Forward kinematics | Every link's pose for given joint values | Product of exponentials (screws at the solved pose) | `robot/fk.ts` |
| Inverse kinematics | Joint values that bring a link to a target | Damped least squares, Levenberg–Marquardt damping, restarts | `robot/ik.ts` |
| Closed loops | The passive joints of a loop for a driver's value | Gauss–Newton from the previous pose, branch kept | `robot/loop.ts` |
| Link inertia | Mass, centre and inertia of each link, in its frame | Bodies combined by the parallel-axis theorem, rotated into the link frame | `robot/inertia.ts` |
| Views and sections | The standard views and cut views of a part | The kernel's hidden-line projection; a split at the section plane | `drawing/project.ts`, `drawing/section.ts` |
| Auto-dimension | Dimensions from the projected geometry | Rules on edge ends, levels, hole rows and rings | `drawing/auto.ts` |
| Auto layout | Views, scale, sheet and room for the dimensions | A search over scales and sheets, rounds of layout and Auto-dimension | `drawing/layout.ts`, `drawing/views.ts` |

## 1. Mates become a placement

A mate names a face that stays (on the base part or a part already placed) and a face on the part it moves. Each face's
geometry is read exactly from the B-rep, in its part's own coordinates: a plane (a point and its normal), a cylinder (a
point on its axis, the axis and the radius), a sphere, a cone, a straight or a circular edge. An edge or a cone is
solved as a round face of radius 0 on its line.

`solveAssembly` places the parts one at a time, each after the parts its mates name. The base part, fixed parts and
parts no mate moves keep where they are. If what is left can only be placed in a ring (A placed by B, B by A), each of
those mates is refused with "It closes a loop". A part whose first mate's part moved since the last solve while it did
not is first carried along with that part, so it keeps its place relative to it where its mates leave it free.

For one part, `solveOne` writes the placement as a rotation R and a move t (a point x of the part goes to R x + t) and
finds them in two stages. Both are closed forms, so solving a solved assembly again changes nothing.

1. **Rotation.** Each mate asks R to take one direction of the moving face (a normal, an axis) onto a direction of the
   fixed one. One direction is met by the smallest turn from where the part stands; a second, independent one fixes R
   as the frame the two span on the part turned onto the frame they span on the other side. A direction that disagrees
   with the ones before it (by more than 10⁻⁹) is refused, with the angle it is off by. An angle mate comes after: it
   turns the part about the one axis left free by the smallest turn that sets the angle (A cos φ + B sin φ = C for the
   turn φ), or is only checked when R is already fixed.
2. **Position.** With R known, each mate gives linear conditions g · t = h on the move. Each row is made orthogonal to
   the rows kept before it (Gram–Schmidt) and the move is the smallest one from where the part stands: it changes only
   what the mates hold. A row with no length left after that is a repeat; if what remains of its h is more than
   10⁻⁶ mm it contradicts the earlier mates and is refused, with the distance. A mate refused here gives up its
   direction too, and the part is solved again without it.

| Mate | Asks of the rotation | Rows on the move |
|---|---|---|
| Coincident | The moving normal onto the opposite of the fixed one (flip: the same way) | 1: flush along the fixed normal |
| Distance | The same | 1: `distance` mm along the fixed normal |
| Angle | The normals at the angle (0: facing each other) | none |
| Concentric | The axis along the fixed axis; either way round unless set | 2: the moving axis point on the fixed axis |
| Tangent, round on flat | The axis square to the face's normal | 1: the axis one radius in front of the face (flip: behind) |
| Tangent, two round faces | The axes parallel | Not linear: after the linear rows, the nearest point on the circle r<sub>a</sub> + r<sub>b</sub> (inside a hole \|r<sub>a</sub> − r<sub>b</sub>\|) round the fixed axis; two at once, where their two circles cross, the crossing nearer no move |
| Fastened | Connector Z and X onto the other's | 3: the origins together |
| Ball | none | 3: the centres together |
| Lock | The placement it stored, relative to the other part; the part's other mates are only checked against it | |

What the solve reports for each mated part is its freedom: free turns (0 once two directions fix R, 1 about the one
direction set, 2 when an angle alone holds it, 3 with none) and free slides, 3 less the rows kept and the directions a
round tangent takes. The studio's gizmo offers moves only while a slide is free and turns only while a turn is free, and
the assembly is solved again after every change from where the parts now stand: a turn about the free axis stays, a
move along a held direction is put back.

<ModelMates />

The sketch solver counts freedom by the rank of a Jacobian ([Solving sketch constraints](/how/sketch-solver)); the mate
solver needs no Jacobian, because each mate it takes is a direction, a linear row or, for two round faces, a circle.

## 2. Robots

### The joint tree

`jointTree` reads the mate graph from a chosen base link. Each pair of parts with mates between them is one joint, and
what the joint lets the child do is read from the mates' first-order constraints at the solved pose, not from their
names. Each mate gives rows on the child's twist relative to its parent, X = (ω, v / L): ω the turn, v the velocity at
the world origin, L a length scale (the farthest part placement from the origin, at least 1 mm) so the two halves are
of one size. A flat mate gives three
rows (the two directions across its normal can no longer turn, and the point cannot move along the normal), a
concentric one four. The free twists are the rows' null space, and they are classified:

| Free twists | Joint |
|---|---|
| none | fixed |
| one turn | revolute (continuous when no limits are set) |
| one slide | prismatic |
| a turn and the slide along its axis | cylindrical, as a slide and a turn through a dummy link |
| two slides and a turn | planar, as three 1-DoF joints |
| three turns about one point | ball, as three turns |
| a screw motion, other combinations | refused, MOTION_UNSUPPORTED |

The tree is grown from the base the way Prim's algorithm grows a spanning tree: each step takes the pair that leaves
the least freedom, so a loose mate closes a loop rather than replacing a joint. A pair reached a second time is a loop,
kept with its mates and never dropped. Two meshing spur gears on revolute joints of one carrier are coupled: the second
follows the first at −z₁/z₂, from the kernel's gear-pair check.

### Forward kinematics

Each joint is kept as a screw at the solved pose, where every joint value is 0: its axis and a point on it. A turn by q
radians about the axis through p is x ↦ R(q)(x − p) + p; a slide moves q mm along it. A link's motion is the product of
the screws on its path from the base, base first (the product of exponentials in the space frame, as in Lynch and Park):

D<sub>link</sub>(q) = exp([S<sub>1</sub>] q<sub>1</sub>) · exp([S<sub>2</sub>] q<sub>2</sub>) · …, &nbsp; pose = D<sub>link</sub> · M<sub>link</sub>,

M the link where the mates put it. A follower (a coupled gear, a cam's follower) takes its value from its leader first.
Values outside a joint's limits are reported and kept as given, not clamped.

### Inverse kinematics

`solveIk` finds joint values that bring a link's tool point (and, in `pose` mode, its orientation) to a target. The
error is a 6-vector: the tool point's offset in metres and the turn still to make as an axis-angle in radians (3 rows in
`position` mode). The Jacobian J comes from the screws at the current pose. A step is

Δq = Jᵀ (J Jᵀ + λ² I)⁻¹ e,

solved by Cholesky. It is kept if it lowers the error, and λ halves; otherwise it is undone and λ grows four times.
λ starts at 10⁻², joint values are clamped to their limits, and a descent runs up to 200 iterations, until both errors
are below 10⁻¹². Up to 15 starts are tried (the given values, then a deterministic sequence of seeds) until one gets
within 10⁻⁷; the best is kept. A result is `reached` only when it is within 10⁻⁴ m and 10⁻³ rad, and `singular` when
σ<sub>min</sub>/σ<sub>max</sub> of J is below 10⁻⁴ there (the value is chosen so that a solve ending on a singularity
is flagged, O43 in `decisions-outer.md`).

### Closed loops

A loop's pin, a point both of its parts share at the solved pose, must stay shared as a driver moves. For a planar loop
(three moving joints round it besides the pin, all turns about parallel axes) `closeLoop` solves the two passive
joints by Gauss–Newton on the pin's residual, its place on one part minus its place on the other, starting from the
previous solution. A step is at most a quarter turn, because past a dead point a full Newton step can land anywhere.
It stops at a residual of 10⁻¹² mm and refuses a driver value where the pin stays more than 10⁻⁹ mm apart
(NO_CLOSURE). The branch is the sign of the turn between the two levers that meet at the pin; a closure on the other
branch is refused (BRANCH_FLIP), never taken.

Any other loop (slides, several loops at once) goes through `closeLoops`: the mates the tree left out become residual
rows (a concentric pair as two points of one axis on the other's line, flat faces as a point at the plane's offset and
the normals kept), solved by damped Gauss–Newton on their analytic Jacobian. The drivers are moved there in steps of at
most 5° or 5 mm, halved near trouble. The loop's freedom is the number of free joints less the rank of the Jacobian;
more drivers than that are refused (LOOP_PASSIVE), and a step where the passive joints lose rank is refused as a dead
point (DEAD_POINT).

<ModelArm />

### Inertia of each link

Robot formats want each link's mass, centre of mass and inertia in the link's own frame. `linkInertia` takes each body
of the link's part with the volume, centroid and inertia the kernel computes
([Volume, centroid and inertia](/how/mass-properties)), scaled to the body's material density (a body with no material
set is counted with the default one and said so, MATERIAL_ASSUMED). The bodies are combined at their common centre
by the parallel-axis theorem, I + m (|d|² E − d dᵀ), and the result is turned into the link frame,
I<sub>L</sub> = Rᵀ I R and the centre Rᵀ (c − o), in kg, m and kg·m². The link frame is at the joint's point with Z
along its axis and X the part's X made square to it (its Y when Z is near X); the base link and a link on a fixed joint
keep their part's frame. The result is checked: positive definite (NOT_SPD) and the principal moments meeting the
triangle inequality, I₃ ≤ I₁ + I₂ (TRIANGLE).

## 3. Drawings

### Views and sections

`projectViews` gives the four standard views, each by the kernel's hidden-line projection
([Hidden lines for drawings](/how/hidden-lines)): the front from −Y by default, the top looking down Z, the right the
front turned a quarter to its right, the isometric from the front-right-top corner. Third angle puts the top view
above the front and the right view to its right, first angle the mirror of it; the views in one column share their
horizontal mapping and those in one row their vertical one, so they stay in projection. Before Auto layout, the studio
and the agent's tool may turn the drawing so the side now seen as the right view becomes the front, when it tells
clearly more: visible edges, plus three for each circle seen round, less half the hidden lines, more than a fifth and
two more than the front's (`frontByInformation`); a drawing with a side set or anything placed by hand stays as it is.

A section cuts the part by the plane square to its view's depth. `sectionOf` adds the kernel's split at that plane to
each body the plane crosses and keeps the far side; a body wholly behind the plane stays whole and one wholly in front
goes. The rest is projected like a view, and its planar faces lying on the plane are the cut faces, returned as rings to
hatch: each body at its own angle (45°, 135°, 30°, 120°, 60°, 150°, then wider) every 2.5 mm. A half section joins the
section on one side of its centre line to the uncut view on the other; an offset section joins the bands of several
parallel planes, with no line drawn at a step. Sections are placed in projection with their view: a front's or a
right's in a row under the views, a top's beside the top view.

### Auto-dimension

`autoDimensions` places ordinary drawing dimensions, each on persistent edge references, so they follow the model:

- **Overall sizes**: width and height in the front view, depth in the top view, between edge ends at the view's
  extremes.
- **Levels**: the distinct positions of the visible straight edges inside a view (steps, notches), from its left or
  bottom extreme: both ways in the top view, heights in the front view.
- **Holes**: each in the first view it shows round in (top, front, right), located from that view's extremes. Three or
  more on one line at one pitch: the first located, then one pitch for all (`9× 20`). Three or more of a kind evenly
  round a point and not a grid: their pitch circle (`Ø40 PCD · 6× EQ SP`) and its centre, not each hole.
- **Callouts**: one diameter a kind of hole, its text from the feature (THRU, a depth, a thread, a counterbore or
  countersink) with the number of such holes (`6× Ø6 THRU`).

The rows go out from each view on its side with more free room, the first 10 mm from the view and the next every 8 mm,
the shorter ones inside; as many as fit, the shortest spilling to the other side. Callout leaders take the other side,
the first 6 mm out and then one every 8 mm. For every side Auto-dimension also reports the room its rows take (the last row's text
needs 4 mm more), which is what the layout gives room for. A dimension placed by hand is kept, and an automatic one
that measures the same span is not added.

### Auto layout

`autoLayout` searches for a sheet on which every dimension has room and nothing overlaps:

1. The views: front and top always, the isometric as set; the right view dropped when it adds nothing (no circle seen
   round in it, no curve, every visible straight edge's position already in the top or front view) and nothing placed
   by hand is in it.
2. The scales: the standard ones, 10:1 down to 1:100, from the largest at which the views alone fit the drawing area
   (the frame less 14 mm, above the title block), keeping those at which the smallest hole is at least 2.5 mm across on
   paper. That value is an estimate, not a standard (O4): below it, centre lines, leader and callout crowd a hole. On an
   A4 sheet A3 is tried next.
3. For each scale, rounds of layout and Auto-dimension, at most four: Auto-dimension says what each side needs; if a
   side is crowded, each side is given the room its rows took and the layout runs again. Once no side is crowded, the
   issue list's moves run on what still overlaps (a short dimension's text, a callout over lines). Then an automatic
   dimension whose text still overlaps is tried at other places: along its own normal in 2 mm steps either way (round
   its circle in 16 directions for a radius or diameter), keeping the first where it clears every other text, view
   and the title block and the issue list gets nothing new.
4. The first round with no error is taken. If no readable scale gives one, the largest clean scale below them is taken
   and the report says it is not readable; if none is clean, the attempt with the fewest errors.

<ModelLayout />

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad-model/src/assembly/mates.ts` | `solveAssembly`, `solveOne`: mate kinds, the rotation and position stages, refusals, `freedom` |
| `packages/barocss-cad-model/src/assembly/faces.ts`, `shapes.ts` | Face tables: exact plane, cylinder, sphere, cone and edge geometry from the B-rep |
| `packages/barocss-cad-model/src/assembly/drag.ts` | The gizmo's moves and turns, `gizmoAxes` from the freedom |
| `packages/barocss-cad-model/src/assembly/edit.ts` | `solveDoc` and the assembly's edits, each solved again |
| `packages/barocss-cad-model/src/robot/joints.ts` | `jointTree`: constraint rows, free twists, `motionOf`, loops, gear couplings |
| `packages/barocss-cad-model/src/robot/fk.ts` | `forwardKinematics`: screws, the product of exponentials, followers |
| `packages/barocss-cad-model/src/robot/ik.ts` | `solveIk`: damped least squares, seeds, `reached` and `singular` |
| `packages/barocss-cad-model/src/robot/loop.ts` | `closeLoop` (planar pin), `closeLoops` (general), branches and dead points |
| `packages/barocss-cad-model/src/robot/inertia.ts` | `linkInertia`, `linkFrames`, `treeInertia` |
| `packages/barocss-cad-model/src/drawing/project.ts`, `views.ts` | `projectViews`, `viewsFor`, `layoutSheet`: views, cells, scales, room |
| `packages/barocss-cad-model/src/drawing/section.ts` | `sectionOf`, `halfSection`, `offsetSection`: cut, project, cut-face rings |
| `packages/barocss-cad-model/src/drawing/auto.ts` | `autoDimensions`, `holesOf`: the rules and the rows |
| `packages/barocss-cad-model/src/drawing/layout.ts` | `autoLayout`, `chooseViews`, `frontByInformation`, `placeDimensionLabels` |

## How it is checked

- **Mates**: `test/mates.test.ts` reads faces exactly from the kernel, seats a pin (coincident + concentric, and
  flipped), checks that a solved assembly solved again does not move, refuses conflicts with their messages, solves a
  chain and refuses a loop, and pins each case's freedom (`{ turns: 1, slides: 2 }` flush on a face, `{ turns: 1,
  slides: 0 }` flush and on an axis, …). The connector joints have `test/o24d-*.test.ts`.
- **Joint tree and FK**: `test/robot-joints.test.ts` runs every assembly of `packages/barocss-cad/conformance/rm/`
  against its frozen tree, and checks the classes from free twists (a ball as three turns about one point; a screw
  refused). `test/robot-fk.test.ts` checks a planar 2R tip against its closed form to 10⁻⁹ over 200 random poses, and
  the product of exponentials against the moving-axis form on a random 3D tree.
- **IK**: `test/robot-ik.test.ts` solves 1000 reachable targets on the 6R arm (`conformance/rm/arm-6r`) from 0 and judges
  each by forward kinematics, not by the solver's own error: at least 990 within 10⁻⁴ m and 10⁻³ rad. The arm straight
  up and a stretched 2R are flagged singular; an unreachable target is never a success.
- **Loops**: `test/robot-loop.test.ts` builds the four-bar from mates, closes it through a full crank turn against
  Freudenstein's equation to 10⁻⁹ rad, refuses the other branch (BRANCH_FLIP) and a non-Grashof linkage at its dead
  points (NO_CLOSURE). `test/o24a-loops.test.ts` closes a slider-crank every 5° through 720° against its closed form, and
  checks that the general closer equals the pin closer on the four-bar to 10⁻⁹.
- **Inertia**: `test/robot-inertia.test.ts`: a rotated, off-origin cuboid to 10⁻¹², a cylinder, two bodies by the
  parallel-axis theorem, the typed checks and the link frames.
- **Views and sections**: `test/drawing.test.ts` (the standard views of the plate, third and first angle, section A–A
  with its hatch), `test/drawing-section-kinds.test.ts` (half and offset sections), `test/sections.test.ts`.
- **Auto-dimension and Auto layout**: `test/auto-dimension.test.ts` and `test/auto-layout.test.ts` run the conformance
  cases of `packages/barocss-cad/conformance/r14/` (views, dropped views, sheet, scale, readability, what is left and
  every dimension's text); `layout-bolt-circle` is the figure's case.

## Limits

- **Mates** are solved in closed form for rigid cases only. A universal or a cylindrical mate combined with other mates
  on the same part, and ball mates at different points of one part, are refused as needing a coupled solve the solver
  does not have. Mates that place parts in a ring are refused; a cam mate holds nothing in the solve (its follower's own
  mates place it, and the joint tree couples the motion).
- **The joint tree** refuses a pair whose free twists are not one joint chain (MOTION_UNSUPPORTED), never guessing.
- **IK** is a local method: it returns the solution its seeds reach, which may be the other elbow, and says `reached`
  only within the tolerances.
- **Loops**: the pin closer takes only planar loops of three turning joints; the general closer refuses mates it has
  no rows for (a tangent, LOOP_MATE_UNSUPPORTED) and loops through a cam (CAM_IN_LOOP).
- **Auto-dimension** does not place the angular position of a ring with no hole on a centre line through it; it lists
  it as skipped with the reason.
- **Auto layout** tries at most four rounds a scale; the 2.5 mm hole size is an estimate; the label search leaves a
  broken view's dimensions where they are.
