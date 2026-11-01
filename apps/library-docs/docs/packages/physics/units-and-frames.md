# Physics units and frames

Declare the unit system and coordinate frame before you connect a Robot, a CAD proxy and a Physics
world. Convert each value once at its boundary. Do not convert Physics output again before you use
it as input to the next Physics step.

This page describes the current unreleased branch. See the [package overview](./) and
[robot motion guide](/guide/robot-motion) for API ownership. The existing
[Robot unit boundaries](/studio/robots#robot-unit-boundaries) remain the Robot facade contract.

## Conversion and frame contract

| Quantity or boundary | Source convention | Physics or destination convention | Required conversion or declaration |
| --- | --- | --- | --- |
| Public Robot turn input/output | Degrees | Internal joint calculations use radians | `rad = deg * Math.PI / 180`. The facade owns this conversion; do not preconvert facade turn inputs. |
| Public Robot slide input/output | mm | Internal Robot joint calculations also use mm | No conversion inside the Robot facade. Convert mm to m when passing length to Physics. |
| Timed Robot joint limits | Joint units per second, squared second or cubed second | Public turn limits use degrees; internal turn math uses radians. Slide limits use mm. | Match the API layer and each joint's unit. A playback speed is a display setting. |
| CAD/Viewer length and Robot MMGS length | mm | Physics length in m | Multiply by `1e-3`; return Physics display positions to mm with `1e3`. Thus 100 mm is 0.1 m. |
| Robot facade MMGS mass | g | kg | Multiply by `1e-3`. |
| Robot facade MMGS inertia | g·mm² | kg·m² | Multiply by `1e-9`. State the inertia origin and axis as well. |
| Robot reported moment | N·mm | N·m | Multiply by `1e-3`. Force in N needs no scale change. |
| Physics time, angles and loads | s, rad, N, N·m | Same SI units in Physics state and commands | Linear impulse is N·s; angular impulse is N·m·s. Do not treat either as a force or torque. |
| World frame | Host declares right-handed XYZ and CAD orientation | Physics body positions and velocities use that declared world frame | There is no universal CAD up axis. These Physics examples use −Y gravity; Robot statics default to −Z. Rotate vectors explicitly when connecting these frames. |
| Body rotation | Local-to-world quaternion | `[x, y, z, w]`, right-handed | The input and state field is `orientationXYZW`; identity is `[0,0,0,1]`. Rigid admission requires norm within `1e-6` of one and normalizes it. `cadProxyPose` requires norm within `1e-9`. |
| Body axes and angular input | Shape dimensions and joint anchors are body-local | Torque and angular velocity are world-frame vectors | A capsule's segment uses its local Y axis. `axisWorld` is a world hinge axis. |
| Contact convention | Pair IDs sorted as A, B | `normalAtoB` points from A to B; `pointM` is world metres | Positive normal impulse acts along the normal on B and against it on A. `tangentImpulseOnBNs` is the accumulated world-vector impulse on B, opposite on A. |
| Independent pendulum reference inertia | `inertia: {about:'com'|'pivot', kgM2}` | Moment about the +Z axis through the named origin | For COM input, Physics adds `massKg * comDistanceM²` once. For pivot input, include this term yourself. |
| CAD proxy display | Source points and `sourceCenterMM` in mm; body centre in m | Viewer translation in mm and unchanged XYZW orientation | `translation = 1000 * bodyPositionM - R * sourceCenterMM`. Rotate around the source centre, then place that centre at the body position. |

The rigid world's sphere inertia is `2*m*r²/5`; a dynamic sphere can declare `inertia:{kind:'sphere-isotropic',about:'com',frame:'body-local',kgM2}` to supply that scalar. Other admitted primitive bodies use explicit `inertia:{kind:'primitive-com',about:'com',frame:'body-local'}`.
Its box inertia is the local COM diagonal `m/3 * [hy²+hz², hx²+hz², hx²+hy²]`. Capsule inertia is a
labelled isotropic proxy, `2*m*(radiusM+halfLengthM)²/5`. These shape models do not recover exact CAD
mass properties. Supply the correct mass and model before interpreting the motion.

For the independent pendulum example, `comDistanceM` is the pivot-to-COM distance. Its state angle is zero when the COM
is below the origin on −Y. Positive angle turns about +Z, and
`comPositionM = [L*sin(angle), -L*cos(angle), 0]`. The pivot equation is
`I_pivot * angleAcceleration = -massKg * gravityMps2 * L * sin(angle)`.
A COM moment and a pivot moment cannot be substituted without the parallel-axis term.

## Off-origin CAD proxy example

The public adapter admits one selected native Surface from the exact source text and revision.
It returns `body:RigidBody`, `collider:Collider` and `binding:SourceBinding`. Add these values to the model's
`bodies`, `colliders` and `sourceBindings` arrays. The binding has source revision/digest, occurrence/model
IDs, numerical entity references and approximation metadata. Exact source text and native bounds remain
with the adapter. They do not enter the numerical World.

The body's input position is `proxy.body.initial.positionM`; geometry is `proxy.collider.geometry`.
The accepted body state uses `orientationXYZW`. `cadProxyPose` reads that state and returns the display
pose's `rotation`, also XYZW.
The fixture below has source bounds `[20,-30,40]` to `[120,10,100]` mm. Its centre is `[70,-10,70]` mm.
The admitted box half extents are `[0.05,0.02,0.03]` m. A +0.1 m X offset places its body centre
at `[0.17,-0.01,0.07]` m.

<<< @/../samples/physics-docs.test.mjs#physics-import

<<< @/../samples/physics-docs.test.mjs#proxy-source

Turn the body +90° about Z while keeping that body centre. The literal quarter-turn matrix gives
`R*[x,y,z] = [-y,x,z]`, so `R*sourceCenterMM = [10,70,70]` mm. The display translation is therefore
`[170,-10,70] - [10,70,70] = [160,-80,0]` mm. A translation of `[100,0,0]` mm alone is correct only
for this fixture's identity orientation.

<<< @/../samples/physics-docs.test.mjs#off-origin-pose

The four expected display points are literal coordinates. The sample uses the quarter-turn matrix
and an inverse transform rather than the adapter's quaternion helper to calculate its oracle.
It compares admission lengths at `1e-9` m and display/inverse coordinates at `1e-6` mm. The source
centre maps to the body centre `[170,-10,70]` mm under the same transform.

The returned pose is a display transform of the original Surface. It is not a replacement collision
mesh. A box proxy uses the Surface control-net AABB with minimum half extent; a sphere encloses
that AABB. Keep the returned `lossLabel` with the simulation record. These source-adapter checks
do not establish a compiled CAD consumer, a Viewer frame or exact Surface collision.

## Keep the source identity with the pose

`assertCadProxyCurrent(proxy, currentSource, currentRevision)` and `cadProxyPose(...)` compare
the complete source string and the caller revision. A changed string with an unchanged revision
still gives `STALE_SOURCE`. A changed revision with the original string also gives `STALE_SOURCE`.
An unknown or malformed binding is not permission to display a guessed pose.

Keep the last accepted world state and frame after refusal. Re-admit the selected Surface explicitly
when the source changes, then let the host replace the world and display binding. Do not silently
reuse an old centre or apply the scale conversion twice. The documentation sample checks both
stale cases and reuse of the original valid binding without changing retained input.

For the numerical and product evidence boundaries, see
[Physics verification](/reference/physics-verification). For command timing and state retention,
see [profiles and lifecycle](./profiles-and-lifecycle).
