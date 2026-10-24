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
twice round the graph closes a loop; the tree keeps one path and lists the loop, which the **Loop** line shows. Two
spur gears meshing on one carrier's joints are coupled: the second follows the first at the gear ratio.

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
- **Playing a motion.** **Play motion** plays the motion chosen in **Motion choice** in time. Its length shows before
  it plays.
  - The draft is the path above: from home, through the waypoints, to the pose shown. Each joint moves at its velocity
    limit, or at 1 rad/s or 100 mm/s when it has none.
  - A saved motion plays as the document keeps it: its waypoints, profile and limits.
  - **Pause motion** holds it. The **Motion time** scrubber sets the pose at a time, **Loop motion** repeats it, and
    **Motion speed** plays it at 0.25× to 2×.
  - The first contact on the way is reported as "Contact *link* – *link* at t … s". From then on the two links are
    marked: outlined on WebGPU, tinted on WebGL2.
  - Playing saves nothing. Moving a slider, **Home**, a change to the waypoints or another choice stops it.
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

## Exporting

**Export URDF**, **Export MJCF**, **Export SDF** and **Export USD** write the robot with:

- one link per part, the joint at the child;
- the visual mesh and a convex hull for collision;
- each link's inertia, in metres, kilograms and radians.

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
| `scara` | A SCARA arm | Turn, turn, a slide of ±40 mm, turn |
| `arm-6r` | An industrial arm's chain | Six turns about Z, Y, Y, Z, Y and Z: waist, shoulder, elbow and a three-axis wrist |
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

The [object API](/packages/api) reads an assembly as a robot: `assembly(…).robot()`. Each method returns what the
agent's robot tool returns: `joints()`, `pose(values)`, `path(waypoints).check()`, `inertia()`, `gravity(values)`, and
`urdf()`, `mjcf()`, `sdf()` and `usd()`. Joint values go in as degrees and millimetres. The pose's `values` come back as
the tool gives them, with turns in radians.

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

- **The exports**, each with what its reader found and what it had to assume. `check` lists what our own reader found
  wrong when reading the file back, and `notes` what the export assumed, such as aluminium for a body without a
  material.

<<< @/../samples/robots.test.mjs#exports
