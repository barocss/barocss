# @barocss/gpu (private experimental v0)

An independent CSS-shaped scene language and original WebGL2 SDF renderer.
This package has no React, Three.js, GSS, CAD or existing utility-class dependency.
It is private, additive and not a claim of CSS/GSS compatibility or production readiness.

## Supported language

```css
@scene demo {
  version: 0;
  background: #101820;
  sphere #ball;
  box #cube;
}
sphere { radius: 1; color: #e08040; }
#ball { translate: -1 0 0; }
#cube { size: 1 2 1; translate: 1 0 0; color: #4090e0; }
```

Exactly one scene, mandatory version 0, ASCII names/IDs, unique object IDs.
Comments and whitespace are permitted. One type selector (`sphere`, `box`) or ID
selector per style rule. No inheritance, classes, groups, lists, pseudo selectors,
URLs, expressions, scripts, arbitrary shaders or silently ignored syntax.
`background` is scene-only; `color` is opaque #rgb/#rrggbb. Numeric vectors have
exactly three whitespace-separated components, without units. `radius` is sphere-only;
`size` is box-only and specifies full extents. `translate` applies to both shapes.
Defaults: background #101820, object color #e08040, radius 1, size 2 2 2,
translation 0 0 0. ID specificity wins over type; later declarations win ties.
Repeated style properties are allowed. Duplicate scene version/background,
unknown IDs/properties/selectors and properties applied to the wrong shape fail.

Limits: 64 KiB UTF-8 source, 32 objects, 128 rules, 512 style declarations,
finite numbers, coordinates with absolute value <=1000, dimensions >0 and <=1000.
Geometry must also remain positive after conversion to GPU float32. Values smaller
than the ray epsilon may be accepted but need not produce visible geometry.
Diagnostics carry source offsets and one-based line/column positions.

## Built ESM API

```js
import { parseScene, compileScene, mountScene } from '@barocss/gpu';
const scene = parseScene(source); // throws SceneError with diagnostics
const shaders = compileScene(scene); // revalidates structured input
const renderer = mountScene(canvas, source); // throws GPUError on GL failure
const result = renderer.update(nextSource); // {ok:true} or {ok:false,error}
renderer.resize(640, 480);
const rgba = renderer.readPixels(); // bottom-left origin, Uint8Array
renderer.dispose(); // idempotent
```

`scene` and `shaders` getters expose the accepted state. Invalid parse, validation,
shader compilation/link or candidate GL draw returns failure and keeps the accepted
scene/frame when the context remains usable. A lost context cannot preserve usable
pixels: it is explicit failure and requires a fresh mount. Missing WebGL2 fails;
there is no CPU fallback. Resize/read/getters throw after disposal/context loss;
update returns failure after disposal/context loss. Dispose removes only this
renderer's programs/shaders/VAO and its listener. No timer or animation loop exists.
Use a dedicated canvas/context: drawing sets default framebuffer, program, VAO,
viewport and blend/depth/scissor/cull/color-mask state; previous host GL state is
not restored. Buffer sizes are integer 1..4096 with <=4,194,304 total pixels.

## Rendering contract

Right-handed scene coordinates, +Y up. Fixed camera at (0,0,6), looking toward -Z,
vertical perspective field of view 45 degrees; aspect follows buffer size.
Sphere and axis-aligned box SDFs are evaluated with a fixed template. Lowest
signed distance wins; equal distances retain the earlier declared object.
128 ray steps, maximum travel 100 units, hit/normal epsilon 0.001. The camera
may be inside a shape; surfaces below epsilon and distant/off-camera objects are
not visibility guarantees. No textures, CSG, rotation, scaling, shadows or picking.
Light direction normalize(-0.6,0.8,1); ambient .35 plus Lambert .65.
Object color uses gamma-2.2 conversion to linear before lighting and back afterward.
Background is emitted unchanged. No raw source/name/ID enters GLSL.
Generated fragment shader <=64 KiB; per-frame work also has buffer/object/step ceilings.

