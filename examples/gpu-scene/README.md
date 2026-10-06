# Local GPU scene example

Build the private package, then start the loopback server from the repository root:

```sh
pnpm --filter @barocss/gpu build:library
node examples/gpu-scene/server.mjs
```

Open `http://127.0.0.1:5180`. `PORT` can select another port. The server binds to
127.0.0.1 and serves only three exact local routes. It has no model endpoint.
The textarea is parsed as scene data; it is never evaluated as code or HTML.
Apply accepts valid changes and displays diagnostics for invalid changes while
keeping the accepted scene. Reset restores the authored sphere/box fixture.

Run the real browser evidence suite with the installed Chrome and bundled
Playwright (no browser download):

```sh
PW_DIR=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm --filter @barocss/gpu test:browser
```

`BAROCSS_GPU_EVIDENCE_DIR` selects a retained evidence directory. Each fixture
retains source, validated scene, generated shaders, PNG, and JSON hashes/readback
assertions. Software WebGL is functional evidence, not physical GPU or performance
proof. Missing Chrome or WebGL2 fails the suite.

The additive host mesh example is at `/mesh.html` on the same loopback server.
It uses independently authored analytic/literal preview packets and explicit
millimetres-to-scene conversion. It does not import the CAD package or alter the
sphere/box source grammar. The host fixture documents its coordinate reorientation;
the renderer has no rotation or automatic camera fitting.

## Source1 rotation prototype

The CAD preview's minimal Example menu includes **GPU · Rotated box** at
`/#rotated-box`. It calls the original GPU compiler with explicit source1 and
uses the existing runtime mouse-orbit camera. See the GPU package README for
syntax, angle bounds and transform order.

Focused rerun (with existing Chrome and Playwright installations):

```sh
pnpm --filter @barocss/gpu build:library
PW_DIR=<installed-runtime> CHROME=<installed-chrome> BAROCSS_ROTATION_EVIDENCE=<output-dir> node examples/gpu-scene/rotation-smoke.mjs
```

The preview server also needs the existing built CAD module graph. The smoke
uses a fresh loopback port and closes its own server/browser. Screenshots and
index.json contain source, ranged AST, owned IR2/execution, camera, backend and
exact HEAD. Broader suites are deferred under the prototype policy.

## Source1 capped cylinder prototype

The root Example menu includes **GPU · Cylinder** at `/#cylinder`. It uses the
same explicit source1/IR2 path as rotation, with radius and full local Y height.
After the affected GPU build, run `examples/gpu-scene/cylinder-smoke.mjs` with
PW_DIR, CHROME and BAROCSS_CYLINDER_EVIDENCE. This short actual browser run also
checks unchanged source0/source1 sphere/box shader controls. The preview server
needs the existing built CAD graph; no native cylinder capability is claimed.

## Source1 capsule prototype

**GPU · Capsule** at `/#capsule` uses local start/end/radius and existing rigid
rotation. After the affected GPU build, run `examples/gpu-scene/capsule-smoke.mjs`
with PW_DIR, CHROME and BAROCSS_CAPSULE_EVIDENCE. One actual browser run checks
axis/oblique segment and rounded-end distances, source edits, retained invalid
frames and exact old source0/rotation/cylinder shader controls. It requires the
existing built CAD module graph for the preview server; no native CAD capability
or physical GPU performance is claimed.
