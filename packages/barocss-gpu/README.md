# @barocss/gpu (experimental v0)

## Complete integer-box Boolean CPU buffers

`prepareAxisBoxBooleanBuffers(result, {basis:'authored-xyz-matches-rhyup',
mmToSceneUnit, translate})` validates the complete CAD integer-axis-box Boolean
result and stages every generated panel. It retains copied original operands,
unused original geometry, generated sources, body/shell relationships and qualified
lineage. Exact two-by-two native tessellation provides separate hard-normal
vertices: at most72 panels,288 vertices,144 triangles and7776 geometry bytes.
Valid empty results keep their native data and return empty arrays/null bounds.
The current CPU domain includes validated separated and full/partial face-contact
results. Edge/corner-only unions still refuse through the actual native validator;
their admitted intersections/differences retain explicit empty or original material
semantics. This does not add general curved, rotated or floating-coordinate Boolean
support. GPU conversion limits still apply, including explicit placement for far
native coordinates. Original native empty-gap volume remains native data.

The native integer-cell Solid proof remains native. Float32 positions/normals and
Uint16 indices are independent caller-owned display copies. Metadata/native/options
are frozen. `AxisBoxBooleanBufferError` codes are INPUT, BUDGET, NATIVE, BINDING and
CONVERSION, with the actual cause retained. The explicit basis declares authored
XYZ agreement with renderer Y-up; scale/translation apply once. Unsafe coordinate
loss and degenerate display triangles refuse without a partial public result.

This CPU profile is separate from existing extrusion-Shell and limited Face/Mesh
renderer inputs. It is not an original Surface, a renderer or a Viewer adoption.
No edges, colors, camera, picking or GLB are added. The focused
`axis-box-boolean-buffers-flow.mjs --output <dir>` uses recorded native results,
actual source/compiled public API and cold files; it requires no browser or GL.

## Native Curve coordinate conversion

Primitive Curve display preparation refuses a nonzero posed millimetre coordinate
that becomes zero when multiplied by `mmToSceneUnit`. It also refuses a nonzero
final scene coordinate that becomes zero in Float32. Scene translation cannot
hide scaling loss. These refusals use the existing `GPUError` and update result
contracts; original source, native points, IDs and uniform/adaptive profiles remain
unchanged. Exact zero, legitimate pose cancellation and nonzero Float32 subnormals
remain admitted subject to the existing range and segment-collapse guards.

This tightens admission for previously accepted lossy conversions. It does not
certify lossless pose/translation arithmetic, pixel accuracy or device capacity.
The focused `examples/gpu-scene/curve-coordinate-admission-flow.mjs --output <dir>`
checks actual source and compiled API CPU preparation using an intentional null
context boundary. It creates no WebGL renderer and does not prove visible-frame
retention or replace an actual browser flow.

These direct GPU cases are not Viewer reproductions. Existing Viewer native
loading first performs its own Loader admission and supports display scales
`1e-6..1`; an actual consumer proof must use a source that survives that route
and its admitted scale/profile. Uniform and selected uniform routes have their
own original-source contracts. The mixed Render Editor retains unshown Curve
source but currently displays its selected Surface and Sphere.

## Native Surface coordinate conversion

Original and posed Surface packet preparation applies the same two coordinate
refusals through a shared internal conversion helper. It preserves the existing
`RangeError`, packet version 0, mm/Y-up frame, source/native data, normal/index
conversion and triangle validity checks. Exact zero, legitimate post-pose or
scene translation cancellation and nonzero Float32 subnormals remain admitted.
Previously accepted per-coordinate scaling or Float32 zero loss now refuses.

Run `examples/gpu-scene/surface-coordinate-admission-flow.mjs --output <dir>` for
the focused actual Source0/CAD sampling/public GPU API/cold-file CPU flow.
Direct `prepareMesh` returns real CPU arrays; the posed mount checks stop at an
intentional null context. No successful renderer, pixel or frame-retention
claim follows. Full pose/translation precision and native Solid accuracy remain
outside this conversion contract.

## Positive pose scale admission

Curve and Surface preparation also checks each native coordinate multiplied by
its positive pose scale before rotation. A nonzero coordinate that becomes zero,
or a nonfinite result, refuses with the existing Curve `GPUError` or Surface
`RangeError`. The pose scale range remains `0.001..100`.

The check compares the original component with its scalar product. It does not
compare it with a later rotated component: rotation or translation may legitimately
cancel a component. Original source/native values and the existing operation
order, unit conversion, Float32, segment and triangle checks remain unchanged.
This is a scalar admission guard, not a guarantee of lossless pose arithmetic.
The focused `pose-scale-admission-flow.mjs --output <dir>` checks real public API
CPU preparation and cold files at an intentional null context boundary; it claims
no successful renderer or browser verification.

An independent CSS-shaped scene language and original WebGL2 SDF renderer.
This package has no React, Three.js, GSS, CAD or existing utility-class dependency.
Its local package configuration is public (`private:false`, `publishConfig.access:public`).
This does not mean the package has been published to npm, or claim CSS/GSS compatibility or production readiness.

## Compiled package and local source development

Run `pnpm --filter @barocss/gpu build:library` to emit the declared `dist/index.js`
ES module and `dist/index.d.ts` declarations. Workspace main/import/types entries
use `src/index.ts` through a TypeScript-capable bundler. The complete `publishConfig`
map selects compiled JavaScript/declarations for release. The package files
include compiled modules/declarations, source for explicit development, README and MIT LICENSE.
Version remains `0.0.0`; actual npm publication is a separate authorized release step.

Explicit `@barocss/gpu/source` exports the original `src/index.ts` for TypeScript-aware
development tooling. The repository's loopback examples use explicit original source entries
or source aliases in historical hosts. The shared [source consumer](../../examples/workspace-source/README.md)
uses ordinary package imports and a reusable esbuild context without source aliases.
Installed esbuild resolves `.js` relative imports in memory, so source
editing does not require an artifact build. A plain browser cannot load raw TypeScript;
use the source host. Plain Node does not resolve source `.js` specifiers to `.ts`.
Explicit compiled checkpoints use every transitive package's complete `publishConfig`
map after a build; a direct dist root import can otherwise mix source dependencies.

Earlier Issue receipts and their commands retain their original compiled-default
manifest scope. Use the shared compiled probe for the current convention. The
named material/curvature example checkpoint migration is tracked separately in #1016.

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

## Source1 rigid rotation (prototype)

Opt in with `parseScene(source, {sourceVersion: 1})` or
`compileGpu({kind: 'scene', source, sourceVersion: 1})`. The source header must
be `version: 1;`. Existing calls remain source0 and reject rotation properties.

```css
@scene tilted { version: 1; box #block; }
#block { size: 1 2 .8; rotate-x: 20deg; rotate-y: 35deg; rotate-z: -10deg; }
```

`rotate-x`, `rotate-y`, `rotate-z` apply to boxes and spheres, default to `0deg`,
and cascade separately. Each accepts one finite literal with explicit `deg`,
within [-360, 360]. Unitless values, radians, functions and expressions fail.
Axes are right-handed; local rotations apply X then Y then Z. For column vectors,
world = translate + Rz * Ry * Rx * local; distance uses the transpose of that
matrix on (world - translate). Rotations preserve distance; normals use the
existing world-space distance gradient. Rotating a sphere retains authored data
but does not change its ideal spherical geometry.

Structured `Scene1` uses `version: 1` and requires each object's owned
`rotateDegrees: [x, y, z]` data. `compileScene(Scene1)` accepts the same bounds.
Source1 emits SDF render IR schema2 with `angleUnit: 'deg'`, `rotationOrder: 'X-Y-Z'`
and per-draw `rotateDegrees`. Scene0, SDF IR1, mesh IR1 and old shader bytes
remain unchanged. AST schema1 identifies source0 or source1 in `sourceVersion`.

Use `mountScene(canvas, source, camera, {sourceVersion: 1})`, or the matching
fourth constructor argument. The third argument remains the runtime camera.
The renderer keeps its selected source version for all updates. Camera changes
alter only the view. Unknown options and invalid source updates fail before
adoption; the accepted scene and frame remain usable.

The minimal root preview includes **GPU · Rotated box**, with mouse orbit.
Build the GPU package and run `examples/gpu-scene/rotation-smoke.mjs` using the
installed PW_DIR/CHROME and BAROCSS_ROTATION_EVIDENCE paths. This short smoke
checks real shader compile/link/draw, rotated/edit/orbit frames, inverse-axis
order, invalid-update retention and an unchanged source0 shader fixture.
Broader numerical/resource/performance/compatibility validation is deferred.
This increment adds no groups, scale, CSG, animation, materials or picking.

## Source1 capped cylinder (prototype)

```css
@scene posts { version: 1; cylinder #post; }
cylinder { radius: .6; height: 2; color: #e08040; }
#post { rotate-x: 20deg; rotate-z: -15deg; translate: -1.4 0 0; }
```

Explicit source1 adds `cylinder` declarations and type selectors. Its centered
local axis is Y; full `height` spans [-height/2, height/2], with radius in XZ.
Defaults are radius1 and full height2. Both dimensions must be finite, positive,
<=1000; Float32 radius and half-height must remain positive. Rotation, translation,
color and existing cascade rules apply. Radius applies to spheres and cylinders;
height is cylinder-only; size is box-only. Units/functions are not accepted for
dimensions. The original capped signed distance combines radial and axial outside
distances with the inside maximum; rotation preserves that distance.

Structured Scene1 cylinders and IR2 cylinder draws use type/kind `cylinder` and
require `height`. Sphere/box records have no height field. The common unused size
layout remains, but does not determine cylinder dimensions. Source0/Scene0/IR1
reject cylinders; source1 sphere/box shader bytes stay unchanged when no cylinder
is present. This is an additive experimental source1/IR2 kind; an older implementation
or consumer must not be assumed to support it.

Select **GPU · Cylinder** in the minimal Example menu to see the cap and side.
`examples/gpu-scene/cylinder-smoke.mjs` checks actual generated GLSL distance
control points (RGBA8 tolerance2/255), source edits, orbit, invalid-frame retention
and unchanged source0/source1 shader controls. CPU intent controls use tolerance
1e-12. It writes exact HEAD, source/AST/IR/execution/camera/backend and PNG lineage
under BAROCSS_CYLINDER_EVIDENCE, using existing PW_DIR/CHROME installations.
This is prototype evidence; broader numerical/resource/performance suites remain
deferred. No CAD cylinder, B-Rep, capsule, groups, CSG or material system is added.

## Source1 capsule (prototype)

```css
@scene struts { version: 1; capsule #strut; }
#strut { start: 0 -1 0; end: 0 1 0; radius: .4; rotate-z: -20deg; }
```

Explicit source1 adds `capsule` declarations/type selectors and capsule-only
`start`/`end` vectors: three finite unitless local coordinates within +/-1000.
Defaults are [0,-1,0], [0,1,0] and radius1. Radius is finite, positive, <=1000,
and positive in Float32. It applies to sphere, cylinder and capsule; height is
still cylinder-only and size box-only. Existing color/translation/rotation and
per-property cascade apply. No height-to-segment conversion is performed.

The segment must remain noncoincident after Float32 endpoint conversion, with
finite positive Float32 dot(delta,delta). Coincident, collapsed and underflowed
segments fail before lowering. There is no snapping/healing. The original SDF
projects the inverse-rotated local point onto the clamped segment, then subtracts
radius from distance to that closest point. Rotation preserves world distance.
Normals use the existing world-distance gradient.

Scene1 capsule objects and IR2 draws carry owned, frozen start/end vectors;
other shapes gain no endpoint fields and capsules gain no height field. The
common unused size layout has no capsule dimension meaning. Structured admission
requires both vectors and rejects sparse/accessor/foreign/extra values without
invoking getters. This is an additive experimental source1/IR2 kind; older consumers
must not be assumed to support it. Source0/Scene0/IR1 reject capsule.

Select **GPU · Capsule** at `/#capsule` for an oblique mixed-primitive view.
`examples/gpu-scene/capsule-smoke.mjs` runs real generated GLSL axis/oblique/end
region distance probes (RGBA8 tolerance2/255), CPU intent controls (1e-12), source
edits/orbit/invalid-frame retention and exact old source0/rotation/cylinder shader
controls. Use existing PW_DIR/CHROME and BAROCSS_CAPSULE_EVIDENCE paths for PNGs
and exact HEAD/source/AST/IR/execution/camera/backend lineage. Broader numerical,
resource, performance and compatibility suites remain deferred. No native CAD
capsule/B-Rep, groups, scale, CSG, materials, animation or picking is added.

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

## Own compiler pipeline

`compileGpu({kind: 'scene', source})` compiles the existing independent `@scene`
language through original ranged syntax AST, symbol/type/default/cascade analysis,
versioned render IR, and original fixed SDF GLSL lowering. The actual scene renderer
uses this pipeline once per candidate. `parseScene` and structured `compileScene`
remain supported conveniences over the same parser/semantic/lowering phases.

`compileGpu({kind: 'mesh', packet, options})` validates the original packet and
explicit millimetre conversion/camera, emits one indexed-mesh IR draw, and lowers
that intent through the original Float32/Uint16 preparation. The mesh renderer uses
this path for creation and updates. CAD is one packet producer; GPU imports no CAD
package. `prepareMesh` and the original validators remain supported.

Success returns `{ok:true, ast, ir, execution, diagnostics:[]}`. Scene execution is
`{kind:'sdf', scene, shaders}`; mesh execution is `{kind:'indexed-mesh', mesh}` and
has `ast:null`. IR uses `schema:'barocss-gpu-render-ir'`, `schemaVersion:1`,
`pipeline:'sdf'|'indexed-mesh'`, name, right-handed-y-up coordinates, background and
resolved draws. SDF dimensions remain full extents in dimensionless scene units.
Mesh packet data retains native mm/UV/winding/revision/ID provenance; conversion
is explicit in options. These are alternative backends, not mixed depth rendering.

Failures return only `{ok:false, diagnostics}` with code, error severity, message
and original UTF16 range (line/column start at1). Mesh failures have range:null and
a dataPath. Invalid semantics never reach shader or typed-buffer lowering, and
Float32 collapse remains a hard lowering error. No WebGL calls occur in compilation.
AST/immutable IR/execution independently own their data, including writable typed
buffer instances. No authored IR, callbacks, raw GLSL, imports, eval or new grammar
is admitted. Actual renderer transactions/loss/disposal remain unchanged.

Allocation bounds:64KiB UTF8 source, at most65536 lexer tokens,4096 syntax nodes,
32 objects,128 style rules,512 style declarations and two grammar levels (scene
body/style body). Valid maximal style/object fixtures use at most2208 AST nodes
plus the two header fields, below the4096 ceiling. Lexing ranges use bounded newline
indices and binary search; malformed nesting/token growth stays inside those bounds.
Coordinates remain within1000; positive dimensions must remain Float32-representable
and at most1000. Scene negativezero still normalizes to positivezero. Original
positive Scene/shader/buffer fixtures and exact packed/browser compiler records
are retained by the verification tests. Software SwiftShader proof is functional
evidence and does not claim physical GPU performance.

## Opt-in scene presentation camera

`mountScene(canvas, source, camera)` can use the existing strict `MeshCamera` data
contract as a presentation camera for SDF scenes. `renderer.camera` returns an owned
copy and `renderer.setCamera(camera)` redraws through view uniforms. Camera-only
actions retain parsed geometry, shader program and resources; invalid camera or
draw failures retain the last accepted camera/frame. Source updates and resize keep
the accepted view. Lost/disposed contexts reject camera updates.

The source grammar and render IR are unchanged. Omitting the third argument keeps
the original fixed-camera shader bytes and behaviour. Opt-in view rays use the
existing validated right-handed basis and FOV, explicit near/far, and the original
128-step/100-scene-unit workload cap. No authored GLSL or implicit geometry rotation
is admitted. Gallery mouse orbit uses this view API for sphere/box and mesh examples.

### Derived CAD edge display (prototype)

`mountMesh(canvas, packet, options, overlay)` accepts an optional `MeshEdgeOverlay`
with `version: 0`, a complete matching `packet`, up to 64 uniquely named paths,
and opaque RGB `color`. Each path has 2–64 original-mm XYZ points; the total is
at most 4096. The renderer uses the mesh conversion/camera and one-pixel,
depth-tested line strips in the same candidate framebuffer.

`renderer.setEdgeOverlay(overlay)` changes this display atomically; `null` removes
it. `renderer.edgeOverlay` returns owned data. `update(packet, options, overlay)`
sets fresh paths; omitted overlay retains existing paths only when the complete
packet is exactly equal, including all numbers and metadata. A changed packet
with omitted overlay drops paths. This does not change mesh/compiler IR, source
grammar, model geometry or topology, and does not certify input paths as CAD edges.

The host Box prototype supplies its twelve actual global native edges; supported
Surface previews supply sampled natural boundaries. Broad resource, compatibility
and pixel/regression validation is deferred under the prototype-first policy.

## Display face highlight (prototype)

`MeshFaceHighlight` version0 binds the complete accepted packet, ASCII faceId,
exclusive indexRange[start,end] and opaque RGB. Range endpoints are integer
multiples of3, nonempty and within the original indices. The host resolves that
range from actual native face metadata; GPU does not infer topology.

Pass optional highlight after the existing edge overlay to mountMesh/constructor,
or as update's fourth argument. `setFaceHighlight(highlight|null)` and the owned
`faceHighlight` getter support atomic view changes. Omitted highlight retains only
for the exact same packet; a changed packet clears it. Invalid range/stale packet
rejects before candidate adoption and retains frame. Highlight draws the selected
original indices with the original shader/camera/depth and a separate color; hidden
faces remain occluded and original edge overlay stays on top. No new packet schema,
CAD dependency, material/selection kernel or renderer-budget widening is added.

Highlight uses depth EQUAL against the original accepted fill, with the same
polygon offset when original edges are enabled. Raster-visible shared silhouette
boundary samples may retain the selected face's color; this does not establish a
hidden-line or geometric visibility certificate. The focused prototype measured
bottom-face changes only within1.1 physical pixels of its actual original boundary
paths and unchanged protected cap/wall interior samples.

## Source1 rounded box (prototype)

```css
@scene rounded { version: 1; rounded-box #block; }
#block { size: 2 2 2; radius: .35; color: #7cd8ca; }
```

`rounded-box` is an additive explicit source1/Scene1/IR2 kind. `size` specifies
full OUTER XYZ extents, default[2,2,2]; `radius` default0.25. After the full
property cascade, radius must be positive and <=min(size)/2. Equality is supported:
size2/radius1 is sphere-shaped. Extents/radius remain finite<=1000; represented
Float32 half-extents/radius must be positive and inner extents nonnegative.
Zero inner components at equality are permitted; no radius clamping/rescaling.

The original inverse-rigid query lowers boxDistance(local,halfSize-radius)-radius,
using admitted scalar Float32 coefficients. Outer extents stay fixed. Existing
color/translate/degree rotation/cascade apply; height/start/end are unsupported.
Structured compile and original source/AST/IR agree. Source0 rejects this kind;
old box/sphere/cylinder/capsule data and shader semantics stay unchanged. No native
CAD fillet, B-Rep rounded solid, Boolean or commercial parity is claimed.

The root Example **GPU · Rounded box** uses actual original source1 compilation.
`examples/gpu-scene/rounded-box-smoke.mjs` after the affected GPU build, with
PW_DIR/CHROME and BAROCSS_ROUNDED_BOX_EVIDENCE, records source/AST/semantic/IR/GLSL,
actual plain-vs-rounded projected center/corner controls, radius edit/orbit,
sphere-equality pixel comparison, source/structured/range failures with frame
retention, backend/GL0 and PNG lineage. Broader validation remains deferred.


## Source1 ring torus (prototype)

```css
@scene ring { version:1; torus #ring; }
#ring { major-radius:1; minor-radius:.25; color:#7cd8ca; }
```

Use explicit `sourceVersion:1`. Local Y is the axis; the centreline circle lies
in XZ. `major-radius` is the centreline radius and `minor-radius` is the tube
radius, in scene units. Defaults are1 and.25. The admitted ordinary ring requires
finite `0 < minor < major` and `major + minor <= 1000`, including its Float32
representation. A collapsed hole or extent overflow rejects after the final
selector cascade. Existing translation and X/Y/Z degree rotations apply.
Generic radius/size/height/start/end properties are unsupported for torus; new
major/minor properties are unsupported on other primitives. Scene1 and IR2 carry
`majorRadius`/`minorRadius`; existing radius/size layout fields are placeholders,
not aliases. Source0 remains unchanged.

The original compiler lowers distance to the XZ centreline circle minus the tube
radius. Select **GPU · Torus** at `/#torus`, drag to orbit, or select Torus and
Apply in the GPU source editor. Invalid editor source/version retains the accepted
view. `examples/gpu-scene/torus-smoke.mjs` runs one affected-build actual source,
helper-distance, hole/annulus/rotation pixel and editor-retention flow. Software
WebGL is permitted; broad validation and physical performance claims are deferred.
This GPU SDF is separate from native CAD geometry or certified solids.

## Host object selection (private editor)

MeshRenderer.setObjectHighlight accepts null or an exact version0 record with the
complete accepted packet, objectId, aligned nonempty indexRange and bounded RGB
color. The host resolves native object identity and contiguous triangle range;
GPU does not infer topology. Admission reuses strict own-data packet/range/color
checks, rejects stale packets/getters and retains the previous frame on failure.
Object tint is display-only and stays distinct from original face highlighting.
Camera/edge updates and resize retain it only for the same accepted packet.
Changed geometry clears the old binding until the host supplies the new range.
The lighting getter reports the fixed direction/ambient/diffuse values used by
the original mesh shader. No editable light/shadow/scene grammar is added.

## Empty or mesh viewport (private editor)

`mountMeshViewport(canvas, options)` starts with a real opaque empty framebuffer,
without a placeholder mesh, shader, native Surface or document. It reuses the
original renderer's context and staged framebuffer lifecycle. `state.kind` is
`empty` or `mesh`; each state getter returns owned display data. Mesh states
include the accepted packet, edge overlay and resolved face/object selection;
empty states contain none of these. Existing `mountMesh` still requires a valid
nonempty packet.

`update(packet, options, overlay?, selection?)` accepts the original packet/options
and optional `{face, object}` highlight records. Omitted records are retained only
for the same packet; `selection: null` clears both highlights. `clear(options?)`
commits a validated empty background and releases old geometry resources.
Both return `UpdateResult` and retain the accepted frame, options and selection
when admission or actual GL allocation fails. `setCamera(camera)` also returns
`UpdateResult`; `resize(width, height)` and `render()` preserve empty state.
`readPixels()` observes the real displayed framebuffer. `dispose()` is idempotent.
Camera/resize do not resurrect cleared geometry, and the canvas/context remain
stable across empty/mesh transitions. Context loss requires mounting a new viewport.

Run `node examples/cad-preview/mesh-viewport-smoke.mjs`, then open its printed
localhost URL. This one source-only browser flow uses the original own CAD Box,
observes its actual position upload and pixels, clears geometry, injects a real
framebuffer allocation refusal, and checks retained state and resource cleanup.
The host exits with the posted browser result. This is bounded lifecycle evidence;
commercial editor interaction and hardware performance remain separate scopes.

## Own CAD face preview bridge (private prototype)

`prepareKernelFacePreview(dto, {displayId, packetRevision})` admits the exact
`barocss-native-face-mesh` v0 DTO from the own CAD engine. It returns an owned,
frozen original preview packet, context and face bindings. Each binding retains
its original `nativeFaceId`, result-scoped `faceToken`, six context tokens,
normal source, applied face sense and exclusive vertex/index ranges.

Native XYZ/mm positions and supplied normals rotate once by `[x,y,z] -> [x,z,-y]`.
Actual UVs and triangle order remain unchanged. Native location and orientation
must already be applied by CAD. Sharp-normal/UV face vertices remain separate;
only local indices gain each face's vertex offset. Exact converted extrema and
original packet guards are authoritative for display admission. No fabricated
Surface, source grammar, UVs, edges, normal source or solid claim is introduced.

Limits: 64 chunks, aggregate 4..4096 vertices and 2..7938 triangles; each face
has at least three vertices and one triangle. Native positions stay within
±1e6 mm, normal length within 1e-5 of one, and actual UVs are finite. Strict
own-data copying rejects accessors, symbols, hidden/sparse/foreign/cyclic data,
unknown fields and over-budget inputs (131072 values, depth12, arrays23814,
records16, strings512). Context/face tokens are nonempty printable ASCII1..48;
untouched native face IDs are printable ASCII1..128. Derived display IDs are
ASCII identifiers1..48. Native validity and display acceptance are separate.

`resolveKernelFaceReference(prepared, reference)` takes an original prepared
result plus an exact serialized reference and returns its frozen binding or
`null`. Every context field, face token and original native face ID must match.
An old reference resolves only against its pinned old result; a repeated token
cannot attach it to a rebuilt body. Malformed references throw. Prepared results
are library-owned (a serialized/cloned result is not an admitted result).
There is no general persistent naming, nearest-triangle repair or native topology
certification. Selection captions and triangle array positions are not keys.

Keep the prepared context paired with the renderer's accepted packet. Stage a
new prepared result, call the original renderer update, and adopt the context
only on success. Existing renderer options, Float32 admission, camera, shading,
face tint and atomic candidate behavior remain unchanged. The focused source
smoke consumes real recorded own-CAD DTOs; external CAD kernels are references
only and are not runtime dependencies.

Focused source verification uses `node examples/cad-preview/kernel-face-preview-smoke.mjs`
with recorded `BAROCSS_NATIVE_FACE_INITIAL`, `BAROCSS_NATIVE_FACE_REBUILT`,
`BAROCSS_NATIVE_FACE_METADATA` and a unique `BAROCSS_NATIVE_FACE_EVIDENCE` directory.
The ephemeral loopback host bundles only actual GPU source, serves the recorded
own-CAD data and awaits one controlled-browser flow. Open its printed URL and
press **Run recorded native flow**. It records actual GL position/normal/index
buffers, native UV/sense/ranges, readback frames, qualified face selection,
rebuild/stale-reference and an original Float32 refusal. It does not evaluate
CAD again, install a backend, or mount a new product editor route.

## Separate mesh packets in one scene (#665)

`mountMeshScene(canvas, entries, options)` mounts1..4 original PreviewPackets with
unique native `surfaceId` values. Each entry is `{packet,color}`; color is opaque
normalized RGB. `MeshSceneOptions` is `MeshOptions` without color: shared camera,
mmToSceneUnit, scene-unit translation and background. It keeps native packets and
indices separate, uses one WebGL2 context/shared depth buffer, and draws each
object with its own color. No synthetic combined packet, scene graph, native
picking/topology or edge overlay is inferred. Optional explicit display transforms
are described below; omitted transforms retain this original lowering path.

`MeshSceneRenderer.update(entries,options)` returns UpdateResult. All data and
Float32 geometry pass existing admission before candidate adoption. Failure keeps
the prior accepted scene/frame. `entries` and `options` return owned copies.
`resize(width?,height?)` defaults to current canvas dimensions and stages before
acceptance. `render`, `readPixels` and idempotent `dispose` own only this renderer's
GPU resources; caller native data/canvas/context remain caller-owned. Do not mount
competing renderers on that canvas. Context loss refuses explicitly; mount a new
renderer rather than assuming automatic restoration. The existing frame limits
(4096 per axis/4194304 pixels) and per-packet workloads remain; at most4 packets.
Lazy first mount lets a Viewer remain empty until a supported source is admitted.

## Explicit per-entry display poses (#670)

`MeshSceneEntry.transform` optionally supplies the complete
`{translationMm,rotationXYZW,scale}` pose in the original packet's declared
right-handed Y-up XYZ frame. No axis conversion is inferred. Translation is
finite within ±10000 mm; each scale is in [0.001,100]; the XYZW quaternion has
components in [-1,1] and unit norm within 1e-9. Computation normalizes that
quaternion, while owned pose copies retain its authored components and signed
zeros. Explicit undefined, unknown fields, sparse arrays and accessors refuse.

Positions use `commonTranslate + mmToSceneUnit * (translationMm + R * (scale *
nativePositionMm))`. Normals use `normalize(R * (nativeNormal / scale))`.
Original packets, UV, native IDs, winding and bounds remain unchanged. Derived
Float64 and Float32 geometry must both retain finite positive triangle area and
normal agreement. Final positions remain within ±1000 scene units; there is no
clamp or reflection support. With no transform, the old compiler/Float32 path is
used exactly, including its normal values and refusal behavior.

The renderer's `bounds` getter returns owned `{min,max}` copies computed from
the actual Float32 display vertices across all entries, in scene units. These
are display extrema, not native Surface bounds or tight NURBS extents. `entries`
returns copied original packets, colors and any authored poses. Resize retains
the accepted execution arrays and poses. Failed poses, second entries or display
lowering preserve the entire previous entries/options/bounds/frame. Viewer hosts
own their Motion frame mapping, fit and picking; the GPU owns no player or timer.

