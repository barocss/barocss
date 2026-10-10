# Physics public root and subpaths

| Entry | Runtime functions | Arguments and result |
| --- | --- | --- |
| Root | `createPhysicsWorld`, `createUprightCapsuleQuery`, `createUprightCapsuleController`, `PhysicsError` | Rigid config/world; immutable static-box query; bounded character controller. |
| `/cad-proxy` | `admitCadSurfaceProxy`, `assertCadProxyCurrent`, `cadProxyPose` | Exact source/revision and native Surface request; copied proxy and display pose. |
| `/replay` | `createPhysicsScene`, `createPhysicsReplaySession`, `restorePhysicsReplaySession` | Admitted config/revisions, accepted command replay and qualified restore. |
| `/fluid` | `createFluidWorld`, `PhysicsError` | Versioned 256-particle basin scene → caller-stepped world. |
| `/cloth` | `createClothWorld`, `PhysicsError` | Fixed pinned-sheet scene → copied topology/positions/diagnostics. |
| `/fluid-cad` | `createCadFluidWorld`, `PhysicsError` | Version 1 fluid scene, original CAD text/request → static-box obstacle world. |

## Rigid world signatures

`createPhysicsWorld(config:PhysicsWorldConfig):PhysicsWorld` takes `fixedStepSeconds`, `gravityMps2`, `bodies`, optional bounded joints and opt-in profile fields.

`getState():PhysicsState` and `step(fixedStepSeconds:number,commands?:PhysicsStepCommand[]):PhysicsState` return copies. `overlapSphere(query):string[]` returns matching body IDs. `raycast(query):PhysicsRayHit|null` returns body ID and distance in metres. `dispose():void` is idempotent. The rigid interface has no reset method; create a new world for a fresh baseline.

Commands are force, impulse, torque, angularImpulse or kinematicTarget. Shape unions are sphere, box and capsule. Type-level shape existence does not admit every pair/profile combination.

[Public rigid signatures and type fields](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/src/types.ts) · [Actual root re-exports](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/src/index.ts)

## Subpath declarations

[CAD proxy entry](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/src/cad-proxy.ts) · [Replay entry](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/src/replay.ts) · [Fluid entry](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/src/fluid.ts) · [Cloth entry](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/src/cloth.ts) · [Fluid CAD entry](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/src/fluid-cad.ts)

Fluid/cloth worlds expose `getState`, `step`, `reset` and `dispose`; their exact dt, state arrays and numerical acceptance gates belong to those profiles. CAD fluid step/reset additionally require current source text/revision. Replay session step takes command frames under its saved fixed step.

Root public types include vectors/quaternions, shapes, config/command/joint/body/contact/event/state/query/world types and capsule-query/controller types. Each subpath re-exports only its declared binding/scene/result/session types. Internal solver/body records are not consumer APIs even when their defining module uses `export` internally.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/README.md)
