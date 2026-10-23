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
Each takes `--output <fresh-directory>` and prints or asserts its own results.
Run them all with:

```sh
node examples/gpu-scene/run-flows.mjs [--only <regex>] [--out <new-directory>] [--no-build]
```

It builds `@barocss/cad` and `@barocss/gpu`, then runs each flow with a fresh
output and the gpu tests' hook (`packages/barocss-gpu/tests/cad-dist.mjs`)
through `NODE_OPTIONS`: in the workspace `@barocss/cad` resolves to CAD's
TypeScript sources, which Node does not load, so a flow run on its own needs
`NODE_OPTIONS="--import ./packages/barocss-gpu/tests/cad-dist.mjs"` too.

The old WebGL2 scene and mesh renderers and their browser evidence flows were
removed with the renderers; the viewer core has its own browser tests in
`packages/barocss-gpu/tests/`.
