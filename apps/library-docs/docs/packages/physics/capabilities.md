# Physics capability and example map

Choose a bounded profile, then use its existing host. Physics owns simulation; the caller owns time, display and recovery. An exported symbol, a private experiment and a visible consumer establish different things.

**Audit:** 2026-10-11, source [98955db7d1c8aa85ecadb789d00c6f4916178d04](https://github.com/barocss/barocss/commit/98955db7d1c8aa85ecadb789d00c6f4916178d04), package `0.0.0-experimental`. The [manifest](https://github.com/barocss/barocss/blob/98955db7d1c8aa85ecadb789d00c6f4916178d04/packages/barocss-physics/package.json) exposes TypeScript source through ordinary package imports to a TypeScript-capable workspace host, without a custom condition. Plain Node cannot resolve internal source `.js` specifiers to `.ts`. The separate `publishConfig` selects compiled JavaScript/declarations; neither configuration proves npm availability.

The existing Manual playground/snippets intentionally retain **`5f5ad866205a21510ac69552e704cc162fa253b5`**, not this newer audit head. Their pinned-source builder preserves that distinction. Standalone commands below consume their checkout's dependencies; use the audited checkout for this map. Historical measurements keep their original heads and runtimes.

[Overview](./) · [Examples](./examples) · [Limits and lifecycle](./limits) · [Canonical roadmap](https://github.com/barocss/barocss/wiki/Physics-Product-Roadmap)

## Capability and delivery status

“Available” means admitted public source, not arbitrary combinations. “Native measured” names retained execution evidence; “adoption” identifies code integration, not a new run. “Live consumer” means an implemented, previously exercised host, not a deployed service or fresh browser result.

| Profile / public availability | Native measured result | Exact adoption | Real live consumer | Current integration validation | Publication |
| --- | --- | --- | --- | --- | --- |
| Rigid contacts/joints: **available**, `createPhysicsWorld` from `@barocss/physics` | [#775 historical bounded gate](https://github.com/barocss/barocss/issues/775#issuecomment-6060693170), [#939 offset fixture](https://github.com/barocss/barocss/issues/939#issuecomment-6077079018); [#1310](https://github.com/barocss/barocss/issues/1310#issuecomment-6097942168) measures one sphere at steps 1/20 and refusal, not contacts | Manual native `a310bd75` adopted at `18a30a463cfc4e2fa947c5ae4d057bc4d13ac659` ([receipt](https://github.com/barocss/barocss/issues/1310#issuecomment-6098008407)); no single aggregate adoption claim for every rigid feature | [Manual sphere](/playground#physics-step) and separate [Surface/joint hosts](#rigid-contacts-and-joints) | #1310 pending under #1254/#674; historical rigid gates do not certify this head | Source present at audit commit; npm/site deployment unverified |
| Visual water: **available**, `/fluid` and `/fluid-cad` | [#871 native playback](https://github.com/barocss/barocss/issues/871#issuecomment-6066151999): frozen v1/v2/shelf hashes and six browser trials | Native `6818e5a4` delta adopted at `9d9ac7e7`, merged at `0653f4b1889e8cb89ff7871081aa478cd610f307` ([receipt](https://github.com/barocss/barocss/issues/871#issuecomment-6066330327)); README context separately preserved | Existing basin and CAD-shelf Viewer hosts; bounded WebGL2 playback recorded | Historical merged-head numeric/browser gates passed at `0653f4b1`; current-head validation not run here | Source present; npm/site deployment unverified |
| Visual cloth: **available**, `createClothWorld` from `/cloth` | [#981 native GO](https://github.com/barocss/barocss/issues/981#issuecomment-6094230974), measured `a8a4a61f`: all 241 states, source/compiled/browser bits, actual pixels and lifecycle | Native `20626afe` adopted at `ba443963406774afd447f45cc2bf6019cc0d16a4`, all 3293 owned paths checked ([receipt](https://github.com/barocss/barocss/issues/981#issuecomment-6094719198)) | Existing [cloth Viewer](#visual-cloth), actual Play/Pause/OneStep/Reset, front/underside and recovery | Merged; integration validation pending under #674 | Source/proof present; npm/site deployment unverified |
| Controlled capsule: **available**, root `createUprightCapsuleController` / `createUprightCapsuleQuery` | [#1065 native GO](https://github.com/barocss/barocss/issues/1065#issuecomment-6094492409), measured `b65b6c75` plus `a07a6692` readback: seven × 241 states, overlap refusal, real Viewer controls/pixels | Native `c9083c71` adopted at `deff1d1baaa17b8fdbd4f8ce2b6b64aef73b6df1`, all 955 owned paths checked ([receipt](https://github.com/barocss/barocss/issues/1065#issuecomment-6094719564)) | Existing [capsule Viewer](#controlled-capsule), actual native playback and recovery | Merged; integration validation pending under #674; native cost is not current-device performance | Source/proof present; npm/site deployment unverified |
| Two disjoint dynamic hinges (HINGE2): **planned / public NO_GO**, #1489 → #1490 | Internal saved-phase proof at `98955db7`; local public candidate stops on step-77 angle discrepancy ([blocker](https://github.com/barocss/barocss/issues/1489#issuecomment-6111755791)) | Internal slice adopted at audit head; local public `7178434a` **not adopted** | #1490 blocked; no qualified live public World host | Public trajectory/repeat/compiled/compatibility gates incomplete | Internal slice in Git; public activation **not published**; no registry/release claim |

Source links below are pinned to the audit commit. Original author runs, exact adoption, current integration acceptance under [#674](https://github.com/barocss/barocss/issues/674)/[#1254](https://github.com/barocss/barocss/issues/1254), and Git/npm/site publication remain separate. This map reuses receipts without rerunning solver/browser campaigns. Older cloth/capsule READMEs saying “pending adoption” are superseded by the exact receipts above, not by a new runtime claim.

## Rigid contacts and joints

Use `createPhysicsWorld`, `PhysicsError` and type `PhysicsWorldConfig` from `@barocss/physics`. The [audited package contract](https://github.com/barocss/barocss/blob/98955db7d1c8aa85ecadb789d00c6f4916178d04/packages/barocss-physics/README.md) and [joint admission](https://github.com/barocss/barocss/blob/98955db7d1c8aa85ecadb789d00c6f4916178d04/packages/barocss-physics/src/joints.ts) define exact combinations. Capacity is not numerical qualification.

- Default: 1–32 bodies, at least one dynamic, at most 3600 steps, fixed interval 1/240–1/30 s and 64 commands per step. Shapes are spheres, oriented boxes and local-Y capsules. Admitted contact families are sphere/sphere, sphere/box, sphere/capsule, box/box, capsule/box and capsule/capsule. At the audit pin, each body kind can carry these shapes; pair selection requires at least one dynamic body and excludes joint-connected pairs. Static/kinematic pairs do not resolve each other. This source admission is broader than the older sphere-only kinematic README wording and does not supply new measured coverage
- Default contact is an approximate one-point manifold. Opt-in `persistent-box-v1` has at most four bodies and up to four cached face-contact points. Named centred/offset stack fixtures are not arbitrary stable-stack acceptance
- `large-v1` allows up to 64 bodies with `broadPhase:'aabb'`, excluding joints, CCD and persistent-box mode. Its 63-sphere floor receipt is not general stack qualification
- Anchored joints: up to eight fixed/hinge records, static/kinematic A and unique dynamic B, initially coincident anchors within 1e-6 m. Hinge limits lie within ±π/2 and include zero. Motor/reaction caps are bounded; connected pairs do not collide
- Dynamic joints: exactly two dynamic spheres and one fixed or hinge joint, no additional bodies/joints. The coincident hinge requires zero gravity/motion, identity orientations, zero local anchors and axis-only angular commands. The separate offset hinge fixes two 1 kg spheres of radius 0.1 m at ±0.1 m X, +Z hinge, limits ±0.8 rad, target 0.5 rad/s, motor/reaction caps 0.0001/0.01 N·m·s. Its measured fixture uses 1/120 s; public admission retains the world's general 1/240–1/30 s interval, without extending measured coverage to other intervals. This is not HINGE2
- CCD is opt-in: one dynamic sphere against 1–8 static boxes; two dynamic spheres with only one marked CCD and zero gravity; or one axis-aligned dynamic box against one static axis-aligned box. No joints or general capsule/oriented-box CCD. Read the package contract for each profile's remaining exclusions

Start with the [fixed-step recipe](./examples#advance-a-rigid-world-explicitly) and [live sphere](/playground#physics-step). After normal workspace dependency setup with Node 22+:

```sh
pnpm --filter @barocss/library-docs dev --host 127.0.0.1
```

Open `/playground#physics-step` at the printed URL. Advance 1, Reset, Advance 20 shows copied CPU state in a **host Canvas2D XY projection**. Y=0 is a reference, not a collider. The [CPU receipt](https://github.com/barocss/barocss/blob/98955db7d1c8aa85ecadb789d00c6f4916178d04/apps/library-docs/evidence/host-samples-physics-cpu.json) and [native browser checkpoint](https://github.com/barocss/barocss/blob/98955db7d1c8aa85ecadb789d00c6f4916178d04/apps/library-docs/evidence/host-samples-checkpoint.md) establish that task, not collisions or long-run stability.

For separate contact/joint previews, follow the [native-Surface host README](https://github.com/barocss/barocss/blob/98955db7d1c8aa85ecadb789d00c6f4916178d04/examples/physics-viewer-scene/README.md): build CAD, GPU, CAD interop, Viewer and Physics using their existing `build:library` scripts, then:

```sh
node examples/physics-viewer-scene/server.mjs
```

Default route: `http://127.0.0.1:52884/`. `/joint-demo.html`, `/motor-demo.html`, `/dynamic-hinge-demo.html` and `/offset-hinge-demo.html?step=120` select bounded fixtures. The base host bundles Physics source; older joint pages use compiled packages. These historical reference consumers have their own entry-resolution requirements; they are not newly checked compiled graphs at the audit head. Do not replay old probes as current acceptance without checking their public mappings.

[#775](https://github.com/barocss/barocss/issues/775#issuecomment-6060693170) remains valid historical pinned bounded release-candidate evidence, not current general-engine or registry acceptance. [#1399 physical `NUMERICAL_NO_GO_WORLD`](https://github.com/barocss/barocss/issues/1399) remains a failure despite experimental closure; [#1572's stable-stack gate](https://github.com/barocss/barocss/issues/1572) is separate.

## Visual water

Public entries: `createFluidWorld` from `@barocss/physics/fluid`; `createCadFluidWorld` from `@barocss/physics/fluid-cad` for its separate obstacle profile.

Exactly 256 particles use the fixed 0.7 × 1.3 × 0.5 m basin, 1/120 s and at most 3600 steps. Version 1 is the base visual profile; version 2 requires `visualViscosity:{kind:'xsph',coefficient:0.15}`. Initial centres need at least 0.025 m spacing. CAD water supports version 1 and one static axis-aligned box with no initial particle overlap, checking exact source text and revision before later steps/resets. No moving obstacle, emitter, two-way rigid coupling, reconstructed surface or calibrated CFD/viscosity.

After the [water host's documented dependency builds](https://github.com/barocss/barocss/blob/98955db7d1c8aa85ecadb789d00c6f4916178d04/examples/physics-scene/fluid-viewer/README.md):

```sh
node examples/physics-scene/fluid-viewer/server.mjs
```

Open the printed local URL. The [CAD-shelf host](https://github.com/barocss/barocss/blob/98955db7d1c8aa85ecadb789d00c6f4916178d04/examples/physics-scene/fluid-cad-viewer/README.md) is separate. These legacy hosts bundle Physics source directly and built display dependencies, not a wholly package-import compiled graph. [#871 evidence](https://github.com/barocss/barocss/blob/98955db7d1c8aa85ecadb789d00c6f4916178d04/examples/physics-scene/evidence/fluid-871-playback-2026-10-09.md) separately records the independent built-package Viewer consumer.

Copy metre positions into the declared Viewer fluid bridge; do not pre-scale a metre DTO. The displayed basin Surface is not itself collision geometry. `reset()` restores the profile; `STALE_SOURCE` preserves accepted CAD-water state. Invalid config/step, numeric/work limits and disposal remain explicit errors. Dispose simulation and display separately. Historical solver p95/playback ratios are machine/profile observations, not GPU completion or FPS.

## Visual cloth

Public entry: `createClothWorld` from `@barocss/physics/cloth`, profile `pinned-sheet-sphere-v1`, version 1, basis `right-handed-xyz-metres`. Six exact input fields include revision and `fixedStepSeconds:1/120`.

The fixed 1 m square sheet has 289 vertices, 512 triangles and two pins; its static sphere has radius 0.3 m, centre `[0,0.1,0]` m and contact offset 0.002 m. Maximum 240 steps. Positions/velocities/topology are copies. Candidates require finite bounded state, structural extension ≤10%, envelope penetration ≤1e-6 m and exact pins. Violations use `NUMERIC_LIMIT`, wrong time `INVALID_STEP`, excess work `WORLD_LIMIT`. Sampled triangle loss ≤0.002 m is a separate display gate, not continuous contact or calibrated fabric. No arbitrary mesh, self-collision or tearing.

Use the [actual cloth Viewer host](https://github.com/barocss/barocss/blob/98955db7d1c8aa85ecadb789d00c6f4916178d04/examples/physics-cloth-viewer/README.md), with Node 22+ and normal workspace dependencies:

```sh
node examples/physics-cloth-viewer/setup.mjs
node examples/physics-cloth-viewer/server.mjs source
```

Setup creates declared workspace links; open the printed URL. The explicit `compiled` mode requires the original transitive library builds and complete public `publishConfig` maps, without source fallback.

Submit the nine-field `ViewerClothFrameV0` in **metres**, with stable layer/context/revision/step identity. Viewer applies `1000 × mmToSceneUnit` once; native CAD remains millimetres. The reference panel is not a collider; the sphere is a projected guide without depth, not native geometry. Two real worlds stage updates. Clear-then-submit Reset is non-atomic and can leave empty display/old accepted CPU state. Context loss pauses/disposes Viewer; explicit Reset after restoration rebuilds on the same caller canvas. Cloth exposes `reset()` and idempotent `dispose()`; later calls refuse `DISPOSED`.

The retained [#981 receipt](https://github.com/barocss/barocss/issues/981#issuecomment-6094230974) measures actual source/compiled/browser state and WebGL2 pixels, with sampled maximum triangle penetration 0.0013840839157666096 m. This is not a new run on this checkout.

## Controlled capsule

Public root entries: `createUprightCapsuleController` and the separate `createUprightCapsuleQuery`. This controlled upright character against static boxes is distinct from the rigid capsule solver.

`upright-capsule-controller-v1` fixes radius 0.15 m, centreline half-length 0.35 m (total height 1 m), world Y, gravity −9.81 m/s², skin 0.002 m, step height 0.1 m and walkable slope 10°. It admits 0–32 static boxes, exactly 1/120 s per command and 240 steps. Desired velocity has zero Y and horizontal speed ≤1 m/s. Query displacement norm ≤2 m does not raise controller speed. No moving platforms, dynamic pushing, arbitrary orientation or exact CAD collision.

Use the [capsule Viewer host](https://github.com/barocss/barocss/blob/98955db7d1c8aa85ecadb789d00c6f4916178d04/examples/physics-character-viewer/README.md), after normal Node 22+ workspace setup:

```sh
node examples/physics-character-viewer/setup.mjs
node examples/physics-character-viewer/server.mjs source
```

Open the printed URL. `compiled` is a separate complete public-map mode requiring original library builds. Seven accepted scenes and overlapping-start refusal are retained in [RESULTS.md](https://github.com/barocss/barocss/blob/98955db7d1c8aa85ecadb789d00c6f4916178d04/examples/physics-character-viewer/RESULTS.md); later adoption receipts supersede its pending-adoption label.

Accepted controller metres become pose millimetres once; Viewer then applies mm-to-scene mapping. Original CAD Surfaces/source ledger remain display authority; unchanged box data governs collisions. Initial penetration uses `INITIAL_OVERLAP`, stale revision `STALE_SNAPSHOT`, wrong time `INVALID_STEP`, malformed commands `INVALID_COMMAND`, excess work `WORLD_LIMIT`. Refusals retain accepted state. Recreate the controller for Reset/new runs; no state-restoration API. Dispose explicitly; later calls refuse.

A late Viewer failure can leave CPU advanced and the prior frame displayed. The host pauses, reports separate cursors and requires Reset; failed reset presentation can make display uncertain. Native recovery evidence does not make CPU/GPU updates atomic or prove current integrated Save/Open.

## Planned public HINGE2

[#1489](https://github.com/barocss/barocss/issues/1489) is the selected two-disjoint-hinge activation path; [#1490](https://github.com/barocss/barocss/issues/1490) is its dependent World/Viewer host. Neither is a working quickstart. Public dynamic joint admission at this audit pin still restricts the existing profile to one joint between exactly two dynamic spheres.

The [published internal slice](https://github.com/barocss/barocss/issues/1489#issuecomment-6111563583) at `98955db7` establishes saved-phase mapping only, without public admission or World orchestration. The [local candidate blocker](https://github.com/barocss/barocss/issues/1489#issuecomment-6111755791) at `7178434a0440d9dcce0be8c602cf3ba4f8ee5068` records the first source-run discrepancy at step 77: both hinge angles differ from the historical bank by one ULP. Later trajectory/repeat/compiled/compatibility gates remain unrun. Node 22.22.0 on the current Linux runtime also reproduces the scalar discrepancy; historical runtime provenance remains unresolved. Matching final body bytes do not prove identical preprojection angle operands.

Status remains **public NO_GO / host blocked**, without changing tolerance, historical evidence or numerical law. No HINGE2 config/command is offered here. Add #1490's final live entry only after actual public qualification and separate host delivery. Advanced soft work [#826](https://github.com/barocss/barocss/issues/826), [#1003](https://github.com/barocss/barocss/issues/1003), [#1004](https://github.com/barocss/barocss/issues/1004), [#1005](https://github.com/barocss/barocss/issues/1005) and [#1006](https://github.com/barocss/barocss/issues/1006) remains conditional research/delivery, not additional public profiles.

## Units, errors and lifecycle

Physics uses right-handed XYZ, metres, kilograms, seconds and radians. CAD/Viewer native geometry uses millimetres: convert a pose at its documented host boundary once. Metre cloth/fluid DTOs stay metres because their bridge owns conversion. Preserve declared bases rather than silently relabelling CAD frames. Simulation proxies/display meshes do not replace original native geometry.

Use `PhysicsError.code` from the same imported graph, not message matching or cross-bundle constructor identity. See [limits and lifecycle](./limits) for codes and [guides](./guides) for fixed clock, proxy/replay ownership. Worlds start no timer/renderer. States/snapshots are copies; invalid candidates retain accepted producer state, without rolling back earlier accepted steps or separate display operations. Rigid Reset means admitting a fresh world and disposing the old one; fluid/cloth expose `reset()`; controller Reset means a new instance. Close simulation and host-owned display resources.
