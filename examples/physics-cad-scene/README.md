# Native CAD Surface to Physics proxy

This bounded consumer compiles the original `two-surfaces.barocad` source through `@barocss/cad`. The optional Physics CAD adapter admits `rational_panel` as a dynamic enclosing sphere and `flat_panel` as a static control-net box with 0.01 m minimum half-extents. It gives both qualified Physics and Viewer target IDs, reports proxy loss, and converts original XYZ millimetres to simulation metres at exactly 0.001. It does not edit the native source or claim exact NURBS collision.

The page uses the real WebGPU Viewer for original weighted Surfaces. Its separate SVG side view shows derived collision shapes, position and contact. The host applies accepted Physics poses back to Viewer in millimetres. A revision-change control refuses the old binding before stepping and leaves both Physics and Viewer states unchanged. **Re-admit proxies** rebuilds the world under the new revision. The revision button changes a host token while source bytes remain the same; the compiled probe also checks changed source bytes.

With Node 22 in this workspace, build the CAD, GPU and Viewer dependencies, then start the page. Physics source is bundled by the example server; no separate Physics build is needed for the page:

```sh
pnpm --filter @barocss/cad build:library
pnpm --filter @barocss/gpu build:library
pnpm --filter @barocss/cad-interop build:library
pnpm --filter @barocss/viewer build:library
node examples/physics-cad-scene/server.mjs
```

Open `http://127.0.0.1:52885/`; set `PHYSICS_CAD_PORT` to change the port. Restart the server after Physics source edits. The separate compiled probe still needs `pnpm --filter @barocss/physics build:library` before `node examples/physics-cad-scene/cad-proxy-probe.mjs`. It checks exact native IDs, mm→m centers and proxy sizes, Viewer pose translation, first contact at step 21, source/revision refusal, unsupported Curve/model/source refusal, and accepted-world retention. The HTML page demonstrates the actual Viewer path. It is still a narrow Surface-derived proxy profile, not automatic fitting of arbitrary CAD parts.
