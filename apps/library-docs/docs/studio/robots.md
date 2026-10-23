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
