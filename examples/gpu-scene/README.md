# Local GPU scene example

Build the GPU package, then start the static host from the repository root:

```sh
pnpm --filter @barocss/gpu build:library
pnpm dev:gpu
```

`pnpm dev:gpu` runs `examples/gpu-scene/source-server.mjs`, which starts
`server.mjs` on `http://127.0.0.1:5180` (`PORT` selects another port). The
server binds to 127.0.0.1 and serves only exact local example routes with a
strict CSP. It has no model endpoint.

- `/` — the scene language on the `@barocss/gpu` viewer (WebGPU). The textarea
  is parsed as scene data (`showScene`); it is never evaluated as code or HTML.
  The source header picks its version (`version: 1;` for rotation and the
  further primitives). Apply accepts valid changes and shows diagnostics for
  invalid ones while keeping the accepted scene; Reset restores the sphere/box
  fixture.
- `/mesh.html` — host triangle packets (`mesh-fixtures.mjs`) in millimetres,
  scaled into the scene and drawn on the same viewer.

The other scripts here are Node flows over the package's CPU data APIs: scene
sources and their arithmetic, conditionals and repeats; primitive geometry
builders; material compilation and evaluation; engine-scene preparation,
raycasts and clips; boolean, Shell and contact buffers; loft and curve edit
previews; native light catalogs and UV01 surface data; and frame preflight.
Each runs with `node examples/gpu-scene/<name>.mjs` against the built package
and prints or asserts its own results.

The old WebGL2 scene and mesh renderers and their browser evidence flows were
removed with the renderers; the viewer core has its own browser tests in
`packages/barocss-gpu/tests/`.
