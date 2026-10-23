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
  shows the gravity torques at the current pose.
- **Paths.** **Add waypoint** records poses. **Check path** sweeps the robot along them and reports the first
  collision, with continuous collision between samples.
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

::: info Not in the studio yet
The Joints card's sliders and the viewport don't show frames yet. For now the agent sets them.
:::

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

