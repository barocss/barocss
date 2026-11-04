# Connect CAD and Viewer

Use one Physics World for one simulation. CAD, rendering and React do not own
another numerical World. This page describes the current unreleased branch and
the host boundary. CAD React is owned by a separate Work and is not inspected
or changed here. This page does not establish CAD Studio integration. Existing
Studio, manufacturing and equipment HOLDs stay.

## Data ownership

| Layer | Owns | Sends to the next layer |
| --- | --- | --- |
| `@barocss/cad` | Native geometry and geometric queries | Stable geometry references, bounds and display tessellation |
| `@barocss/cad-model/api` | Authored part definitions, IDs, units and available mass properties | A revision-bound model for an explicit Physics admission adapter |
| Host admission adapter | Unit/frame conversion, supported collision approximation and body-to-part binding | A supported SI `PhysicsModel` and `WorldOptions` |
| `@barocss/physics` | Accepted model/state, commands, fixed-step advancement and numerical failure | `PhysicsState`; optionally the existing recorder owns stepping |
| Display adapter | Mapping accepted body IDs and poses to display objects | A Viewer motion frame or GPU transform data |
| `@barocss/viewer` / `@barocss/gpu` | Camera, display resources, picking and drawing | Pixels and display interaction; no physics advancement |
| React or Studio host | Lifecycle, user commands, selection and subscription | Commands to the sole simulation owner; display requests from accepted snapshots |

Do not tessellate or rebuild CAD after every physics step. Keep the authored CAD
model and reusable display meshes. Apply transient accepted poses to those
meshes. A user command to commit a final pose to CAD would need its own document
edit/undo contract; it is outside the current simulation work.

The current CAD proxy entry is `@barocss/physics/cad-proxy`.
`admitCadSurfaceProxy` admits a selected Source-v0 Surface as a bounded box or
sphere approximation. `assertCadProxyCurrent` rejects a changed source or
revision. These APIs do not provide exact B-rep collision or a general solid-
mass/full-tensor import. CAD-model root exports no API; use the `/api` subpath.
Generic COM offsets, principal axes, full tensors and collider-local offsets
remain the G3 prerequisite before a general CAD part importer.

## Convert units and frames once

CAD lengths use mm. The CAD-model mass API uses g and g·mm². Physics uses m, kg,
s and radians. Convert length and mass by `1e-3`, inertia by `1e-9`. Return
positions to mm only in the display adapter. Keep body-local dimensions and
world-frame angular velocity, gravity, torque and impulses distinct.

For an off-origin CAD proxy, use `cadProxyPose`; translation is not just the
body centre in mm. It includes `-R(q) * sourceCenterMM`. See the independently
checked [off-origin example](./units-and-frames#off-origin-cad-proxy-example).

Viewer's `applyMotionFrame` and `applyGeometryMotionFrame` require an explicit
`{basis:'part-xyz-matches-rhyup'}` agreement and use translation in mm with XYZW
rotation. That flag does not perform a basis conversion. Choose and verify the
host frame first. Changing the camera up vector alone does not convert model
positions, rotations, gravity or inertia. The current contact examples use Y
gravity. The earlier CAD consumer kept CAD XYZ and explicitly used Z gravity;
that consumer is not proof of a general CAD-to-Viewer frame converter.

For loaded primitive Surface packets, the existing Viewer call shape is:

```ts
const pose = cadProxyPose(proxy, acceptedBody, source, revision);
viewer.applyMotionFrame(
  { contextId: 'simulation', timeSeconds: acceptedState.timeSeconds,
    poses: [pose] },
  [{ contextId: 'simulation', targetId: proxy.bodyId,
    ref: { modelId: proxy.modelId, surfaceId: proxy.surfaceId } }],
  { basis: 'part-xyz-matches-rhyup' },
);
```

This excerpt shows the existing API boundary. The host must have loaded matching
geometry, verified its basis and retained its binding. It is not a complete
React component or an arbitrary CAD assembly adapter. The current primitive packet path admits at most four geometry entries. Viewer
currently refuses overriding authored assembly poses. `examples/physics-lab/display.mjs` contains
an actual accepted-state-to-Viewer implementation for its display proxies.

## Desktop display density

`Viewer.resize(width,height)` takes backing-store device pixels. The host owns
CSS layout and DPR. A fixed640×360 backing store stretched across a desktop
canvas looks blurred even when the physics and pose tests pass.

The contact sample uses the canvas's CSS content size times actual browser DPR,
up to DPR2. It scales both axes together to retain the current public Viewer
limits: at most4096 per axis and4194304 total pixels. It floors the final device
pixel dimensions. Thus a large desktop may use a lower effective scale than2;
this does not change numerical dt, state or solver tolerance. Resize and DPR
changes must leave the accepted Physics state and clock unchanged.

Actual native `Viewer.readPixels()` covers that backing store. The sample's
640×360 nearest-centre pixel sample is only a bounded test observer; it is not
the display resolution or a second renderer. Native dimensions and byte counts
must be checked separately. Desktop DPR1 and2, layout changes, real GPU pixels
and state-word comparison belong to separate checks. Mobile is outside scope.

## Viewer and the current Studio viewport

`@barocss/viewer` already exposes `applyMotionFrame` for loaded primitive Surface
packets and `applyGeometryMotionFrame` for loaded primitive Surface/curve data.
The common World can feed those APIs through an explicit accepted-pose adapter.
Do not add another physics solver to Viewer or GPU. Viewer owns presentation;
Physics owns the numerical state and commands.

The current Studio does not use `@barocss/viewer`. Its
`apps/cad-studio/src/viewport/gpuRenderer.ts` uses `@barocss/gpu/viewer` and has
a host method `setInstanceTransforms`; `Viewport.tsx` supplies its
`instanceTransforms` map. A future Studio adapter should target that existing
host path. Adopting Physics does not require replacing the Studio renderer.
`setInstanceTransforms` is a Studio host method, not a new public Physics/GPU API.

Before Studio integration, define body-to-instance IDs, model revision, units,
frame and absolute-versus-relative placement. Kinematic/FK preview and dynamics
must not both write the same instance pose. Late Worker replies from an old
revision must not replace the current display. Camera and picking must not step
physics. No Studio source, dependency, build or screen test is changed here;
its HOLD remains.

CAD React belongs to another Work. It can later consume the same accepted-pose
contract through its own lifecycle adapter. That does not create a second
World or authorize changes to that Work in this task.

## Integrate in this order

First qualify the selected numerical profile through the public World. Next
verify a Viewer adapter with the same accepted states, independent transform
checks and actual desktop GPU pixels. CAD React lifecycle work remains with its separate owner. A future Studio
adapter should reuse the same pose contract with Studio's existing GPU viewport,
only within an authorized integration scope. Existing Studio work stays
on HOLD; this sequence does not resume its workers or change app dependencies.

Keep kinematic playback separate from dynamics. CAD-model Robot/FK paths replay
joint-space poses; they do not establish dynamic forces or contact accuracy.
Exact CAD collision, arbitrary connected mechanisms, moving eight-body contact,
real-equipment prediction and manufacturing approval remain outside the current
qualified profile. See [verification](/reference/physics-verification) and
[profiles and lifecycle](./profiles-and-lifecycle).
