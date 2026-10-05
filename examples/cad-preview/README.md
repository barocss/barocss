# Native CAD to GPU preview

This local consumer imports the built private `@barocss/cad` and
`@barocss/gpu` ESM APIs. It creates no new package.

## Run

From the repository root:

```sh
pnpm --filter @barocss/cad build:library
pnpm --filter @barocss/gpu build:library
node examples/cad-preview/server.mjs
```

Open the loopback URL printed by the server. Select a fixture, edit its model
source, then apply it. Grid counts, scene scale, scene translation and color
are host controls. Source text is parsed as the bounded CAD grammar. It cannot
provide scripts, callbacks, shaders, imports or remote resources.

The quarter-cylinder source has radius 10 mm and height 30 mm along Y. Its
control points are authored in these axes. GPU has no rotation API. The other
fixtures are an asymmetric plane with U domain `[-2,3]` and V domain `[4,6]`,
and a rational nonplanar patch. The supplied control-point and rational-weight
edits change actual native geometry. A grid edit changes only its preview.

## Data and units

1. Source text creates the native NURBS model in millimetres.
2. CAD evaluates the selected surface on a U-major grid. It produces packet v0
   and a finite sampled approximation report. Preview normals average incident
   triangle normals; they are not exact NURBS derivative normals.
3. Both CAD and GPU validate the actual generated packet. The host specifies
   `mmToSceneUnit` and translation in scene units. No unit is inferred and no
   camera fitting occurs. Canonical model and packet coordinates stay in mm.
4. GPU renders the packet with its fixed camera and shaders. The application
   adopts source, model, report, packet and revision only after success. A
   rejected candidate retains the previous accepted state and usable frame.
   Context loss makes the preview explicitly unavailable.
5. IGES comes from the accepted native model, not from preview triangles. It
   describes open geometry and is not a manufacturing solid.

The report checks five points per mesh cell. `maxSampledDeviationMM` is the
largest measured distance at those probes. `certified` is false. The report
does not establish a global error bound, exact normals or export compatibility.
The existing independent OCP exchange consumer remains the exchange gate.

## Verify and retain evidence

```sh
node examples/cad-preview/test.mjs
PW_DIR=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node examples/cad-preview/browser.mjs
BAROCSS_CAD_PYTHON=/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/bin/python pnpm --filter @barocss/cad test:exchange
```

The browser runner retains artifacts outside the checkout: authored source,
native model, actual generated packet/report, explicit options, native IGES,
actual framebuffer PNG, fixed shaders and backend metadata. Its manifest pairs
each accepted revision with hashes and the exact task or merge SHA. Capture
timestamps and backend metadata can vary; native source replay is deterministic.

Browser controls compare real pixels after source, rational-weight, grid and
scene-transform edits. They also check rejection preservation, context loss,
resize, repeated updates and owned-resource disposal. Software WebGL proves
functional composition. It does not measure physical GPU performance.
