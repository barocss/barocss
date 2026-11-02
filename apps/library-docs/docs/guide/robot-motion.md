# Robot motion: from a path to a pose

Physics supports [continuous primitive rotation](/packages/physics/profiles-and-lifecycle#isolated-noncubic-rotor)
for admitted boxes, spheres and capsules. This does not qualify connected robot
joint dynamics. CAD proxy conversion, kinematic pose calculation and control
accuracy require their own evidence.

Use CAD Model to prescribe joint motion, calculate link poses and inspect
limits. Use Physics to predict motion from initial conditions and applied
loads within an admitted physical model. These operations have different
inputs, outputs and verification requirements.

The former `@barocss/motion` package is retired. The functions on this page
belong to `@barocss/cad-model`. A sampled pose is not a command to a motor.

## Choose the calculation

| Calculation | Input | Output | What it does not establish |
|---|---|---|---|
| Forward kinematics (FK) | Joint values and a joint tree | Link and tool poses | Forces, contact response or stability |
| Inverse kinematics (IK) | A tool target, joint tree and optional start values | Joint values, residuals and `reached` | A clear path to the target or a unique solution |
| Timed path | Joint waypoints and velocity/acceleration limits, with optional jerk | Duration and joint values at a time | Whether an actuator can follow that motion |
| Clearance or sweep | Geometry and selected poses or a path | Distances, contact, or an incomplete check | Physical contact forces |
| Statics and inverse dynamics | Mass/inertia, gravity and a prescribed pose or motion | Required joint holding effort or motion loads | Free motion from those loads |
| Forward dynamics | A supported physical model, initial state and loads | State after a time step | General robot, controller or hardware acceptance |

See [the Robot API](/packages/cad-model/#assembly-and-robot-motions),
[the Studio robot workflow](/studio/robots) and
[the kinematics algorithms](/how/cad-model#_2-robots) for their full contracts.

## Keep the units and frame explicit

The `Robot` object uses **degrees for turns and mm for slides**. Path times
are seconds. Velocity, acceleration and jerk use the joint's own units per
second, second squared and second cubed. A `default` rate has each joint's
own unit; a named joint rate overrides it.

`RobotPath.poseAt(t)` returns joint inputs. Pass them to `robot.pose(values)`
to obtain link positions in mm and rotations in degrees. These placements use
the assembly's coordinates. Missing joint values mean zero at the solved home
pose, rather than the previous waypoint's value.

The lower-level FK/IK and timed-path functions use radians for turns and mm
for slides and point positions. IK reports its position residual in metres
and angle residual in radians. Do not pass degree values to `solveIk`, or
convert a public `RobotPath.poseAt` reply a second time before `Robot.pose`.

Read [Robot unit boundaries](/studio/robots#robot-unit-boundaries) before
combining public MMGS mass/inertia reports with SI dynamics. Declare the
gravity vector and frame; the robot gravity default is along -Z, while many
Physics examples use -Y. A display adapter must make any frame change explicit.

## Time a turn and a slide together

The following repository sample opens the shipped SCARA document. It uses
its first turning joint and the quill's sliding joint. Other joints stay at
their zero values. The file path is relative to `apps/library-docs/samples`;
an application can instead supply its own `.bcad` document.

<<< @/../samples/physics-motion.test.mjs#imports

<<< @/../samples/physics-motion.test.mjs#open-scara

Set the joint limits separately from the timing rates. Limits describe the
allowed joint range. Rates describe how this particular path is timed.
`setJoints` and `withMotion` return new robot objects; they keep the originals.

<<< @/../samples/physics-motion.test.mjs#mixed-path

The turn travels 60° at a maximum 60°/s and 120°/s². The slide travels
30 mm at 15 mm/s and 30 mm/s². Each segment uses one normalized progress
function shared by both joints. The tighter slide rate limits that progress
to 0.5/s and its acceleration to 1/s².

For a rest-to-rest trapezoid with distance d, speed v and acceleration a,
duration is `d/v + v/a` when `d >= v²/a`. Here the slide takes
`30/15 + 15/30 = 2.5 s`. The return takes another 2.5 s. The repeated
initial waypoint adds zero time. Every nonzero segment starts and ends at
rest; a waypoint join is not a blended robot corner.

### Read the joint inputs, then obtain the pose

<<< @/../samples/physics-motion.test.mjs#sample-and-pose

At 1.25 s, the shared progress is one half: 30° and -15 mm. The example
compares the quill origin with an independent rotation about the first joint's
off-origin pivot. The mate solve places the home quill origin at `(225,25,-30)`
mm; this differs from the document's initial unsolved instance position.
Public link positions are rounded to six decimal places in mm. The example
compares the analytic point at that same reporting precision, with a 1e-9 mm
comparison tolerance. It records the difference from the unrounded analytic
point separately. This does not establish full-precision FK accuracy from a
rounded reply. That separate reporting difference must be at most
0.5e-6 mm per component, the half-step bound for six decimal places. It is
not a wider numerical FK tolerance. The tests also sample both outward and
return segments.
This checks the stated kinematics and timing; it does not qualify a physical
SCARA arm or certify clearance.

Finite times before the start or after the end return the corresponding
endpoint. Negative finite time is valid. NaN and infinite query times are
refused. A zero-distance segment has no dwell time; add a separate supported
timing or application rule if the operation needs a physical pause.

### Choose an S-curve when jerk is constrained

<<< @/../samples/physics-motion.test.mjs#s-curve

An S-curve also needs positive jerk limits for every moving joint. It keeps
the same joint-space line and synchronized start/end values, but changes the
progress in time. This example takes 3 s rather than 2.5 s for the outward
segment. A slower profile does not by itself establish acceptable motor
torque, reducer life or control tracking.

### Inspect refusals before playback

<<< @/../samples/physics-motion.test.mjs#refusals

`problems()` returns path findings. `duration()` and `poseAt()` refuse an
invalid path. A direct `robot.pose(...)` preview has a different contract:
it reports out-of-limit joints and keeps the requested values. Inspect
`out_of_limits` before treating a pose as admissible.

Nonfinite joint values use `VALUE`. Nonfinite supplied rates use `LIMITS_BAD`.
Missing or nonpositive required rates use `LIMITS_MISSING`. These codes are
not a physical failure measurement. See [refusal codes](/reference/refusals).

## Solve a tool target with IK

The `Robot` facade has no `ik()` method. The public `robot/ik` subpath exposes
`solveIk(tree,target,start?)` for a joint tree. Its target is a rigid motion
from the solved home pose, evaluated at the home tool point. It is not an
absolute link placement record from `Robot.pose`.

The following separate analytic tree has a Z turn and an X slide. It has no
body geometry or collision model. The tool is 40 mm from the pivot at home.
Its analytic target position is
`[(40+s) cos(theta), (40+s) sin(theta), 0]` mm.

<<< @/../samples/physics-motion.test.mjs#ik-imports

<<< @/../samples/physics-motion.test.mjs#ik-model

Inspect residuals and joint bounds, including when the target is reachable.
The example checks three different targets, rather than accepting one
successful pose as general IK qualification.

<<< @/../samples/physics-motion.test.mjs#ik-residuals

The example uses the solver's existing acceptance limits: 1e-4 m position
and 1e-3 rad orientation. It calculates residuals from the returned joint
values with independent scalar geometry. The tests also compare FK at those
joint values and the solver's reported residuals.

### Retain an unreachable result

<<< @/../samples/physics-motion.test.mjs#unreachable

The requested slide is 120 mm, but its upper limit is 80 mm. The target
radius is 160 mm; the allowed radius is at most 120 mm. The independent
position residual remains at least about 40 mm. `reached:false` is a result
to handle, not a reason to apply the target pose. Check `errorM`, `errorRad`,
joint limits and singularity information for each solve. Reachability still
does not establish a collision-free transition.

## Check geometry separately

Use `RobotPath.check()` for its supported straight joint-space sweeps. Read
each reply's `clear`, contact, `skipped` and possible `exhausted` fields.
An empty path problem list does not run that sweep. A budget-exhausted sweep
is incomplete, rather than clear. The facade's looped path check still
refuses with `LOOP_OPEN`, even when looped playback is supported.

For a current assembly pose, `assembly.clearance({near})` is asynchronous and
reports display-mesh distances and any pending exact-overlap distinction.
It is a separate calculation from path timing and physical collision response.
See [assembly clearance](/packages/cad-model/#checking-assembly-clearance) and
[robot path limits](/studio/robots#moving-it) before interpreting either result.

## Keep loads, dynamics and control separate

`robot.gravity(...)` calculates the effort needed to hold the prescribed
pose. Motion-load and actuator-sizing tools calculate demands along a
prescribed trajectory. They do not advance free motion from applied torque.
Their assumptions, material inputs and sourced ratings remain part of the result.

Physics advances its admitted models from initial conditions and loads. Its
reduced one-coordinate planar pendulum is separate from PhysicsWorld's joint
solver. Numerical checks of that ODE do not implement the planned CAD-bound
pendulum experiment workflow or arbitrary connected robot dynamics.

Contact requires its own geometry and impulse checks. Feedback control also
requires a defined plant, controller, sensing and tracking criteria. Sending
commands to hardware adds its own calibration and measured acceptance. None
of those stages follows from path playback, IK success or an export file.

The original eight-box and two-hinge NO_GO records remain. Narrow contact
construction checks do not establish long-term stack stability. Existing
Physics, Studio and manufacturing HOLDs stay in force. Read
[limits](/reference/limits#planned-physical-experiments) and
[experiment evidence stages](/reference/verification#planned-experiment-evidence)
before using a calculated motion as a physical prediction.