One genuine native CAD packet/WebGL flow consumes the compiled GPU export:

```sh
REPO_DEPS_ROOT=/path/to/existing/dependencies \
BAROCSS_MESH_TRANSFORM_EVIDENCE=/unique/evidence \
BAROCSS_MESH_TRANSFORM_PORT=52191 \
node packages/barocss-gpu/tests/mesh-scene-transform-flow.mjs
```

Open the printed loopback URL and press **Run display transform flow**. The
receipt covers actual uploaded buffers, independently expected transformed
positions/normals/bounds, original metadata, visible frames/shared depth,
invalid pose and Float32 collapse retention, copied getters and disposal.
Broader validation and npm publication are separate states.

## Genuine native Surface and Curve primitives (#679)

`mountPrimitiveScene(canvas, entries, options)` adds a mixed renderer alongside
unchanged `mountMeshScene`. A Surface entry is `{kind:'surface',packet,color,
transform?}`. A Curve entry is `{kind:'curve',sample,basis,color,transform?}`, where
`sample` is the complete own CAD `AdaptiveCurveSamplingResult` and `basis` must be
`'authored-xyz-matches-rhyup'`. The host explicitly asserts that authored XYZ
matches the renderer's right-handed Y-up frame. There is no inferred axis rotation.
This package declares its own `@barocss/cad` dependency. The native validator
reconstructs the sample from original Curve coefficients/options before display;
GPU code does not replace the CAD sampling engine.

The scene admits1..4 entries with distinct native IDs and at most4096 Curve points /
4092 Curve segments in total. Native sampling keeps its current degree1..3,
2..16-pole, positive-weight, nonperiodic clamped family and actual native refusal
limits. Full copied source/Model/coefficients/parameters/provenance/quality reports
remain separate from renderer-local positions. Input snapshots reject getters,
hidden/symbolic/foreign/cyclic/sparse/nonfinite data within262144 values, depth24,
4096 array elements,64 record fields and262144-character strings per sample.

Options and optional per-entry poses use the #670 contract and existing camera.
One context, candidate framebuffer and shared depth clear support lit indexed
Surface triangles and unlit `LINE_STRIP` Curves at width1 device pixel. Curves
have one position buffer and no normals, indices, UV or fabricated Surface packet.
There is no depth bias: coplanar Curves can be occluded under the shared `LESS`
depth test. Exactly repeated native sample points remain zero-length segments;
nonzero native segments that collapse in Float32 are refused atomically.

`entries`, `options` and actual Float32 display `bounds` return owned copies.
`update`, staged `resize`, `render`, `readPixels` and idempotent resource-only
`dispose` follow the existing lifecycle. Invalid native records, basis, poses,
coordinates or candidate resources retain the previous complete scene/pixels.
No timer, native edit, boundary topology, exact picking, thick-line portability,
global tolerance or manufacturing certification is inferred.

One actual compiled CAD/GPU/WebGL flow: set a unique `BAROCSS_PRIMITIVE_EVIDENCE`
directory, optionally `BAROCSS_PRIMITIVE_PORT`, and run
`node packages/barocss-gpu/tests/primitive-scene-flow.mjs`. Open the printed
loopback URL and press **Run native primitive flow**. It uses two genuine native
Surfaces and two weighted, asymmetric Curves with nonunit original domains.
Root/lock adoption, Viewer consumer adoption and publication remain separate.

## Explicit wide primitive scene v1 (#725)

`mountPrimitiveSceneV1(canvas,{version:1,entries},options)` adds an explicit scene
envelope and `PrimitiveSceneRendererV1`. Surface entries keep the old fields.
Each Curve entry now requires `sampleVersion:0|1`, exactly matching its native
sample report. Version0 uses the original CAD sampler validator; version1 uses
`validateWideAdaptiveCurveSamples` on the full own native wide record. Its source
version remains0. Old `mountPrimitiveScene` and its16-pole/v0 reader continue to
reject v1 envelopes/records/additional fields, with their old capacities.

V1 uses the same GPU backend and declared frame/pose/resource contracts. It admits
1..4 distinct native objects, up to4096 segments/4097 points per wide Curve, and
16384 segments/16388 points across the scene. The wide native profile is positive
open-clamped degree1..3, up to64 original poles/70 knots. Its snapshot admission is
2097152 values/depth32/8192 array elements/64 record fields/262144-character source
strings. Legacy samples retain their own smaller per-record profile. Native
validation must precede GPU allocation, and all native source/coefficients/IDs,
original parameter/D1-guard/quality data remain owned copies. No fit, edge identity
or global/manufacturing certificate is inferred.

`entries`/`options`/actual Float32 `bounds` return copies. `update` takes the same
explicit v1 envelope and stages the complete candidate. Mismatched sample/source/
scene versions, tampered/getter/budget/unsafe pose/Float32 data preserve the prior
entire scene/pixels. Resize/render/readPixels/dispose inherit the same single
context/shared depth lifecycle; no new renderer or copied CAD span kernel exists.
Normals/indices apply only to Surfaces and line width remains1 device pixel.

One actual compiled native-record/GPU/WebGL flow uses saved real CAD696 records:

```sh
BAROCSS_WIDE_NATIVE_RECORD=/actual/wide.owned-result.json \
BAROCSS_LEGACY_NATIVE_RECORD=/actual/legacy.v0-owned-result.json \
BAROCSS_PRIMITIVE_V1_EVIDENCE=/unique/output \
BAROCSS_PRIMITIVE_V1_PORT=52193 \
node packages/barocss-gpu/tests/primitive-scene-v1-flow.mjs
```

Open the printed loopback URL and press **Run wide native scene flow**. Actual
old-reader refusal,64-pole/nonunit/C0 source record, independent line/mesh buffers,
pixels/TRS/bounds/depth, candidate retention and owned cleanup are recorded.
Native API completion, Integration/Viewer/Loader adoption and publication remain
separate. Only the compatible compiled own-CAD producer can satisfy this new API.

## Explicit directional and ambient mesh lighting (#717)

Optional `MeshOptions.lighting` is a complete
`MeshLighting={ambientStrength,directionalStrength,direction}` record. Strengths
are finite [0,1] and their sum is at most1. Direction is dimensionless in the
renderer's Y-up world-normal frame, has finite components within ±1000 and is
nonzero. Authored direction/strength values are copied; direction is normalized
only when lowering GPU uniforms, including finite subnormal values. Unknown,
getter/hidden/symbol/sparse/nonfinite/zero data refuse without clamping.

Single mesh/viewport, mesh-scene and primitive-scene/v1 paths consume this option.
The indexed-mesh compiler IR retains it in draw options. Older strict readers
refuse the additional field; no SDF language or private editor lamp API is implied.
Absent lighting preserves exactly the original shader source, ambient0.35 /
diffuse0.65 direction[-0.6,0.8,1] and gamma2.2 path. Supplied lighting only changes
opaque mesh shading; native positions/normals/indices/UV/IDs and bounds are unchanged.
Curve lines and edge overlays remain unlit. No PBR, shadows or photometric units.

The actual strength is `ambientStrength + directionalStrength * max(dot(unitNormal,
unitDirection),0)`, applied through the existing gamma/color formula. MeshRenderer
`shaders` reflects the accepted shader; `lighting` retains legacy `diffuseStrength`
metadata and reports configured/constant kind. The full authored DTO is available
in copied `options.lighting`. Candidates validate/stage atomically; invalid lighting
keeps accepted options/data/pixels/resources and disposal remains resource-only.

One actual native Surface/Curve and all common mesh paths are exercised by
`node packages/barocss-gpu/tests/mesh-lighting-flow.mjs` with unique
`BAROCSS_LIGHTING_EVIDENCE` and optional `BAROCSS_LIGHTING_PORT`. Press **Run native
lighting flow** at its printed URL. Independent bright/opposed/zero/default gamma
pixels, unchanged real GL arrays/native source, unlit Curve pixels, subnormal
direction lowering, copied getters/IR, invalid retention and cleanup are recorded.
Integration, Viewer/editor adoption and publication remain separate stages.

## Qualified original model identities in scene v2 (#746)

`mountPrimitiveSceneV2(canvas,{version:2,entries},options)` adds required
`ref:{modelId,geometryId}` to each existing explicit-v1 entry. `modelId` is the
caller's accepted source-model namespace (ASCII1..128), not an inferred native
Model name or a native revision/topology certificate. `geometryId` must match
original packet.surfaceId or validated sample.curve.id exactly. Structured pairs
are unique; the same original geometry ID is legal in different model namespaces.
Source/models/packets/samples/IDs remain unchanged; no synthetic ID workaround.

V2 keeps1..4 objects, v1 Curve budgets/sampleVersion/frame/TRS/lighting/Float32
admission and the same single-context shared-depth backend. Ref/getter/native-ID/
duplicate-pair/invalid-candidate refusal retains the whole accepted data/pixels.
Owned entries copy refs and native records. Old v0/v1 profile schemas/uniqueness
remain and refuse v2/ref fields. No document transport, native reference revision
binding, topology naming, exact picking or assembly semantics are inferred.

Use `node packages/barocss-gpu/tests/primitive-scene-v2-flow.mjs` with unique
`BAROCSS_PRIMITIVE_V2_EVIDENCE` and optional port. Press **Run qualified native scene
flow**. It first demonstrates the actual old refusal on two native source Models
with shared Surface/Curve IDs, then observes the new qualified scene's buffers,
pixels/bounds/depth/ref/native retention, invalid cases and cleanup. Integration
and actual model-set/Viewer/Loader adoption remain separate from native readiness.

### Explicit qualified primitive viewport (#763)

```ts
const viewport = mountPrimitiveViewport(canvas, options);
// Genuine empty background/depth frame. No fake native primitive or bounds.
viewport.entries; // []
viewport.bounds;  // null
viewport.update({version: 2, entries: qualifiedNativeEntries}, options);
viewport.clear(options); // UpdateResult; explicit empty command
viewport.dispose();
```

PrimitiveViewport reuses the existing primitive backend, validation and atomic
frame/resource lifecycle. update requires exactly existing qualified scenev2
1–4 entries; Surface packets/native Curve samplingv0/v1, original source/IDs/UV,
explicit TRS/frame/unit/lighting and all native/display budgets remain unchanged.
Old mountPrimitiveScene/v1/v2 constructors and updates still refuse empty arrays.
The new constructor creates a real empty framebuffer/color/depth with zero
primitive buffers, programs, VAOs or fabricated native geometry.

clear requires explicit current PrimitiveSceneOptions, with the same own-data,
camera/lighting/unit/canvas admission. It stages background/depth and releases the
previous owned frame only after success. Invalid update/clear candidates retain
accepted entries/options/bounds/pixels. entries and options return owned copies;
bounds is a copied derived display bound or null when empty. render/readPixels,
resize and idempotent dispose retain current loss/disposal rules. No Infinity
bounds, fake Surface packet, normalized native domain or serialized empty model
is introduced. This is display lifecycle, not sketch document/authoring support.

One real compiled native553 Line + own-GPU browser collector:

```sh
BAROCSS_PRIMITIVE_VIEWPORT_EVIDENCE=/absolute/unique/output \
BAROCSS_PRIMITIVE_VIEWPORT_PORT=52199 \
node examples/gpu-scene/primitive-viewport-flow.mjs
```

Open its isolated localhost page and run the actual clear flow. It checks original
source/coefficient copies and actual Line GL buffer, independent empty background
pixels, invalid/legacy-empty refusal retention, clear/restore/empty resize and zero
owned resources after disposal. It proves one nativev0 Line and this explicit
viewport lifecycle. Wide/Surface/reader/gallery/hardware-performance campaigns
and Viewer/Loader/sketch UI adoption are separate.

### Own opaque Mesh material source (#779)

```ts
const result = compileMeshMaterial(`
@shader #wave {
  @uniform timeSeconds: float(0,2,0);
  @fragment {
    color: mix(#204080,#E08020,sin(timeSeconds*1.5707963267948966)*0.5+0.5);
  }
}`);
if (result.ok) {
  meshRenderer.setMaterial({material: result.material, uniforms: {timeSeconds: 1}});
  meshRenderer.material; // owned accepted binding
  meshRenderer.setMaterial(null); // exact legacy path
}
```

compileMeshMaterial is a DOM-free source→typedIR compiler with half-open UTF16
source diagnostics. validateMeshMaterialIR reconstructs source and compares complete
owned data; lowerMeshMaterial emits only trusted expression/uniform layout. Imported
or forged success objects/raw GLSL are not trusted. MeshRenderer.setMaterial validates
IR and scalar values, then uses its existing program/frame/resource lifecycle.
Missing uniform values use declared defaults; foreign/getter/nonfinite/out-of-range
values refuse. Source changes and uniform changes restage program/buffers/frame;
this prototype does not promise buffer/program reuse or animation performance.
There is no timer or native geometry mutation. setMaterial(null) restores old shader
bytes/pixels. Existing update/resize preserve accepted material; clear removes it.

Profile mesh-opaque-fragment-v0 is one opaque color output with float uniforms,
decimal/exponent and opaque #RGB/#RRGGBB literals, unary± and float+,-,*, sin/cos, mix(color,color,
float), clamp(float,float,float). Uniform names ASCII1..32/shader IDs1..64; min/default/
max finite ordered within±1000. Source64KiBUTF8/tokens4096/uniforms16/nodes256/depth16;
intermediate interval bounds±1e6, sin/cos arguments±1000, mix ratio admitted0..1.
Declared target semantics clamp admitted ratios and final linear RGB0..1 to protect
Float32 color bounds. Material zeros normalize to+0 for JSON-friendly shader data;
authored native/source/coefficient -0 is not changed.

Three-digit colors expand each digit and normalize to uppercase #RRGGBB in the
existing color IR; complete caller source and diagnostic ranges remain original.
For example, #aBc and #AABBCC produce identical typed color and trusted lowering.
Shader IDs retain their separate grammar. Four/eight-digit alpha colors refuse.
The version0/profile and compiler budgets remain unchanged. The compiled CPU/file
flow is `node examples/gpu-scene/material-shorthand-flow.mjs --output <directory>`;
this does not establish a new renderer or consumer adoption.

After uniforms and before the fragment, declare up to16 immutable expressions:
`@let fade: float(clamp(amount,0,1));` and
`@let tint: color(mix(#112233,#AABBCC,fade));`. Later declarations and the fragment
can reference earlier locals. Names are case-sensitive ASCII identifiers1..32;
uniform/local collisions and sin/cos/mix/clamp/float/color names refuse. Forward,
self or cyclic references and mismatched declared types refuse. Locals inline
into the existing version0 expression IR; source remains original and no extra
uniform, schema field or runtime branch is introduced. Caller bindings accept
only declared uniforms. Every definition node and every full reference expansion
counts against the existing256-node compilation limit, including unused locals;
expanded depth stays16. Repeated references cannot evade these limits. Run the
compiled source/file flow with
`node examples/gpu-scene/material-locals-flow.mjs --output <directory>`.

Hex colors decode once using legacy gamma2.2; expressions are linear RGB, then one
existing ambient/directional lighting multiplication and one gamma2.2 encode, alpha1.
No CSSColor4/exact sRGB-transfer/PBR certification. No division/loops/conditions/eval/
imports/callbacks/rawGLSL/color uniforms/UV/textures/vertex deformation. Native UV is
retained packet data, not a material varying. Original positions/normals/indices/UV/
IDs/source stay unchanged; all previous MeshOptions/scene grammar/version/Curve/edge
paths stay. Only single MeshRenderer is adopted. Other Scene/Primitive/Viewer/Canvas
material APIs are separate. Material and overlay/face/object highlight combinations
explicitly refuse in this profile; no silent selection masking.

Every refused candidate retains accepted material/native/program/pixels and frees
only candidate resources. CPU artifacts own copies/GC; GL resources remain this
renderer's ownership. Compiled Node probe and one actual native Surface GPU flow:

```sh
BAROCSS_MATERIAL_CPU_EVIDENCE=/absolute/unique/cpu \
node examples/gpu-scene/mesh-material-cpu-probe.mjs
BAROCSS_MATERIAL_GPU_EVIDENCE=/absolute/unique/gpu \
BAROCSS_MATERIAL_CAD_DEPS=/absolute/compiled/CAD/provider/repo \
node examples/gpu-scene/mesh-material-flow.mjs
```

The actual browser flow checks typed source/IR/trusted GLSL, nonunit native affine
Surface/source/UV/-0 and actual position/normal/index uploads; caller time0/1/2
independent linear/mix/light/gamma RGB, CPU/IR/uniform refusals, explicit test-injected
createProgram-null retention, exact absent-material restoration and disposal0.
The injection is not physical allocation exhaustion. No broad/native/reader/packed/
color/renderer/performance campaign or publication follows from this prototype.

### Qualified Surface material (#837)

`PrimitiveSceneRendererV2` and `PrimitiveViewport` expose
`setMaterial(ref: PrimitiveSceneRef, binding: MeshMaterialBinding | null): UpdateResult`
and a copied `materials: PrimitiveSceneMaterial[]` query. Select the exact
accepted `{modelId, geometryId}` pair. Only Surface entries accept the existing
opaque material language/typed IR/uniform binding. Null resets that Surface;
other bindings stay. Unknown/Curve references and unsafe bindings refuse with
the complete accepted frame/state retained. Native packet/UV/IDs/poses and
position/normal/index buffers stay geometry authority; material is appearance.

Updates restage the full frame/programs/buffers. There is no reuse/performance
promise or internal clock. Resize/render retain bindings. A successful scene
`update` replaces geometry and explicitly resets all materials; failed updates
retain them. Viewport `clear` drops bindings after successful empty adoption;
empty binding requests refuse. Disposal is idempotent and owns only allocated
GPU resources. Context loss retains the existing remount requirement.

Scene0/1/2 entry and options schemas are unchanged. Primitive renderers have no
selection/highlight/edge-overlay API; unsupported overlay fields still refuse.
MeshRenderer's separate overlay policy is unchanged. Existing absent/reset
material uses the exact legacy shader path. Curves remain on their default
Line shader. No texture/UV varying, deformation/PBR/shadow/raw GLSL or Viewer
adoption is supplied. See `examples/gpu-scene/qualified-material-flow.mjs` for
one actual mixed native scene and independent time0/1/2 RGB/light/gamma checks.

### Shared-depth bounded particle layer (#850)

Only `PrimitiveSceneRendererV2` and `PrimitiveViewport` expose:

```ts
setParticleLayer(frame: ParticleLayerV0 | null): UpdateResult
update(input: PrimitiveSceneInputV2, options: PrimitiveSceneOptions,
       particles?: ParticleLayerV0 | null): UpdateResult
// Copied query:
particleLayer: ParticleLayerV0 | null
```

`ParticleLayerV0` has exact own fields `version:0`, `contextId`, `sceneRevision`,
`stepIndex`, `coordinateSystem:'right-handed-y-up-scene-units'`, and a dense
`positions:number[]`. Admit1..256 XYZ points, finite±1000 scene units;
context/revision ASCII1..128; integer step0..2147483647. GPU copies original
binary64 numbers and lowers a derived Float32 buffer. GPU does not convert
metres/mm, import Physics, advance simulation or create native geometry IDs.
The host owns tag meaning, unit mapping and pending generation checks.

Incremental set requires current context/revision match and nondecreasing step;
equal step requires identical original position bits. Null clears only particles.
Reset clears first or uses a full atomic update with an explicit new context.
Full update with the same context retains revision/step checks; a different
context permits a new generation. Omitted/null third argument clears particles
on successful scene replacement. Native/camera/particle state stages in one
accepted frame; refusal retains prior state/pixels/resources. Whole scene update
retains the material-reset rule above; particle-only updates retain materials.

Particles use fixed6px opaque circular POINTS, encoded cyan[0.1,0.7,1]/alpha1,
actual LESS depth test/write and the native camera/framebuffer. A WebGL2 point-size
range containing6 is required. No separate canvas/renderer/blit, overlay SVG,
forced visibility, transparency sorting, texture/PBR or lighting/gamma pass for
particles is supplied. Submitted count differs from visible/occluded samples.
Native bounds and entries describe native geometry; inspect particle positions
separately. Native-empty binding refuses. Viewport clear removes both; resize/
render retain; lost context requires remount; dispose releases owned resources.
Full frames/programs/buffers restage; no reuse or performance guarantee.

### Explicit complete frame (#868)

`PrimitiveSceneRendererV2` and `PrimitiveViewport` expose
`updateFrame(frame: PrimitiveSceneFrameV0): UpdateResult` and copied `frame` query.
The exact own DTO requires all fields:

```ts
{ version: 0, scene: PrimitiveSceneInputV2, options: PrimitiveSceneOptions,
  particles: ParticleLayerV0 | null, materials: PrimitiveSceneMaterial[] }
```

Materials are a dense0..4 list of unique `{ref,binding}` pairs, resolved against
candidate Surface entries. Unknown/duplicate/Curve refs and unsafe data refuse.
Missing candidate Surface binding means default appearance; empty materials and
null particles are explicit clears. No old namespace transfers implicitly.
All current native/IR/uniform/particle/camera/profile limits apply. Query material
ordering follows candidate native entry order, as the existing materials query.

CPU validation and existing native/material/particle programs stage one full
frame before presentation/adoption. Refusal preserves all prior scene/options/
appearance/layer queries and pixels and releases candidate resources. Existing
`update` keeps its material reset; existing setters remain explicit. Resize/
render retain the full frame; clear drops it. Only Viewport accepts scene2
entries[] with materials[]/particles:null. SceneRendererV2 still requires1..4.
Empty frames use no fake geometry or geometry programs. Context loss/remount and
owned idempotent disposal stay current. No clock or buffer/program reuse promise.

Primitive rendering still has no selection/highlight/edge overlay. Such fields
refuse. A material overrides stored entry color, so a host must visibly support
selection feedback or refuse that selected-material combination. GPU does not
silently clear selection or implement Viewer behavior. Viewer869 adoption is a
separate consumer after the actual Integration receipt.

## Native Boolean CPU buffers (#891)

`prepareCoplanarBooleanBuffers(nativeMesh, {mmToSceneUnit: 0.05, translate: [0,0,0]})`
accepts only the whole validated `barocss-native-coplanar-face-boolean-mesh` v0
result from CAD #887. It returns an independent frozen native binary64 copy and
caller-owned Float32 positions/normals, Uint16 triangle indices and true boundary
pairs. Coordinates keep raw authored XYZ; positive scale and translation apply
once. Native UV, sources, mesh/support/evaluation IDs and fragment provenance
remain native. Bridges and diagonals are excluded from boundary pairs. Empty
regions return empty arrays and null bounds. Unsafe Float32 geometry refuses.

This is a CPU backend preparation API, not a PreviewPacket0 or a render entry.
Existing mount/scene/viewport APIs do not accept this profile. Browser, GL,
materials, depth, pixels and resource lifetime require a separate actual target
consumer. This API does not resolve the denied #874 browser gate.

Run the affected build and the actual saved-file API flow:

```sh
pnpm --filter @barocss/gpu build:library
node examples/gpu-scene/boolean-buffers-flow.mjs --meshes /path/to/887/meshes --output /tmp/boolean-buffers
```

## Native filled Shell CPU buffers

`prepareBooleanShellBuffers(nativeShellMesh, {mmToSceneUnit: 0.05, translate: [0,0,0]})`
uses the complete dedicated CAD #896 v0 mesh. Its native authority stays frozen
and independent, including face/Shell ranges, per-face UV and BOTH adjacent face
bindings for each true edge. Face vertices retain hard normals without welding.
`edgePositions` contains three original Curve D1 points per native edgePath;
`edgeIndices` draws two successive segments per path. Bridges and cap/wall
triangulation diagonals are excluded. Raw XYZ conversion applies once.

This CPU profile is distinct from the planar #891 profile and PreviewPacket0.
It is not accepted by existing mount/viewport render APIs, and has no browser,
GL, pixel, resource, inverse-picking or Solid certificate. Unsafe converted
triangles or edge segments refuse; genuine empty results stay empty/null.

```sh
pnpm --filter @barocss/gpu build:library
node examples/gpu-scene/shell-buffers-flow.mjs --meshes /path/to/896/meshes --planar /path/to/887/cross_union.owned-mesh.json --output /tmp/shell-buffers
```

## Provisional native Shell renderer source (#908)

`mountBooleanShell(canvas, completeNativeShellMesh, {mesh: {...meshOptions, camera}, edges: null})`
adds a dedicated draw path for the whole #896 mesh using public #904 preparation.
It preserves native hard-normal faces and original Curve samples, without a
Surface/PreviewPacket0 adapter. `edges: {color: [0,0,0]}` selects true global paths
only. Indexed triangles write LESS depth; sampled lines use LEQUAL/no depth write,
with polygon offset on filled faces. This is display bias, not CAD hidden-line proof.

`update(native, options)` and `setOptions(options)` return UpdateResult; view-only
changes reuse accepted buffers. `resize`, `render`, `readPixels` and idempotent
`dispose` follow the candidate framebuffer lifecycle. Copied `native`, `options`,
`bounds` and `empty` getters preserve authority; `resourceCounts` reports owned
handles, not driver memory. Explicit camera and edges/null are required. Dimensions
are 1..4096 with area at most 4194304 pixels. Context loss requires a new renderer;
original CPU data can still be read before disposal. Use resize for canvas changes.

**Source/build stage only: actual GL, pixels, depth, failure retention, resource
cleanup and visible Shell support have not run.** The #874 administrative browser
policy denial remains unresolved. Do not treat this provisional entry as tested
render support or a release. It does not change existing packet/scene render APIs.

The pending example can be compiled without opening a server or browser:

```sh
pnpm --filter @barocss/gpu build:library
node examples/gpu-scene/shell-render-flow.mjs --build-only --output /tmp/shell-render-build
```

The actual #908 flow later passed after owner permission/app restoration and was
separately accepted on local Integration; historical denial evidence is retained.

### Qualified native Shell depth scene (#941)

`mountBooleanShellScene(canvas, scene, options)` uses one exclusive WebGL2 context
and one shared depth framebuffer for up to4 caller-selected complete native Shell
meshes. Scene input is exactly `{schema:'barocss-gpu-boolean-shell-scene',version:0,
entries}`. Each entry has `{ref,native,color,edges}`; color is explicit RGB[0,1],
edges is explicitly null or `{color:RGB}`. Ref is the exact caller qualification
`{graphId,graphRevision,featureId,outputSlotId}`: case-sensitive ASCII IDs1..64 and
a nonnegative safe revision. Duplicate complete tuples refuse. GPU validates the
tuple/profile, not its relationship to a CAD graph; callers obtain current leaves
from actual CAD evaluation. Native local IDs may repeat across qualified leaves.

Options are `{mmToSceneUnit,translate,background,camera,lighting?}` with required
explicit MeshCamera and current optional MeshLighting. Original authored XYZ/mm
enters one positive scale/translation without axis conversion, native reconstruction
or welding. Complete native source/F64/UV/face/Shell/true Curve identity is copied
separately from private display arrays. Copied `scene`, `options`, `bounds` getters,
`empty` and live `resourceCounts` provide inspection. Empty entries retain identity;
explicit empty scenes draw only the background. No Surface retag or native union.

`update(scene,options)` and `setOptions(options)` return UpdateResult; resize,
render, readPixels and idempotent dispose follow the single-Shell lifecycle. A
whole candidate must validate, stage and present before adoption. Refusal retains
all accepted entries/native/frame/resources; dimensions roll back on resize failure.
Same-conversion view updates reuse private CPU buffers. Context loss rejects GL
operations while retaining CPU provenance until disposal; mount a new renderer
explicitly after a restored context. render re-presents the accepted framebuffer.

Draw all opaque triangles first with LESS/depth writes, then all original sampled
Curve paths with LEQUAL/no depth writes/width1. Enabled edges apply the existing
polygon offset to their own filled entry. Equal-depth ties follow input order;
sampled display bias is not certified CAD hidden-line or topology resolution.
Caps per mesh stay384 vertices/288 triangles/192 paths/80 faces/8 Shells. Four-entry
aggregate caps are1536/1152/768/320/32 respectively, at most1536 sampled line segments
and77568 derived geometry-array bytes, excluding native/JS/framebuffer memory.
Native snapshot work stays1048576 values per mesh, bounded by4 entries. Frame size
is1..4096 per axis and area4194304. Accepted plus one staged target uses at most4
programs/4 shaders/16 VAOs/40 buffers/2 framebuffer-texture-depth sets; shader handles
are transient. These are owned-handle limits, not physical memory/performance claims.

Actual source/file/browser flow command:

```sh
node examples/gpu-scene/shell-scene-flow.mjs --graphs <927-authored-files> --meshes <896-mesh-files> --output <directory>
```