WebGL2 behavior reference: [Khronos specification](https://registry.khronos.org/webgl/specs/2.0.0/).
Original implementation, not GSS code or compatibility.

## Verification and local example

Build before tests: `pnpm --filter @barocss/gpu build:library`.
Run lint, type-check, test and test:consumer. The consumer packs built artifacts,
imports ESM and compiles declarations independently.

```sh
PW_DIR=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node \
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
pnpm --filter @barocss/gpu test:browser
```

The pixel gate must obtain actual WebGL2 and readPixels. Missing browser/context
is failure, never skip. Software WebGL proves functionality only; it proves no
physical-GPU execution, throughput or performance. Evidence retains source,
validated data, shaders, PNG/JSON, SHA/hash/backend/buffer/assertion details.
The example lives in `examples/gpu-scene/`; follow its README to run on loopback.

## Host triangle preview API (packet v0)

This additive host API is separate from the unchanged sphere/box stylesheet grammar.
It attaches one approximate open-surface preview per dedicated canvas, with no SDF
composition, CAD runtime, automatic camera fit, tessellation, rotation or nonuniform scale.

```js
import { mountMesh } from '@barocss/gpu';
const options = {
  mmToSceneUnit: 0.1, translate: [-0.5, -0.5, -1.5],
  color: [0.9, 0.4, 0.1], background: [0.06, 0.12, 0.19],
};
const renderer = mountMesh(canvas, packet, options);
const result = renderer.update(nextPacket, options);
console.log(renderer.revision, renderer.packet, renderer.options);
renderer.resize(640, 480);
const rgba = renderer.readPixels();
renderer.dispose();
```

All option fields are required. Scale is explicit finite positive millimetres-to-scene
conversion; translation is scene-space XYZ. RGB values are finite opaque normalized
components 0..1. Resulting coordinates must be finite within -1000..1000.
Packets/options are defensively copied, and accepted getters return copies.
Revision is host provenance, integer 0..2147483647; lower/equal revisions are allowed
and are not a freshness or synchronization policy. Unknown packet/option fields fail.

The identical GPU/CAD JSON-compatible contract is:

```js
{
  version: 0, surfaceId: 'surface', revision: 0,
  lengthUnit: 'mm', coordinateSystem: 'right-handed-y-up', winding: 'ccw',
  positions: [/* flat XYZ in mm */], normals: [/* flat unit XYZ */],
  indices: [/* triangle indices */], parameters: [/* flat CAD-domain UV */],
  bounds: { min: [/* XYZ */], max: [/* XYZ */] }
}
```

surfaceId is an ASCII identifier. Dense ordinary numeric arrays only; no executable
accessors, custom prototypes, external assets, source or shader input. Vertex count
4..4096, triangle count 2..7938; matching XYZ/normal/UV lengths, all finite, positions
within +/-1e6 mm, unit normals within 1e-5, exact component min/max bounds. Each
triangle has three distinct valid indices and nonzero area, with CCW face direction
agreeing with its vertex normals. GPU conversion must preserve nondegenerate geometry
and winding. UV is retained as provenance and has no GPU meaning.
CAD U-major rows use index(i,j)=i*countV+j, triangles (a,b,c),(b,d,c),
a=(i,j), b=(i+1,j), c=(i,j+1), d=(i+1,j+1).
`validatePreviewPacket` and `validateMeshOptions` return defensive accepted values;
`prepareMesh` returns validated copies and bounded Float32/Uint16 buffers.
Structural/count checks precede array allocation. Approximate previews do not replace
NURBS/IGES or demonstrate watertight/manufacturable geometry.

The mesh path uses original fixed GLSL ES3.00 shaders and indexed WebGL2 triangles.
Default camera/light/gamma match the primitive path; default perspective near plane .01 and far100. The optional mesh camera changes only the view; primitive rendering stays fixed.
No face culling: open surfaces remain visible from either side, using their supplied
world normals without reversing them. Depth uses LESS, with earlier triangles winning
exact depth ties. Buffer/pixel limits match the primitive path (4096 per side,
4,194,304 pixels total). Positions/normals each allocate <=49,152 bytes; indices
<=47,628 bytes. One accepted and one candidate set coexist during updates. Each owns
one program/VAO, three buffers, RGBA8 texture, depth24 renderbuffer and framebuffer.
Shaders are released after linking. Framebuffer storage is bounded by the pixel ceiling;
backend-specific physical allocation is not a performance claim.

Candidates validate, upload and draw offscreen before presenting with WebGL2 blit.
Failed validation/upload/compile/link/draw keeps accepted metadata and usable prior
pixels; failed presentation restores from the accepted framebuffer when context is usable.
Resize allocates/draws before resizing the host buffer and restores on failure.
Lost context requires a fresh mount and cannot promise usable retained pixels.
Dispose is idempotent, releases only owned resources/listener; it retains the canvas.
Use a dedicated context: host GL state is changed and not restored.
No animation loop, network, file operations or third-party renderer is included.

Both original and mesh browser gates must pass without skips. The analytic host fixture
uses radius10/height30 quarter-cylinder p(u,v)=(10*cos(pi*u/2),10*sin(pi*u/2),30*v),
normal oriented by cross(partialU,partialV). The visibility fixture explicitly
reorients host coordinates by -90 degrees about X, (x,y,z)->(x,z,-y), and
transforms normals identically; the renderer itself supports no rotation.
Host placement/scale remain explicit;
no CAD package imports are required. The literal asymmetric patch is a deterministic
contract replay control. Actual CAD output integration is recorded separately when both
independently verified lanes are available. See `examples/gpu-scene/mesh.html`.


### Optional mesh camera

`MeshOptions.camera` accepts owned plain JSON data:

```js
const camera = {
  eye: [4, 3, 6], target: [0, 0, 0], up: [0, 1, 0],
  fovYDegrees: 45, near: 0.01, far: 100,
};
const result = renderer.update(renderer.packet, { ...renderer.options, camera });
```

Absence preserves the old options shape and fixed mesh projection: eye(0,0,6),
target(0,0,0), up(0,1,0), vertical FOV45, near0.01/far100. Camera vectors and
clipping distances use scene units. Packet positions still use mm; the host's
explicit scale/translation creates world positions before camera projection.
`up` is a dimensionless direction, normalized internally. Normals and light
remain in world coordinates; changing the camera does not rotate geometry or
infer an outward direction.

Eye/target components must be finite within +/-1000, with separation >=1e-4.
Up norm must be >=1e-6; the normalized forward/up cross norm must be >=1e-6.
FOV is 10..100 degrees; near>=1e-4 and near<far<=10000. Unknown fields,
accessors, invalid axes/optics and unstable Float32 projection requests reject.
Numeric bounds alone do not guarantee a stable Float32 matrix. The near/far
planes must remain distinct after Float32 conversion, and their computed
normalized-device depth endpoints must remain within 1e-3 of -1/+1. No silent
clamping, unit inference or automatic camera fitting occurs. Caller vectors
and nested accepted getters own separate copies.

`prepareCamera(camera, aspect)` returns column-major Float32 view/projection
matrices for bounded independent host diagnostics. The renderer computes its
aspect from its own buffer dimensions and accepts no raw matrix/shader input.
Candidate uniform/upload/draw failures retain the prior usable frame/options
when the context remains available. Context loss requires a new renderer.
