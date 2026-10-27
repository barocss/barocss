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

### Candidate Universal robot joints

This candidate is not integrated into the product and has not been runtime-verified in this documentation work.
The current joint support described above remains unchanged.

The candidate represents one explicit Universal mate as two rotations about the connector axes. The pair's joint
keys end in `#0` for connector A's Z axis and `#1` for connector B's X axis. These keys keep their meaning when
the robot base changes. The axes come from the solved connector frames, including their local settings, rather
than from fixed world directions. Changing the base can reverse their order and signs without renaming the keys.
Set limits and ratings on each axis key in `doc.robot.joints`; pair-level settings are refused. Stored and public
turn limits use degrees, velocity uses deg/s, and effort uses N·mm. The tree converts them to solver units.

The two rotations use an intermediate logical carrier with `part: null`. It is not an assembly body or a BOM or
mass row. The candidate feeds this chain into the existing forward-kinematics and generic export paths.

It refuses a Universal combined with other mates on the same pair, a grounded endpoint, or a closed or coupled
loop. Missing connector geometry, invalid axes, separated origins or axes that are not perpendicular also prevent
the decomposition. Unsupported decomposition reports `MOTION_UNSUPPORTED`; an unresolved or unmet mate can
instead report `MATE_PROBLEM` before decomposition. The explicit Cylindrical mate candidate still has no robot
decomposition in this candidate; its assembly freedom does not establish robot or export support.

## Moving it

![The Joints card of a two-link arm: each joint with its slider](/shots/studio/robots/joints.jpg)

- **Sliders.** Each joint's slider poses the robot, within its limits. **Home** returns every joint to zero, the pose
  the mates solve to.
- **Numeric pose.** For an independent moving joint, enter turns in degrees or slides in mm.
  Choose **Apply** or press **Enter** to apply the value. Typing alone does not change the pose.
  Choose **Cancel** or press **Escape** to discard the edit and restore the displayed value.
  A value outside the joint's set lower or upper limit is refused; the previous pose stays unchanged.
  The slider's input window does not add physical joint limits.
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
    the reply says by how much, as `loops: {chords, chordResidual}`, with `chordResidual` in mm. A waypoint that gives
    a passive joint is
    refused, `LOOP_PASSIVE`. In Studio, **Play motion** and the time scrubber close supported looped motions too.
    Studio's **Check path** still refuses a looped motion with `LOOP_OPEN`.
- **Playing a motion.** **Play motion** plays the motion chosen in **Motion choice** in time. Its length shows before
  it plays.
  - The draft is the path above: from home, through the waypoints, to the pose shown. Each joint moves at its velocity
    limit, or at 180/π deg/s (about 57.3 deg/s) for a turn and 100 mm/s for a slide when it has none.
  - A saved motion plays as the document keeps it: its waypoints, profile and limits.
  - **Pause motion** holds it. The **Motion time** scrubber sets the pose at a time, **Loop motion** repeats it, and
    **Motion speed** plays it at 0.25× to 2×.
  - For a supported looped motion, the driving joints follow the path and the passive joints are solved. Seeking
    forward or backward keeps the assembled branch through earlier segment joins. A refused seek leaves the pose
    and time unchanged. Playing a single joint's preview on a looped robot is still refused with `LOOP_OPEN`;
    choose a supported motion in **Motion choice** instead.
  - For an open-chain motion, the first contact on the way is reported as "Contact *link* – *link* at t … s". From then on the two links are
    marked: outlined on WebGPU, tinted on WebGL2.
  - Playing saves nothing. Moving a slider, **Home**, a change to the waypoints or another choice stops it.