Native implementation, local Integration, named consumer adoption and publication
are separate stages recorded in #941. No assembly poses/picking/material language,
Solid certification or arbitrary meshes are added by this scene profile.

### Derived cloth layer and complete frame1 (#979)

PrimitiveSceneRendererV2 and PrimitiveViewport add copied `clothLayer` and
`setClothLayer(layer|null)` for one genuine derived simulation sheet beside accepted
native geometry. A cloth layer is not a native Surface/Curve, packet, editable face
or picking authority. Native entries, source/IDs/UV/poses and native-only bounds
remain separate. GPU does not run Physics or a clock. #825 saved research snapshots
are real display controls; they do not establish the public Physics/Viewer bridge.

Exact ClothLayerV0 fields are `{version:0,kind:'simulation-cloth',layerId,contextId,
sceneRevision,stepIndex,coordinateSystem:'right-handed-y-up-scene-units',positions,
indices}`. IDs are opaque ASCII1..128 as in ParticleLayerV0; stepIndex is0..240.
Positions are867 own finite binary64 Number values within±1000 scene units; indices
are1536 canonical17×17 grid values for512 triangles. Preserve original Number
values and signed zero separately from private F32 positions/normals/U16 indices.
The host/Viewer maps metres once via `metres * 1000 * mmToSceneUnit`. GPU applies
no additional native mm scale, axis conversion or transform to cloth coordinates.

For an active identity, older steps and changed equal-step data refuse; identical
equal-step submissions may restage but preserve semantic state. Changed layer,
context or opaque revision requires explicit cloth clear or full frame1 replacement.
An opaque revision has no inferred order. Even full frame1 replacement rejects a
regressing/changed-equal step under the same identity. Null clears cloth and its
cursor only, retaining native/options/material/particle state. Nonnull requires
accepted native geometry; an empty viewport must first accept its native scene.

Additive PrimitiveSceneFrameV1 has exactly `{version:1,scene,options,particles,
materials,cloth}`, with qualified native scene2 and explicit cloth/null. Use copied
`frameV1` and `updateFrameV1` for atomic camera/pose/visibility/native appearance
updates that retain the derived layer. Dedicated material/particle setters and
resize retain cloth. Exact legacy `frame`/`updateFrame` version0 stays available;
its full replacement explicitly clears cloth, as do ordinary successful native
update, clear and disposal. Failed replacements retain the entire old frame.
The cloth-only getter retains CPU metadata after context loss until disposal;
other native/complete frame getters keep their existing live-context requirement.

One separate cloth draw uses fixed opaque RGB[0.76,0.52,0.22], current fixed
directional/ambient gamma2.2 appearance and `gl_FrontFacing` to orient normals on
both sides. It shares the native camera, target and LESS/depth writes. Validate
original and F32 canonical triangle areas; area-weighted vertex normals must be
finite and nonzero. Degenerate/cancelling normals refuse without repair. Native
material/lighting changes do not change the fixed cloth appearance. Native picking
does not account for visual cloth occlusion; consumers must disclose that limit.

The cloth upload arrays total10008 bytes (3468 positions +3468 normals +3072 indices),
with one VAO/three buffers/one program and no extra framebuffer. Existing native,
particle, material and framebuffer limits remain. At most one accepted plus one
candidate frame structurally permits12 programs/12 VAOs/32 buffers and2 framebuffer,
texture and depth attachments; shader compilation is sequential with2 transient
handles. Actual flow tracks owned handles and cleanup, not physical memory or GPU
completion timing. All input/F32/shader/late allocation failures retain accepted
native+cloth metadata/pixels/resources. Disposal is idempotent.

```sh
node examples/gpu-scene/cloth-layer-flow.mjs --trial <825-selected-trial.json> --output <directory>
```

Native GPU implementation, local Integration, Physics world, Viewer bridge/host,
numeric collision/performance certification and publication are distinct stages.

### Bounded scalar material absolute value

`abs(float)` accepts one expression bounded within `[-1000,1000]`. For example,
`mix(#123,#ABC,abs(phase))` accepts a uniform phase declared in `[-1,1]`.
The compiler expands it to existing `clamp(x,0,1000)+clamp(-x,0,1000)` IR.
It charges both copies of x and all eight generated nodes against the existing
work and depth limits. No new IR variant or runtime shader function is added.
Existing bare uniforms and locals named `abs` remain valid. Source text stays
unchanged; canonical scalar zero follows the existing positive-zero policy.
This is CPU authoring support; actual renderer and consumer adoption are separate.

`min(float,float)` and `max(float,float)` accept two expressions whose intervals
are each within `[-1000,1000]`. They expand to `clamp(a,-1000,b)` and
`clamp(a,b,1000)`, respectively. The compiler charges all three or two generated
nodes and derives the scalar result interval from the argument endpoints.
A result bounded in `[0,1]` can serve directly as a color-mix ratio. Existing
bare uniform/local names `min` and `max` remain valid. Canonical IR, trusted
lowering, original source and the existing work/depth limits are preserved.

### Literal-edge smoothstep ramps

`smoothstep(edge0,edge1,x)` accepts three scalar arguments. Edges are signed
literal constants (including transparent parentheses and constant locals),
within ±1000, with `edge0 < edge1` and finite reciprocal width at most1000.
The input interval must remain within ±1000 and intermediate bounds within ±1e6.
It expands to `t=clamp((x-edge0)*reciprocal,0,1)` and
`clamp(t*t*(3-2*t),0,1)` in the existing IR. All15 generated nodes and two extra
complete `t` trees charge existing work/depth limits. There is no runtime
smoothstep intrinsic or IR/profile change. Variable edges, equal/reversed edges,
unsafe narrow widths and excess work refuse; bare names remain compatible.
Use `node examples/gpu-scene/material-smoothstep-flow.mjs --output <fresh-dir>`
after the affected GPU build for the new CPU source/emitted/cold-file flow.

### Explicit material degree conversion (#1152)

`radians(x)` converts one scalar expression from explicit degree input into
radians. Its conservative input interval must remain within -1000 to 1000.
It expands to existing multiplication by `Math.PI / 180`, with two generated
nodes and no repeated argument subtree. Existing node/depth/source budgets,
IR version0/profile and runtime calls remain unchanged. Bare `radians` uniform
and local names remain legal. No uniform, native geometry or scene rotation
unit is implicitly converted. Wrong arity/type and unsafe input ranges refuse.

For example, use `sin(radians(angleDegrees))` with a degree-valued uniform.
The CPU source/emitted/cold-file flow is
`node examples/gpu-scene/material-radians-flow.mjs --output <fresh-dir>`.
Native grammar completion does not establish browser or editor adoption.


### Bounded integer-power material expressions

`pow(base, n)` accepts a scalar expression and one unsigned numeric literal
whose parsed value is an integer from 2 through 8. Decimal/exponent spellings
are supported; computed, signed or parenthesized exponents are refused.
It emits exactly the existing left-associated repeated multiplication IR.
Every copied base subtree and generated multiply is charged, plus the parsed
exponent literal; conservative interval bounds, depth16 and work256 remain.
Bare `pow` uniform/local identifiers stay valid. No general fractional or
dynamic exponent, new runtime intrinsic, angle unit or IR/profile is added.
For a cubic fade, use `mix(#000,#FFF,pow(strength,3))` with strength bounded0..1.
Run `node examples/gpu-scene/material-integer-power-demo.mjs --source <fresh-dir>`
for one source/emitted/cold-file CPU flow. This does not establish rendered pixels.


## General engine geometry

`prepareTriangleGeometry()` prepares independently authored indexed triangles.
Use the explicit `barocss-gpu-triangle-geometry` version0 record with an ID,
right-handed Y-up coordinates, scene units and CCW winding. Supply dense plain
arrays for positions, unit normals, UVs and indices. This contract is separate
from native CAD preview packets and keeps their existing APIs unchanged.

The returned `geometry` is an independent frozen copy of the original Number
values. Positions, normals and UVs are separately owned Float32 arrays. The
largest referenced index selects Uint16 (up to65535) or Uint32 (from65536).
Unused vertices remain in the original geometry and its bounds. No welding,
normal generation, unit conversion or native identity is inferred.

The first profile admits3..131072 vertices and1..131072 triangles. Position and
UV values have magnitude at most1000; normals have unit-length tolerance1e-6.
Original and converted triangles must have safe nonzero area and normals that
agree with their winding. Nonzero attributes that become zero in Float32 are
refused. Source arrays cannot contain accessors, sparse values or foreign data.
The source stays immutable; returned typed buffer contents are caller-owned
and mutable. Preparation allocates no WebGL resources.

Run `node examples/gpu-scene/triangle-geometry-flow.mjs --output <fresh-directory>`
after the GPU library build for one source/API/emitted/cold-file flow.
Scene hierarchy, general rendering, textures and other engine services are
separate roadmap stages. This CPU preparation is not rendered-engine parity.

## General engine scene preparation

`prepareEngineScene()` admits the explicit `barocss-gpu-engine-scene` version0
source. It contains a camera, linear RGB background, identified geometry and
opaque unlit material catalogs, and group/mesh nodes. A parent is a group ID or
explicit `null`. Each node supplies scene-unit translation, unit XYZW quaternion,
positive scale and visibility. Local transforms use T*R*S; world transforms use
parent*local, column-major. Effective visibility includes all ancestors.

The result retains a frozen independent source and derives world/normal matrices,
mesh bounds and an ordered visible draw plan. Mesh instances share their one
prepared catalog geometry and material. Original local poses, coordinates, UVs
and IDs remain unchanged. Float32 matrices and geometry buffers are independently
owned mutable execution data. The CPU admission model checks transformed original
and Float32 triangles. It does not allocate GL handles or prove shader pixels.

Scene0 admits16 geometries,32 materials,64 nodes,32 total mesh instances and16
levels. Aggregate geometry limits are262144 vertices/triangles and11534336 buffer
bytes; instance work is at most524288 vertices including hidden meshes. Scale is
0.01..100 per local axis; transformed positions remain within1000 scene units.
Missing/cyclic references, unsafe transforms and Float32 triangle collapse refuse
the entire candidate. Empty scenes are valid with an explicit camera/background.
Texture, alpha, mesh parents, lights, raycasting and animation are later profiles.

Run `node examples/gpu-scene/engine-scene-flow.mjs --output <fresh-directory>`
after the GPU library build for one source/emitted/cold-file acceptance flow.

## General engine ray selection

`raycastEngineScene(scene, ray)` returns the nearest eligible front-facing
triangle hit or `null`. Supply original engine-scene0 and explicit engine-ray0
records in right-handed Y-up scene units. The ray has bounded origin, unit
(direction-length tolerance1e-9) direction and inclusive near/far distances.
The entire source scene is admitted again, including hidden assets. Visible
instance work is capped at262144 triangles before intersection begins.

Hits retain node/geometry/material IDs and original triangle ordinal. Point,
distance, barycentrics, original UV interpolation and transformed unit normal
come from authored Number world geometry. Exact-distance ties retain authored
draw/triangle order. Results and arrays are independently frozen; caller source
and ray stay unchanged. Prepared mutable execution buffers are not query inputs.

The first profile skips back-facing and near-parallel triangles (normalized
front determinant must exceed1e-8). Barycentric/range boundaries use computed
Number comparisons with no clamping or epsilon expansion. This CPU selection
profile has floating edge ambiguity and proves no rendered pixel or native CAD
intersection accuracy. Screen-to-ray conversion, BVH, textures and editor
selection are separate consumers/stages. Run the single
`examples/gpu-scene/engine-raycast-flow.mjs --output <fresh-directory>` flow after
the GPU library build for source/emitted/file acceptance.

### Engine texture source preparation

`prepareEngineTextureBindings(originalScene, originalBindings)` admits a complete
scene0 and its separate texture-binding companion0. This CPU operation validates
opaque RGBA8/sRGB bytes, bottom-left rows, nearest/clamp metadata and original
material/texture references. It does not render or decode images.

The companion has exact fields `format`, `version`, `sceneId`, `textures`,
`bindings`; format is `barocss-gpu-engine-texture-bindings`, version0. Textures
have exact `id,width,height,format,colorSpace,rowOrigin,filter,wrapS,wrapT,pixels`.
Dimensions are integers1..1024; bytes are integers0..255 with alpha255.
Bindings have only `materialId,textureId`, one binding per existing material.
Every catalog entry is validated, including unused textures. Catalog maximum8,
bindings maximum32, total maximum1048576 texels/4194304 pixel slots, admitted
before numerical copies. Empty catalogs and scenes remain genuinely empty.

Result `{scene,textureBindings,textures,pixelBytes}` retains an independent frozen
original companion with Number signed zero and a prepared scene from its original
source. Each prepared texture `{texture,pixels}` owns a separate mutable Uint8Array;
changing it cannot change original source or a subsequent preparation. Source
pixel storage is logically at most33554432 bytes; upload data4194304 bytes, separate
from scene budgets. These are logical ceilings, not measured memory. There is no
cache, image URL, GPU handle or trusted mutable prepared-input shortcut.

`EngineTextureBindingsError` has INPUT/VERSION/BUDGET/REFERENCE/TEXTURE/SCENE
codes; SCENE retains the actual provider error as cause. Getters, sparse arrays,
extra/hidden/symbol fields and foreign prototypes refuse without invocation.
Before any source pixel copy/upload allocation, admit collection sizes/dimensions,
the complete scene, all texture values and all references. Reprepare both originals
for a same-ID change. Existing scene/native/material-language contracts stay valid.

Texture shader sampling, tint colour conversion, atomic renderer resources and
actual pixels remain a later #1184 graphics stage. This API makes no rendered
texture support claim. After the GPU build, run the one CPU source/emitted/file
flow `node examples/gpu-scene/engine-texture-bindings-flow.mjs --output <fresh-directory>`.

### Original camera rays for general engine scenes

`prepareEngineCameraRay(camera, request)` derives one Number-space ray for the
existing `raycastEngineScene` API. Use the same complete original scene's camera
and original scene for both operations. The request requires all eight fields:

```js
const prepared = prepareEngineCameraRay(originalScene.camera, {
  format: 'barocss-gpu-engine-camera-ray-request', version: 0,
  pixelOrigin: 'bottom-left', sampling: 'pixel-center',
  viewportWidth: 5, viewportHeight: 5, pixelX: 2, pixelY: 2,
});
const hit = raycastEngineScene(originalScene, prepared.ray);
```

The frozen result contains `{camera, request, ray}`. Camera and request retain
owned original values, including signed zero. Ray origin is a separate eye copy;
its unit direction and near/far distances are derived from the original Number
camera basis. The original perpendicular camera clip planes become distances
along the normalized query ray. They are not clamped: an off-axis ray from a
valid camera with `far: 10000` can exceed the existing ray distance limit and
refuse with `EngineCameraRayError` code `RANGE`.

Dimensions are explicit integers in `1..2048`; pixel indices must lie inside
the viewport. Sampling uses `(x + 0.5, y + 0.5)` from the bottom left. No CSS
coordinates, device-pixel ratio, canvas inspection or inferred camera defaults
are accepted. Complete camera admission uses the real `validateMeshCamera`;
its refusal is retained as the cause of code `CAMERA`. Other codes are `INPUT`,
`VERSION`, `RANGE` and `NUMERICAL`.

This is CPU source-camera ray derivation. It does not read rendered pixels,
assert Float32 raster agreement, pick native CAD parameters or replace Viewer
queries. Existing generic ray query visibility, numerical edge ambiguity,
work limits and authored identity rules remain in force. Save the full original
camera/request/scene and re-derive after opening the file.

### Caller-time translation clips for general engine scenes

`sampleEngineTranslationClip(originalScene, clip, request)` returns frozen
`{originalScene, clip, request, scene}` with independently owned complete source
scenes. Only the tracked local translations in the derived `scene` change.

```js
const sampled = sampleEngineTranslationClip(originalScene, {
  format: 'barocss-gpu-engine-translation-clip', version: 0,
  id: 'move_clip', sceneId: originalScene.id,
  coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
  timeUnit: 'seconds', interpolation: 'linear',
  tracks: [{nodeId: 'mesh', keys: [
    {timeSeconds: 0, translation: [0, 0, 0]},
    {timeSeconds: 2, translation: [2, 0, 0]},
  ]}],
}, {
  format: 'barocss-gpu-engine-translation-clip-request', version: 0,
  timeSeconds: 1,
});
const preparedFrame = prepareEngineScene(sampled.scene);
```

Each track names one unique current group or mesh. Local positions use scene
units within `-1000..1000`. Times use caller seconds within `0..3600`;
keys must increase with gaps of at least `1e-6` seconds. Limits are 32 tracks,
32 keys per track and 512 keys in total. Empty tracks and empty scenes work.
Before the first key and after the last key, the endpoint holds. At an exact
key time, the literal translation retains its sign bits. Inside a segment,
each component uses `left + (right - left) * alpha` in Number arithmetic.

Original and derived complete scenes pass the real `prepareEngineScene`.
`EngineTranslationClipError` uses `SCENE` for original admission and `FRAME`
for derived admission, retaining the actual provider error as its cause.
Other codes are `INPUT`, `VERSION`, `BUDGET`, `REFERENCE` and `RANGE`.
Valid local key values can still fail a nested world-transform or Float32
limit at the requested time. Only that sampled frame is validated.

Geometry, material, camera, hierarchy, rotations, scales, visibility and IDs
retain their original values. Save the full original scene, clip and request
to reconstruct the frame after opening the file. This CPU source service owns
no clock, playback loop, renderer, native CAD pose, simulation or browser.
It provides no quaternion, scale, blend, easing, event or interval certificate.

### Original camera frustum candidates for general engine scenes

`prepareEngineSceneFrustum(originalScene, request)` classifies the admitted
original Number world bounds of every mesh using the scene's complete camera:

```js
const candidates = prepareEngineSceneFrustum(originalScene, {
  format: 'barocss-gpu-engine-scene-frustum-request', version: 0,
  viewportWidth: 800, viewportHeight: 600,
});
console.log(candidates.candidateNodeIds);
```

The recursively frozen result is `{scene, request, entries, candidateNodeIds}`.
It retains independent complete original scene/request copies. Entries follow
original mesh-node order and contain `nodeId`, `geometryId`, `materialId`,
`classification` and `outsidePlane`. Groups produce no entry. Effective hidden
ancestry produces `hidden`; visible bounds produce `inside`, `intersecting` or
`outside`. Inside and intersecting IDs form the candidate list. An outside
entry names its first separating plane in near, far, left, right, bottom, top
order. Other entries have `outsidePlane: null`.

The six planes use the original Number camera basis and explicit integer
viewport dimensions in `1..2048`. For each plane, a centre/radius AABB interval
uses boundary band `1e-9 * (1 + abs(distance) + radius)`. Only a maximum below
the negative band excludes the box. Touching and near-boundary intervals stay
candidates. False positives are expected: a candidate is a box observation,
and does not establish a triangle or rendered-pixel hit.

Full source admission uses the actual `prepareEngineScene`, including hidden
resources. `EngineSceneFrustumError` code `SCENE` retains its actual provider
error as cause; other codes are `INPUT`, `VERSION`, `RANGE` and `NUMERICAL`.
One existing scene preparation is followed by at most 192 plane intervals.
No geometry/source edit or renderer draw replacement occurs. Save the full
original scene and viewport request to reconstruct the classification.
This CPU service provides no CSS/DPR mapping, Float32 raster agreement,
occlusion, native CAD hit, exact floating certificate or performance claim.


### Caller-time local quaternion rotation clips

`sampleEngineRotationClip(originalScene, originalClip, request)` evaluates one
caller-owned second using a separately versioned rotation source:

```js
const sampled = sampleEngineRotationClip(originalScene, {
  format: 'barocss-gpu-engine-rotation-clip', version: 0,
  id: 'turn', sceneId: originalScene.id,
  coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
  timeUnit: 'seconds', rotationOrder: 'xyzw',
  interpolation: 'shortest-path-nlerp',
  tracks: [{ nodeId: 'parent', keys: [
    { timeSeconds: 0, rotationXYZW: [0, 0, 0, 1] },
    { timeSeconds: 2, rotationXYZW: [0, 0, 1, 0] },
  ] }],
}, {
  format: 'barocss-gpu-engine-rotation-clip-request', version: 0,
  timeSeconds: 1,
});
```

The recursively frozen result is `{originalScene, clip, request, scene}`.
All four are independently owned source records. Only tracked local
`rotationXYZW` values change in the derived complete scene; original keys,
geometry, material, camera, hierarchy, translations, scales, visibility and
IDs retain their values. Save the full original scene, clip and request to
reconstruct the selected frame. Explicit composition with translation clips
uses the previous admitted derived scene and preserves both provenance records.

Time is a finite Number in `0..3600` seconds. Each uniquely identified group
or mesh track has `1..32` keys, with `0..32` tracks and at most 512 keys total.
Key times increase with separation of at least `1e-6` seconds. XYZW components
are finite dimensionless Numbers in `[-1,1]`, with unit norm within `1e-9`.
At held endpoints and exact internal keys, original coefficients and signed
zeros are copied before arithmetic. Inside a segment, temporary endpoints
are normalized; a negative dot negates only the temporary right endpoint,
and a zero dot retains its authored sign. Linear component interpolation is
then normalized. This explicit shortest-path nlerp has variable angular
speed; exact keys can change quaternion signs without changing orientation.

Request, clip metadata, key caps and coefficients, complete original scene,
all references, interpolation and complete derived scene are checked in that
order. `EngineRotationClipError` codes are `INPUT`, `VERSION`, `BUDGET`,
`REFERENCE`, `RANGE`, `SCENE` and `FRAME`. The last two retain the actual
`EngineSceneError` cause. Local valid keys can still fail world bounds or
representation at the selected time. Only that frame is validated. Two
existing bounded scene preparations retain their source/work limits; no
partial result or mutable execution plan is exposed on refusal.

This CPU source service owns no clock, player, loop, blending, events,
renderer, native CAD pose, simulation or browser. Slerp, multiple-turn spin,
scale/skin/morph channels and full interval validity are unsupported.


### Caller-time positive local-scale clips

`sampleEngineScaleClip(originalScene, originalClip, request)` samples a
separate positive scale source at one caller-owned second:

```js
const sampled = sampleEngineScaleClip(originalScene, {
  format: 'barocss-gpu-engine-scale-clip', version: 0,
  id: 'resize', sceneId: originalScene.id,
  coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
  timeUnit: 'seconds', interpolation: 'linear',
  tracks: [{ nodeId: 'parent', keys: [
    { timeSeconds: 0, scale: [1, 1, 1] },
    { timeSeconds: 2, scale: [2, 3, 4] },
  ] }],
}, {
  format: 'barocss-gpu-engine-scale-clip-request', version: 0,
  timeSeconds: 1,
});
```

The frozen independent source result is `{originalScene, clip, request, scene}`.
Only tracked local `scale` changes in the complete derived scene. Original
geometry positions, normals, UVs, indices, hierarchy, IDs, translations,
rotations, materials, camera and visibility retain their values. Nonuniform
scale uses the existing actual world and inverse-transpose normal transforms;
it is not baked into original geometry. Explicit source-service composition
retains each original scene, clip and request for cold reconstruction.

Dimensionless scale components must be finite Numbers in `0.01..100`.
Request/key time is `0..3600` seconds, with increasing key gaps of at least
`1e-6`. There are `0..32` unique group/mesh tracks, `1..32` keys per track,
and at most 512 total keys. Empty scenes and empty tracks are valid. Held
endpoints and exact internal keys copy literal coefficients before arithmetic;
strict interior segments use componentwise linear interpolation. This contract
has no zero, negative, mirrored, logarithmic or blended scale.

Own data, metadata, key counts/ranges, complete original scene, all references,
interpolation and complete derived frame are checked in that order.
`EngineScaleClipError` codes are `INPUT`, `VERSION`, `BUDGET`, `REFERENCE`,
`RANGE`, `SCENE` and `FRAME`; the last two retain the actual scene provider
cause. Positive local keys can still fail nested world, normal, triangle or
Float32 limits. Refusal returns no partial frame. Two unchanged bounded scene
preparations retain their source/work limits. Only the selected frame is
validated, with declared Number rounding and no interval certificate.

Save the full original scene, clip and request. This CPU source service owns
no clock, player, loop, renderer, native CAD scaling, simulation or browser.
Existing native millimetre display poses have a separate scale contract.


### Original material opacity and object order (CPU source service)

`prepareEngineOpacityBindings(scene, opacityBindings)` prepares one complete
original scene0 and a separate dimensionless opacity companion0:

```js
const prepared = prepareEngineOpacityBindings(originalScene, {
  format: 'barocss-gpu-engine-opacity-bindings', version: 0,
  sceneId: originalScene.id,
  bindings: [{ materialId: 'glass', opacity: 0.5 }],
});
```

The companion has exactly `format`, `version`, `sceneId` and `bindings`.
Each of its 0..32 dense own data bindings has exactly `materialId` and
`opacity`: unique existing material ID, finite Number within 0..1. Hidden
and unused material references are validated. Unbound materials default to
1 without adding defaults to the original companion. Authored negative-zero
is retained and has zero-opacity semantics. Accessors and extra fields refuse.

The frozen result has exactly `{scene, opacityBindings, opaqueNodeIds,
transparentNodeIds, omittedNodeIds}`. `scene` is the actual prepared scene:
complete frozen original `scene.scene` and separately owned mutable typed
execution buffers. New companion records and all three ID arrays are frozen
and independent. Groups have no list entry. Effective-hidden or zero-opacity
meshes are omitted; opaque meshes keep original source order. Transparent
meshes sort far to near by original Number camera-forward depth of original
world AABB centres; exact ties keep source order. Behind-camera and outside
frustum meshes remain in the lists. Opacity does not alter original scene
draws, geometry, camera, poses or CPU ray/frustum query authority.

Preflight checks all own metadata, counts and opacity values before one
complete scene preparation, then all material references before sorting.
There are at most 32 depth keys and 496 insertion-sort pair comparisons;
existing scene/geometry caps remain. `EngineOpacityBindingsError` codes are
`INPUT`, `VERSION`, `BUDGET`, `REFERENCE`, `RANGE`, `SCENE` and `NUMERICAL`.
Scene and reflection refusals preserve real causes. Each call leaves caller
inputs and prior accepted originals untouched.

Save the complete original scene and companion. Ordinary JSON drops the sign
of negative-zero; retain a separate sign record if exact Number sign matters.
Cold reconstruction revalidates both original inputs. This API prepares source
order; existing opaque renderers do not consume the companion. Actual blending,
shader pixels, GPU resources, transparent visibility and triangle sorting need
separate renderer qualification. No rendered transparency, PBR or textured
alpha support is implied.

ONE source/API/file flow: `node examples/gpu-scene/engine-opacity-bindings-flow.mjs
--output <fresh-directory>`.


### Original ambient/directional light bindings (CPU source service)

`prepareEngineLightingBindings(scene, lightingBindings)` admits the complete
original scene0 and an independent dimensionless world-light companion0:

```js
const prepared = prepareEngineLightingBindings(originalScene, {
  format: 'barocss-gpu-engine-lighting-bindings', version: 0,
  sceneId: originalScene.id,
  lighting: { ambientStrength: 0.25, directionalStrength: 0.75,
    direction: [0, 0, 1] },
  bindings: [{ materialId: 'paint', response: 'lambert' }],
});
```

The companion has exactly `format`, `version`, `sceneId`, `lighting` and
`bindings`. Lighting has exactly the existing `MeshLighting` fields shown
above. Strengths are finite Numbers in 0..1 with sum at most 1. Direction
is an original nonzero finite XYZ array with components within -1000..1000;
it points from the surface toward the light in right-handed Y-up world
coordinates. Original coefficients and negative-zero signs are retained.
Up to 32 dense own bindings have exactly `materialId` and `response`;
response must be `lambert`, with unique existing material IDs. Hidden and
unused materials are validated. Unbound materials remain original unlit
source, and original scene material types are unchanged.

The frozen result is exactly `{scene, lightingBindings, lightDirection,
litMaterialIds}`. `scene` is one complete prepared scene, with frozen original
`scene.scene` separate from independently owned mutable typed execution
buffers. Original companion/lighting/binding records, original and derived
Number directions, and material ID list are frozen independent copies.
`litMaterialIds` retains binding order. Scale-then-hypot normalization gives
a separately derived Number unit direction, including subnormal original
components. No source coefficient is replaced with this derived direction.

All own data/counts/lighting/binding values admit before scene preparation;
all references admit before normalization. The unchanged actual mesh lighting
validator supplies numeric/range/nonzero checks. There is one bounded scene
preparation, at most 32 binding references and one three-component
normalization. Existing scene/geometry work and source limits remain.
`EngineLightingBindingsError` codes are `INPUT`, `VERSION`, `BUDGET`,
`REFERENCE`, `LIGHTING`, `SCENE` and `NUMERICAL`; actual validator, scene and
reflection causes are retained. Oversized arrays refuse before key enumeration.
Refusal returns no partial source and preserves caller and accepted originals.

