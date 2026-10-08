# CAD shelf and water particles

This example tests the first fixed CAD obstacle for 3D water particles. The blue Surface is the source CAD geometry. Physics uses a labelled axis-aligned box derived from its control net. The Viewer draws the Surface and 256 Physics particles in one WebGL2 canvas.

From the repository root, build the Viewer dependencies once, then start the example:

```sh
pnpm --filter @barocss/cad build:library
pnpm --filter @barocss/cad-interop build:library
pnpm --filter @barocss/gpu build:library
pnpm --filter @barocss/viewer build:library
node examples/physics-scene/fluid-cad-viewer/server.mjs
```

Open `http://127.0.0.1:52955/`. Physics comes from `packages/barocss-physics/src/fluid-cad.ts`; editing that source needs only a server restart. Select the shelf or no-collision mode. Use play, pause, one step and reset. The page shows the exact particle-position SHA-256, per-step box projection count, CAD body ID and approximation label. It also shows warm p95 CPU time for `world.step()` and for synchronous Viewer frame submission after the first 30 samples. Viewer submission time does not measure GPU completion. The stale-source control passes a changed revision and checks that the solver state and rendered pixels stay the same.

For the compiled package contract, build Physics and run `node examples/physics-scene/fluid-cad-shelf-probe.mjs`. The probe checks source admission, invalid configs, copied state, stale revision/text refusal, no accepted particle centre inside the radius-expanded box through 240 steps, repeat hashes and measured step cost. [Browser evidence](../evidence/fluid-816-cad-shelf-2026-10-09.md) records the actual Viewer flow.

The box is one fixed approximation. It is not an exact Surface collider. This example does not claim continuous collision detection, moving CAD, v2 viscosity with an obstacle or measured fluid pressure.