![The pan-tilt head's saved motion "look around" chosen in Motion choice, paused partway, its camera frame drawn](/shots/studio/robots/saved-motion.jpg)

- **Saving a motion.** With the draft chosen, name it in **Motion name** and **Save as motion** keeps it in the
  document, in degrees and millimetres, and chooses it. A motion of the same name is replaced. Saving is an undo step;
  the pose shown and the play state are never saved.
  For a supported looped motion, **Add waypoint** and **Save as motion** keep only driving-joint values. The solved
  passive-joint values stay in the preview and are worked out again when the motion plays.
- **Workspace.** **Workspace** (Map workspace) samples the reachable space and draws it as voxels, with a summary and the samples.
  **Download workspace** saves it.

## Limits and sizing

Revolute and prismatic joints need their lower and upper limits, effort and velocity before they export. The agent
and `cad-cli` can also run two checks:

- **robot-check** works through the arm's duty: limits, sweeps, the torques at every pose, and the actuators
  against their ratings. It lists every margin.
- **robot-size** raises actuators and ratings, or slows the profile, round by round until every margin is above
  zero, or stops with a typed reason when no sizing can fix the brief.

### Duty files and public reports

A public duty file has `moves`. Each move supplies `from`, `to`, `profile` and limits. Turning values use degrees;
sliding values use mm. Use `joint_limits` by joint key when a move mixes turns and slides. Velocity, acceleration
and jerk use the corresponding units per second, second squared and second cubed. `dwell` and `serviceLife` use
seconds, `clearance` uses mm, and `g` uses mm/s². `inertia_ratio_max` is dimensionless. The `actuators` map names
catalogue motor and reducer ids by joint key. It does not supply new sourced hardware data.

The CLI passes canonical `PublicDuty` directly to `robotCheckOfDoc`; sizing uses `robotSizeOfDoc`. Public
`serviceLife` and `dwell` remain in seconds. The sample also uses the explicitly importable
`robot/native/duty.readDuty` to decode the same public input into native operands, then calls
`nativeRobotCheckOfDoc` and `nativeRobotSizeOfDoc` for comparison. Those native operands use radians, existing SI
quantities and `life_h` in hours. The shared `dutyJson` adapter writes public values back. The sample compares the
shared projections with the canonical results on the shipped SCARA document, including its turn and slide:

<<< @/../samples/robot-public-metadata.test.mjs#duty

`robot-check` publishes the original harness result through `harnessJson`. A margin contains `value`, `limit`,
`unit`, its dimensionless `margin`, its `source` and `ok`. Angles use `degree` or `degree/s`; turning effort uses
N·mm and slide effort uses N. The adapter converts the original quantities before rounding. A non-finite
quantity is `null`, not an invented finite measurement. Decisions, unknowns and sources keep their meaning.

Project the original report before cloning or serializing it. A cloned margin has no raw quantity identity.
Changing a margin's `value`, `limit` or `unit` also invalidates that identity. Projection then refuses with
`HARNESS_RAW_PROVENANCE_UNAVAILABLE`:

<<< @/../samples/robot-public-metadata.test.mjs#harness

Consistency checks use dimensionless `errorRatio` and `limitRatio: 1`, and retain their original `ok` decision.
Two zero quantities give an error ratio of 0. A positive error with a zero limit gives `null` and
`reason: "zero-limit"`. Non-finite quantities or ratio overflow give `null` and `reason: "non-finite-ratio"`.
The old mixed-unit `value` and `tol` fields are not public consistency fields.

The scripted sizer's `sizedJson` result uses the same public boundaries for `tree`, `duty` and `report`. It retains
`ok`, `rounds`, `trace` and any `stopped` reason. Trace text keeps its explicitly stated original units. The CLI
writes the robot document and a public `.duty.json` file, and prints a summary. It does not print that whole result.
These are the CLI's shared adapters, not new `Robot` facade methods. This sample limits sizing to zero rounds and
checks the actual returned contract; it does not demonstrate a successful search for a hardware design:

<<< @/../samples/robot-public-metadata.test.mjs#sized

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
This section records the confirmed R7 public contract. Focused samples check angular metadata, B1 mass/gravity and
the shared B2 duty/harness/sized boundaries. Further evaluation, orientation, print, CAM and material field changes
and the final combined checks are pending. The full R7 contract is not yet product-qualified.
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

Nested gear placements `couplings[i].g1.rotation` and `g2.rotation` use degrees in the gear pair's common frame.
The internal FK and `GearPlacement` keep radians. GearSpec pressure and helix angles already use degrees; do not
convert them again. A pose's gear metadata uses `phase` and `homePhase` in degrees and `backlash` in mm.
`loops.residual` is the pin distance in mm for a pin closer. For a general closer, it is the original norm of
distance and rotation constraint rows, not a pure length. The four-bar pin-loop sample's checked motion reports
`loops.chordResidual` in mm.

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

#### Calculate the sign of a holding torque

Consider one moving link at a prescribed static pose. Its total mass is 100 g, its centre of mass is
`r = [200, 0, 0]` mm from the hinge, and the hinge's positive axis is world `+Y`. All vectors below are in
world coordinates. Use gravity `[0, 0, -9806.65]` mm/s² and no other applied loads.

| Calculation | Value |
|---|---|
| Convert mass and acceleration | `100 g = 0.1 kg`; `-9806.65 mm/s² = -9.80665 m/s²` |
| Gravity force, `F = m g` | `[0, 0, -0.980665]` N |
| Gravity moment, `r × F`, with `r` in mm | `[0, +196.133, 0]` N·mm |
| Holding moment, opposite to gravity | `[0, -196.133, 0]` N·mm |
| Holding moment projected onto the `+Y` axis | `-196.133 N·mm` |

The public gravity reply reports the holding value by joint key, so this single independent turning joint has
`-196.133` in both `torques` and `generalized`, with unit `N·mm`. It does not report the positive gravity moment.
The internal calculation uses a 0.2 m lever and gives `-0.196133 N·m`; the public conversion multiplies by 1000.
A negative value means holding effort opposite to the joint's positive axis. It is not a negative mass or a failure.

![A 100 g moving mass at a 200 mm X lever, downward gravity force, and a hinge whose positive Y axis points into the XZ diagram](/diagrams/robot-holding-units.svg)

[Open the holding-torque diagram at full size](/diagrams/robot-holding-units.svg).

This is a calculated example and diagram, not an API execution, measurement, or validation result. It explains
one static pose; it does not predict free motion, acceleration, contact forces, or actuator suitability. The
bounded static gravity experiment still requires its supported one-joint model, explicit gravity input and known materials.

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
four physically assembled coupling mechanisms. The duty/metadata samples above exercise actual shared producers;
the final combined checks after the remaining field changes are still pending.

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
  and deg/s² (or mm/s and mm/s²). `duration()` gives its length in seconds. `poseAt(t)` returns the driving-joint
  values at a time in degrees or mm; pass them to `robot.pose(...)` for the solved passive values and link placements.
  `motion(name)` reads a saved motion, and `withMotion(name, path)` returns a robot with the path saved.
  - Supported looped paths, including the sample four-bar's saved `crank` motion, can use `duration()`, `poseAt(t)`
    and `problems()`. Supply driving joints only. Seeking keeps the assembled branch through preceding segment
    joins; a later seek cannot skip an unreachable or dead-point part of the path.
  - `problems()` returns `[]` for a supported, closable path, or lists its typed refusal. `duration()` and `poseAt(t)`
    throw the typed refusal when the required path cannot close. Finite lower or upper bounds on passive loop joints
    remain unsupported and give `LOOP_OPEN`. Extra passive-joint waypoint inputs give `LOOP_PASSIVE`.
  - An empty problem list describes the motion's timing and closure. Collision checking along that motion is
    separate. The four-bar example does not establish support for arbitrary mechanisms with several coupled loops.

<<< @/../samples/robots.test.mjs#motions

- **Checking a motion for contact.** The open-chain samples' demo motions are clear, and the gripper's meshing
  fingers are skipped as designed contact. For a looped motion, the object API's `check()` still refuses with
  `LOOP_OPEN`: its sweep and continuous collision checks do not yet follow the closed motion. Use the agent's
  `check_path` for the supported looped path, with the chord and residual contract described above. Studio's
  **Check path** has the same `LOOP_OPEN` boundary. Playback alone does not certify collision clearance.

<<< @/../samples/robots.test.mjs#sweeps

- **The exports**, each with what its reader found and what it had to assume. `check` lists what our own reader found
  wrong when reading the file back, and `notes` what the export assumed, such as aluminium for a body without a
  material.

<<< @/../samples/robots.test.mjs#exports
