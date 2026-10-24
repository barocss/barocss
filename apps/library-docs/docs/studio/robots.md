# Robots

An assembly whose mates leave motion free is a mechanism. The **Joints** card reads it as a robot: links, joints and
their limits. You can move it, check it and export it for simulators.

## The joint tree

Each pair of parts with mates between them is one joint. The kind of joint is read from the motion the mates leave
free, not from the mates' names:

| Free motion | Joint |
|---|---|
| none | fixed |
| one turn | revolute, or continuous without limits |
| one slide | prismatic |
| a turn and the slide along its axis (cylindrical), a plane's two slides and a turn, a ball's three turns | a chain of one-degree joints through extra links |

Anything else, such as a screw motion or two turns about different axes, is refused with a typed reason. A part joined
twice round the graph closes a loop; the tree keeps one path and lists the loop, which the **Loop** line shows.

Some joints follow another instead of moving on their own:

- **Gears.** Two spur gears meshing on one carrier's joints are coupled: the second follows the first at the gear
  ratio. A joint's gears are those of its part and of the parts fixed to it, so a gear locked to its shaft turns with
  the shaft's joint. A locked gear off the joint's axis is noted `GEAR_NOT_COUPLED` rather than left out.
- **Cams.** A **Cam** mate, from a face of the cam part to the follower's flat face, makes the follower ride the lobe.
  The mate holds nothing itself: the follower's own mates place it in its guide, and its slide follows the cam's joint
  by the lobe's lift. A cam mate from the follower to another sliding part, such as a valve it pushes, moves that
  part with it, so chains like crank → gear → cam → follower → valve work. The Joints card says "follows *joint* on its cam (*mate*)".
  - The lobe is read from the cam's faces at the follower's face: flats and arcs along the cam's axis, such as an
    arc-and-line profile. Anything else is refused, `CAM_PROFILE_UNSUPPORTED`.
  - Nothing is coupled, and `CAM_NOT_SEATED` says why, when the cam has no joint to drive it, the follower doesn't
    slide, its face isn't flat or isn't across the cam's axis, the two are on different links, or the face is off the
    lobe at the solved pose (by how much).
  - The follower's face is taken as an infinite plane, so a face narrower than its contact's travel isn't caught.
- **One leader each.** A joint follows one leader: a second cam or push on it is refused, `COUPLED_TWICE`. Couplings
  that lead back round to their own joint are cut where the cycle closes, `COUPLING_CYCLE`.

**Base link** chooses which link stays put. Angles are in degrees and lengths in millimetres in the card; exports
write metres and radians.

## Moving it

![The Joints card of a two-link arm: each joint with its slider](/shots/studio/robots/joints.jpg)

- **Sliders.** Each joint's slider poses the robot, within its limits. **Home** returns every joint to zero, the pose
  the mates solve to.
- **A pose is a preview.** It isn't saved, and it doesn't add undo steps.
- **Links.** **Link masses** lists each link's mass and centre of mass, from its bodies and their materials. The card
  shows the gravity torques at the current pose. Right after an edit, these wait until the masses are worked out.
- **Paths.** **Add waypoint** records poses. **Check path** sweeps the robot along them and reports the first
  collision, with continuous collision between samples.
  - **Designed contact isn't a collision.** Some faces touch by design, and the sweep leaves those to the design
    while it still checks the rest of the same links. Each pair it skips says why.
    - Two meshing gears' teeth are the coupling's to hold.
    - Two links pinned in a planar loop can't cross where they're stacked.
    - A cam follower's face rides the lobe. The rest of the follower is checked against the cam.
    - A running fit: the two round faces of a concentric mate, such as a piston in its bore. The display meshes' facets
      cut inside a true circle, so a 0.1 mm clearance would read as contact. Within the facets' depth, plus 0.05 mm,
      the fit's faces don't count as touching; a boss past the bore still does.
    - The cam's and the fit's faces are checked at the sweep's steps, at most 1/90 of the move apart, not certified
      between them as the rest of the sweep is.
  - **Closed loops along a motion.** The agent's `play_motion` and `check_path` close a looped robot's loop at every
    pose: the motion names the driving joints, and the passive ones are solved. `check_path` cuts each segment into
    chords at most 1° (or 1 mm) of the drivers apart and certifies each one. A chord's middle isn't closed exactly, and
    the reply says by how much, as `loops: {chords, chord_residual_mm}`. A waypoint that gives a passive joint is
    refused, `LOOP_PASSIVE`. The studio's **Check path** and playback don't close the loop yet.
