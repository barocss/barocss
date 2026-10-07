# @barocss/gpu (private experimental v0)

An independent CSS-shaped scene language and original WebGL2 SDF renderer.
This package has no React, Three.js, GSS, CAD or existing utility-class dependency.
It is private, additive and not a claim of CSS/GSS compatibility or production readiness.

## Local source development

This private workspace package exposes `src/index.ts` through main, types and
import exports. Use `pnpm dev:gpu` from the repository root for the
loopback example. Installed esbuild resolves the original TypeScript module
graph in memory, including `.js` relative imports. Reload consumes source edits
without a dependency build or server restart. A plain browser cannot load raw
TypeScript; use the source host. Existing Node artifact demos explicitly import
`dist/index.js` and retain their separate `build:library` checkpoint. This private
entry change is not a published-package or release change.

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
is present. This is an additive private source1/IR2 kind; an older implementation
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
invoking getters. This is an additive private source1/IR2 kind; older consumers
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