Save the full original scene and companion; retain an explicit sign sidecar
when ordinary JSON would discard negative-zero. Reopening recomputes only
the derived unit direction and execution data. This service prepares original
light bindings; existing opaque renderers do not consume them. It does not
render Lambert pixels, alter native gamma2.2 lighting, add PBR/shadows or
qualify GPU resources. Generic linearRGB/sRGB rendering is a separate stage.

ONE source/API/ray/file flow:
`node examples/gpu-scene/engine-lighting-bindings-flow.mjs --output <fresh-directory>`.

### General engine authored material source (companion0, CPU)

`prepareEngineMaterialBindings(scene, companion)` connects the existing
MeshMaterial compiler and trusted lowering to original scene0 material IDs.
The companion has exactly `format: 'barocss-gpu-engine-material-bindings'`,
`version: 0`, `sceneId` and `bindings`. Each binding has exactly `materialId`,
`material` (full original MeshMaterialIR/source) and `uniforms` (supplied scalar
record). Up to eight unique existing material IDs are supported, including
hidden and unused materials. Original scene unlit material records stay intact.
This companion describes untextured opaque emission; rendering is a separate stage.

The result has exactly `scene`, `materialBindings`, `resolvedBindings` and
`loweredBindings`. The first is one actual prepared complete scene.
`materialBindings` retains full original IR/source and supplied uniform values,
including signed zero and omissions. `resolvedBindings` entries have
`{materialId, binding}` with the actual reconstructed MeshMaterialBinding;
the unchanged internal binder fills defaults, checks declared ranges and
normalizes zero. `loweredBindings` entries have `{materialId, lowered}` with
the existing trusted expression, declarations and uniform layout. Catalogs
retain binding order, are independently copied/deeply frozen and have no nested
aliases to caller data or each other. Scene execution buffers remain mutable
and independently owned. The internal standalone binder is not a public export.

All source/header/count guards and own-data snapshots precede providers.
Limits are eight bindings, 64KiB aggregate UTF8 source (code-unit preflight
before encoding), 16 declared/supplied uniforms per binding and 128 of each
in aggregate, 8192 snapshot values per binding (65536 aggregate) and depth24.
Snapshot records allow at most16 own keys; dense arrays allow at most256 values,
with length guards before enumeration. Accessors, hidden/symbol fields, foreign
prototypes, cycles, nonfinite data and unsupported fields refuse. Root/binding
records may use a null prototype; full IR and supplied/nested records require
Object.prototype. Snapshot counts are confirmed before provider calls.
`__proto__` uniform declarations/values refuse `INPUT` because the existing
internal binder cannot supply an own numeric property for that name. The
compiler and native binding paths are unchanged. All other accepted names,
grammar, canonical IR, range and zero behavior remain existing provider authority.

There is one actual binder and one actual lowerer call per binding, up to16
source reconstructions, followed by one actual complete scene preparation and
all scene/material reference checks. No parser cache or geometry rescan is
claimed. Codes are `INPUT`, `VERSION`, `BUDGET`, `REFERENCE`, `MATERIAL`, `SCENE`;
actual material/scene/reflection causes remain available. Refusal returns no
partial source and preserves caller and previously accepted originals.

Persist the full original scene/companion, with an explicit sign sidecar where
ordinary JSON discards negative zero. Resolved defaults/lowering are derived
data and must not replace original supplied uniform records. Shader ID alone
does not identify source: the same ID can have different complete sources;
different material bindings can supply different values for the same source.
This service has no program cache, GLSL from callers, geometry attributes,
texture/light/alpha composition, pixels, GL resources or consumer adoption.

ONE source/API/file/cold flow:
`node examples/gpu-scene/engine-material-bindings-flow.mjs --output <fresh-directory>`.

### Authored engine UV material grammar (distinct source profile, CPU)

`compileEngineUVMaterial(source)` adds dimensionless scalar inputs `uv_u` and
`uv_v` to the existing material grammar in a distinct profile. It returns
`{ok: true, material}` or `{ok: false, diagnostics}`. Full IR has exactly
`format: 'barocss-gpu-engine-uv-material'`, `version: 0`,
`profile: 'engine-opaque-uv-fragment-v0'`, `source`, `shaderId`, `uniforms`
and `expression`. New leaves are `{kind: 'input', type: 'float', name: 'uv_u'}`
or `uv_v`; existing expression shapes/desugaring remain unchanged.

```css
@shader #uv_gradient {
  @let ratio: float(clamp(uv_u, 0, 1));
  @fragment { color: mix(#000000, #FFFFFF, ratio); }
}
```

The input interval is `[-1000, 1000]`, matching original TriangleGeometry UV
admission. It is not implicitly `[0, 1]`; the example explicitly clamps it.
These channels are not screen coordinates, time, scene units or native CAD
parameters. Existing scalar/color type and range guards apply. Each input use
costs one node; local expansion also costs the complete expanded expression.
Limits remain 64KiB UTF8 source, 4096 tokens plus EOF, 16 uniforms/locals,
256 definition and expanded nodes, depth16, literals/declarations within1000
and intermediate range within1e6. No new evaluator, texture sampling or caller GLSL.

`validateEngineUVMaterialIR(input)` performs one existing bounded own snapshot
and one reconstruction from full original source, then compares canonical IR.
Own limits remain8192 visited values/depth24,16 record keys/256 dense array
values; accessors, cycles, hidden/symbol fields, foreign prototypes and
nonfinite data refuse. This inherited snapshot reflects descriptors before
array cardinality checks. Successful compile/validation yields fresh frozen
IR; numeric zero is canonicalized and original source text is preserved.
Forged/unsupported IR refuses `MeshMaterialError` with code `IR`. Source
reconstruction errors preserve actual source offsets and the actual compiler
diagnostic as `cause`; reflection `INPUT` errors preserve the actual exception.
Other codes remain existing `SYNTAX`, `TYPE`, `RANGE`, `BUDGET` and `INPUT`.
New diagnostic/error messages are bounded to1024 characters.

`lowerEngineUVMaterial(input)` performs one actual validation/reconstruction
then shared trusted lowering. Its deeply frozen result has exactly `expression`,
`uniformDeclarations`, `uniformLayout` and
`inputDeclarations: 'in vec2 v_engine_uv;'`. Inputs lower only to
`v_engine_uv.x/y`; uniforms remain `mat_u_N`. Existing linear color constants,
numeric precision, mix ratio/output clamps remain. Layout records are
independent copies. This is compiler text, without linked shader/pixel support.

The legacy compiler/profile/IR and its public expression type exclude input
leaves. Legacy declared uniforms named `uv_u`/`uv_v` retain their meaning;
only the new profile prohibits declarations shadowing input names. Legacy
and UV IR reject each other's validation/lowering paths. Legacy lowering
retains its original mutable three-field result. Current material companion0
and native renderers still accept only the legacy profile; a future distinct
binding and renderer contract must consume the UV profile explicitly.
No GPU program/cache/gamma/resource lifetime or consumer adoption is implied.

ONE source/IR/API/file/cold flow:
`node examples/gpu-scene/engine-uv-material-flow.mjs --output <fresh-directory>`.

### Original UV material-ID source binding (CPU companion0)

`prepareEngineUVMaterialBindings(sceneInput, materialInput)` prepares a distinct
`barocss-gpu-engine-uv-material-bindings` version0 companion. Root fields are
exactly `format`, `version`, `sceneId`, `bindings`; entries are exactly
`materialId`, full `EngineUVMaterialIR`, `uniforms`. The material ID must exist
in the original admitted scene, be unique in the catalog, and the scene ID must
match. Hidden or unused materials still undergo complete admission. Empty
catalogs are allowed. Existing companion0 remains legacy-profile only; each
companion refuses the other's root format and material IR. No mixed catalog.

The result has exactly `scene`, `materialBindings`, `resolvedBindings` and
`loweredBindings`. Original full source/comments/IR, supplied omissions/values
and negative zero remain frozen in `materialBindings`. Separate resolved
bindings reconstruct the actual UV source, fill declared defaults and normalize
numeric zero. Separate trusted lowered catalogs retain the UV compiler's four
fields, including `inputDeclarations: 'in vec2 v_engine_uv;'`. Every catalog,
record and layout is frozen and independent. Original scene/UV/IDs remain
separate from mutable derived typed buffers and other preparations.

This reuses private catalog admission, actual UV validation/uniform binding/
lowering and one actual scene admission. Limits are eight bindings, 16 declared
and supplied uniforms per binding (128 of each aggregate), 64KiB aggregate
UTF8 source with code-unit preflight before encoding. Own snapshots preserve
original signs; 8192 visited values/depth24 per entry, record keys16, dense
arrays256, with array cardinality checked before enumeration. All headers,
counts, byte guards and entry snapshots precede any material provider. At most
16 actual source reconstructions (eight binding and eight lowering), then one
scene admission before identity checks. Existing compiler/scene limits remain.
Finite supplied scalars must have declared names and ranges; omitted values use
defaults. The service refuses `__proto__` declarations/values with `INPUT`,
matching the existing catalog boundary.

Errors reuse `EngineMaterialBindingsError`/diagnostic codes and retain actual
causes: `INPUT`, `VERSION`, `BUDGET`, `REFERENCE`, `MATERIAL`, `SCENE`.
Messages are bounded to1024 characters. Forged IR/source/profile or bad numeric
uniforms preserve the real material error and source diagnostic offsets; scene
refusals preserve the actual scene cause. No partial result or caller mutation.

This admits original analytic UV source and trusted text; it does not execute
shaders, supply caller UV values, mount a renderer or establish pixel, gamma,
resource/cache/lifetime or consumer support. Dimensionless original triangle UV
is the authority; native CAD parameters are separate. Consumer source document
and actual renderer composition require their own contracts and receipts.

ONE source/API/file/cold flow:
`node examples/gpu-scene/engine-uv-material-bindings-flow.mjs --output <fresh-directory>`.

### Repeating original UV material grammar (distinct source profile, CPU)

`compileEngineUVRepeatingMaterial(source)` adds only `fract(floatExpression)`
to the existing UV grammar, in a distinct profile. Its result shape is the
existing `{ok: true, material}` or `{ok: false, diagnostics}`. IR has exactly
seven fields: `format: 'barocss-gpu-engine-uv-repeating-material'`, `version: 0`,
`profile: 'engine-opaque-uv-repeating-fragment-v0'`, full original `source`,
`shaderId`, `uniforms`, `expression`. The new scalar call is
`{kind: 'call', type: 'float', name: 'fract', args: [expression]}`.

```css
@shader #repeating_gradient {
  @let ratio: float(fract(uv_u));
  @fragment { color: mix(#000000, #FFFFFF, ratio); }
}
```

Declared semantics are `x - floor(x)`, including negative inputs. The entire
argument interval must remain within `[-1000, 1000]`; otherwise `RANGE` refuses
at the original call token. Its conservative compiler interval is `[0, 1]`,
so the example can use it as a mix ratio. This is one call node plus the actual
argument/expanded-local nodes. Exactly one float argument is required (`TYPE`).
The new profile reserves the local name `fract`; bare declared uniforms with
this name keep the existing uniform semantics. Original UV units/ranges,
source bytes, tokens, declarations, nodes and depth limits remain unchanged.

`validateEngineUVRepeatingMaterialIR(input)` uses one inherited own snapshot
and one reconstruction from full source, then exact canonical comparison.
Reflection errors retain their actual cause; source refusal retains the real
compiler diagnostic and original UTF16 offsets. UTF8 source budget remains
64KiB. Successful IR is fresh and frozen; source/comments are retained and
canonical zero is positive. Inherited own-data guards/limits remain unchanged.

`lowerEngineUVRepeatingMaterial(input)` validates once, then uses the same
trusted lowerer. It emits `fract(...)` and the existing fixed UV input
 declaration, uniform declarations/layout and output/mix clamps. Its exact
four-field result and copied layouts are frozen. This is GLSL text; hardware
precision at wrapping boundaries and actual shader/pixel behavior are unrun.
No evaluator or caller-provided UV values are introduced.

Legacy and UV0 grammar/IR types exclude `fract` and still refuse this call.
Their validation/lowering paths refuse repeating IR, and repeating validation
refuses their IR. Current material and UV companion0 reject this new profile;
a future explicit binding/document/renderer contract is required. No silent
profile upgrade, renderer/cache/resource/consumer or publication support.

ONE source/IR/API/file/cold flow:
`node examples/gpu-scene/engine-uv-repeating-material-flow.mjs --output <fresh-directory>`.

### Repeating UV material-ID source binding (CPU companion0)

`prepareEngineUVRepeatingMaterialBindings(sceneInput, materialInput)` admits
only the distinct `barocss-gpu-engine-uv-repeating-material-bindings` version0
companion. Exact root fields are `format`, `version`, `sceneId`, `bindings`;
entries are `materialId`, full `EngineUVRepeatingMaterialIR`, `uniforms`.
The complete original source/IR/profile is validated. Original scene ID must
match; bindings require unique existing material IDs, including unused/hidden
materials. Empty catalogs are permitted. Existing legacy/UV0 companion formats
and IR admission remain unchanged; each explicit companion rejects other profiles.

The exact four-field result is `scene`, `materialBindings`, `resolvedBindings`,
`loweredBindings`. Original full source/comments/IR, supplied omissions/values
and negative zero remain independently frozen. Resolved bindings reconstruct
actual repeating source, fill declared defaults and normalize numeric zero.
Trusted lowering retains four frozen fields and the fixed UV input declaration.
Original scene/UV/IDs remain separate from mutable derived typed buffers.
No same-ID shader cache or caller-supplied UV values are implied.

This uses the same private catalog guards and a shared private UV binding helper.
All headers/counts/source guards and sign-preserving snapshots run before actual
material providers. Bounds remain eight bindings, 16 declared/supplied uniforms
per binding and128 of each aggregate, 64KiB aggregate UTF8 with a code-unit
preflight, 8192 own values/depth24 per entry, 16 record keys and256 dense array
values. Array counts precede enumeration. No getters/hidden/symbol/cycle/foreign/
nonfinite data. The service refuses `__proto__` declarations/values with `INPUT`.
At most16 actual source reconstructions, then one scene admission before identity
checks. Compiler/source/profile/argument/node and original scene limits remain.

Errors reuse `EngineMaterialBindingsError` and the actual `INPUT`, `VERSION`,
`BUDGET`, `REFERENCE`, `MATERIAL`, `SCENE` codes. Real material errors retain their
source diagnostic/UTF16 offsets; scene/reflection errors retain actual causes.
No partial result or mutation of accepted data/files. This is source/catalog
admission, without shader execution, wrapping precision, interpolation/pixels,
resource/cache/lifetime, consumer document or publication support.

ONE source/API/file/cold flow:
`node examples/gpu-scene/engine-uv-repeating-material-bindings-flow.mjs --output <fresh-directory>`.


### Original indexed triangle normal generation

`prepareTriangleGeometryWithNormals(source)` admits an explicit
`barocss-gpu-triangle-normal-source` version 0 source with positions, UVs and
indices. Positions use scene units in right-handed Y-up coordinates; UVs are
dimensionless. Each source vertex must be referenced. Normals use incident
CCW triangle area vectors from original Number positions, accumulated by vertex
index and normalized once. Duplicate positions with different indices remain
independent. Degenerate triangles, unused vertices, cancelling sums and invalid
incident winding are refused. Split sharp edges explicitly when needed.

The result contains frozen original `source`, the method
`area-weighted-original-triangle`, and an actual `prepared` triangle geometry.
Original signed data, generated Number normals and mutable execution buffers are
independent. Existing geometry0 still requires explicit normals. Limits are
131072 vertices and triangles, 1048576 original numeric values, plus the existing
geometry and Float32 representation limits. This API performs one existing
geometry admission; it does not allocate WebGL resources.

The source, emitted API and cold-file example is
`examples/gpu-scene/triangle-normal-generation-flow.mjs`.


### Atomic local TRS clips

`sampleEngineTransformClip(scene, clip, request)` samples complete local
translation, XYZW quaternion and scale keys at one explicit caller time. The
new `barocss-gpu-engine-transform-clip` version 0 profile uses scene units,
right-handed Y-up coordinates, seconds and
`linear-trs-shortest-path-nlerp` interpolation. All three channels are required
on each key. Translation and scale interpolate linearly; rotation uses the
existing shortest-path normalized linear interpolation semantics. Held and
exact endpoints preserve authored coefficients.

All tracked node transforms replace together before final scene admission. This
allows a valid complete frame even when a single-channel intermediate exceeds
world bounds. Original scene, clip and request remain frozen and independent;
`result.scene` is the final prepared scene with separately mutable execution
buffers. Existing sparse translation, rotation and scale clips stay unchanged.

Limits are 32 tracks, 32 keys per track and 512 aggregate keys. Seconds are
0..3600 with key gaps at least 1e-6. Translation is within +/-1000, positive
scale .01..100 and unit quaternion tolerance 1e-9. Exactly one original and one
final scene admission retain the existing scene budgets. Errors preserve actual
reflection or scene causes; `SCENE` identifies original admission and `FRAME`
identifies final admission. This API has no clock, renderer or playback loop.

The source, emitted API and cold-file example is
`examples/gpu-scene/engine-transform-clip-flow.mjs`.


### Source2 local XYZ scale

`compileAffineSceneSource(source)` compiles a distinct Source2 source profile for
Sphere, Box, Cylinder, Capsule, Rounded Box and Torus. Use `version: 2` and
`scale: x y z;` on type or ID rules. Each scale is dimensionless and within
.01..100; omitted scale is `[1, 1, 1]`. Existing shape dimensions, endpoint
coordinates and Euler rotations keep their original meaning. Transforms apply
local scale, then X/Y/Z rotation, then translation about the existing local
origin. Source0 and Source1 APIs keep their original profiles.

The frozen result preserves full original source, canonical Scene2 and trusted
vertex/fragment text under `source2-local-positive-xyz-min-step-v0`. It reuses
the existing parser, semantic shape validators and distance kernels. Source
limits remain 64 KiB UTF8, 32 objects, 128 rules and 512 declarations. Error
diagnostics use original UTF16 positions. Reopen by compiling the full original
source string; generated shader text is derived data.

Nonuniform scale maps queries through inverse rotation and component division,
then multiplies local distance by the minimum executed scale. The resulting
field is conservative in ideal arithmetic and is not exact world distance.
Original Number values and executed Float32 constants stay distinct. Hardware
precision, ray convergence, normals, pixels and resources have not been
qualified by this source compiler. Existing renderers do not accept Source2.

A six-shape source is `examples/gpu-scene/affine-scene-authoring.css`. The source,
emitted API and cold-file flow is `affine-scene-source-flow.mjs` in that folder.


### Original Source1 / Source2 object bounds (CPU)

`prepareSourceSceneBounds({sourceVersion:1|2,source,objectIds?})` reconstructs
original source through the actual compiler. Omit `objectIds` for all objects,
pass `[]` for no objects, or pass unique current IDs. Returned objects follow
original scene order. Unknown IDs, unsupported source and malformed own data
refuse with `SourceSceneBoundsError` and the declared diagnostic code.
Diagnostic codes distinguish own-data INPUT, requested VERSION, source/selection
BUDGET, actual compilation SOURCE, malformed/duplicate/unknown-ID SELECTION
and defensive finite-arithmetic NUMERICAL. Compilation errors retain actual
native diagnostics/errors as their cause.
The request admits at most32 IDs and64KiB source; no getter is invoked.

The frozen result preserves the complete original source and independent
canonical Scene1/Scene2 copy, requested selection (null for omission), per-object
`localBounds`/`worldBounds` and aggregate `bounds` (null for an empty selection).
It declares version0/profile `original-number-box-corners-v0`, right-handed Y-up,
scene units and `binary64-box-corners-no-padding`. Bounds have `min`/`max` XYZ
arrays. No camera is inferred or changed.

Local boxes use actual primitive conventions: sphere radius, Box/RoundedBox
outer half-size, cylinder XZ radius/Y half-height, capsule endpoint ranges plus
radius, and torus XZ major+minor/Y minor. Eight corners per selected object
(at most256) apply Source2 positive XYZ scale, forward Rz*Ry*Rx and translation
using the existing rotation coefficients. Source1 uses identity scale. Legal
large Source2 bounds remain available even outside the camera's range.

These Number computations describe primitive box enclosure in ideal arithmetic;
rotated curved primitives can have loose boxes. Rounded outputs have no outward
padding or rigorous rounding certificate. They do not certify Float32 shaders,
raymarch/pixel containment, exact native extrema, safe culling or continuous
animation bounds. Source spelling/signs remain original; canonical zero policy
is the actual compiler's. CPU data is copied, frozen and GC-owned; no DOM, GL,
resources, cache, file transport or renderer adoption occurs here. Render's
Frame all/selected UI and camera acceptance remain separate.

Run the bounded source/API/emitted/file flow after building, with a fresh output:

```sh
node examples/gpu-scene/source-scene-bounds-flow.mjs --output /absolute/fresh/output
```


### CPU authored material color inspection

`evaluateAuthoredMaterial({material,uniforms,uv?})` reconstructs one existing
Mesh, UV or repeating material through its actual binder, resolves declared
uniform defaults/overrides and evaluates the canonical tree in JavaScript
binary64. `uniforms` is required; `{}` selects defaults. UV/repeating profiles
require a dense dimensionless UV tuple within[-1000,1000]; legacy Mesh forbids
UV. Supplied UV -0 is preserved; inherited uniforms and final RGB normalize
zero to +0. The new service refuses `__proto__` uniform names explicitly.

The fresh deeply frozen sample has exact fields `format,version,profile,
colorSpace,uvUnit,source,material,uniforms,uv,linearRGB`. Format is
`barocss-gpu-authored-material-sample`, version0, profile
`binary64-linear-rgb-v0`. It retains original source and independent canonical
material. This is authored linear RGB only, without lighting/gamma/alpha,
texture, geometry, clock, rendered pixels or a GPU precision certificate.

Canonical traversal counts at most256 occurrences/depth16. Existing expanded
functions keep their recorded operation order. Color mix clamps the ratio,
then evaluates A*(1-r)+B*r per channel; final RGB clamps to[0,1]. Actual provider
budgets and two independent8192-visit/depth24 snapshots remain unchanged.
`AuthoredMaterialEvaluationError` exposes code and actual cause; inherited
legacy lost source offsets are not reconstructed. Messages are at most1024
characters; reflection proxies have no side-effect guarantee.

For a phase uniform in[-1,1], the existing repeating compiler refuses
`fract(uv_u+phase)` because its inferred range exceeds[-1000,1000]. Use the
existing composition `fract(clamp(uv_u,-999,999)+phase)` for bounded inspection.
CPU evaluation/native adoption, editor use, actual graphics and publication
are separate stages.


### Primitive presentation recovery failure

A failed candidate plus failed accepted-frame presentation recovery returns
`PrimitiveSceneRecoveryError extends AggregateError`, with fixed name/message,
readonly `code:'CONTEXT'` and standard `errors` exactly `[original,recovery]`.
The owned two-element array is frozen; cause objects retain their identities
and are not frozen or normalized. Successful recovery retains the original
candidate Error object and existing UpdateResult signature.

Failed recovery makes presentation unavailable. It does not assert actual
hardware context loss. Subsequent GPU presentation/readback refuses; dispose
still releases owned live-context resources using actual `gl.isContextLost()`.
Viewer must consume the published fatal error to retain native CPU/provenance
while fencing Open/Fit/presentation. There is no public private-state getter,
new renderer/profile or resize-recovery promise. Code/build/public-error checks
are separate from actual single/double-fault WebGL2/Viewer/resource proof.

### Generic indexed Box authoring

`prepareBoxGeometry(input)` accepts exact Box source0 parameters:
`{format:'barocss-gpu-box-geometry',version:0,id,coordinateSystem:'right-handed-y-up',positionUnit:'scene',sizeXYZ:[width,height,depth]}`.
Dimensions are finite Numbers satisfying `0 < size <= 2000` in scene units. The
Box is centred at the origin. Existing EngineScene nodes supply poses.

The frozen result `{source,prepared}` retains original dimensions and uses
`prepareTriangleGeometry` for the generated original Number geometry and
independent mutable Float32 execution buffers. Six flat faces have 24 split
vertices, 12 outward CCW triangles, face-local dimensionless UVs and Uint16
indices: 840 buffer bytes. Face order is +X, -X, +Y, -Y, +Z, -Z. UV seams and
flat normals remain separate; this does not generate native CAD topology or
replace SDF Box kernels.

Errors reuse `TriangleGeometryError`. Exact data, metadata, dimension bounds,
original area and Float32 nonzero/collapse checks apply. Tiny positive dimensions
can genuinely refuse; values are never enlarged or clamped. Source/caller data
and independent calls do not share mutable arrays. Existing general renderer,
pixels, lifetime, textures and publication retain their separate qualifications.

`examples/gpu-scene/box-geometry-flow.mjs --output <fresh-directory>` exercises
source/emitted APIs, independent Box attributes, a shared two-instance scene,
refusals and original parameter files with cold reconstruction.

## Original indexed Plane geometry

`preparePlaneGeometry(input)` accepts exact original parameters:
`{format:'barocss-gpu-plane-geometry',version:0,id,coordinateSystem:'right-handed-y-up',positionUnit:'scene',sizeXY:[width,height],segmentsXY:[nx,ny]}`.
Dimensions are finite Numbers in scene units, `0 < size <= 2000`. Cell counts
are integers from 1 to 128 per axis. The plane lies in XY, centred at the origin, with
+Z normals. Existing scene node poses supply orientation and placement.

The frozen `{source,prepared}` result keeps independent original parameters
and generated Number attributes. One existing `prepareTriangleGeometry` call
creates independent mutable Float32 attributes and Uint16 indices. Vertex
`j*(nx+1)+i` has position `[width*(i/nx-.5),height*(j/ny-.5),0]`, normal `[0,0,1]`
and UV `[i/nx,j/ny]`. Each cell a, b=a+1, c=a+nx+1, d=c+1 has CCW indices
`[a,b,d,a,d,c]`. Vertices and cells follow rows from bottom to top, left to right.

There are `(nx+1)*(ny+1)` vertices and `2*nx*ny` triangles. The maximum lattice
has 16,641 vertices, 32,768 triangles and 729,120 typed buffer bytes. Segments
are admitted before attribute generation. Existing `TriangleGeometryError`
codes and original/F32 area, range and collapse refusals apply; tiny positive
sizes can refuse. Source and separate calls never share mutable arrays.
This is generic mesh authoring; native CAD Plane, topology, renderers and
publication retain their separate contracts.

`examples/gpu-scene/plane-geometry-flow.mjs --output <fresh-directory>` covers
source/emitted APIs, original parameters/files, shared scene instances,
source-coordinate ray queries, bounded refusals and cold reconstruction.

## Original indexed Sphere geometry

`prepareSphereGeometry(input)` accepts exact original parameters:
`{format:'barocss-gpu-sphere-geometry',version:0,id,coordinateSystem:'right-handed-y-up',positionUnit:'scene',radius,longitudeSegments,latitudeSegments}`.
The finite radius satisfies `0 < radius <= 1000` in scene units. Longitude
segments are integers from 3 to 128; latitude segments from 2 to 128.
The sphere is centred at the origin, with its poles on the Y axis.

Frozen `{source,prepared}` keeps original parameters and independently generated
Number geometry. One existing `prepareTriangleGeometry` call creates mutable
Float32 attributes and Uint16 execution indices. Interior rings use
`theta=PI*(j/H)`, `phi=(2*PI)*(i/W)`, radial normal
`[sin(theta)*cos(phi),cos(theta),sin(theta)*sin(phi)]`, position `radius*normal`
and UV `[i/W,1-j/H]`. The final longitude copies the first position and normal
exactly with U=1. Each sector has independent exact pole position/normal and
UV `[(i+.5)/W,1 or 0]`. Radial normals remain distinct from facet normals.

Vertex order is all interior rings, then north poles, then south poles.
Outward CCW top fans precede middle cells and bottom fans; no degenerate pole
quads are emitted. Counts are `(H-1)*(W+1)+2*W` vertices and `2*W*(H-1)`
triangles, capped at 16,639 vertices, 32,512 triangles and 727,520 typed bytes.
Parameters are admitted before generation. Existing `TriangleGeometryError`
codes and original/F32 range, area, normal and collapse checks remain; tiny
positive radii can refuse. Calls and input records share no mutable arrays.

Original trig and Float32 values are executed approximations. Bounds describe
sampled vertices, not an exact analytic sphere enclosure. This generic mesh
does not replace SDF Sphere or native CAD identity, certify tessellation error
or establish renderer, pixel, resource, performance or publication support.