- **Playing a motion.** **Play motion** plays the motion chosen in **Motion choice** in time. Its length shows before
  it plays.
  - The draft is the path above: from home, through the waypoints, to the pose shown. Each joint moves at its velocity
    limit, or at 180/π deg/s (about 57.3 deg/s) for a turn and 100 mm/s for a slide when it has none.
  - A saved motion plays as the document keeps it: its waypoints, profile and limits.
  - **Pause motion** holds it. The **Motion time** scrubber sets the pose at a time, **Loop motion** repeats it, and
    **Motion speed** plays it at 0.25× to 2×.
  - The first contact on the way is reported as "Contact *link* – *link* at t … s". From then on the two links are
    marked: outlined on WebGPU, tinted on WebGL2.
  - Playing saves nothing. Moving a slider, **Home**, a change to the waypoints or another choice stops it.
![The pan-tilt head's saved motion "look around" chosen in Motion choice, paused partway, its camera frame drawn](/shots/studio/robots/saved-motion.jpg)

- **Saving a motion.** With the draft chosen, name it in **Motion name** and **Save as motion** keeps it in the
  document, in degrees and millimetres, and chooses it. A motion of the same name is replaced. Saving is an undo step;
  the pose shown and the play state are never saved.
- **Workspace.** **Workspace** (Map workspace) samples the reachable space and draws it as voxels, with a summary and the samples.
  **Download workspace** saves it.

## Limits and sizing

Revolute and prismatic joints need their lower and upper limits, effort and velocity before they export. The agent
and `cad-cli` can also run two checks:

- **robot-check** works through the arm's duty: limits, sweeps, the torques at every pose, and the actuators
  against their ratings. It lists every margin.
- **robot-size** raises actuators and ratings, or slows the profile, round by round until every margin is above
  zero, or stops with a typed reason when no sizing can fix the brief.

Gravity torques, the sweep and inverse kinematics follow a cam's coupling. A move's torques through a cam are
refused, `CAM_UNSUPPORTED`: the lift's second derivative isn't worked out yet.

## Exporting

**Export URDF**, **Export MJCF**, **Export SDF** and **Export USD** write the robot with:

- one link per part, the joint at the child;
- the visual mesh and a convex hull for collision;
- each link's mass in kg, centre of mass in m, and inertia tensor in kg·m². Rotations follow the file format.

No format holds a cam coupling, so a robot with a cam follower is refused, `CAM_UNSUPPORTED`. The agent's
`export_urdf` and `export_mjcf` take `leave_out: ["cam"]`, which writes the follower as a free joint and notes it.

Every export is checked against its format's rules by our own reader before it is written. The URDF and MJCF outputs have also been read back by
external tools — urdfdom's `check_urdf` and MuJoCo — and their kinematics match the studio's.

## Tool and sensor frames

A frame is a named pose on a link: a tool's centre point, or a camera. It is kept with the robot's settings, beside
the joints.

- **In the viewport.** Each frame is drawn where the pose puts it, as an axis triad (X red, Y green, Z blue) with its
  name on a chip: a tool's in the accent colour, a sensor's in cyan. It moves with the joint sliders, and keeps its
  size as the arm moves.
- **In the Joints card.** Each frame's origin (mm) and its Z axis at the pose shown, in the assembly's coordinates.
- **Setting them.** The agent sets frames; the studio has no editor for them yet.

- **Where a frame sits.** On a link, posed in that link's part's own coordinates: a position in mm, and a rotation in
  degrees about X, then Y, then Z, as a placed part's rotation. A frame may be a `tool` or a `sensor`.
- **What uses it.**
  - Forward kinematics moves a frame with its link.
  - Inverse kinematics can reach a frame's pose, or only its position.
  - The workspace map of a frame is its link's, taken at the frame's origin.
- **How each export writes it.** As a fixed child of its link, at its pose. A frame adds no mass, and with no frames
  every export is byte for byte as before.

  | Format | A frame is |
  |---|---|
  | URDF | A massless link on a fixed joint (`<name>_fixed`), as ROS-Industrial's `tool0` |
  | SDF | A link with a tiny inertial (an SDF link without one would weigh 1 kg), fixed to its link |
  | MJCF | A body welded to its link, with no joint and no mass, and a `<site>` of its name at its origin |
  | USD | An `Xform` beneath its link's prim |

- **What is refused.**
  - `[FRAME_NAME]`: a name that isn't letters, digits and `_`, or that one of the export's own links or joints
    already uses.
  - `[FRAME_LINK_MISSING]`: a frame on a part that isn't in the assembly.
  - `[FRAME_LINK_STALE]`: a frame on a part that isn't a link of the robot as it stands.
  - `[FRAME_POSE]`: a pose that isn't three numbers.

  A frame is refused this way, never dropped. See [Refusal codes](/reference/refusals).
- **The agent's action.** `assembly.frames` sets, changes or removes frames. Frames are part of the robot's settings,
  so the agent proposes every change, at any autonomy level.
- **How it was checked.**
  - Read back with our own readers, each frame is where forward kinematics puts it, at 21 poses.
  - External tools read the frames too: MuJoCo 3.3.0 as sites, usd-core as prims beneath their links, and urdfdom's
    `check_urdf`.
  - SDF is checked only by our own reader.


## Sample robots

`@barocss/cad-model` ships eight sample robots under `samples/robots/`, each a `.bcad` file you can open, with
`index.json` listing them. They're built from blocks joined by the studio's mates. Each joint has an estimated rating,
so every sample exports, and each carries one demo motion in its robot settings, in degrees and millimetres.

| Sample | What it is | Joints |
|---|---|---|
| `arm-2r` | A planar arm | Two turns about parallel vertical axes, 40 mm apart, ±150° |
| `scara` | A SCARA arm | Turn (±130°), turn (±145°), a slide of ±40 mm, turn (±360°) |
| `arm-6r` | An industrial arm's chain | Six turns about Z, Y, Y, Z, Y and Z: waist, shoulder, elbow and a three-axis wrist, each with its limits |
| `gantry-ppp` | A Cartesian gantry | Slides along X (0–200 mm), Y (0–120 mm) and Z (±40 mm) |
| `pan-tilt` | A camera head | Pan about Z (±170°), tilt about X (±60°), and a `camera` sensor frame |
| `gripper` | A gear-coupled gripper | The left finger turns ±30°; the right one follows on meshing 20-tooth gears, the other way |
| `four-bar` | A four-bar linkage | Crank, coupler and rocker, closed in one loop |
| `gear-joint` | A gear-driven joint | A 20-tooth gear driving a 30-tooth one, which turns two thirds as far, the other way |

Open one from **Templates**, under **Samples · Robots**. It opens as Open would open its file, with its joints in the
**Joints** card and its demo motion in **Motion choice**.

![The Templates menu, with the eight robot samples under Samples · Robots](/shots/studio/robots/samples-menu.png)

Set a pose with the sliders, and **Play motion** plays the draft from home to it. Here three samples are paused
half-way:

![The 6R arm half-way from home to a reach, its shoulder and elbow bent](/shots/studio/robots/arm-6r-motion.jpg)

![The SCARA arm half-way through a pick, its quill partly lowered](/shots/studio/robots/scara-motion.jpg)

![The Cartesian gantry half-way across its X and Y travel, its ram up](/shots/studio/robots/gantry-ppp-motion.jpg)

### In code

The [object API](/packages/api) reads an assembly as a robot: `assembly(…).robot()`. It exposes `joints()`,
`pose(values)`, `path(waypoints).check()`, `inertia()`, `gravity(values)`, and the robot export methods.
The public contract below applies to the facade, agent replies and stored robot settings.

For `Robot.pose(values)`, turning-joint inputs and the returned `values` are in degrees. Sliding-joint values are in
millimetres. `RobotPath.waypoints` and `RobotPath.poseAt(t)` use the same units. Link and frame placements keep
positions in mm and rotations in degrees.

#### Robot unit boundaries

::: warning R7 contract preparation
This section records the confirmed R7 public contract. The samples check the combined angular and B1 mass/gravity
implementation. B2 duty/consistency reports and the remaining field changes are pending. The full R7 contract is not
yet product-qualified.
:::

Use degrees for turning joints and mm for sliding joints. Resolve the joint type before you convert a value.

| Interface or field | Turning joint | Sliding joint |
|---|---|---|
| `Robot.pose(values)` input and returned `values` | degrees | mm |
| `RobotPath.waypoints`, `RobotPath.poseAt(t)` | degrees | mm |
| `Robot.path(waypoints, { limits })` velocity and acceleration | deg/s, deg/s² | mm/s, mm/s² |
| `Robot.joints()`, `Robot.setJoints()` and stored `RobotSettings.joints` lower/upper limits | degrees | mm |
| Public and stored joint velocity | deg/s | mm/s |
| Public acceleration and jerk | deg/s², deg/s³ | mm/s², mm/s³ |
| Public and stored joint effort; reported torque or force | N·mm | N |
| `RobotPath.check()` contact `values` | degrees | mm |

The internal joint tree, kinematics and dynamics keep their radians and SI calculations. Adapters convert at the
public boundary. Values that already use degrees, such as pose inputs and saved motion waypoints, need no second
conversion. A value of `90` must remain a quarter turn after a save, read, pose or contact report.

For a mimic relation, `follower = multiplier × leader + offset`. The offset uses the follower's unit. The multiplier
uses the follower's unit divided by the leader's unit. It is dimensionless when both use the same unit. For a turn
that drives a slide, a public multiplier of 0.1 mm/degree and an offset of 2 mm give 11 mm at 90 degrees. For the
reverse relation, 10 degrees/mm and an offset of 5 degrees give 35 degrees at 3 mm. Convert both the multiplier and
offset when you pass between public and internal units. Apply the same joint-type rule to cam and contact values.

**Public reports.** `Robot.inertia()` returns `{ links }`. Each link uses these fields, as does its agent report:

| Field | Public unit |
|---|---|
| `links[i].mass` | g |
| `links[i].centroid` | mm |
| `links[i].inertia`, `links[i].principal.moments` | g·mm² |
| `links[i].frame.origin` | mm |
| `links[i].bodies[j].mass` | g |

For `Robot.gravity(values, g)`, supply `g` in mm/s². The default is `[0, 0, -9806.65]`, which preserves the existing
9.80665 m/s² physical value. An explicit input of `[0, 0, -9810]` selects 9.81 m/s² instead. The reply's `gravity` is
the magnitude in mm/s². It is not a returned vector. `torques` and `generalized` contain the holding moment or force
by joint key. Read `units[key]`: a turn uses N·mm, and a slide uses N. Density remains g/cm³.

A motion report uses `joints[key].peak`, `rms` and `unit` for moment or force. Its `distance`, `peakVelocity`,
`peakAcceleration` and `peakJerk` use degrees or mm and the corresponding time derivatives. `at` is in seconds.
These motion fields are separate from a gravity reply. The object facade exposes `path()` for motion; it has no
`move()` or `size()` method.

Public durations and timestamps use seconds. This includes `duration`, `time`, `at`, `moveDuration`, `cycleDuration`
and `dwell`. `evaluationTime`, `builtTime` and `wallTime` convert former millisecond values by dividing by 1000.
`serviceLife` converts former hours to seconds by multiplying by 3600. A turning joint's `stopDeceleration` uses deg/s².

For a physical reference, take a solid 10 × 10 × 10 mm cube at density 2.7 g/cm³. Its mass is 2.7 g, centroid is
[5, 5, 5] mm and each diagonal centroidal inertia is 45 g·mm². With the explicit test input `[0, 0, -9810]` mm/s²,
its weight is 0.026487 N.
With its centre 5 mm perpendicular to a hinge axis, the holding torque magnitude is 0.132435 N·mm. The corresponding
native SI values are 0.0027 kg, [0.005, 0.005, 0.005] m and 4.5 × 10⁻⁸ kg·m². The cube samples below check mass,
inertia and slide force against these independent values. The hypothetical 5 mm hinge is a calculation only; the
tested hinge below uses a drilled arm with a 20 mm lever.

#### Physical report examples

The cube uses aluminium `al6061`, whose density is 2.7 g/cm³. The code calls the object facade, and compares its
reply to closed-form values. The expected values are not taken from a conversion helper.

<<< @/../samples/robot-public-reports.test.mjs#import

<<< @/../samples/robot-public-reports.test.mjs#cube

<<< @/../samples/robot-public-reports.test.mjs#cube-report

The gravity input is a vector, and the returned `gravity` is its magnitude. A cube with no joint can check that
magnitude, but supplies no joint holding-force result:

<<< @/../samples/robot-public-reports.test.mjs#gravity

Add two perpendicular plane mates to constrain a second cube to a vertical slide. Its holding force is
0.026477955 N at the default gravity and 0.026487 N at the explicit 9810 mm/s². A 20 mm displacement does not change
its weight:

<<< @/../samples/robot-public-reports.test.mjs#slide

<<< @/../samples/robot-public-reports.test.mjs#slide-force

For turning effort, use a 20 × 20 × 80 mm aluminium block. It has two blind bores of radius 4 mm and depth 8 mm,
and two transverse bores of radius 4 mm and length 20 mm. None intersect. The concentric and plane mates make a
hinge about +Y. The block's centre is 20 mm above that hinge at home. At 90 degrees, the lever is perpendicular to
gravity. The holding moment is negative about +Y, in N·mm:

<<< @/../samples/robot-public-reports.test.mjs#arm

<<< @/../samples/robot-public-reports.test.mjs#arm-torque

The samples also check a real sweep's initial contact at 45 degrees and −12.5 mm. A separate unit projection
fixture covers all four turn/slide mimic combinations. That fixture checks conversion; it does not demonstrate
four physically assembled coupling mechanisms. B2 duty/consistency and remaining field changes need later checks.

[Native export files](#exporting) retain their format-specific SI units. Their frozen bytes need a separate check
from public JSON quantities. Explicit source catalogue records such as `{ v, unit, src }` retain their source units
and provenance. They do not change the units of public robot results.
See [Unit and export comparisons](/reference/verification#unit-and-export-comparisons).

<<< @/../samples/robots.test.mjs#import

<<< @/../samples/robots.test.mjs#open

- **The 2R arm:** its two turns, a pose, and a path checked for collisions.

<<< @/../samples/robots.test.mjs#arm-2r

- **The SCARA arm:** the quill's slide.

<<< @/../samples/robots.test.mjs#scara

- **The 6R arm:** its axes, its demo motion swept, and its URDF read back.

<<< @/../samples/robots.test.mjs#arm-6r

- **The gantry:** each slide carries the ones after it.

<<< @/../samples/robots.test.mjs#gantry

- **The pan-tilt head:** its camera frame at a pose, and a pose past the tilt's limit.

<<< @/../samples/robots.test.mjs#pan-tilt

- **The gripper:** only the leader is given; the follower turns by the coupling.

<<< @/../samples/robots.test.mjs#gripper

- **The four-bar linkage:** the loop, and what a tree format leaves out.

<<< @/../samples/robots.test.mjs#four-bar

- **The gear-driven joint:** the gear ratio.

<<< @/../samples/robots.test.mjs#gear-joint

- **Motions:** a path timed and played, the sample's saved motion read, and a path saved as a motion.
  `path(waypoints, { profile?, limits? })` takes waypoints in degrees and millimetres, and limits per joint in deg/s
  and deg/s² (or mm/s and mm/s²). `duration()` gives its length in seconds, `poseAt(t)` the joint values at a time in
  degrees, and `problems()` what is wrong with it on this robot. `motion(name)` reads a saved motion, and
  `withMotion(name, path)` returns a robot with the path saved.

<<< @/../samples/robots.test.mjs#motions

- **Every demo motion swept.** Each sample's own motion is clear, and the gripper's meshing fingers are skipped as
  designed contact. The object API doesn't close loops yet, unlike the agent's tools, so the four-bar's motion is
  refused with `LOOP_OPEN`: by `check()`, `poseAt()` and `duration()`, and listed first by `problems()`.

<<< @/../samples/robots.test.mjs#sweeps

- **The exports**, each with what its reader found and what it had to assume. `check` lists what our own reader found
  wrong when reading the file back, and `notes` what the export assumed, such as aluminium for a body without a
  material.

<<< @/../samples/robots.test.mjs#exports
