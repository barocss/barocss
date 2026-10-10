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
