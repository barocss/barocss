# Qualified native Surface and public Physics cloth

This bounded example consumes genuine `createClothWorld` states from public
`@barocss/physics/cloth`, through step240 at the fixed1/120s host step. The
explicit Run proof action submits the exact nine-field Viewer cloth DTO beside
the original authored #979 NURBS panel, compiled from HTTP source by public
Loader. The host adds layer/context identity and copies the producer arrays.
It does not submit velocities, diagnostics or collider fields to Viewer.

One canvas uses `mmToSceneUnit:0.0013`: each metre coefficient reaches scene
coordinates through `positionsM * 1000 * mmToSceneUnit`. The native source
is XYZ/mm with authored signed-zero knots and original Surface identity/UVs.
The front/back buttons expose both shared-depth directions. Native picking
and fits use original native geometry only and can ignore visible cloth
coverage/extent. This display does not certify CAD collision or fabric physics.
There is no RAF loop or playback controller; #981 owns that separate scope.

Use Node22. Ordinary development uses public package names and their source
default exports, without custom conditions or aliases:

```sh
node examples/viewer-cloth-scene/server.mjs
```

Open <http://127.0.0.1:52980/> and use Run proof. The server bundles once. Its
metafile audit at `/input-audit.json` requires own source inputs and zero own
dist inputs in this default mode.

The explicit compiled acceptance checkpoint requires current compiled outputs
for Viewer, Physics and their CAD/Loader/GPU dependencies. It maps every own
public package entry and subpath through `publishConfig.exports.import`,
including transitive imports. It refuses any missing compiled mapping. This
test-only resolver is separate from ordinary development resolution:

```sh
VIEWER_CLOTH_COMPILED=1 node examples/viewer-cloth-scene/server.mjs
```

The compiled audit requires own dist inputs and zero own src inputs. Both modes
print the mode and full input audit. `VIEWER_CLOTH_PORT` changes the HTTP port;
`VIEWER_CLOTH_EVIDENCE` optionally records the browser's `/result` POST JSON.
The server also serves the original authored fixture as
`/original-panel.barocad`. No packet is fabricated by the host or server.

`window.viewerClothProbe` exposes the public Viewer/world, genuine copied
`frames[0..240]`, producer snapshots0/60/240, `frameFromState`, front/back
cameras, qualified `ref`, native reload helper, pose helper, public GPU
constructors for method-argument instrumentation, actual GL uploads/draws,
pixel/resource/error snapshots, `runProof()` and `dispose()`. Frame inputs and
`getState().clothFrame` remain separate copies. The public constructors allow
an acceptance runner to observe F64 scene arguments without private renderer
reflection. Buffer instrumentation independently reads actual GL buffer data.

Run proof records source preservation, step0/60/240 hashes, independent native
and cloth depth controls, canonical upload bytes, copy/idempotence checks,
malformed/identity/stale/area/F32/allocation refusals, retaining camera/pose
routes, qualified material and genuine256-fluid compatibility, native source
replacement, explicit reset and30 distinct submission timings after warmup.
Test-only buffer readback is disabled for the timing samples; resource/draw
counters remain. The timing measures Viewer submission wall time. It excludes solver time,
completion wait and any GPU execution/FPS claim. A first failure remains in
the result with completed case counts and no implicit disposal, so it can be
inspected before repair.

Dispose releases the Viewer and the caller-owned Physics worlds and records
the remaining seven GL resource classes; it is separate from context-loss
testing. Lose context invokes the actual `WEBGL_lose_context` extension.
The lost Viewer retains copied CPU cloth metadata until disposal, while GPU
mutations refuse. Use a separate fresh page for that lifecycle check to keep
normal disposal and lost-context evidence distinct. Browser execution, native
author completion, Integration and publication require separate receipts.
