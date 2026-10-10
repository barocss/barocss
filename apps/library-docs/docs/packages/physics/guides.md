# Own time, proxies and visual layers

## Advance a fixed clock

Accumulate host frame time and request admitted fixed steps. Each step accepts at most 64 commands. Force/torque acts for one step; impulse/angular impulse acts once. Only dynamic bodies accept those commands. A kinematic target is an absolute metre position for this step. Input command order does not change the validated result. Reject invalid commands before treating a candidate step as accepted.

## Admit a CAD proxy

Use `/cad-proxy` with the complete original Source0 string, original Surface reference and caller revision. `admitCadSurfaceProxy` derives a conservative labelled sphere/box proxy from native control-net bounds. Keep source center, shape-loss label and exact source/revision association. Before using later poses, `assertCadProxyCurrent` checks both text and revision. Re-admit after a source edit; do not silently reuse a stale proxy.

`cadProxyPose` maps an accepted body pose back to Viewer millimetres, including rotation around source center. The host applies the copied frame. The original Surface stays native/display authority; simulation collisions belong to the proxy.

## Choose visual water or cloth

`/fluid` creates one 256-particle fixed basin. `/fluid-cad` adds one admitted static box obstacle for its version 1 water profile. These are visual approximations, without calibrated flow/pressure guarantees.

```ts
import { createClothWorld } from '@barocss/physics/cloth';
const cloth = createClothWorld({
  format: 'barocss-cloth-scene', version: 1, revision: 'sheet-v1',
  basis: 'right-handed-xyz-metres', fixedStepSeconds: 1 / 120,
  profile: 'pinned-sheet-sphere-v1',
});
try {
  const state = cloth.step(1 / 120);
  console.log(state.positionsM.length, state.triangles.length);
} finally { cloth.dispose(); }
```

The sheet has fixed topology and pins. Returned vertices/triangles are copies for caller display. The static sphere is simulation identity, not a native CAD Surface.

## Save a command replay

`/replay` saves an admitted scene plus accepted command frames. Restore validates scene/config/source identity, replays in a new world and compares final state. This is not arbitrary state injection or cross-platform bitwise determinism. Dispose replay sessions when their document closes.

## Query before moving a character

`createUprightCapsuleQuery` queries immutable static boxes without advancing a world. The separate `createUprightCapsuleController` uses that query to move its fixed upright character profile. Do not treat either as an arbitrary capsule or dynamic-character solver.

`packages/barocss-physics/package.json` (Manifest and version; local source) · `packages/barocss-physics/README.md` (Package task notes; local source)