`examples/gpu-scene/sphere-geometry-flow.mjs --output <fresh-directory>` checks
source/emitted APIs, seam/pole ownership, shared scene instances, copied buffers,
refusals and original files with cold reconstruction.

## Complete native frame CPU preflight

`preparePrimitiveSceneFrame(input, profile='qualified-v2')` admits a complete
existing frame0: `{version:0,scene:{version:2,entries},options,particles:null,materials}`.
It validates native geometry, display poses, camera, lighting and candidate
qualified opaque Surface material bindings together. No canvas, context,
listener, GPU handle or presentation is created. The qualified profile requires
1..4 primitives. Explicit `'viewport-v2'` additionally admits an empty scene
with no materials. Particles and cloth are excluded from this CPU profile.

The frozen result has `format:'barocss-gpu-primitive-frame-preflight'`, version0,
profile, canonical copied `frame`, prepared `primitives`, derived `bounds` and
`bufferBytes`. Original native packets/samples/UV/IDs and admitted poses remain
separate from independently mutable Float32 display views and Uint16 indices.
Bounds describe those display views; they are null for empty. Byte totals count
the owned execution views, excluding original data and driver storage.

Materials retain input order and reference candidate Surfaces. Existing source
validation, uniform defaults, declared ranges and canonical numerical zero
apply. Records and original arrays are frozen; execution views belong to the
caller. Mutating those views does not change `.frame`. Re-admit `.frame` through
the supported API before a later mount or update; the prepared DTO is inspectable
CPU data and is not a trusted backend token. Existing constructors and updates
keep their own signatures and validation.

Existing native/sample/material caps and errors remain. Actual Error identities
propagate; a thrown non-Error is wrapped in GPUError with its original cause.
Preflight success does not establish shader compilation, device capacity,
complete first presentation, rollback, lifecycle or rendered Open. Those remain
separate requirements of #1375. A failed first mount has no accepted frame to
roll back. Existing #1334 update recovery retains its own semantics.

`examples/gpu-scene/primitive-frame-preflight-flow.mjs --output <fresh-directory>`
uses genuine authored native Surface assets, two materials, explicit poses and
camera/light, source/emitted APIs, copied files and cold CPU reconstruction.

## Original indexed Torus geometry

`prepareTorusGeometry(input)` accepts exact original parameters:
`{format:'barocss-gpu-torus-geometry',version:0,id,coordinateSystem:'right-handed-y-up',positionUnit:'scene',majorRadius,minorRadius,majorSegments,minorSegments}`.
Finite scene-unit radii satisfy `0 < minorRadius < majorRadius` and executed
Number `majorRadius + minorRadius <= 1000`. Both cell counts are integers from
3 to 128. The ring is centred at the origin around Y, with its centreline in XZ.

Frozen `{source,prepared}` preserves original scalar parameters and generated
Number geometry through one existing `prepareTriangleGeometry` call. Independent
mutable Float32 attributes and Uint16 indices remain separate. Rows use the tube
angle beta and columns the major angle phi. Position is
`[(R+r*cos(beta))*cos(phi),r*sin(beta),(R+r*cos(beta))*sin(phi)]`, radial normal
`[cos(beta)*cos(phi),sin(beta),cos(beta)*sin(phi)]`, UV `[i/W,j/H]`.
Last column copies each row's first position/normal exactly; last row copies the
first row, including the double corner. Both UV endpoints remain distinct.
Outward CCW cell indices are `[a,d,b,a,c,d]`, where b=a+1, c=a+W+1, d=c+1.

Maximum counts are 16,641 vertices, 32,768 triangles and 729,120 typed bytes.
All parameter admission precedes generation. Existing TriangleGeometryError
codes, original/F32 area/range/nonzero/collapse refusals and actual causes apply.
Tiny or near-horn cases may refuse; there is no clamp, trig snapping or healing.
Radial normals differ from facets, and bounds describe sampled vertices rather
than exact analytical enclosure. SDF Torus Float32 radius-coefficient rules and
native CAD topology/identity remain separate; this does not replace either kernel.
Renderer, pixels, quality/error, physical memory, parity and publication retain
separate qualifications.

`examples/gpu-scene/torus-geometry-flow.mjs --output <fresh-directory>` checks
source/emitted APIs, double seams/winding, shared Scene/ray composition, copied
original files, bounded refusals and cold reconstruction.

## Original closed indexed Cylinder geometry

`prepareCylinderGeometry(input)` admits exact parameters:
`{format:'barocss-gpu-cylinder-geometry',version:0,id,coordinateSystem:'right-handed-y-up',positionUnit:'scene',radius,height,radialSegments,heightSegments}`.
Finite scene-unit dimensions satisfy `0 < radius <= 1000`, `0 < height <= 2000`.
Radial cells are integers from 3 to 128; height cells from 1 to 128. The cylinder
is centred at the origin along Y and always closed. Cone, open and partial-arc
options are excluded.

Frozen `{source,prepared}` keeps copied original parameters and generated Number
geometry through one `prepareTriangleGeometry` call. Independent mutable Float32
attributes and Uint16 indices remain separate. Side rows ascend Y, columns follow
`phi=(2*PI)*(i/S)`, with position `[r*cos(phi),h*(j/H-.5),r*sin(phi)]`, radial normal
`[cos(phi),0,sin(phi)]`, UV `[i/S,j/H]`. The last column copies its first exactly
with U=1. Separate top/bottom cap rims copy the actual side endpoint positions;
flat normals ±Y retain hard edges. Both cap disks use UV `[(nx+1)/2,(nz+1)/2]`.
Centres have UV `[.5,.5]`.

Vertex order is sides, top rim/centre, bottom rim/centre. Side indices are
`[a,d,b,a,c,d]`; top fans use centre/next/current and bottom centre/current/next.
Maximum counts are 16,901 vertices, 33,024 triangles and 738,976 typed bytes.
All input admission precedes generation. Existing TriangleGeometryError codes,
original/F32 range/area/nonzero/collapse checks and actual causes remain. Tiny
positive dimensions can refuse; there is no snapping, normalization or healing.
Bounds describe sampled vertices, not analytic enclosure. SDF Cylinder, native
CAD identity/topology, pixels, quality/error, performance, parity and publication
retain separate contracts.

`examples/gpu-scene/cylinder-geometry-flow.mjs --output <fresh-directory>` checks
source/emitted APIs, side/cap seam and normal/UV splits, shared Scene/ray queries,
original parameter files, copies, refusals and cold reconstruction.

## Original closed indexed Cone geometry

`prepareConeGeometry(input)` admits exact original parameters:
`{format:'barocss-gpu-cone-geometry',version:0,id,coordinateSystem:'right-handed-y-up',positionUnit:'scene',radius,height,radialSegments,heightSegments}`.
Finite scene-unit radius satisfies `0 < radius <= 1000`, height `0 < height <= 2000`.
Radial cells are integers 3..128; height cells 1..128. Original half-height and
both normalized slope components must remain positive. Always closed along Y,
base at -height/2, apex at +height/2. Open, truncated and partial arcs are excluded.

Exact frozen `{source,prepared}` retains copied original parameters and generated
frozen Number geometry through one `prepareTriangleGeometry` call. Mutable own
Float32 attributes and Uint16 indices are separate. Positive-radius side rows
j=0..H-1 use `rho=r*(1-j/H)`, `y=h*(j/H-.5)`, `phi=(2*PI)*(i/S)`. Positions are
`[rho*cos(phi),y,rho*sin(phi)]`; normals are `[(h*cos(phi))/L,r/L,(h*sin(phi))/L]`
with `L=Math.hypot(h,r)`; UV `[i/S,j/H]`. Final column copies its first position/normal
bits with U=1. S distinct apex vertices use sector-midpoint normals and UV
`[(i+.5)/S,1]`; this is an authored shading choice at a nondifferentiable apex.

A separate bottom rim copies side row0 positions with flat -Y normals and disk UV
`[(cos(phi)+1)/2,(sin(phi)+1)/2]`, including a copied UV seam. Cap UV does not use
scaled side normals. Centre UV is `[.5,.5]`. Vertex order is positive side rows,
sector apex vertices, bottom rim, centre. Quads use `[a,d,b,a,c,d]`, apex triangles
`[a,apex_i,b]`, and bottom fans `[centre,current,next]`; all CCW outward. Maximum
16,770 vertices, 32,768 triangles and 733,248 typed bytes remain within existing budgets.

Existing TriangleGeometryError codes and original/F32 admission remain. Original
half-height or slope underflow refuses GEOMETRY before generation; no clamp or
healing. Sampled bounds, authored apex normals and original mesh CPU ray queries
are separate from analytical enclosure, native CAD identity, SDF, raster picking,
GL, performance, parity and publication. Existing providers and exports remain.

`examples/gpu-scene/cone-geometry-flow.mjs --output <fresh-directory>` checks
source/emitted/DTS APIs, literal topology/winding/seams/cap UV/apex normals, shared
Scene/rays, originals/copies/refusals and real cold original-file reconstruction.

## Original closed indexed Capsule geometry

`prepareCapsuleGeometry(input)` admits exact ten-field parameters:
`{format:'barocss-gpu-capsule-geometry',version:0,id,coordinateSystem:'right-handed-y-up',positionUnit:'scene',radius,halfLength,radialSegments,bodySegments,capSegments}`.
Positive scene-unit radius r and middle half-length L require original `r+L <= 1000`
and `r+L > L`. Cells: radial S3..128, body B1..128, each cap C2..64. Always closed
along Y with cap centres±L and axial endpoints±(L+r); no zero-middle Sphere
fallback, arbitrary axis/endpoints, open or partial-arc options.

Frozen copied scalar source and original Number mesh remain separate from mutable
owned Float32 positions/normals/UVs and Uint16 indices. One existing
`prepareTriangleGeometry` admits the generated candidate. Positive rings follow
C−1 lower interiors, B+1 body rows including exact shared equators, C−1 upper
interiors. Azimuth seams copy position/normal bits with U0/U1. Two poles each
retain S midpoint-U vertices and exact ±Y normals. UV V is normalized ring index
with denominator B+2C, including physical poles at0/1; it is not arc length.

Lower theta=(PI/2)*(j/C) uses rho=r*sin(theta), y=-L-r*cos(theta), normal
`[sin(theta)*cos(phi),-cos(theta),sin(theta)*sin(phi)]`. Upper uses
rho=r*cos(theta), y=L+r*sin(theta), normal
`[cos(theta)*cos(phi),sin(theta),cos(theta)*sin(phi)]`. Body normals are radial,
with exact equator Y±L. Vertex order is all positive rings, bottom poles, top poles.
Indices first all strips `[a,d,b,a,c,d]`, then bottom pole/current/next and top
current/pole/next fans. K=B+2C−1; maximum33,151 vertices/65,280 triangles/1,452,512
typed bytes remain within existing geometry/Scene/ray limits.

Original pole/ring Y levels must be strictly increasing; a genuine helper
RangeError becomes GEOMETRY with its actual cause. After inherited admission,
the same Float32 Y levels must remain distinct or refuse REPRESENTATION.
Existing type/version/budget/reflection/geometry/Float32 causes remain; no clamp,
snapping or healing. Bounds describe actual sampled vertices. This generic mesh
is separate from Source1/SDF, native CAD Solid, collision/Physics, analytical
enclosure/global accuracy, raster pixels, performance/parity and publication.

`examples/gpu-scene/capsule-geometry-flow.mjs --output <fresh-directory>` checks
source/emitted/DTS, independent rings/poles/UV/winding/equators, shared Scene/ray
composition, original source/mesh copies/refusals and cold file reconstruction.

## Authored indexed RoundedBox geometry

`prepareRoundedBoxGeometry(input)` retains the exact eight-field original
`RoundedBoxGeometrySourceV0`: format `barocss-gpu-rounded-box-geometry`, version0,
ASCII id1..64, right-handed-y-up, positionUnit `scene`, `sizeXYZ`, `cornerRadius`
and `segments`. Dimensions satisfy 0<size<=2000, represented positive half/core
extents and 0<radius<min half dimension; the radius must remain distinct from
each half extent. Integer segments2..64. No defaults, open pieces, radius0,
Box/Sphere substitution or geometric repair.

The result is frozen `{source,prepared}` with independent frozen original scalar
and generated Number data, plus separately mutable Float32 position/normal/UV
and Uint16 index buffers. Six plane charts, twelve quarter-cylinder charts and
eight triangular spherical corner lattices share copied canonical boundary
position/normal bits and split UVs. Edge UV is station/axial-row; corner UV is
two normalized lattice indices. Outward CCW uses actual source triangle cross
products. These sampled charts do not establish welded B-Rep or analytic contact.

For N segments, vertices=4N²+36N+56, triangles=8N²+24N+12. N2 gives144 vertices,
92 triangles/5160 bytes; N64 gives18744 vertices/34316 triangles/805704 bytes.
Existing TriangleGeometry budgets/validation/error codes and actual causes are
retained through one admission. Original construction failure and Float32
triangle collapse refuse; no clamp, epsilon weld or fallback normal. Bounds are
the sampled vertex bounds; original source remains distinct from derived views.

`examples/gpu-scene/rounded-box-geometry-flow.mjs --output <fresh-directory>`
checks ordinary/emitted public APIs/types, seams/UV/normals/winding, shared
Scene/face rays, original parameter/mesh files, copies/refusals and genuine cold
reconstruction. Source1/SDF, native CAD Fillet/Solid, Physics/collision, actual
graphics/lifetime/global error/parity/current-root acceptance and publication
remain separate. Render parameter documents require their own explicit profile
and dispatch adoption of this factory.

## Native Surface normalized coordinate material grammar (CPU stage)

`compileNativeSurfaceUV01Material(source)` reserves `surface_u01` and
`surface_v01` as readonly float inputs bounded within `[0,1]` in a distinct
`barocss-gpu-native-surface-uv01-material` v0 IR with profile
`native-surface-opaque-uv01-fragment-v0`:

```css
@shader #native_gradient {
  @fragment { color: mix(#000, #FFF, surface_u01); }
}
```

`validateNativeSurfaceUV01MaterialIR(unknown)` copies own data and reconstructs
source once, rejects mismatched fields, then returns fresh frozen canonical IR.
`lowerNativeSurfaceUV01Material(unknown)` validates once and returns a frozen
expression, uniform declarations/layout and `in vec2 v_native_surface_uv01;`.
U lowers to `.x`; V lowers to `.y`. Constant sources keep that declaration.
Uniform/local declarations that shadow these two names are refused. Source
spelling and diagnostic UTF16 offsets are preserved; source/token/node/depth,
range, copy and uniform budgets remain those of the existing material compiler.

These dimensionless inputs require normalization of the original native Surface
domain in Number before a future Float32 display conversion. The producer must
retain original U/V, domain, frame, units and source-qualified identities.
Interpolated shader values do not become exact native queries. This stage does
not supply a producer, binding, attribute buffer, evaluator or graphics program.
Legacy MeshMaterial and generic/repeating EngineUV formats remain distinct and
reject this IR. Legacy declared uniforms named `surface_u01` or `surface_v01`
retain their original meaning. No native render or pixel support is implied.

One CPU source/compiled/file/cold flow:
`node examples/gpu-scene/native-surface-uv01-material-flow.mjs --output /absolute/fresh-directory`.

## Source-qualified native Surface UV01 geometry (CPU)

`prepareNativeSurfaceUV01Geometry(unknown)` accepts an exact own eight-field
request: `format: 'barocss-gpu-native-surface-uv01-request'`, `version: 0`,
`sourceVersion: 0`, complete CAD `source`, `surfaceId`, explicit `countU`/`countV`
(2..64) and sampled `revision` (0..2147483647). Source is limited to 64KiB UTF8
and 65536 UTF16 units. The full Model has 1..16 objects; the selected Surface has
degree 1..5 and a 2..16 control grid per axis. Existing native refusal rules apply.

It compiles the complete original Source0, selects the actual Surface, obtains
its original domain and generates one native D0 preview. The ten-field v0 result
with profile `source0-surface-d0-uv01-v0` retains the request, full Model,
selectedObjectIndex, domain and complete `preview: {packet, report}` beside
`normalizedParameters` and an independently owned mutable Float32 `uv01` view.
All ordinary result data is deeply frozen. This view consumes 8 bytes per vertex,
at most 32768 bytes. A later consumer must re-admit source and rederive it; returned
metadata and a caller-mutated view are not a trusted backend capability.

Actual original parameters normalize in Number before Float32, in U-outer/V-inner
sample order. Finite positive represented domain widths and normalized values
within [0,1] are required; no domain is inferred from packet extrema and no value
is clamped. Derived zero is +0. Float32 interior rounding, including coincident
samples or endpoint rounding, is allowed. Original source/native control, knots,
weights, domain, raw U/V, signs and IDs stay separate. Native positions remain
mm/authored XYZ; packet frame metadata is retained without axis conversion.

`NativeSurfaceUV01GeometryError` distinguishes INPUT/BUDGET/SOURCE/SELECTOR/
NATIVE/NORMALIZATION, preserves actual native/reflection causes, and carries
original source diagnostic UTF16 offsets. No material binding, frame admission,
vertex attribute, linked program, scene scaling, rendering, exact fragment query
or document pin qualification is supplied. It does not change existing preview,
MeshMaterial/EngineUV, Scene or renderer contracts.

One source/emitted/file/cold CPU flow:
`node examples/gpu-scene/native-surface-uv01-geometry-flow.mjs --output /absolute/fresh-directory`.

## Source-native Surface UV01 material binding (CPU)

`prepareNativeSurfaceUV01MaterialBinding(unknown)` accepts five own data fields:
`format: 'barocss-gpu-native-surface-uv01-binding-request'`, `version: 0`, a
source-qualified `geometry` request, distinct native UV01 `material` IR and an
explicit `uniforms` record. It snapshots at most 16 finite own uniform values,
validates the new material, lowers its newly canonical IR through the public
lowerer, resolves declared defaults/ranges, then rebuilds the original native
geometry. Material validation and lowering each perform their own snapshot and
compile: two material reconstructions and one geometry producer call. Existing
source/work/copy/native sampling bounds apply; no trusted bypass is added.

The seven-field v0 result has profile `source0-surface-opaque-uv01-binding-v0`,
`geometry`, canonical `material`, resolved `uniforms` and trusted `lowered` text.
Ordinary data is fresh and deeply frozen; `geometry.uv01` remains an independently
owned mutable Float32 view. A consumer must re-admit source rather than trust a
modified returned view. Uniform zeros canonicalize to +0; original geometry U/V,
source, domain, control/knots/weights/signs and material source spelling remain.

`NativeSurfaceUV01BindingError` reports INPUT/MATERIAL/UNIFORM/GEOMETRY with bounded
messages, actual cause chains and original material/geometry source offsets.
Unspecified values use declared defaults; undeclared, nonfinite or out-of-range
values are refused. This CPU candidate qualifies its source/native/material data,
not external document/body/asset/TEN pins or repeated model-name namespaces.
Shader IDs remain separate from original native identity.

No frame admission, vertex attribute, program link, rendering, lifetime or scene
scale/axis conversion is supplied. Legacy MeshMaterial/Frame0 and generic EngineUV
formats remain distinct. Actual visible Surface/context matching needs an explicit
new companion/frame profile and a separately verified renderer operation.

One joint source/emitted/file/cold CPU flow:
`node examples/gpu-scene/native-surface-uv01-binding-flow.mjs --output /absolute/fresh-directory`.

### Native caller reflection errors

Native Surface UV01 material validation/lowering and source geometry preparation
wrap exceptions from own-data reflection as fresh INPUT errors with zero source
offsets and the exact caller exception as cause. A caller-created public Error
class does not authenticate a source, uniform or work failure. Local shape/work
refusals and actual source/compiler/native diagnostic chains keep their existing
codes and offsets. Material descriptor ordering, geometry cardinality ordering,
copy/work budgets, original signed data and all public declarations are unchanged.
This correction is native-only; legacy MeshMaterial and generic/repeating EngineUV
reflection behavior remains compatible.

One bounded source/emitted/file/cold flow:
`node examples/gpu-scene/native-reflection-cause-flow.mjs --output /absolute/fresh-directory`.

## Trusted native Surface UV01 shader source (CPU)

`prepareNativeSurfaceUV01ShaderSource(unknown)` accepts four own fields:
`format: 'barocss-gpu-native-surface-uv01-shader-request'`, `version: 0`, a raw
native UV01 `binding` request, and explicit `lighting` (null for the existing
fixed-light template, or the existing three-field MeshLighting configuration).
It admits lighting first, reconstructs the actual binding once, then reuses the
own mesh shader templates and trusted lowered expression. Binding work remains
two material snapshots/compiles plus one geometry producer, with existing bounds.

The six-field v0 result has profile `source0-native-opaque-uv01-shader-source-v0`,
`request`, `binding`, and `shaders: {vertex, fragment}`. Its request is effective
canonical intent with all uniform defaults resolved, rather than unresolved
editor history. Ordinary data is fresh/frozen; the binding's independent Float32
UV01 view remains mutable. Original geometry/material source strings and native
control, knots, domain, raw U/V, signs and IDs remain separate from derived data.

GLSL300es/highp source retains position0/normal1, the existing camera branch and
lighting/gamma/opaque output. Location2 is `vec2 native_surface_uv01`, assigned to
matching `v_native_surface_uv01` varying. Trusted native material declarations and
linear expression replace only the previous inner color decode. Each insertion
anchor must occur once; each complete vertex/fragment is bounded to 65536 UTF16
units and UTF8 bytes. Caller GLSL or prepared bindings are not inputs.

`NativeSurfaceUV01ShaderSourceError` reports INPUT/LIGHTING/BINDING/SHADER, bounded
messages and actual cause/source-offset chains. Position and normal attributes
must already be prepared in the existing display/world convention; this source
builder applies no scene scale, pose or axis conversion. It creates no upload,
linked program, frame, pixel, device or lifetime receipt. A matching renderer and
qualified context still need their own contract and actual graphics acceptance.
It retains the existing single global lighting model; light entities remain #1445.

One source/emitted/DTS/file/cold flow:
`node examples/gpu-scene/native-surface-uv01-shader-source-flow.mjs --output /absolute/fresh-directory`.

## Authored pure float material functions

All four existing material compiler profiles accept bounded expression functions:

```css
@shader #two_axis_ramp {
  @fn fade(t:float(0,1)):float(t*.5+.25);
  @let u:float(fade(surface_u01));
  @fragment { color:mix(mix(#000,#fff,u),#F00,fade(surface_v01)); }
}
```

Use native Surface UV01 compilation for this example. Legacy Mesh and generic
EngineUV/repeating profiles retain their own coordinate and builtin limits.
Uniforms precede functions, functions precede locals, and the fragment follows.
At most eight functions each declare one float parameter with finite ordered
bounds within ±1000 and return one float expression. Names have 1..32 ASCII
characters. Argument intervals must fit the declared bounds; no implicit clamp
is applied. Function/type/builtin/coordinate/uniform names cannot collide.

Bodies can use their parameter, literals and the profile's existing builtins.
They cannot capture uniforms, locals or coordinates, call authored functions,
recurse or change state. Calls in locals/fragment can nest within existing work
and depth limits. There are no defaults, named arguments, multiple parameters,
vector returns, unit declarations, blocks or imported code. The extension below
adds color results.

Original source and UTF16 ranges are retained. Definitions and calls expand into
the existing canonical expression IR; no parameter uniform, runtime function,
new IR node, public export, profile or schema version is emitted. Existing
256-node work includes unused definitions, argument parsing, body expansion and
EVERY full argument subtree substituted for a parameter reference. Depth16,
source64KiB, tokens4096, uniforms16 and locals16 remain unchanged. Definition
errors point to original body tokens; arity/type/argument-range errors point to
the call name. Refusal does not mutate caller data or previously authored files.

Compilation, reconstruction, trusted lowering and existing supported evaluator
profiles remain CPU stages. Native shader linkage, UV attributes, rendered
pixels, file/editor adoption and publication require their separate receipts.

One source/emitted/file/cold flow:
`node examples/gpu-scene/material-pure-float-function-flow.mjs --output /absolute/fresh-directory`.


## Pure color-return material expressions

The same bounded function grammar also admits an existing color expression:

```css
@shader #two_axis_palette {
  @fn tint(t:float(0,1)):color(mix(#203040,#FFEEDD,t));
  @let u:color(tint(surface_u01));
  @fragment { color:mix(u,tint(surface_v01),.5); }
}
```

This source uses the native Surface UV01 compiler; the other three existing
profiles keep their own coordinate permissions. The parameter is still one
dimensionless float with declared bounds. The result must match float or color
as declared. Color is the existing linear RGB expression type, with existing
hex/rgb decode and mix semantics; it is not a general vector or layer type.

Float and color functions share the eight-declaration ceiling, full256-node
expanded work and depth16. Bodies still cannot capture uniforms, coordinates or
locals, or call authored functions. An existing float function may be used in
a caller argument, such as tint(fade(surface_u01)). Color arguments, vector
returns, extra parameters, resource captures and implicit clamps remain absent.

Only original token replay and existing expression IR are used. Public types,
exports, profiles, versions, uniform layout, trusted lowerer and supported CPU
evaluator modes are unchanged. Return mismatch errors use the original result
type span; existing float body checks remain compatible. Native shader source
preparation is separate from linking, attribute uploads, frames and pixels.

One new palette source/emitted/file/cold flow:
`node examples/gpu-scene/material-color-return-function-flow.mjs --output /absolute/fresh-directory`.


## Typed literal Scene2 parameter references

`compileParameterizedAffineSceneSource(source)` is a separate opt-in CPU authoring
entry. Existing `compileAffineSceneSource`, Scene0/1 AST and renderer defaults
remain unchanged. It accepts literal scalar, scene-length and degree parameters:

```css
@scene parameter_pair {
  version:2;
  @param extent:length(2scene);
  @param gain:scalar(.5);
  @param yaw:angle(30deg);
  sphere #left; sphere #right;
}
sphere { radius:$extent; scale:$gain $gain $gain; color:#ABC; }
#left { translate:-3 0 0; }
#right { translate:3 0 0; rotate-y:$yaw; }
```

Headers precede parameters, and parameters precede objects. Up to16 unique ASCII
names declare immutable numeric literals; `$name` references match the field's
quantity. Scene lengths and scalars stay within ±1000; degrees within ±360.
Lengths are scene-coordinate values, with no implicit CAD millimetre conversion.
Existing positivity, Float32 shape checks, scale.01..100 and cascade still apply
to every use, including overridden fields and unmatched type selectors.

The distinct eight-field v0 source result retains the full original source, its
separate authored AST, original parameter/reference tokens and ranges, resolved
metadata, existing AffineScene2 and trusted shaders. Private numeric-token views
are derived data. No imported AST, runtime override, arithmetic, function, loop,
new kernel, GLSL uniform or linked renderer is supplied. Old source entrypoints
continue to refuse parameter syntax.

Source64KiB, two bounded65536-token scans, cumulative4096 AST/parameter/reference
work, references1536 and existing32objects/128rules/512fields remain fixed.
The complete copied/frozen ordinary result is bounded to2MiB UTF16/UTF8;
source spelling and native data stay separate from canonical resolved zero.
SceneParameterSourceError codes INPUT/SYNTAX/TYPE/RANGE/BUDGET/SCENE retain original
UTF16/LF diagnostic positions and actual base compiler causes.

One source/emitted/file/cold flow:
`node examples/gpu-scene/scene-literal-parameter-flow.mjs --output /absolute/fresh-directory`.


## Typed Scene quantity products

`compileMultiplicativeAffineSceneSource` is a separate source-only entry for
`calc($NAME * $NAME)` coefficient atoms. Both operands are declared parameters;
one must be scalar. The other determines scalar, scene-length or degree output.
A complete calc is one vector component, preserving original operator/reference
spans and metadata uses. For example a length2scene and scalar.5 yield radius1.

There is exactly one multiply and two references: no nesting, literal operands,
other operators, initializer arithmetic or runtime overrides. The older literal
parameter entry continues to refuse calc syntax. The new source result and
authored AST have their own format/schema/profile, retaining original text and
independently derived existing Scene2/shader data. This creates no GLSL uniform,
geometry kernel, physical unit conversion, linked renderer or frame.

Finite products remain within ±1000 for scalar/length and ±360 for degrees;
existing positivity, Float32 shape checks and scale.01..100 follow. Each product
charges three expression nodes plus both reference uses under the existing4096
work/1536use/source64KiB/16parameter/result2MiB bounds. Owned data is fresh/frozen;
syntax/type/range/budget errors use original spans and actual Scene causes remain.

One new source/emitted/manual-file/cold flow:
`node examples/gpu-scene/scene-quantity-product-flow.mjs --output /absolute/fresh-directory`.


## Flat typed Scene arithmetic

`compileArithmeticAffineSceneSource` opts in to `calc($left + $right)`,
`calc($left - $right)` and the existing two-reference product. Each atom has
exactly two declared parameters and one operator. Addition/subtraction require
the same quantity: scalar, scene-coordinate length or degree angle. Products
require at least one scalar. Result quantity must match the coefficient slot.

Whitespace or comments surround + and -; hyphen names and signed/exponent
initializers retain their existing meaning. Products keep compact spelling.
The original literal and product entries/profiles retain their accepted syntax
and addition refusals. The new result/AST has a distinct arithmetic profile,
retaining six original tokens, exact operand use ranges and whole-atom private
numeric ranges. No nested/general expressions, literal operands, division,
initializer formulas, external overrides, runtime uniforms or CAD unit conversion.

Original Number operation order, finite magnitude1000 for scalar/length and360
for degrees, canonical resultzero+0, old native shape/F32/scale/cascade checks,
4096 original+expression/use work,1536uses,16params,source64KiB/result2MiB remain.
Original source/comments/-0/Unicode/ranges are preserved in fresh frozen data.
This CPU compiler creates no linked renderer/frame/TEN/pixel/lifetime receipt.

One source/emitted/literal-control/file/cold flow:
`node examples/gpu-scene/scene-flat-arithmetic-flow.mjs --output /absolute/fresh-directory`.


### Authored native directional light catalog (#1472)

`prepareNativeDirectionalLights(input)` admits a separate CPU catalog with
format `barocss-gpu-native-directional-lights`, version0 and profile
`native-world-directional-linear-v0`. Its exact fields are format, version,
profile, sourceId, revision, ambientStrength and lights. The sourceId is the
outer document ID; revision is an authored context tag. The host must match
them to its current document and join native TEN/frame context.

Each ordered light has nodeId, label, enabled, directionScene, colorLinearRGB
and intensity. Stable nodeId identifies a scene-root light, not a Body or mesh.
Up to four lights, including disabled entries, use right-handed Y-up world
surface-to-light directions, explicit linear-sRGB RGB and dimensionless
intensity0..1. Every entry validates. Direction magnitude and signed original
values remain in the catalog; only independent execution copies normalize
direction with max-absolute scaling and hypot. Ambient and each intensity
are bounded independently; this CPU provider performs no clamp or encoding.

The result has catalog and execution. Both are fresh, deeply frozen ordinary
data without caller mutation or shared object references. Dense own arrays,
exact data fields, bounded IDs/labels and a16KiB signed-result cap are enforced.
Errors expose INPUT, VERSION, BUDGET, IDENTITY or NUMERICAL; reflection failures
retain their actual cause. Existing singleton MeshLighting and scene APIs stay
unchanged. No automatic file upgrade or renderer dispatch occurs.

This stage proves authored catalog/file reconstruction and derived CPU directions.
New native frames, shader/uniform consumption, linked programs, pixels, Viewer
accepted state, recovery/disposal and Render history/versioned files remain
separate stages under #1445. Point/Spot lights and attachment remain future work.


### Bounded authored Scene repeats

`compileFiniteRepeatAffineSceneSource(source)` is a separate opt-in Source2 compiler. For example:

```css
@scene row {
  version: 2;
  @param extent: length(1scene);
  @repeat studs:sphere(3);
}
sphere { radius: $extent; }
#studs_0 { translate: -3 0 0; }
#studs_2 { translate: 3 0 0; }
```

The repeat has one ASCII prefix (1..32 characters), one existing shape and a canonical positive decimal count (1..32). Up to eight repeats share the existing 32-object scene limit. Each creates stable `prefix_0` through `prefix_(count-1)` IDs, in declaration/index order. Explicit objects can interleave; collisions refuse without renumbering. Existing type and ID selectors, typed parameters and flat arithmetic supply coefficients. Parameters must precede objects/repeats. No body, index variable, zero count, condition, nesting or runtime loop is supported.

The distinct version0 result/profile `source2-typed-finite-repeat-coefficients-v0` retains original source and authored AST. Each repeat retains nine actual tokens/ranges; generated objects occur only in canonical Scene2, with separate `generation` records (`nodeId`, `prefix`, `index`, `declaration`). Private derived ID tokens use original prefix origin ranges and are never presented as authored ID tokens. Ranges count UTF16 units and LF lines. Scene units, original Number coefficients, existing native AffineScene2 and shader contracts stay the same.

Original source is limited to 64KiB UTF16/UTF8, parameters16, references1536, rules128, fields512 and cumulative work4096. Each repeat adds10 work units and each generated object adds4 before expansion; existing parameter/expression charges also apply. Shaders remain64KiB each; the complete signed result remains2MiB before fresh copying/freezing. Rejections use `SceneParameterSourceError`. Older literal, product and arithmetic compilers retain their schemas and reject repeats.

Rerun the bounded complete-source/file/cold qualifier with `node examples/gpu-scene/scene-finite-repeat-flow.mjs --output ABS_FRESH`. This proves CPU source authoring and lowering. Rendering, consumer document upgrades and publication require separate acceptance.


### Native directional light shader source

`prepareNativeDirectionalLightShaderSource({lights, material})` composes trusted CPU shader source and a uniform-name contract from a complete raw native directional light catalog and a legacy mesh material binding, or explicit `null`. It reuses catalog admission, existing material binding validation and public material lowering. A nonnull binding recompiles original material source twice through those actual providers; null performs no material compilation. EngineUV and NativeUV materials require their separate profiles and are refused here.

The fresh frozen eight-field version0 result has profile `native-world-directional-linear-mesh-opaque-v0`, independent original `catalog`/`material`, derived `execution`, `abi` and trusted `shaders`. Inventory order includes disabled lights. Each stable ID maps to index-based `nativeLightDirection_N`, `nativeLightColor_N` and `nativeLightIntensity_N` names; disabled effective intensity is positive zero while original catalog values remain. Material uniforms retain actual `mat_u_N` source order/defaults. The null-material branch uses the existing color uniform and power2.2 decode; a bound material omits that uniform and uses its trusted lowered linear expression.

The vertex shader is unchanged. The fragment accumulates ambient plus zero to four colored Lambert terms with world RH Y-up surface-to-light unit directions. It multiplies the trusted linear base color, saturates linear radiance to[0,1], then applies native power1/2.2 with alpha1. It adds no old singleton light and has no runtime loop or arbitrary shader input. This new opaque profile uses native power-law color compatibility; it does not establish exact standard-sRGB, HDR/PBR or physical light transport.

`DirectionalLightShaderSourceError` uses INPUT, LIGHTS, MATERIAL or BUDGET with bounded messages and actual reflection/provider causes. Existing provider source/work/cardinality limits apply; each shader remains64KiB UTF16/UTF8 and the complete signed result is capped at256KiB before final copy/freeze. Original catalog signs versus normalized/effective values and legacy material zero canonicalization remain separate. SourceId/revision and ABI names are caller tags and CPU names, not accepted frame/TEN or actual uniform-location certificates.

After the affected GPU build, run `node examples/gpu-scene/directional-light-shader-source-flow.mjs --output ABS_FRESH` for the one source/emitted/raw-request/material-source/shader-file/cold flow. Shader linking, uniform upload, a new complete native frame/profile, recovery/lifetime, Viewer joins, editor files/history and publication require separate acceptance.


### Typed conditional Scene objects

`compileConditionalAffineSceneSource(source)` adds an explicit Source2 authoring profile. After typed literal parameters, write `@when optional:sphere($used < $limit);`. It compares exactly two same-quantity parameters with strict `<`, with whitespace or comments on both sides. A true predicate includes stable `optional_0`; a false predicate keeps its decision and original tokens while omitting that object from selected Scene2. Six existing shapes are supported. No body, else, repeat, nested condition, runtime uniform or expression predicate is accepted. Older literal/product/arithmetic/repeat entries keep their existing grammar.

The fresh frozen nine-field version0 result uses profile `source2-typed-conditional-objects-v0`, original authored AST, parameters, all ordered `decisions`, selected `scene` and trusted `shaders`. All potential candidates, including false, undergo existing semantic and shape validation in the first actual lowerer call. A private active view then removes only false objects and their own ID rules before a second unchanged lowerer call. Unknown unrelated selectors still refuse. Original public rules remain complete. Existing CPU empty-scene support applies when all predicates are false.

Caps are eight predicates, 32 potential objects, 16 parameters, 1536 total references, 128 rules, 512 fields and 4096 cumulative work units. Each predicate charges12 authored units,3 comparison units,4 potential object/provenance units and two reference uses. The exact active view is additionally charged before allocation, including resolved field literals. Source and each candidate/selected shader remain64KiB UTF16/UTF8; the whole signed result remains2MiB before copying/freezing. Original ranges/source signs, scene-length/deg/scalar units and canonical Number coefficients remain separate from derived Float32 shaders or native CAD identities. Existing SceneParameterSourceError provides original diagnostics and actual delegated causes.

After the affected GPU build, run `node examples/gpu-scene/scene-conditional-flow.mjs --output ABS_FRESH` for one complete original-source/emitted/manual-control/file/cold qualifier. This delivers CPU authoring and lowering; renderer/frame/TEN/lifetime, consumer files/history, integrated UI and publication require separate acceptance.
## Typed mixed Scene generation

`compileGeneratedAffineSceneSource(completeSource)` is an explicit source-only
compiler for Source2 parameters, positive finite repeats and typed conditional
objects in one file:

```css
@scene composed {
  version:2;
  @param used:length(2scene);
  @param limit:length(3scene);
  @repeat studs:sphere(2);
  @when optional:sphere($used < $limit);
}
sphere { radius:1; translate:0 0 0; }
```

The result has format `barocss-gpu-generated-affine-scene-source`, version0,
profile `source2-typed-mixed-generation-v0`, original `source`, authored `ast`,
`parameters`, ordered repeat `generation`, all conditional `decisions`, selected
`scene` and trusted `shaders`. The authored AST schema is
`barocss-gpu-generated-affine-scene-ast`, schemaVersion0/sourceVersion2. Original
tokens and rules remain separate from generated IDs and selected Scene2.

Repeat count is a canonical positive decimal1..32. Conditions use exactly two
same-quantity literal parameter references and strict `<`, with whitespace or
comments on both sides. Eight generation statements share one limit; explicit
objects plus every potential repeat/conditional object share the32-object limit.
False conditions reserve identity and receive full shape/style validation. Stable
IDs are `studs_0`, `studs_1` and potential `optional_0`; toggles never renumber.
After all potential candidates pass the unchanged lowerer, a second unchanged
lowerer processes the selected view. Only genuine false conditional objects and
their exact own-ID rules are removed. Repeat objects stay selected.

Source64KiB,16 parameters,1536 references,128 rules,512 fields and4096 cumulative
work remain shared. The new profile charges all original records, generated
objects, predicates, references, calculations and the selected view before
generated object copies or lowering. Both shader results are limited to64KiB;
the complete result is limited to2MiB in UTF16 and UTF8 before copying/freezing.
Calls return fresh independent immutable graphs; input is primitive complete
source text only. Existing `SceneParameterSourceError` codes/ranges/cause policy
apply. Existing literal/product/arithmetic/repeat/conditional entries keep their
own grammar and result types. No body, nesting, index variable, computed count,
else, runtime condition, native CAD unit conversion, renderer admission, editor
document format or publication is implied.

### Optional finite Scene repeats (#1494)

`compileOptionalRepeatedAffineSceneSource(source)` is a separate Source2 entry
for finite rows whose count can be zero:

```css
@scene optional_row {
  version: 2;
  @param radius: length(.5scene);
  @repeat row:sphere(0);
}
sphere { radius: $radius; }
```

Edit the canonical literal count `2` → `0` → `3` in the original source. Counts
are exactly `0..32`; at most eight repeat declarations and 32 explicit plus
expanded objects are admitted. Zero retains its authored declaration and costs
repeat work. It emits no objects, IDs or generation records. Positive generated
IDs remain `PREFIX_index`, interleaved with explicit declarations in source
order. Duplicate prefixes still refuse. An explicit `#row_0` is independent of
a zero repeat, while a stale `#row_0` style without a real object refuses.

The exact nine-field result uses format
`barocss-gpu-optional-repeat-affine-scene-source`, version `0`, profile
`source2-typed-optional-repeat-coefficients-v0`, original `source`, authored
`ast`, `parameters`, actual `generation`, selected `scene` and trusted `shaders`.
The AST uses schema `barocss-gpu-optional-repeat-affine-scene-ast`, schemaVersion
`0`, sourceVersion `2`. Original tokens and UTF16 ranges stay separate from
private expanded identities. Results are fresh independent copied/frozen data.

Every declared shape and every global style field/reference/arity/range/scale
is validated, including unmatched type rules. Cross-field capsule, torus and
rounded-box relationships apply only to actual instances. A zero repeat creates
no phantom object for template validation. Individually valid torus radii may
therefore coexist in an empty source even if their relationship would refuse
for an instantiated torus. No zero-related selector is silently removed.

The new entry retains typed arithmetic, existing units, 4096 cumulative work,
1536 references, source/shader 64KiB and signed result 2MiB limits. All coefficient
work is admitted before generated object/provenance copies. It calls the
unchanged affine lowerer once. It accepts primitive original text only and
reuses `SceneParameterSourceError`. Old finite-repeat and mixed-generation
entries retain positive-count semantics and reject zero. Conditions, bodies,
index variables, nesting, computed counts and runtime generation are excluded.
CPU source/API/file support does not qualify empty graphics, GPU frames,
consumer dispatch, native documents, editor history or publication.

## Discrete Mesh material source selection (CPU compiler stage)

`compileDiscreteMeshMaterial(source)` compiles complete primitive source text
into a distinct material profile. It returns `{ok: true, material}` or
`{ok: false, diagnostics}`. `validateDiscreteMeshMaterialIR(input)` reconstructs
the full original source and compares the complete own-data IR.
`lowerDiscreteMeshMaterial(input)` validates once and returns trusted GLSL text
and a uniform layout:

```ts
const compiled = compileDiscreteMeshMaterial(`
@shader #discrete_palette {
  @uniform level: float(0, 1, .5);
  @fragment { color: select(level, .5, #203040, #FFEEDD); }
}`);
if (compiled.ok) {
  const lowered = lowerDiscreteMeshMaterial(compiled.material);
  // Trusted expression text and uniform declarations; no shader execution.
  lowered.expression;
  lowered.uniformDeclarations;
  lowered.uniformLayout;
}
```

`select(value, threshold, below, otherwise)` requires a float value and exactly
one signed numeric literal threshold within ±1000. Both branches must have the
same float or color type. Strict `value < threshold` selects `below`; equality
selects `otherwise`. All branches are parsed, type/range checked and charged,
including unreachable branches. The canonical six-field selection node retains
a literal float threshold and both complete branch trees. Scalar bounds join
both branch intervals. Lowering emits a parenthesized ternary, stable `mat_u_N`
uniform names, precision17 numeric text and the final linear RGB clamp.

The exact seven-field IR uses format `barocss-gpu-discrete-mesh-material`,
version `0`, profile `mesh-opaque-discrete-fragment-v0`, original `source`,
`shaderId`, ordered `uniforms` and `expression`. Lowered output has exactly
`expression`, `uniformDeclarations` and `uniformLayout`. Original source spelling
and UTF16 offsets remain separate from canonical Number coefficients; numeric
zeros become positive zero. Results are fresh independent recursively frozen
ordinary data. Validation does not mutate or freeze caller data, invoke getters
or accept supplied IR as authority.

Limits are source 64KiB UTF8, tokens 4096, definition/expanded expression work 256,
depth 16, uniforms 16, locals 16, functions 8, literals ±1000 and intermediate
bounds ±1e6. Own-data admission is bounded to 8192 values/depth 24, current-realm
plain records with at most 16 keys and dense arrays with at most 256 entries. Getters,
hidden/symbol fields, cycles, foreign prototypes and nonfinite numbers refuse.
The new profile caps complete JSON IR at 2MiB UTF16/UTF8, each lowered expression
and declaration string at 64KiB, and the whole lowered result at 128KiB.

Compilation returns bounded four-field `MeshMaterialDiagnostic` records with
original half-open UTF16 spans. Validation/lowering use `MeshMaterialError`.
Reconstruction failures use `IR` and retain the original frozen diagnostic as
cause; whole-IR mismatches use local `IR`. Raw reflection failures use fresh
`INPUT` with the exact cause; local shape/range/work errors have no fabricated
cause. Oversize results use `BUDGET`.

Only this profile reserves `select` in declarations. Old authored `@fn select`
and `@fn step`, old public recursive types and old Material profiles remain
unchanged; `step` remains available here. Existing pure-function capture,
recursion and body-call restrictions still apply. Old validators, binders,
`evaluateAuthoredMaterial` and shader preparers do not accept this new profile.
No evaluator, UV/input/fract, texture, lighting, material binding, shader link,
pixel, frame, consumer or publication support is added. GLSL text is not run.

After the affected GPU build, run the one source/emitted/IR/GLSL/original-file/cold
flow:

```sh
node examples/gpu-scene/material-discrete-selection-flow.mjs --output /absolute/fresh-directory
```

## Discrete authored Material color sampling (CPU)

`evaluateDiscreteAuthoredMaterial({material, uniforms})` reconstructs one complete
discrete Mesh material and samples its authored linear RGB with binary64 Number
operations. The required uniform record may be empty to use declared defaults:

```ts
const compiled = compileDiscreteMeshMaterial(`
@shader #palette {
  @uniform level: float(0, 1, .5);
  @fragment { color: select(level, .5, #203040, #FFEEDD); }
}`);
if (compiled.ok) {
  const defaults = evaluateDiscreteAuthoredMaterial({
    material: compiled.material, uniforms: {},
  });
  const below = evaluateDiscreteAuthoredMaterial({
    material: compiled.material, uniforms: { level: .4999 },
  });
  defaults.linearRGB; // Equality selects the second palette color.
  below.linearRGB;    // Strictly below selects the first palette color.
}
```

The exact request has only `material` and `uniforms`, as current-realm ordinary
records with enumerable data fields. Complete material source is validated once
through `validateDiscreteMeshMaterialIR`. Uniform overrides have at most 16 own
ASCII names of 1..32 characters and finite Number values. Unknown names or values
outside declared bounds refuse; omitted names use defaults. `__proto__` is refused
in overrides and declarations, including omitted declarations. Other own names
such as `constructor` remain safe.

Source reconstruction admits and charges both selection branches. Runtime
selection evaluates the float selector and literal threshold once and executes
only the selected branch: strict `<` chooses `below`; equality chooses
`otherwise`. Existing arithmetic, trigonometry, clamp and color-mix operation
order is preserved. Runtime traversal remains at most 256 visits/depth 16, with
finite intermediates within ±1e6 and final RGB clamped to 0..1. Uniform and final
RGB zeros are positive zero; complete original source spelling is retained.

The fresh frozen result has exactly eight fields: `format`, `version`, `profile`,
`colorSpace`, `source`, `material`, `uniforms`, `linearRGB`. Format is
`barocss-gpu-discrete-authored-material-sample`, version `0`, profile
`binary64-discrete-linear-rgb-v0`, color space `linear-rgb`. Canonical material
includes both branches; `uniforms` contains resolved declarations in source
order. The complete JSON result is capped at 2MiB UTF16/UTF8 before final freeze.
Results are independent across calls and input, without caller mutation,
freezing, getters or caches.

`AuthoredMaterialEvaluationError` and existing diagnostic codes are reused.
Local root/header errors use `INPUT`; unsupported headers use `PROFILE`; uniform
shape/name/value errors use `UNIFORM`. Actual raw reflection failures use fresh
`INPUT` with the exact cause. Material reconstruction uses `MATERIAL`, or `BUDGET`
for an actual provider budget failure, preserving its real cause chain.
Numerical guards use `NUMERICAL`; traversal/result limits use `BUDGET`. Local
errors have no fabricated cause, and messages are bounded to 1024 characters.

Existing `evaluateAuthoredMaterial` requests, samples and dispatch remain
unchanged. This entry samples only authored coordinate-free color. It adds no
UV, material binding, texture, lighting, gamma, shader execution, rendered pixels,
frame, GPU precision parity, consumer or publication support.

After the affected GPU build, run the one source/emitted/original-file/cold flow:

```sh
node examples/gpu-scene/material-discrete-evaluation-flow.mjs --output /absolute/fresh-directory
```

## Authored EngineUV texture expressions (CPU source stage)

`compileEngineUVTextureMaterial(source)` accepts complete primitive source text
and returns `{ok: true, material}` or `{ok: false, diagnostics}` in a distinct
profile. Declare exactly one sampler after all numeric uniforms and before
functions, locals and the fragment:

```ts
const compiled = compileEngineUVTextureMaterial(`
@shader #image_palette {
  @uniform amount: float(0, 1, .25);
  @sampler image: sampler2d;
  @let sampled: color(sample(image, uv_u, uv_v));
  @fragment { color: mix(sampled, #203040, amount); }
}`);
if (compiled.ok) {
  const lowered = lowerEngineUVTextureMaterial(compiled.material);
  lowered.expression;
  lowered.samplerDeclarations;
  lowered.samplerLayout;
  lowered.samplingHelpers;
}
```

`sample(ALIAS, U, V)` requires the declared alias as one identifier token and
two float expressions whose complete intervals stay within ±1000. UV values
are dimensionless; trusted text clamps `vec2(U,V)` to 0..1 without rewriting
original UV expressions. The canonical five-field node is
`{kind: 'sample', type: 'color', sampler, u, v}`. It returns linear color bounded
to 0..1. Samples may occur in locals and fragment expressions; pure function
bodies cannot sample or capture the alias, even in unused definitions. Existing
pure float functions can calculate sample coordinates within their declared
bounds.

The sampler alias uses ASCII 1..32 characters and cannot collide with uniforms,
UV inputs or reserved builtins. Functions, parameters and locals cannot shadow
the alias. `sample` and `sampler2d` are reserved only in this new profile; old
authored function names remain unchanged. A missing sampler refuses `SYNTAX`;
a second declaration refuses `BUDGET` before its alias is parsed. Unknown alias
uses `TYPE`, malformed arity `SYNTAX`, color coordinates `TYPE` and excessive
coordinate bounds `RANGE`, with original half-open UTF16 source spans.

IR has exactly eight fields: `format`, `version`, `profile`, `source`, `shaderId`,
`uniforms`, `samplers`, `expression`. Format is
`barocss-gpu-engine-uv-texture-material`, version `0`, profile
`engine-opaque-uv-texture-fragment-v0`. `samplers` contains exactly one
`{name, type: 'sampler2d'}` record. Alias identity is source authorship; it does
not implicitly identify an image, URL, catalog entry, device unit or handle.

`validateEngineUVTextureMaterialIR(input)` snapshots complete own data,
reconstructs original source and compares the whole canonical IR.
`lowerEngineUVTextureMaterial(input)` validates once and returns exactly seven
fields: `expression`, `uniformDeclarations`, `uniformLayout`, `inputDeclarations`,
`samplerDeclarations`, `samplerLayout`, `samplingHelpers`. Input declaration is
`in vec2 v_engine_uv;`. Numeric uniforms retain source order and `mat_u_N` names.
The sampler declaration is `uniform highp sampler2D mat_s_0;`; its layout retains
the declared alias even if unused. Each layout record has exactly `name`, `type`,
`glslName`, `colorSpace`, `rowOrigin`, `filter`, `wrapS`, `wrapT`, with values
`sampler2d`, `mat_s_0`, `srgb`, `bottom-left`, `nearest` and two `clamp-to-edge`
values respectively.

Trusted GLSL ES3.00 text uses the exact existing #1184 `decodeSRGB` function:
one piecewise sRGB decode follows `texture(...).rgb`. Original literal colors
retain historical power2.2 coefficients; existing whole-material final RGB clamp
is preserved. This text yields linear color and performs no output encoding.
Future output transfer, lighting, resource joins and frame policy require their
own contracts. No pixel bytes or image resource are admitted by this compiler.

Limits remain source 64KiB UTF8, tokens 4096, definition/expanded work 256,
depth/nesting 16, uniforms 16, locals 16, functions 8, literals ±1000 and
intermediate bounds ±1e6. A sampler declaration charges one work unit; every
sample charges one node and both coordinate trees, including expanded copies.
Own snapshots use 8192 values/depth 24, current-realm ordinary records with at
most 16 keys and dense arrays of at most 256 elements. Accessors, hidden/symbol
fields, cycles, foreign prototypes, nonfinite data and inconsistent descriptors
refuse without getter invocation or caller mutation/freezing. Results are fresh
independent recursively frozen ordinary graphs; numeric zeros canonicalize to
positive zero while original source spelling is retained.

Whole JSON IR is capped at 2MiB UTF16/UTF8. Lowered expression, numeric
declarations, sampler declarations and helpers are each capped at 64KiB; whole
lowered JSON is capped at 128KiB before freezing. Errors reuse `MeshMaterialError`
and bounded four-field diagnostics. Reconstruction failure uses `IR` with the
real frozen diagnostic/cause and spans; whole-IR mismatch is local `IR`. Raw
reflection uses fresh `INPUT` with the exact cause; local shape/work errors have
no fabricated cause. Oversize results use `BUDGET`.

Old public types, grammars and profiles stay unchanged. This profile excludes
discrete selection and repeating `fract`. Old validators, bindings and samplers
do not gain texture expressions. No external alias-to-texture join, evaluator,
upload, shader link, pixels, texture-unit allocation, renderer, native Surface
UV pairing, frame, lifetime, consumer or publication support is added.

After the affected GPU build, run the one source/emitted/IR/text/file/cold flow:

```sh
node examples/gpu-scene/engine-uv-texture-material-flow.mjs --output /absolute/fresh-directory
```

## Opt-in WebGPU primitive backend (#1512)

This API uses the existing complete original native frame and legacy Material
IR. Native code, builds and source/file flows are separate from actual GPU
qualification. The required same-target browser access is currently denied by
administrator policy; real WebGPU/device/screen qualification is pending. The
preserved WebGL2 APIs remain available and their default selection is unchanged.

The first admitted profile is frame version `0`, qualified scene version `2`,
exactly one Surface, `particles: null`, explicit existing camera and zero or one
matching legacy Mesh material. Optional existing MeshLighting is supported.
Prepare the genuine packet from original CAD source, retain its qualified
`{modelId, geometryId}` reference, and pass the complete frame:

```ts
// frame is the complete original {version, scene, options, particles, materials}.
const prepared = prepareWebGPUPrimitiveFrame(frame, canvas.width, canvas.height);
const viewport = await mountPrimitiveBackendViewport(canvas, frame, {
  backend: 'webgpu',
  fallbackCanvas: null,
});
viewport.status;
await viewport.updateFrame(editedOriginalFrame);
await viewport.resize(512, 512);
const rgba = await viewport.readPixels();
const hit = await viewport.pick(256, 256);
viewport.select(hit.ref);
viewport.select(null);
viewport.dispose();
```

The renderer re-admits complete original frames; `prepared` is CPU data, never
a trusted runtime shortcut. Geometry-parameter changes supply a freshly derived
packet from the original CAD source. Camera, light, pose and material-uniform
changes use the same complete frame contract. Curves, multiple Surfaces,
particles, cloth, EngineUV/nativeUV/discrete/texture materials, multi-light
catalogs and other profiles refuse before device work. Nothing is silently
omitted. Existing native limits are 4096 vertices, 7938 triangles and 16 material
uniforms.

`lowerMeshMaterialWGSL(input)` reconstructs the complete unchanged legacy
MeshMaterialIR and returns exactly `format`, `version`, `profile`, `material`,
`expression`, `declarations`, `uniformLayout`, `uniformByteLength`. Format is
`barocss-gpu-mesh-material-wgsl`, version `0`, profile
`mesh-opaque-fragment-wgsl-v0`. The material parameter block is always 64 bytes,
four vec4 slots. Layout records retain `name`, `type`, `min`, `max`, `default`,
plus `index`, `byteOffset`, `access`; source order determines offset `4*i`.
Trusted accesses use generated material slot/component expressions, never
caller names as WGSL symbols. Executed Float32 coefficients/defaults/bounds that become
nonfinite or underflow refuse `MeshMaterialError` with `RANGE`. Existing
compiler budgets and old public IR types remain unchanged.

`prepareWebGPUPrimitiveFrame(input, width, height)` calls common native frame
admission and returns exactly `format`, `version`, `profile`, `frame`, `wgsl`,
`frameUniforms`, `materialUniforms`. Format is
`barocss-gpu-webgpu-primitive-frame`, version `0`, profile
`qualified-surface-v0`. Metadata is fresh frozen ordinary data; independently
owned Float32 views remain mutable. Frame uniforms contain view/projection/light/
style in 160 bytes; material uniforms use 64 bytes. Original source, native F64
control/knots/weights/mm and qualified IDs stay separate from display F32
positions/world normals/U16 indices and resolved uniform values. Prepared
geometry already includes the display transform; no second mm conversion occurs.

Existing right-handed camera data is retained. The OpenGL clip-depth interval
−1..1 becomes WebGPU 0..1 only through `(z+w)/2`. Rendering is one indexed
triangle list, no culling/blending, `depth24plus` with `less`, group0 binding0
for frame uniforms and binding1 for material uniforms. Existing power2.2 color
decode/output encoding and single-directional/ambient response are preserved.
No CPU/GPU numerical equality or native texture pairing is promised.

Options have exactly `backend: 'webgpu' | 'webgl2' | 'auto'` and
`fallbackCanvas: HTMLCanvasElement | null`. A supplied fallback canvas must be a
distinct current-realm canvas. `auto` attempts WebGPU and uses startup fallback
only for an admitted profile's capability/initialization failure. Before WebGPU
context acquisition the original fresh canvas may use WebGL2; after acquisition
only the explicit fresh fallback canvas can be used. No host canvas is created
silently, and an acquired WebGPU canvas is never switched to WebGL2.

The facade exposes copied `frame` and `selected`, actual `canvas`, and status
with exactly `backend`, `state`, `generation`, `fallbackReason`, `limits`.
States are `ready`, `lost`, `disposed`, `failed`. Limits are actual numeric
`maxTextureDimension2D`, `maxBufferSize`, `maxUniformBufferBindingSize`,
`maxColorAttachments`, `maxColorAttachmentBytesPerSample`, `maxVertexBuffers`,
`maxVertexAttributes`, `maxBindGroups`, `maxVertexBufferArrayStride`, or `null`
for the fallback. No device or GPU handle is public.

`readPixels()` returns fresh canonical RGBA in top-left row order, converting
BGRA or preserved WebGL2 bottom-left rows. WebGPU `pick(x,y)` requires bounded
integer canvas pixels and reads the real depth-matched identity attachment;
identity zero is a miss. Its result is exactly `{generation, ref}`. WebGL2
fallback picking explicitly refuses `UNSUPPORTED`. `select(ref|null)` accepts
only the admitted qualified reference; selecting a reference does not certify
a physical hit. No bounds-based hit substitution is provided.

Only one asynchronous operation may be pending. Overlapping mutations,
readbacks and selection refuse `BUSY`; candidate snapshots precede the first
await. Accepted generation advances only after submission/presentation/error
checks. Candidate failure retains accepted resources; failed presentation
attempts accepted-color recovery, whose failure is terminal. Resize commits
backing dimensions with presentation and restores prior dimensions/color after
refusal when needed. The 10-second wait timeout is terminal and prevents scope/
resource reuse; late completion releases owned candidates. Queue completion
alone is not screen evidence.

Device loss is terminal `lost`, retaining the CPU frame and cleaning owned
resources. There is no automatic device-loss-time fallback. `dispose()` is
idempotent and destroys owned buffers/textures/device, unconfigures the owned
context and clears references. Preserved WebGL2 errors retain their actual
causes. Errors use `PrimitiveBackendError` and codes `INPUT`, `PROFILE`, `BUDGET`,
`UNSUPPORTED`, `INIT`, `DEVICE_LOST`, `RENDER`, `STATE`, `BUSY`; messages are
bounded to 1024 characters. Local errors have no fabricated cause; reflection
and inherited provider failures retain actual causes.

Canvas sides are at most 1024 and total pixels at most 1048576. Actual device
limits must admit dimensions 1024, buffer 4194304, uniform binding 160, two color
attachments/eight bytes per sample, two vertex buffers/attributes, one bind group
and stride12. Accepted plus candidate use at most 11 owned buffers, six textures
and two pipeline/module/group references, including one serial readback buffer.
Per-frame geometry/uniform logical buffers are at most 146156 bytes; readback is
at most 4194304 bytes with 256-byte padded rows. Shader text is capped at 64KiB.
These are bounded logical allocations, not measured driver memory.

The one source/emitted/original-frame/WGSL/file/cold flow is:

```sh
node examples/gpu-scene/webgpu-primitive-vertical-flow.mjs --output /absolute/fresh-directory
```

That CPU flow does not qualify shader execution. Actual adapter/device limits,
WGSL compilation, same-scene WebGPU/WebGL2 pixels, screen/console, updates,
physical hit/miss, startup fallback and cleanup require the separately authorized
real GPU phase. Device-loss proof, integration, consumer display and publication
remain separate stages. The denied original browser target must not be bypassed
through another browser/tool/origin/port.

## Authored EngineUV sampler and texture resource join (CPU, #1184)

`prepareEngineUVTextureMaterialBindings(sceneInput, textureInput, materialInput)`
joins complete original scene0, unchanged texture companion0 and a distinct
authored Material companion. The texture companion still has exactly five
fields: `format`, `version`, `sceneId`, `textures`, `bindings`. The new authored
companion has exactly four: `format`, `version`, `sceneId`, `bindings`:

```ts
const compiled = compileEngineUVTextureMaterial(`
@shader #image_palette {
  @uniform amount: float(0, 1, .25);
  @sampler paint: sampler2d;
  @fragment { color: mix(sample(paint, uv_u, uv_v), #203040, amount); }
}`);
if (compiled.ok) {
  const authored = {
    format: 'barocss-gpu-engine-uv-texture-material-bindings',
    version: 0,
    sceneId: originalScene.id,
    bindings: [{
      materialId: originalScene.materials[0].id,
      material: compiled.material,
      uniforms: { amount: -0 },
    }],
  };
  const prepared = prepareEngineUVTextureMaterialBindings(
    originalScene, originalTextures, authored,
  );
  prepared.samplerBindings;
  prepared.loweredBindings;
}
```

Each authored entry has exactly `materialId`, `material`, `uniforms`. Up to eight
unique existing scene materials are admitted. The reconstructed single sampler
alias maps to the texture companion binding with the same `materialId`.
Sampler spelling never implies a texture ID, and shader ID is not scene material
membership. Every authored material requires that actual texture binding, even
when its declared alias is unused or the material is hidden. Two differently
named material-local aliases may share one texture. Empty authored bindings are
valid; all supplied catalog members still undergo admission.

The prepared result has exactly eight fields: `scene`, `textureBindings`,
`materialBindings`, `resolvedBindings`, `loweredBindings`, `samplerBindings`,
`textures`, `pixelBytes`. Resolved entries are
`{materialId, binding: {material, uniforms}}`; lowered entries are
`{materialId, lowered}`. Sampler references are exactly
`{materialId, name, textureId, glslName}`, where `glslName` is `mat_s_0`, not a
device unit or resource handle. Returned scene and upload records reuse the
actual complete texture provider result.

`materialBindings` retains independently snapshotted original complete-source
IR and supplied Number signs, including `-0`. Resolved material is validated
source reconstruction; omitted uniforms use declaration-order defaults and
resolved numeric zeros become `+0`. Uniform overrides require ordinary own
records with at most 16 enumerable ASCII identifier keys of 1..32 characters,
finite Number values, declared membership and inclusive original ranges.
Supplied and declared/default `__proto__` always refuse `UNIFORM`.
`constructor`, `prototype` and `toString` are safe only when actually declared;
resolution uses own-name membership and `Object.fromEntries`.

All ordinary output metadata is frozen and independent from inputs and other
calls. The texture provider intentionally shares its frozen original texture
references within one result. Its Uint8 upload buffers and geometry Float32/
index buffers remain mutable derived views, never caller aliases or original
authority. Original bottom-left byte order, dimensionless UVs, scene material/
texture IDs and right-handed-y-up scene units remain unchanged. No native
parameter conversion, caller mutation/freezing, cache or prepared shortcut is
added. Same-ID source or pixel changes require complete original-input admission.

Admission order is exact authored header/version/IDs and binding length, entry
headers and aggregate source/uniform counts, independent own snapshots, actual
material validation, safe uniform resolution and actual lowering per entry,
one complete texture provider call, then joint scene/material/texture references.
Validation plus public lowering reconstructs source twice per entry, at most
16 times. The texture call performs the one complete scene admission. Inherited
texture preparation allocates admitted Uint8 buffers before outer joint-reference
checks; a refused candidate is unpublished CPU data. There is no universal
preallocation-refusal guarantee or partial accepted output.

New authored limits are eight bindings, aggregate source 65536 UTF16 units and
UTF8 bytes, declared/supplied uniform totals 128 each and 16 per entry. Each exact
three-field entry snapshot is bounded to 8192 visited values/depth 24, arrays 256,
records 16 keys and strings 65536 units. Source limits precede snapshots/provider
calls. Inputs require current-realm ordinary records and dense enumerable own
arrays; accessors, hidden/symbol fields, cycles and foreign prototypes refuse
without getter invocation. Original Material companion JSON is capped at 2097152 UTF16 units and
UTF8 bytes; aggregate lowered-wrapper JSON at 1048576 units and bytes. Existing
compiler work/depth/text limits and texture/geometry caps remain. Texture limits
are eight textures, 32 bindings, dimensions 1..1024 and 4194304 byte-channel slots
or 1048576 texels. No small whole-result JSON cap is imposed on geometry/pixels.

`EngineUVTextureMaterialBindingsError` has codes `INPUT`, `VERSION`, `BUDGET`,
`REFERENCE`, `UNIFORM`, `MATERIAL`, `TEXTURE`, `SCENE`, with prefix
`Engine UV texture material bindings: ` and messages bounded to 1024 characters.
Own reflective operations produce fresh `INPUT` with an own exact cause,
including undefined or branded errors. Local guards stay outside reflection
catches and have no fabricated cause. Header structure uses `INPUT`, companion
format/version uses `VERSION`, and cardinality/work/text ceilings use `BUDGET`.
Material-provider direct `BUDGET` remains
`BUDGET`; other actual material failures use `MATERIAL`. Texture-provider
`SCENE`, `BUDGET`, `REFERENCE` retain their classification; other failures use
`TEXTURE`. Actual provider errors and diagnostic chains remain causes, with no
invented source offsets or stronger promise about old provider internals.

Old numeric binders, compiler, texture catalog and renderer remain unchanged.
This stage qualifies source/catalog composition only. Sampled RGB, texture
upload, programs, device units, frame pixels, rollback/loss/disposal, UI,
consumer display and publication require separate acceptance. #1184 remains
open for its graphics gates; this API does not fulfill them.

After the affected GPU build, run the one source/emitted/original-file/cold flow:

```sh
node examples/gpu-scene/engine-uv-texture-material-bindings-flow.mjs --output /absolute/fresh-directory
```

### Frozen-parent source custody for a reproducible rerun

With Node.js 22 active, run this affected build and flow sequence from the
repository root. The browser bundle explicitly pins `@barocss/cad` to the local
accepted CAD source. A shared `node_modules` link can otherwise resolve CAD from
a live Integration checkout instead of the frozen parent. The qualifier uses
the same local source pin and audits all normalized source-graph paths. These
commands do not edit shared links or package manifests:

```sh
pnpm --filter @barocss/gpu exec tsc
pnpm --filter @barocss/gpu exec esbuild src/index.ts --bundle --format=esm --platform=browser --target=es2022 --alias:@barocss/cad=../barocss-cad/src/index.ts --outfile=dist/index.js
node examples/gpu-scene/engine-uv-texture-material-bindings-flow.mjs --output /absolute/fresh-directory
```

## Typed EngineUV texture WGSL source lowering (CPU, #1184)

`lowerEngineUVTextureMaterialWGSL(input)` validates complete original
EngineUVTextureMaterialIR once and lowers its typed expression directly to
trusted WGSL. It does not translate GLSL or accept caller shader text:

```ts
const compiled = compileEngineUVTextureMaterial(`
@shader #wgsl_image_palette {
  @uniform amount: float(0, 1, .25);
  @sampler paint: sampler2d;
  @fragment { color: mix(sample(paint, uv_u, uv_v), #203040, amount); }
}`);
if (compiled.ok) {
  const lowered = lowerEngineUVTextureMaterialWGSL(compiled.material);
  lowered.expression;
  lowered.declarations;
  lowered.uniformLayout;
  lowered.samplerLayout;
}
```

Result has exactly ten fields: `format`, `version`, `profile`, `material`,
`expression`, `declarations`, `uniformLayout`, `uniformByteLength`, `inputName`,
`samplerLayout`. Format is `barocss-gpu-engine-uv-texture-material-wgsl`, version
`0`, profile `engine-opaque-uv-texture-fragment-wgsl-v0`. Complete original
material/source/aliases and Number coefficients remain separately owned and
frozen. No new grammar or source IR type is introduced.

Numeric parameters reuse four vec4 slots and a fixed 64-byte block. Layout
records retain `name`, `type`, `min`, `max`, `default`, plus `index`, `byteOffset`,
`access`; float offsets are `4*index`, with trusted
`materialParams.slot[floor(index/4)]` component accesses. Complete declarations
include the MaterialParams struct and uniform at group0/binding1, texture at
group1/binding0 and sampler at group1/binding1, plus owned decode/mix helpers.
The containing shader supplies a trusted local `material_uv: vec2<f32>` named
by `inputName`; this does not declare a vertex varying, location or native UV
mapping.

The sole sampler layout has exactly twelve fields: `name`, `type`, `textureName`,
`samplerName`, `group`, `textureBinding`, `samplerBinding`, `colorSpace`,
`rowOrigin`, `filter`, `wrapS`, `wrapT`. It retains source name/type, uses
`material_tex_0`, `material_sampler_0`, group1/bindings0 and1, `srgb`,
`bottom-left`, `nearest` and two `clamp-to-edge` values. Layout and declarations
are retained even when the alias is unused. They are source/binding contracts,
not active GPU resources. Alias names are not material IDs, texture IDs or
device units. The separate CPU join remains responsible for resource identity;
this operation neither calls it nor allocates upload buffers or handles.

Typed float/color/uniform/input/unary/binary/call/sample nodes are traversed
directly. EngineUV leaves read `material_uv.x/y`; samples visit both coordinate
children and emit explicit `textureSampleLevel` at level0 with UV clamped to
0..1. One owned piecewise sRGB helper clamps encoded RGB, uses low/12.92 or
`pow((encoded+.055)/1.055,2.4)`, selecting low at encoded≤.04045. Future execution
requires unorm texture storage/view, nearest/clamp and a single level: hardware
sRGB decode together with this helper would decode twice. Original bottom-left
rows remain in row0 and V remains unchanged; no `1-V` is emitted.

Literal colors retain historical power2.2 coefficients; scalar mix is already
canonical typed arithmetic. The owned color-mix helper clamps its scalar ratio,
and whole-material linear RGB remains clamped to 0..1. This operation emits no
output display transfer. Uploads, interpolation, actual texture samples and pixel
values are not proved by trusted source text.

Emitted literals use admitted Float32 values, exponential8 spelling and an `f`
suffix. Original F64 declaration bounds/defaults remain in metadata; their
execution admission and emitted coefficients use `Math.fround`. Nonfinite,
overflow or nonzero-to-zero underflow refuses `MeshMaterialError` with `RANGE`.
Signed execution zero is preserved. No CPU/F32/GPU numerical equality is promised.

Inherited source 64KiB, tokens 4096, definition/expanded work 256, depth16 and
own-data limits remain. The new visitor counts at most256 nodes/depth16,
including sample and both coordinates. Combined declarations plus expression
are capped at65536 UTF16 units and UTF8 bytes; complete signed JSON result is
capped at2097152 units and bytes before an independent copied/frozen output.
All output arrays/records are fresh across calls; there are no mutable packed
views, input mutation/freezing, callbacks, result caches or partial results.

Actual validator `INPUT`, `IR`, `BUDGET`, diagnostics and reflection causes pass
through unchanged. New emission `RANGE`, `BUDGET`, `IR` uses bounded messages,
start/end0 and no fabricated source span or cause. Old legacy WGSL and GLSL
profiles/types remain unchanged. This does not add EngineUV textures to the
#1512 native Surface viewport. Discrete selection, repeating `fract`, nativeUV,
renderer/device/pipeline/module validation, image evaluation, frame/pixels,
selection/updates/retention/fallback/loss/lifetime, consumer and publication
support remain separate.

For the affected build and the one new source/emitted/full-original-file/cold
flow, use Node.js22 from the repository root. Pin CAD to the local accepted
source rather than a shared live Integration link; the qualifier audits all
normalized package paths and unchanged parent bytes. No shared links or package
manifests are changed:

```sh
pnpm --filter @barocss/gpu exec tsc
pnpm --filter @barocss/gpu exec esbuild src/index.ts --bundle --format=esm --platform=browser --target=es2022 --alias:@barocss/cad=../barocss-cad/src/index.ts --outfile=dist/index.js
node examples/gpu-scene/engine-uv-texture-material-wgsl-flow.mjs --output /absolute/fresh-directory
```

## Complete authored unlit EngineUV WGSL program (source only, #1184)

`lowerEngineUVTextureProgramWGSL(input)` accepts original
EngineUVTextureMaterialIR only. It calls the existing typed WGSL lowerer once,
including one complete original-source reconstruction, then generates a complete
trusted vertex/fragment module. Caller lowered text, modules, callbacks and saved
generated code are not authority:

```ts
const compiled = compileEngineUVTextureMaterial(`
@shader #unlit_image_palette {
  @uniform amount: float(0, 1, .25);
  @sampler paint: sampler2d;
  @fragment { color: mix(sample(paint, uv_u, uv_v), #203040, amount); }
}`);
if (compiled.ok) {
  const program = lowerEngineUVTextureProgramWGSL(compiled.material);
  program.code;
  program.entryPoints;
  program.vertexLayout;
  program.abi;
}
```

The fresh frozen result has exactly nine fields: `format`, `version`, `profile`,
`lowered`, `code`, `entryPoints`, `vertexLayout`, `abi`, `targets`. Format is
`barocss-gpu-engine-uv-texture-program-wgsl`, version `0`, profile
`engine-opaque-unlit-uv-texture-program-wgsl-v0`. `lowered` retains the complete
existing lowerer output and original material. Entry points are exactly
`{vertex: 'engine_uv_vertex', fragment: 'engine_uv_fragment'}`.

Vertex layout has two six-field records: `slot`, `location`, `stride`, `format`,
`semantic`, `stepMode`. Position is float32x3/slot0/location0/stride12; UV is
float32x2/slot1/location1/stride8; both use `stepMode: 'vertex'`. Original local
positions use right-handed-y-up scene units. World/view/projection matrices are
column-major. Vertex code applies world, then view/projection, and converts
OpenGL clip depth once with `(clip.z+clip.w)*.5`. Perspective UV location0 is
unchanged: no native mm conversion, Surface-domain normalization or V flip.

The exact seven-field ABI is `frame`, `material`, `draw`, `clipDepth`,
`uvTransform`, `outputTransfer`, `identity`:

| Block | Exact contract |
| --- | --- |
| frame | group0/binding0, 128 bytes, view offset0/projection offset64, column-major; six fields `group`, `binding`, `byteLength`, `viewByteOffset`, `projectionByteOffset`, `matrixOrder` |
| material | group0/binding1, 64 bytes; three fields `group`, `binding`, `byteLength`; existing lowerer slots and Float32 admission |
| draw | group2/binding0, 80 bytes, world offset0/identity offset64, column-major; six fields `group`, `binding`, `byteLength`, `worldByteOffset`, `identityByteOffset`, `matrixOrder` |

Draw storage is a 64-byte mat4x4 plus a 16-byte vec4 of uint identity data.
Texture/sampler use the exact existing sole sampler layout at group1/bindings0
and1, nearest/clamp/level0. A future runtime therefore requires three bind groups.
These are source ABI records, not created descriptors, buffers or resources.
No instance-matrix packing helper is added.

`clipDepth` is `gl-to-webgpu-z-half`, `uvTransform` is `none`, and
`outputTransfer` is `linear-to-srgb-piecewise`. The fragment supplies local
`material_uv = input.uv`, evaluates the trusted clamped authored linear color,
then encodes clamped linear RGB: at≤.0031308 use `12.92*x`; otherwise
`1.055*pow(x,1/2.4)-.055`. Alpha is1. This authored profile is unlit: no normals,
lighting, extra base tint or unbound-unlit substitution is inserted. A lit
profile requires a separate contract. Sample decoding remains the existing
single standard sRGB decode from unorm data; hardware sRGB double decoding and
legacy display gamma2.2 are not substituted.

Identity has exactly `location`, `format`, `zeroMeaning`, `min`, `max`:
location1/`r32uint`/`background`/1/4294967295. The fragment writes
`draw.identity.x` directly, not a float varying, ordinal or shaderId. Targets
have exactly `location`, `format`, `blend`: location0/`rgba8unorm`/false and
location1/`r32uint`/false. A future runtime owns nonzero-token mapping to actual
scene/node/geometry IDs and clears identity to zero. This source generator does
not validate host tokens or implement picking.

Original F64/source/UV/aliases stay authoritative inside `lowered`; code and
ABI are separate derived observations. Ordinary records/arrays are recursively
frozen and independently owned across calls, with immutable strings and no
caller aliases, handles, caches or mutable typed views. Complete module text
is capped at65536 UTF16 units and UTF8 bytes. Complete signed JSON result is
capped at2097152 units and bytes before freezing, counted without joining the
whole JSON. Existing lowerer errors and diagnostic/reflection cause chains pass
through unchanged. Only new module/result ceilings add `MeshMaterialError`
`BUDGET`, with bounded message/start=end0 and no fabricated source cause.
Inherited Float32 underflow/overflow, work256/depth16 and source/IR limits remain.

This operation adds no runtime or fallback. Actual shader-module validation,
device limits/alignment, pipelines, uploads, interpolation, sampled/output
pixels, token mapping, accepted/candidate resources, selection, updates,
retention, device loss, cleanup, consumer and publication remain separate.
The #1512 native Surface profile does not implicitly accept this generic texture
program; an unavailable compatible fallback is not claimed.

With Node.js22 active, first run the two build commands in the preceding recipe:
scoped `tsc` and browser ESM `esbuild` with the explicit local CAD alias. They produce the direct emitted
artifact. This new qualifier does not create that `dist` artifact. Then run the
standalone source/emitted/API/original-file/cold qualifier:

```sh
node examples/gpu-scene/engine-uv-texture-program-flow.mjs --output /absolute/fresh-directory
```

Save complete originals rather than generated code. The qualifier pins all
unchanged package source inputs and local CAD dependency resolution, then one
fresh Node.js22 child reconstructs source before regenerating the program. Source qualification
does not complete #1184's real graphics gate.

## Authored unlit EngineUV WebGPU viewport (#1184)

`mountEngineUVTextureWebGPUViewport(canvas, sceneInput, textureInput,
materialInput, optionsInput)` uses complete original scene0 and both original
texture/Material companions. It requires WebGPU; no generic fallback is
available. Options have exactly `{width, height}`, integers1..1024 and at most
1048576 pixels:

```ts
const viewport = await mountEngineUVTextureWebGPUViewport(
  canvas, originalScene, originalTextures, originalMaterials,
  { width: 256, height: 256 },
);
viewport.status;
viewport.originals;
await viewport.updateFrame(editedScene, editedTextures, editedMaterials);
const rgba = await viewport.readPixels();
const hit = await viewport.pick(128, 128);
viewport.select(hit.ref);
viewport.select(null);
viewport.dispose();
```

This is staging/runtime implementation. The native source/API/file flow does
not prove actual modules, devices, programs or graphics. Actual generic GPU
screen/pixel/lifecycle qualification remains UNRUN; no mock GPU or declaration
of a graphics pass follows from source verification. The preserved #1512 native
Surface profile and its manual evidence do not qualify this generic profile.

Options are admitted first, then one complete original authored join runs
synchronously before the first await. All hidden/unused source data is admitted;
every visible draw requires an authored Material binding or `REFERENCE` refusal.
An empty visible set is valid. Each authored entry then uses the actual complete
program lowerer once: the join's two source reconstructions plus one program
reconstruction, at most24 across eight entries. Caller WGSL, prepared shortcuts,
injected devices/platforms, shaderId caches and partial frames are unsupported.

The `originals` getter returns exactly `scene`, `textureBindings`,
`materialBindings`, as fresh deep-frozen ordinary copies including original
signed zeros. `selected` returns a copied frozen `{sceneId, nodeId, geometryId}`
or null. IDs retain their respective source namespaces; sampler/shader/material
IDs are not pick identity. No packed arrays or GPU handles escape.

Status has exactly `backend`, `profile`, `state`, `generation`, `width`, `height`,
`limits`, `resources`. Backend is `webgpu`, profile
`engine-opaque-unlit-uv-texture-program-wgsl-v0`; states are `ready`, `lost`,
`failed`, `disposed`. Limits and logical resource records are copied/frozen.
Mount generation is1; successful update/resize advances once. Reads, picks and
selection do not advance it.

`updateFrame(scene, textures, materials)` and `resize(width, height)` return
promises of the existing `UpdateResult`; `select(ref|null)` returns it directly.
Refusals retain actual errors. Mount/read/pick reject `EngineUVWebGPUError`.
Pixels are fresh tight RGBA in top-left order. `pick(x,y)` takes bounded integer
backing pixels and reads the real depth-matched uint identity attachment, returning
exactly `{generation, ref}`. Token0 is background; nonzero tokens map current
draw order to actual scene/node/geometry references. Unknown tokens use `RENDER`.
The host converts CSS coordinates; no pointer listener or bounds-hit proxy is
added. Selection requires an accepted visible reference; null clears, and exact
references remain selected only while visible after commit.

Only one asynchronous operation may be pending; overlapping mutation/read/pick/
selection refuses `BUSY`. External canvas backing changes use `STATE`;
lost/failed/disposed operations also use `STATE`. Original candidate snapshots
precede awaits. Upload and render happen offscreen, then same-format presentation
and queue/error-scope completion precede atomic originals/resources/map/size/
generation commit. Early failure releases its candidate and retains accepted
state. Presentation failure restores old size/color when healthy; failed recovery
is terminal and retains actual causes. Ten-second wait timeouts invalidate the
operation epoch and clean late results. Device loss is terminal `lost`; disposal
is idempotent, invalidates pending work and cleans owned resources/context/device.
There is no automatic fallback or loss-time backend switch.

Programs reuse position slot0/stride12 and UV slot1/stride8, frame128, material64,
draw80 and three bind groups. Original scene-unit world/camera Float32 matrices
are packed explicitly little-endian, with uint draw identity and three zero
padding lanes. There is no normal, tint, light, native mm or UV/V remap; the
program performs the one GL clip-depth conversion. Image rows are copied unchanged
to rgba8unorm, nearest/clamp/level0, with the one explicit standard sampled sRGB
decode. Authored linear color and original linear background use standard
piecewise sRGB output encoding once, alpha1. No legacy display gamma2.2 is added.
Canvas/offscreen color use rgba8unorm; RGBA-to-BGRA raw copies are not used.

All admitted unique geometries, textures and authored materials are allocated,
including unused ones; only visible draws get draw buffers. A candidate shares
its source geometry/texture IDs internally, without cross-generation caching.
Fixed sampler/layout ownership is device-scoped; pipelines/modules/groups are
released as references and buffers/textures destroyed. Existing scene/catalog/
source limits remain, including16 geometries/32 materials/64 nodes/32 meshes,
524288 vertex work, 11534336 CPU geometry bytes, eight textures/4194304 byte
channels, eight authored entries/128 uniforms and source64KiB. Each shader is
capped at64KiB and aggregate shaders at512KiB UTF16/UTF8.

Resource ledger has exactly `geometryBytes`, `textureBytes`, `uniformBytes`,
`colorIdentityBytes`, `depthTexels`, `depthBudgetBytes`, `chargedBytes`,
`readbackBytes`, `buffers`, `textures`, `bindGroups`, `pipelines`.
`colorIdentityBytes` is8WH; `depthTexels` isWH; `depthBudgetBytes` is4WH, a
conservative accounting charge, **not physical depth24plus storage**.
`chargedBytes` sums geometry/texture/uniform/color-identity bytes plus that
depth charge and is at most33554432. Accepted plus candidate plus the larger
padded readback is at most67108864 before device mutation. Readback uses
256-byte row pitch and at most4194304 bytes; pick uses256 scratch bytes.
Buffers are at most89, textures11, bind groups48 and pipelines8 per candidate.
Driver overhead, browser swap resources and physical memory remain unmeasured.

Thirteen actual positive integer limits are checked and rechecked for each
candidate: `maxTextureDimension2D`, `maxBufferSize`,
`maxUniformBufferBindingSize`, `maxColorAttachments`,
`maxColorAttachmentBytesPerSample`, `maxVertexBuffers`, `maxVertexAttributes`,
`maxBindGroups`, `maxVertexBufferArrayStride`, `maxSampledTexturesPerShaderStage`,
`maxSamplersPerShaderStage`, `maxUniformBuffersPerShaderStage`,
`maxBindingsPerBindGroup`. They must admit the actual candidate dimensions/
largest buffers/readback, 128-byte uniforms, two attachments/eight sample bytes,
two vertex buffers/attributes, three groups/stride12, one texture/sampler,
two uniforms per stage and two bindings per group. No dynamic-offset alignment
is assumed.

`EngineUVWebGPUError` uses `INPUT`, `VERSION`, `BUDGET`, `REFERENCE`, `UNIFORM`,
`MATERIAL`, `TEXTURE`, `SCENE`, `CAMERA`, `REPRESENTATION`, `UNSUPPORTED`, `INIT`,
`DEVICE_LOST`, `RENDER`, `STATE`, `BUSY`. Messages are bounded to1024 characters;
raw reflection preserves an own exact cause even when undefined, while local
guards have none. Actual join errors/codes remain causes. Program `RANGE` maps
to `REPRESENTATION`, `BUDGET` to `BUDGET`, other program errors to `MATERIAL`;
camera failures use `CAMERA`. Private preparation/packing helpers are not public
exports. All earlier public exports/providers remain unchanged.

Use Node.js22 and the preceding scoped `tsc`/browser ESM `esbuild` recipe with
explicit local CAD alias before the one new source/private-preflight/direct-
emitted/refusal/original-file/fresh-child qualifier:

```sh
node examples/gpu-scene/engine-uv-webgpu-runtime-flow.mjs --output /absolute/fresh-directory
```

That source gate supplies implementation/evidence only. Actual device modules,
pipelines, quarter-texel pixels, physical picking, updates/refusal retention,
device loss, browser/screen/live console, consumer and publication require
separate real acceptance. Existing denied-target restrictions and protected
servers/tabs remain; no alternate-origin/tool/port proof is proposed.


## Native Surface UV01 material WGSL source

`lowerNativeSurfaceUV01MaterialWGSL(originalIR)` revalidates the complete native
Surface source and lowers its typed UV01 tree to a trusted WGSL color expression.
It returns the copied original IR, a fixed 64-byte material uniform layout and
`native_surface_uv01` input metadata. The future program caller supplies that
`vec2<f32>` from original native Surface normalized parameters and implements
the trusted `material_mix` helper. Native UV01 is distinct from generic mesh UV
and image sampling. Legacy IR, GLSL and WebGPU profiles remain unchanged.

This source API does not mount a viewport, produce a whole shader program, bind
native files/TEN, upload uniforms, sample textures or qualify device/pixel output.
Original source and Number coefficients stay separate from derived Float32 text.
Unsafe Float32 coefficients refuse with `MeshMaterialError` RANGE; existing
source/IR diagnostics and raw causes are retained. Tree/text/result work is
bounded and returned data is independently owned and deeply frozen.

After the affected library build, run the scoped source/API/original-file flow
with Node22 from the repository root:

```sh
node examples/gpu-scene/native-surface-uv01-wgsl-flow.mjs --output /absolute/fresh/output
```

Actual native UV01 WebGPU program/frame/render/pixels, consumer display and
publication require separate receipts.

## Multiple original Surface WebGPU viewport (#1553)

`mountMultiSurfaceWebGPUViewport(canvas, completeFrame, { width, height })`
selects required WebGPU for **1..4 original qualified Surfaces** and0..4 legacy
MeshMaterial bindings. Use complete common frame0, scene2, explicit camera and
`particles:null`. Existing global MeshLighting is optional. Curve, empty,
particle, cloth, EngineUV, nativeUV01, texture and light-entity profiles are not
admitted by this route. Existing single-Surface and WebGL APIs keep their contracts.

Each full `(modelId,geometryId)` pair is distinct, including shared native geometry
IDs under different model aliases. GPU retains independently copied native
packets/parameters/poses/material CSS and Number coefficients. Existing common
preflight applies native-mm/display transforms once. Private position/normal/U16
execution bytes and camera160/material64 blocks are explicitly little-endian.
Caller source-document/TEN relationships remain the caller's authority.

One shared rgba8unorm/r32uint/depth24plus target draws entries in admitted order.
Tokens1..N map full refs;0 is background. Native gamma2.2, inherited singleton
lighting and direct background clear are preserved. Actual canvas configuration
admits fixedRGBA8; no preferred-format assumption or automatic fallback is used.

The returned viewport exposes `canvas`, fresh frozen `frame`, copied `selected`
and eight-field `status`. Async `updateFrame`, `resize`, `readPixels` and `pick`
allow one pending operation. `pick(x,y)` reads a top-left backing pixel and returns
`{generation,ref}` from the actual identity attachment. `select(ref|null)` only
changes metadata; it does not highlight or increment generation. Candidate updates
retain a still-present full selection; validation refusals preserve accepted state.
Failed presentation attempts restore accepted pixels; failed recovery is terminal.

Dimensions1..1024/product1048576, per-program64KiB and signed ordinary
`{frame,programs}`2MiB limits are bounded separately from upload charges. Status
resources are eleven logical fields: per-entry5buffers/224uniformbytes, N pipelines
and bindgroups, three shared textures, padded index/readback storage and logical
4-byte depth charge. Candidate32MiB and overlap/readback64MiB are caps, not measured
physical memory or driver-private allocation certificates. Required device limits
are the nine named fields; private prepared data is not a public input shortcut.

`MultiSurfaceWebGPUError` has INPUT/PROFILE/BUDGET/REPRESENTATION/UNSUPPORTED/INIT/
DEVICE_LOST/RENDER/STATE/BUSY codes and bounded messages. Actual causes are retained.
Device loss is terminal lost; timeout/recovery/cleanup failures are terminal failed.
Each device await is capped at10s; epoch cancellation prevents late commits.
`dispose()` invalidates waits, attempts every owned cleanup and releases this route's
canvas claim. First disposal reports cleanup failures; repeated disposal is a no-op.
No foreign device/context is released.

Native source/API/file/cold qualification uses
`node examples/gpu-scene/multi-surface-webgpu-flow.mjs --output ABS_FRESH` after
`build:library` with Node22. This flow checks original native source reconstruction,
trusted source/program/packing/identity/resource contracts and public emitted exports.
It uses no fake GPU. Actual shader compilation/device/pixels/shared-depth picking,
update retention/file remount/loss/driver cleanup and consumer adoption require
separate genuine browser receipts. Native code is not publication or release.

## Complete native Surface UV01 WebGPU program source

`lowerNativeSurfaceUV01ProgramWGSL(originalIR)` calls the native UV01 material
lowerer once and emits a complete trusted WGSL vertex and fragment program.
Only original `NativeSurfaceUV01MaterialIR` is accepted. Its separate profile is
`native-surface-opaque-uv01-program-wgsl-v0`; existing runtime profiles are unchanged.
The result has nine fields: `format`, `version`, `profile`, `lowered`, `code`,
`entryPoints`, `vertexLayout`, `abi`, and `targets`. Every call owns fresh deeply
frozen ordinary data, including the copied original material source and coefficients.

Vertex slots 0/1/2 are Float32 position/normal/native UV01 with strides 12/12/8.
Positions and normals are already prepared in world scene units. The program
applies view/projection and converts OpenGL clip Z to WebGPU Z once. Normal and
original native normalized UV01 use explicit perspective, center interpolation.
UV01 is not flipped, clamped, or redefined as texture UV. The future frame caller
must reconstruct original Surface requests and match full identity, revision,
vertex order, TEN and display context before joining separately derived arrays.
Equal array lengths do not establish that authority.

Group 0 uses frame binding 0 (160 bytes: view/projection/light/style), material
binding 1 (64 bytes), and draw binding 2 (16 bytes: identity at offset 0).
Target 0 is `rgba8unorm`; target 1 is `r32uint`. Future frame validation reserves
identity 0 for background and maps positive draw identities to full model/geometry
references. Source generation does not validate future buffers or topology.
Color uses the native material expression, inherited Lambert lighting and gamma
power 1/2.2 with opaque alpha. Style XYZ is reserved; there is no additional tint,
texture sampling, or new light entity. The exact returned ABI describes all offsets.

Complete code is limited to 64 KiB in UTF16 and UTF8. The complete signed finite
ordinary result is counted incrementally against 2 MiB in both encodings before
its final copy and freeze. Existing source, tree, Float32 and diagnostic guards
remain active; direct lowerer errors and raw reflection causes pass through.
Local budget errors use `MeshMaterialError` BUDGET with span 0/0 and no cause.

After the affected library build, run the ONE source/API/original-file/cold flow:

```sh
node examples/gpu-scene/native-surface-uv01-program-flow.mjs --output /absolute/fresh/output
```

This API generates source. Actual device compilation, native frame/TEN joining,
binding uploads, interpolation, pixels, physical picking, viewport lifecycle,
consumer adoption and publication need their own receipts.

### Source-derived native Surface UV01 CPU frame (#1569)

`prepareNativeSurfaceUV01Frame(input, width, height)` admits a complete original-source
request with format `barocss-gpu-native-surface-uv01-frame-request`, version `0`,
`entries` (1–4) and explicit `options`. Each entry contains exactly `ref`
(`modelId`, `geometryId`), the original `NativeSurfaceUV01GeometryRequest`, original
`NativeSurfaceUV01MaterialIR`, own numeric `uniforms` overrides, and `transform`
(an original `MeshSceneTransform` or `null`). Options contain exactly
`mmToSceneUnit`, `translate`, `background`, `camera` and `lighting`. Integer viewport
dimensions are 1–1024. No external packet, prepared token, legacy material, defaults,
Curve, texture, particle or authored-light entity is accepted.

Full `(modelId, geometryId)` pairs are unique; the geometry ID must match the
original selector and rebuilt Surface packet. The model ID is a caller asset
alias, not native `Model.name` or a provenance certificate. Viewer/Render callers
must verify source/count/revision/document/body/asset/TEN/display context before
calling. Equal IDs or array sizes alone never establish correspondence.

The function calls the existing native binding and complete WGSL program provider
once per entry, then the existing qualified common frame preflight once across all
entries. This performs three material reconstructions and one geometry producer
per entry. Options/poses are validated early and revalidated by common admission.
The common frame applies native millimetres, pose and world-normal transformation;
the shader receives those already prepared values and dimensionless original
Surface UV01 in corresponding native vertex order.

The result retains the copied raw request (including signed overrides), actual
bindings, common frame, viewport, prospective resource ledger and ordered draws.
Each draw has a copied full reference, identity token `index + 1` (background `0`),
complete program, actual index count, four independent little-endian byte arrays
for positions/normals/U16 indices/UV01, and independent 160/64/16-byte
frame/material/draw uniform blocks. U16 storage is padded to four bytes without
changing the index count; all reserved bytes are zero. Ordinary results are
recursively frozen, while typed views remain mutable and never share their buffers
with caller data, other entries/calls or the other result views. Results are
observations, never trusted future mount inputs.

Raw request and complete `{request, bindings, frame, programs}` accounting each
charge every repeated path, signed number, source/code string and typed observation
(as numeric-array text): at most 2 MiB in UTF16 and UTF8, 262144 visits and depth 48.
Raw strings are at most 64 KiB in both encodings, records 16 fields and arrays 24576
elements; root entry counts are admitted before descendants. Existing provider
source/tree/F32/result caps still apply. Some maximal native packets can exceed
aggregate limits. Packed draw allocation follows aggregate and prospective resource
admission; nonzero numeric upload values must stay nonzero finite F32.

The exact resource fields are `geometryBytes`, `uniformBytes` (240 per draw),
`colorIdentityBytes` (8WH), `depthTexels` (WH), `depthBudgetBytes` (logical 4WH),
`chargedBytes` (geometry + uniforms + 12WH), `readbackBytes`
(`ceil(4W/256)*256*H`), `buffers` (7 per draw), `textures` (3), `bindGroups` and
`pipelines` (one per draw). Candidate charge is capped at 32 MiB before upload-byte
allocation. These are prospective logical charges, not measured allocations.
No device objects, accepted candidate or readback exist in this CPU API; future
64 MiB accepted+candidate+readback and device limits remain runtime work.

`NativeSurfaceUV01FrameError` has bounded messages and exactly the diagnostic codes
`INPUT`, `BUDGET`, `REFERENCE`, `OPTIONS`, `BINDING`, `PROGRAM`, `FRAME`, and
`REPRESENTATION`. Reflection/provider exceptions retain their exact own cause,
including an explicitly thrown `undefined`; local guards have no fabricated cause
or spans. Failure returns no result and does not modify prior caller files/state.

Run the single source/emitted/original-file/cold reconstruction flow with
`node examples/gpu-scene/native-surface-uv01-frame-flow.mjs --output ABS_FRESH` after the affected GPU
build. Its cloud parent is `69b70d24793a6ccc0b73f7543a7385e81c99ca64`; the implementation
owns only the two new frame source files, additive public index/README, and this
flow. CPU/source results do not establish WGSL device/interpolation/pixels,
physical picking, lifecycle, consumer TEN/schema/history/current-Root acceptance,
Integration adoption or publication. The original browser denial and deferred
rendering acceptance remain unchanged.

### Required-WebGPU native Surface UV01 viewport (#1574)

`await mountNativeSurfaceUV01WebGPUViewport(canvas, rawRequest, { width, height })`
adds an explicit, required-WebGPU route for the complete raw request described in
#1569 above. Supply a fresh current-realm `HTMLCanvasElement`; route-local canvas
claims prevent duplicate mounts through this route, not mounts by other backends.
Options contain exactly own enumerable plain-data `width` and `height`: finite
integers 1–1024, at most 1048576 backing pixels, with no defaults. Accessors,
hidden/extra/symbol fields and reflection failures are refused without invoking
getters. No fallback, backend default, legacy admission or public device injection
is added. The host must explicitly remount after device loss.

The viewport exposes `canvas`, `originals`, `selected`, `status`,
`updateFrame(input)`, `resize(width, height)`, `readPixels()`, `pick(x, y)`,
`select(ref | null)` and `dispose()`. Mount rejects with
`NativeSurfaceUV01WebGPUError`; updates/resizes return `Promise<UpdateResult>`,
selection returns `UpdateResult`, and failed reads/picks reject. Diagnostic codes
are exactly `INPUT`, `FRAME`, `BUDGET`, `UNSUPPORTED`, `INIT`, `DEVICE_LOST`,
`RENDER`, `STATE`, `BUSY`, with messages at most 1024 characters. A provider
refusal is `FRAME` with the exact `NativeSurfaceUV01FrameError` cause, including
nested diagnostics/spans. Local refusals do not invent causes; reflection failures
preserve their exact own cause, even `undefined`.

Every admitted mount/update/resize synchronously invokes the real #1569 frame
provider once before any device await. Resize recompiles retained raw originals,
not prepared observations or the common legacy frame. Each `originals` read is a
fresh independent recursively frozen ordinary copy of the complete raw request,
including source text and signed Numbers. Upload buffers never become public
viewport observations. Caller-owned source/body/asset/TEN/current-display
correspondence is still required; aliases and equal-sized arrays do not prove it.
The provider's 1–4 native-bound Surface profile and all its budgets remain intact.

Each draw consumes its trusted complete program and declared entry points. Slots
0/1/2 upload positions/normals/UV01 verbatim as Float32x3/Float32x3/Float32x2 with
strides 12/12/8; the fourth geometry buffer is padded U16 indices with the provider's
unchanged index count. Group 0 bindings 0/1/2 are the unchanged 160/64/16-byte
frame/material/draw blocks, with explicit minimum binding sizes and stage visibility.
This is seven buffers, one bind group and one pipeline per draw, plus shared
`rgba8unorm`, `r32uint`, `depth24plus` attachments. Rendering is triangle-list,
cull-none, opaque/no-blend, depth-write/less and single-sample. Identity clears to
zero and each draw uploads its provider token `i + 1`. There is no second pose,
normal, millimetre, UV or color transform. Presentation copies offscreen RGBA8 to
a fixed opaque RGBA8 canvas configuration.

`status` is an independent immutable observation with backend `webgpu`, profile
`source0-native-surface-uv01-webgpu-v0`, state `ready | lost | failed | disposed`,
generation, dimensions, actual snapshotted limits and the existing eleven-field
logical resource ledger. Generation starts at one only after accepted presentation.
The actual limits include texture dimension and max buffer size, uniform binding
size ≥160, color attachments ≥2 and render-target bytes/sample ≥12, vertex buffers/attributes ≥3,
bind groups ≥1, vertex stride ≥12, uniform buffers/shader stage ≥3 and bindings/group
≥3. Render-target cost is 8 for RGBA8 plus 4 for R32uint; the logical packed
color/identity storage ledger remains 8 bytes per pixel. Candidate dimensions,
every upload, full padded readback and 256-byte pick
staging must fit before allocation. Provider candidate charge remains ≤32 MiB;
accepted + candidate + maximum readback logical charge must be ≤64 MiB. Logical
depth bytes/counts are not driver measurements, and no sampled texture/sampler
support is inferred. Resources report zero after owned resources are released.

One asynchronous operation may run at a time; a `BUSY` refusal does not release
the active operation's lock. Host backing-size changes outside `resize` are
refused. Candidates compile/upload/render offscreen, present successfully, then
commit raw originals/generation/selection and release old resources. Recoverable
candidate failures preserve accepted metadata/resources. A failed presentation
restores backing dimensions and re-presents the accepted scene; failed recovery
or cleanup is terminal. Ten-second bounded waits, epoch invalidation, late-device
destruction and late-map unmapping prevent pending work from reviving a disposed
viewport. Actual device loss (including rejection of its loss promise) is terminal;
no automatic backend switch occurs. Disposal is idempotent, cancels waits, releases
route claims/context/device/resources and preserves primary plus cleanup failures.

`readPixels()` returns an independent tightly packed, top-left RGBA byte array,
removing WebGPU's 256-byte row padding. `pick(x, y)` accepts bounded integer
backing pixels in that same orientation and returns `{ generation, ref }`, where
`ref` is the complete model/geometry pair or `null` for background; invalid identity
tokens are `RENDER` refusals. Selection is metadata only, survives reordering by
full pair and clears when the selected pair disappears; there is no highlight shader.

After the affected GPU type-check and library build, run:

```sh
node --test packages/barocss-gpu/tests/native-surface-uv01-webgpu-viewport.test.mjs
node examples/gpu-scene/native-surface-uv01-webgpu-runtime-flow.mjs --output ABS_FRESH
```

These are **DETERMINISTIC SOFTWARE EVIDENCE**. The private fake browser boundary
exercises actual source-derived admission and runtime control flow, not a graphics
device. The source/emitted/public-API/original-file/cold flow saves complete raw
requests, native sources and material sources and reopens/recompiles them in a fresh
process; prepared output is never cold authority. The defensive 32/64 MiB runtime
caps are not claimed as exercised real-data branches when earlier provider limits
make them unreachable. The existing #1569 no-mock qualifier is unchanged.

Real-device WGSL compilation, upload/interpolation/shared-depth pixels with an
independent declared tolerance, physical identity picking, update/refusal pixel
retention, file remount and driver/loss/lifetime acceptance remain UNRUN. A permitted
genuine cloud-browser acceptance is the next dependency, followed by named-consumer
original-source/TEN/current-display integration. This software implementation does
not establish #1512 milestone-4 completion, default readiness, consumer acceptance,
publication or release; the original Mac graphics denial is not bypassed.

### Authored directional light WGSL preparation (#1578)

`prepareNativeDirectionalLightProgramWGSL({ lights, material })` accepts the complete
original `NativeDirectionalLightsV0` catalog and a legacy `MeshMaterialBinding` or
`null`. It returns trusted complete WGSL (`vertexMain` / `fragmentMain`), explicit
ABI metadata, derived f32 execution, and fresh 64-byte material / 144-byte light
`Uint8Array` upload artifacts. `originals` preserves the complete signed catalog,
raw material source/IR, and exactly the supplied overrides, including omitted
defaults and `-0`; it is independent of normalized provider output. Ordinary
observations are recursively frozen and independently owned. Upload bytes remain
caller-mutable, cannot change observations or subsequent calls, and are never
accepted as reusable trusted inputs.

The original catalog provider runs once. Nonnull material uses one owned raw
snapshot, one unchanged binder and one unchanged WGSL lowerer (two source
reconstructions). Every resolved uniform must have its own finite in-range value.
`NativeDirectionalLightProgramWGSLError.code` is `INPUT`, `LIGHTS`, `MATERIAL`,
`REPRESENTATION` or `BUDGET`; actual reflection/provider failures retain their exact
cause, including thrown `undefined`. Local refusals do not fabricate causes.
Finite ordinary f32 rounding is supported; overflow or nonzero-to-zero loss is
refused. Original subnormal directions can normalize to safe executable values.

ABI: world position/normal occupy vertex slots and locations 0/1, stride12,
`float32x3`. Group0 bindings are frame0=144 bytes (vertex+fragment), material1=64,
lights2=144 and draw3=16 (fragment). Frame fields are column-major view at0,
projection at64, color at128. Null material consumes `pow(color.xyz,2.2)`; color.w
is unused. Clip z maps once from the existing camera convention to WebGPU.
Draw identity is u32 at0 with zero padding at4/8/12. The future host supplies
nonzero identity and a complete identity-to-(modelId,geometryId) mapping;
background is0. Frame/draw bytes are not produced or validated here.

Material uses the unchanged four-vec4 lowerer layout, offsets4*i. Light ambient
is f32 at0, zero padding at4/8/12; four fixed32-byte slots start at16. Each slot
has direction.xyz/intensity at16+32*i and linear color.xyz/zero padding at32+32*i.
All floats are explicitly little endian. Disabled lights retain authored slots
with effective +0 intensity. Unused slots/padding are zero. Removal compacts and
reorder remaps slots; sourceId+nodeId remains authored identity, never slot index.
The module unrolls up to four contributions, normalizes world normal once,
accumulates ambient and Lambert terms, clamps baseLinear*light after accumulation,
and encodes power1/2.2 with alpha1. This preserves linear-sRGB/power2.2 compatibility
arithmetic, without a physical/PBR/HDR/exact-standard-sRGB claim.

Downstream pipeline contract: triangle-list, cull none, no blending, one sample,
color targets `rgba8unorm` and `r32uint`, depth `depth24plus`, write enabled,
compare `less`. No device or pipeline is created. This API does not widen #1553
or #1574 admission, accept caller WGSL, create UV/texture unions, or certify a
frame, pixels, picking, loss/disposal, original-source/TEN/current-display join,
or Viewer/Render editing/Save/Open. Those need explicit downstream work.

Bounds: unchanged provider envelopes, raw material snapshot depth24/8192 values,
256 array elements/16 record entries; WGSL <=64KiB UTF16 and UTF8; streamed signed
ordinary result <=2MiB UTF16 and UTF8, depth48/32768 values, plus exactly208 binary
bytes. Defensive output caps are not claimed to have been forced with mocks.

After `pnpm --filter @barocss/gpu build:library`, run Node22:
`node examples/gpu-scene/native-directional-light-program-wgsl-flow.mjs --output /absolute/fresh/directory`.
The one CPU qualifier exercises ordinary source and emitted public entries,
independent literal module/LE-byte expectations, declaration consumer and exact
two runtime/eight type-only additions, edits/refusals/ownership, signed original
file saves and cold reconstruction. Numerical CPU references are not rendered
pixels; actual shader compilation, upload and GPU/runtime checks remain unrun.
Actual legacy source admission rejects f32-overflow coefficients first (literal
and generated coefficients are bounded by1000, intermediate ranges by1e6).
Therefore lowerer overflow is unreachable under this unchanged profile; the
qualifier records that upstream refusal, not a fabricated lowerer-overflow pass.
Genuine lowerer coefficient/default/bound underflow is tested independently of
local upload underflow.

## Authored directional-light required WebGPU viewport (#1579)

`mountNativeDirectionalLightWebGPUViewport(canvas, request, {width,height})` is an
additive, explicit required-WebGPU route. It renders 1–4 admitted qualified native
Surface packets, legacy opaque material bindings, and a complete 0–4 authored
world-directional light catalog. Existing routes, defaults and fallbacks are unchanged.

The exact request is `{format:'barocss-gpu-native-directional-light-webgpu-request',
version:0,frame,lights}`. `frame` is the complete existing version0 CPU frame
`{version:0,scene:{version:2,entries},options,particles:null,materials}`. Options must
explicitly contain exactly `mmToSceneUnit`, `translate`, `background`, and `camera`;
any legacy `lighting` field is refused. Entry colors and optional existing transforms
are admitted by the unchanged qualified-v2 provider. Material targets use full
`{modelId,geometryId}` pairs (modelId up to128 characters). Each replacement is
complete; omitted bindings do not carry forward. Pass the raw authored catalog,
including disabled entries and original directions, labels, order and revisions.

The frozen facade exposes `canvas`, fresh recursively frozen `originals`, fresh
`selected`, and `status`. Operations are `updateFrame`, `resize`, `readPixels`,
`pick`, `select`, and idempotent `dispose`. Mount rejects; update/resize/select
return the existing `UpdateResult`. Readbacks reject on refusal. Generation starts
at1 after presentation and advances only on accepted update/resize. Selection is
metadata only. Pick reads a bounded integer top-left backing pixel and returns
`{generation,ref}` from the identity attachment; readPixels returns fresh tightly
packed top-left RGBA bytes. The host must provide a fresh current-realm canvas,
retain ownership of it, and change backing size only through this viewport.
Duplicate claims are prevented within this route, not across unrelated APIs.

Private admission snapshots original packets, complete material source/overrides,
and raw lights before awaiting a device. It invokes common admission exactly once
and the actual directional WGSL provider once per draw. That means N catalog
admissions and exactly3 material reconstructions per bound draw (common1,
program2), unbound0. This admits authentic packet structure, not CAD-source
provenance: callers retain complete CAD documents/models/revisions and own the
packet/source/TEN/current-display join. A prepared frame is never a caller token.

Each draw owns position, normal, U16 index and four uniform buffers, with group0
bindings frame144/material64/lights144/draw16, all fragment-visible and frame also
vertex-visible. Provider WGSL and material/light bytes are consumed unchanged;
only new frame and identity data are packed locally, little-endian. There are N
pipelines/groups and three shared color/identity/depth attachments. Color is opaque
rgba8unorm, identity r32uint, depth depth24plus/less, no blend, cull none, sample1.
No UV buffers, textures, shadows, point/spot lights or automatic fallback are added.

For N draws and W×H, logical steady ownership is7N buffers,368N uniform bytes,
padded geometry bytes plus12WH attachment budget, and3 textures. Readback is a
separate `ceil(4W/256)*256*H` transient buffer. Candidate cap32MiB and overlap cap
64MiB include the maximum readback. Dimensions are explicit integer1..1024, at
most1048576 pixels. These are conservative logical charges, not physical driver
allocation measurements. Device limits are checked before allocations, including
color target cost12 bytes/sample (distinct from8WH packed color+identity storage),
four fragment uniforms/bindings,144-byte uniform binding size and every upload
and padded readback. Provider caps may make defensive residency ceilings unreachable.
Raw signed ordinary data is capped at2MiB UTF16/UTF8,262144 visits,depth48;
aggregate request/common/program metadata at8MiB,524288 visits,depth64. Records
are current-realm own data, at most64 fields; arrays are dense, bounded24576,
and source strings/keys bounded64KiB. Accessors, symbols, hidden fields, cycles,
nonfinite values and legacy singleton lighting are refused without coercion.

Candidate rendering precedes canvas mutation; presentation precedes commit.
Recoverable candidate refusals retain accepted observations. Failed presentation
restores dimensions and re-presents the accepted frame; failed restoration or
cleanup is terminal. Operations serialize with BUSY; device loss, rejected loss
promises and10-second timeout invalidate pending epochs with no fallback. Cleanup
attempts every owned resource even after a failure, preserves aggregate causes,
and releases the logical ledger. Disposal invalidates pending work; late devices
are destroyed and late mappings unmapped. Remount explicitly after terminal failure.
Diagnostics are INPUT,PROFILE,FRAME,PROGRAM,REPRESENTATION,BUDGET,UNSUPPORTED,INIT,
DEVICE_LOST,RENDER,STATE,BUSY. Exact provider/reflection causes are retained.

Software verification: `node --test --test-concurrency=1
packages/barocss-gpu/tests/native-directional-light-webgpu-viewport.test.mjs` and,
after the GPU library build, `node
examples/gpu-scene/native-directional-light-webgpu-flow.mjs --output ABS_FRESH`.
The latter compares source/emitted/DTS, independent ABI/resource expectations and
fresh-process reconstruction from saved original CAD/material files. Test-platform
bytes establish deterministic software control flow only. Genuine GPU shader
compilation, rendered directional colors/depth, physical picking, original-file
mount and driver cleanup remain UNRUN until permitted device acceptance. #1579
stays open for that stage; editor integration and overall default readiness remain
separate. No release/publication claim follows from these software checks.
