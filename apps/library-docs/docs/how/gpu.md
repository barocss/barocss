<script setup>
import GpuPasses from '../.vitepress/components/algorithms/GpuPasses.vue';
import GpuBrdf from '../.vitepress/components/algorithms/GpuBrdf.vue';
import GpuCaps from '../.vitepress/components/algorithms/GpuCaps.vue';
</script>

# Rendering a model on the GPU

The studio's viewport draws a part with `@barocss/gpu`'s viewer when the browser has WebGPU. The kernel hands it
triangles; the viewer turns them into pixels: shadows, lit surfaces, edges, section caps, selection outlines. This page
opens up how. The calls themselves (creating a viewer, materials, lights, picking, captures) are on the package page,
[`@barocss/gpu`](/packages/gpu/).

The methods and constants are those of `packages/barocss-gpu/src/viewer/`, its shaders in `viewer/shaders/`, and the
analyses in `compute/`. The figures work out small cases in the page with the shaders' formulas.

## The stages at a glance

| Stage | What it does | Source |
|---|---|---|
| 1. Buffers | A mesh's positions, normals, colours and indices into GPU buffers, kept on the CPU too | `viewer/geometry.ts`, `viewer.ts` (`upload`) |
| 2. Shadow maps | Each shadow-casting light's depth view of the casters | `viewer.ts` (`shadowFrame`, `drawFrame`), `spot-shadow.ts`, `point-shadow.ts` |
| 3. Caps' probe | With section planes: what lies just past each pixel's entry into the kept region | `viewer.ts` (`drawCapFront`), `shaders/pick.ts` |
| 4. Surface pass | Opaque surfaces lit, caps, grid, lines, transparent meshes, 4× multisampled | `shaders/surface.ts`, `shaders/line.ts` |
| 5. Transparency | See-through surfaces, weighted and blended in any order | `shaders/surface.ts` (`oitOf`), `shaders/oit.ts` |
| 6. Outline mask | Which outlined mesh covers each pixel | `shaders/pick.ts` (`fsMask`) |
| 7. Bloom, focus | Optional glow and depth of field at half size | `shaders/bloom.ts`, `shaders/depth-of-field.ts` |
| 8. Output | Ambient occlusion, contact shadows, tone mapping, background, outlines, sRGB | `shaders/output.ts`, `shaders/output-color.ts` |

## 1. From tessellated faces to buffers

The kernel [tessellates each face](/how/tessellation) and a part's `meshes()` returns its triangles: positions,
normals, indices, and a face id per triangle; with `{ lines: true }` also its display edges as segment pairs. The
viewer validates them once and keeps the prepared arrays on the CPU. That copy is uploaded again when the GPU device is
lost, and it is what CPU picking ray-casts.

On the GPU each attribute is a buffer of its own:

| Buffer | Format | Bytes |
|---|---|---|
| Position | `float32x3` | 12 a vertex |
| Normal | `float32x3` (computed smooth over shared vertices when left out) | 12 a vertex |
| Colour | `unorm8x4`, linear | 4 a vertex |
| Texture coordinates | `float32x2`; one shared zero buffer for meshes without them | 8 a vertex |
| Indices | `uint16` or `uint32`, as given | 2 or 4 an index |
| Instance | a 4 × 4 transform as four `float32x4`, and a `unorm8x4` colour | 68 an instance |
| Line segment | two `float32x3` ends and two `unorm8x4` colours, one instance a segment | 32 a segment |

Every surface draw is instanced; a plain mesh is one identity instance. A normal goes through an instance's transform by
the cofactor of its 3 × 3 part, which is right for any invertible transform. Per frame the viewer writes one frame
block (camera, lights, shadow views, clip planes) and one 256-byte object block per mesh, bound at a dynamic offset.

Before drawing, meshes whose box is outside the view frustum are dropped. Opaque meshes are sorted by pipeline, so the
GPU changes state less often; lines and points come after surfaces; transparent meshes are sorted far to near by their
box's centre. The camera uses *reversed* depth: the near plane maps to 1 and far to 0, which keeps float precision far
from the eye. A perspective camera has no far plane; an orthographic one fits its depth range to the scene, the scene
box's centre ± 1.05 times its radius.

## 2. The passes of a frame

A frame is one command buffer of render passes. The passes in dashed boxes run only when something needs them: the
probe while a section caps a mesh, the transparency passes while a see-through surface is in view, the mask while a
mesh is outlined, bloom and depth of field when they are set.

<GpuPasses />

| Pass | Runs | Writes |
|---|---|---|
| `shadow i` | a shadow-casting light, when its view or a caster changed since it was drawn | one layer of a `depth32float` array, 2048² by default |
| `light probe` | a shadow-casting light while a caster is capped | the probe from the light, `rg32float` |
| `cap front`, `cap front samples` | while a section caps a mesh | `rg32float` depth and back-face flag; per sample a `r16uint` triangle key |
| `surface` | always | `rgba16float` colour and `depth32float` depth, 4 samples |
| `oit`, `oit composite` | a see-through surface in view | `rgba16float` accumulation, `r16float` revealage, then over the colour |
| `outline mask` | a mesh outlined | `r32uint` outline numbers |
| `bloom`, `depth of field` | when set | half-size `rgba16float` levels |
| `output` | always | the canvas |

The shadow layers are compared with a key of the light's view, the clip planes and every caster's slot, geometry,
instances and transform; when nothing in it changed, the layer is not drawn again. Faces in the surface pass carry a depth bias of −2
(slope −1.5), which sets them just behind lines drawn on them; lines test depth but never write it, so they leave no
gaps in what is behind them. A curved face's contour (its outline from the eye) is not stored: the vertex shader finds
it per triangle and per frame, where the facing f = n̂·v̂ changes sign along the triangle's edges.

## 3. Shading: metal and roughness

Each lit fragment gets a base colour, a metalness m (0 – 1) and a roughness (clamped to 0.04 – 1). Each light adds its
BRDF f(v, l) times n·l, its colour and intensity, π, and the share of it the shadow map lets through. The specular
part is the microfacet model: GGX for D, the height-correlated Smith term for V and Schlick's Fresnel for F. The
diffuse part is Lambert's, reduced by what Fresnel reflected and by metalness.

<GpuBrdf />

Light that does not come from a light source is the ambient term, in two forms:

| Without an environment map | With an environment map |
|---|---|
| A hemisphere: the ground colour below the up axis blended to the sky colour above it, by n·up / 2 + ½ (default weight 0.3 each) | The map's diffuse light, a cosine-weighted mean of its radiance round the normal (64 × 32, 512 samples a texel) |
| Its reflection: sky or ground along the mirrored view direction, blended toward the ambient colour by roughness | The map prefiltered by GGX, one mip level per roughness from 0 to 1 (up to 7 levels, 128 samples a texel), read along the mirrored direction |
| Weighted by f<sub>0</sub> + (max(1 − roughness, f<sub>0</sub>) − f<sub>0</sub>)(1 − n·v)<sup>5</sup> | Weighted by the split-sum table: f<sub>0</sub> · A + B, A and B over n·v and roughness (64 × 64, 256 samples, Smith with k = a / 2) |

So the ambient's diffuse share is ambient · base · (1 − m), and its reflection shows on metals and at grazing angles.
Surface finishes add to the same model: a relief of value noise or grooves bends the normal (fading into roughness
where its marks are finer than a pixel), machined, turned and brushed marks use an anisotropic GGX (Burley's form), and a clear coat adds a
second GGX lobe, with its own roughness, on the unbent normal.

## 4. Shadows

A shadow map stores, for each texel of a light's view, the depth of the nearest caster. A point is in shadow where it
is farther from the light than that depth. Before the comparison the point is pushed along its normal and the depth
lowered by a bias, so a surface does not shadow itself.

| Light | Its view | Filter |
|---|---|---|
| Directional (first 4) | Orthographic, round the scene: eye c − 2r·d, depth 0.9 r – 3.1 r | 3 × 3 comparisons (PCF); or PCSS when `environment.softShadows` gives the light an angular size |
| Spot (first 4) | Perspective along its cone | 3 × 3 PCF; or PCSS when `shadowRadius` is set |
| Point (first 8, one may cast) | Six 90° views, one per cube face | 3 × 3 taps, each across face seams by its own direction; or PCSS from a disk square to each ray |

For a directional light the push is 1.5 shadow texels along the normal (1.5 × 2r / size), and the bias 0.0005 of the
depth range. *PCSS* (percentage-closer soft shadows) softens an edge with distance from what casts it: 16 taps on a
Poisson disc, turned per point, find the mean depth of the blockers round the point; the penumbra's width is the gap
between the point and that mean times the light's size, kept between 1 and 32 texels; 16 taps across that width give
the lit share. A *shadow catcher* draws only the shadow, as dark as its opacity, on an otherwise invisible ground.

Two effects in the output pass reach where the map is too coarse. Ambient occlusion takes 12 samples on a spiral round
each pixel in the depth buffer and darkens where nearby surfaces rise above the pixel's own plane. Contact shadows
march 14 steps from each pixel toward the first shadow-casting directional light in screen space; a surface in front of
the ray by less than a blocker's assumed thickness (twice the ray's length) darkens the pixel.

## 5. Section planes and caps

A section plane keeps the points p with n·p ≥ d; up to six planes keep the intersection of their kept sides, or, as a
cut-out, everything but the intersection of their cut-away sides. Fragments elsewhere are discarded. That alone would
leave every cut solid hollow. The viewer does not compute cap polygons: it decides per pixel whether the pixel shows the
inside of a solid, and draws the cap there.

<GpuCaps />

The test needs no closed outline and no stencil buffer; it relies on the solid being closed and outward-wound, so
that whatever lies first after the entry is a back face exactly when the entry is inside. Where two capped solids
touch, the back face's small lead gives the cap to the solid the entry lies in, not to the one behind it. The same probe-and-test runs in
four more places:

- **Antialiased edges.** The multisampled probe stores a 16-bit key per sample: a hash of the mesh's slot, the triangle's
  first vertex and the instance, never 0. A cap sample is drawn where its own key matches, so the cap's border is
  covered per sample like a face's. Two triangles on one ray share a key about 1 time in 65 535.
- **See-through caps.** A ghosted mesh's cap is drawn into the transparency pass at the mesh's opacity.
- **Shadows.** A probe drawn from the light lets the caps cast shadows into the shadow map.
- **Picking and outlines.** `capPick` and `capMask` draw the caps into the pick and the outline mask; on the CPU,
  `capHit` repeats the test ray by ray with the same rule (a back face wins a tie).

When the kernel's exact section arrives, the studio replaces the cut bodies with it, so the per-pixel caps are what
shows while a plane is being moved.

## 6. Picking

Three questions are answered differently, each where it is cheapest:

| Call | How | Answer |
|---|---|---|
| `pick(x, y)` | One render pass scissored to the pixel: the mesh's id (`r32uint`), its depth (`r32float`) and the instance (`r32uint`), read back; then the point from the depth, and the triangle by a ray on the CPU in that mesh's own space | mesh, instance, point, triangle, face; or the cap and its plane |
| `raycast(x, y)` | On the CPU: a tree over every mesh and instance, visited nearest entry first; within a mesh of 1024 triangles or more, a triangle hierarchy with 8 a leaf | the same, at once, without a GPU round trip |
| `pickLine`, `pickPoint` | On the CPU in screen space: the nearest segment or point within a radius in pixels, through a box hierarchy from 256 segments; one hidden by a surface in front is passed over | the segment (an edge id) or point |

A GPU pick that waited for its readback while the camera, the canvas, a clip plane or a picked mesh's transform changed
returns null rather than a stale answer.

## 7. Transparency

While a see-through surface is in view, it is drawn in a pass of its own with *weighted blended* transparency: each
fragment adds its premultiplied colour times a weight into an accumulation target, and multiplies a revealage target
by 1 − alpha. Both are order-independent sums, so no sorting is needed. The weight favours near layers:
w = clamp(1 / (10⁻³ + (z / 2)³), 10⁻², 3 × 10³), z the view depth over the scene's size. A full-screen composite then
lays the average colour accumulation / weight over the scene, as opaque as 1 − revealage.

## 8. Progressive stills

`createPathTrace()` renders a frozen copy of the scene with a compute shader instead of the raster passes. Each sample
traces one jittered ray per pixel through the kernel's triangle hierarchy (packed as in section 9) for up to 6
bounces by default (1 – 16). At each hit it adds every light directly, with a shadow ray through the same hierarchy,
then picks the next direction by sampling the diffuse lobe, the GGX lobe or the coat, weighted by metalness and coat.
From the third bounce a path survives with probability clamp(max throughput, 0.05, 0.95) and is scaled up when it
does. Samples accumulate as a running mean in 32-bit floats, with no clamp on bright samples. On capture, an optional
5 × 5 bilateral filter, guided by the first hit's normal and depth and by colour, denoises before the same tone mapping as the raster
output.

## 9. GPU compute for analyses

`computeExperimental` runs two analyses on the GPU, each with a CPU mirror reading the same packed data:

| Step | What it does |
|---|---|
| Packing the hierarchy | The kernel's `triangleBvh`, as 8 words a node (box, child link or leaf range) and 12 a triangle (its vertices and source index). Boxes are rounded outward to the next float32, so a triangle's float32 vertices never fall outside its box. A hierarchy deeper than the shaders' 64-entry stack is refused (`GPU_BVH_DEPTH`). |
| Wall thickness | One invocation per triangle: a ray from its centre along its inward normal, skipping itself, to the next wall (the depth); the local thickness is twice the distance from the ray's midpoint to the nearest surface, at most the depth. |
| 3-axis access | Each triangle split into n² parts (n from its longest edge over the step, at most 48), each part's centre 0.01 mm off the face; one invocation per sample casts rays along ±X, ±Y, ±Z on the face's side and records which leave the part. The masks fold back per triangle on the CPU. |

Both are for display: the values a report uses stay the CPU's. The GPU does not compute Booleans: the `boolean/` folder
prepares display buffers from the kernel's Boolean results on the CPU.

## WebGPU and WebGL2

The studio has a second renderer for browsers without WebGPU, `apps/cad-studio/src/viewport/renderer.ts`. It is the
studio's own, not this package's:

| | WebGPU (this package) | WebGL2 (the studio) |
|---|---|---|
| Passes | shadow maps, probe, surface (4× MSAA, half float), transparency, mask, bloom, focus, output | a multisampled scene pass, a resolve, an ambient-occlusion composite, an id pass for picking |
| Shading | metal–roughness with lights, shadows and environment maps | a clay shading of the bodies |
| Shadows | shadow maps for directional, spot and point lights | a soft round contact shadow under the model's box |
| Sections | the viewer's clip planes cut and cap on the GPU, per pixel | each mesh clipped and capped on the CPU, as geometry |
| Picking | GPU id and depth readback, or the CPU ray cast | an id pass read back with `readPixels` |

The analysis maps and the mould's halves draw only with WebGPU.

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-gpu/src/viewer/viewer.ts` | The viewer: pipelines, targets, `drawFrame` (the pass order), shadow frames and their cache, `pick`, `raycast`, caps on the CPU (`capHit`) |
| `viewer/geometry.ts` | Geometry checks, smooth normals, the CPU ray against triangles with clip planes (`clippedRayFull`), segment and point picking |
| `viewer/lights.ts` | The frame block (`packFrame`), the default lights, the output block |
| `viewer/camera.ts` | Reversed depth, clip planes fitted to the scene, rays from the cursor |
| `viewer/shaders/common.ts` | The frame and object blocks, clip planes, `regionAlong`, `capPoint`, the triangle key |
| `viewer/shaders/surface.ts` | GGX, Smith, Schlick, shadows (PCF, PCSS, point faces), `shadeLayered`, the caps (`capShade`, the hatch), transparency weights, shadow catchers |
| `viewer/shaders/material-layer.ts` | `brdfLayered`, finishes, anisotropic GGX, the clear coat and oil film; shared with the path tracer |
| `viewer/shaders/env.ts` | The environment's prefiltered reflections, diffuse light and split-sum table |
| `viewer/shaders/pick.ts` | Pick ids, the outline mask, the caps' probe, depth-only shadows, caps in picks, masks and shadow maps |
| `viewer/shaders/line.ts` | Lines as screen-space quads, contours in the vertex shader, hidden-line parts |
| `viewer/shaders/output.ts`, `output-color.ts` | Ambient occlusion, contact shadows, ACES and AgX, grading, outlines, sRGB |
| `viewer/shaders/bloom.ts`, `depth-of-field.ts`, `oit.ts` | Bloom chain, depth of field, the transparency composite |
| `viewer/path-trace.ts`, `shaders/path-trace.ts` | Progressive stills: the trace and display compute passes |
| `src/compute/` | The packed hierarchy (`bvhPack.ts`, `bvhWgsl.ts`), wall thickness, access, the dispatch helper |
| `apps/cad-studio/src/viewport/sectionView.ts` | Which renderer cuts and caps a section in the studio |

## How it is checked

Node tests (`pnpm --filter @barocss/gpu test`), all in `packages/barocss-gpu/tests/`:

- `viewer-core.test.mjs`: reversed depth, clip planes fitted to the scene, frustum culling, the frame block against the
  WGSL layout, clip planes and caps on the CPU for one plane, several planes and a cut-out, ray picking through the
  hierarchy against a test of every triangle, and GPU picks that return null when the camera, a clip plane or a
  transform changes during readback.
- `viewer-cap-samples.test.mjs`: the sampled shaders read the probe per sample; the triangle key is 16 bits, never 0,
  and two triangles share one about 1 time in 65 535.
- `viewer-depth-of-field.test.mjs`, `viewer-path-trace.test.mjs`: the focus block and its resources; the path tracer's
  packed scene, transforms and refusals.
- `compute-bvh-pack.test.mjs`, `compute-thickness.test.mjs`, `compute-access.test.mjs`: outward float32 rounding,
  every triangle once in leaf order, the CPU mirror against the kernel's own queries, depth refusals; a box's walls 8
  thick, a tube's wall 5; a sealed cavity reached by no direction.

Browser tests in Chrome with WebGPU (`test:browser`):

- `viewer-browser.test.mjs`: draws, picks with `pick()` and `raycast()`, orbits, resizes and recovers from a lost device.
- `viewer-cap-aa-browser.test.mjs`: antialiased caps, a ghosted cap added once, the cost of the sampled probe at 1440p
  and 4K.
- `viewer-shadow-soft-browser.test.mjs`, `viewer-env-browser.test.mjs`, `viewer-bloom-browser.test.mjs`,
  `viewer-post-browser.test.mjs`, `viewer-contour-browser.test.mjs`: soft and contact shadows, environment lighting,
  bloom, the output pass, and the GPU contour against the CPU's within a pixel.
- `viewer-path-trace-browser.test.mjs`, `compute-thickness-browser.test.mjs`, `compute-access-browser.test.mjs`: path
  traced shadows and transport; each analysis on WebGPU equal to its CPU mirror per triangle or sample.

Also in that folder, outside the two scripts' lists: `viewer-shadow-spot-browser.test.mjs` and
`viewer-shadow-point-browser.test.mjs` (spot and point shadows keep clipped caps and recover their device), and
`viewer-shadow-multi.test.mjs` (four directional casters, the fifth left out).

## Limits

- **Lights.** The first 4 directional, 4 spot and 8 point lights are used; at most one point light casts a shadow. PCSS
  approximates an area light with bounded searches; it is not an area-light renderer.
- **Sections.** At most 6 planes. A cap relies on closed, outward-wound solids; an open mesh can show a wrong cap.
  Within one ray, two triangles whose keys collide (about 1 in 65 535) can swap a cap sample.
- **Transparency.** Weighted blending approximates order: layers of similar depth and opacity mix rather than cover
  each other.
- **Progressive stills.** Section clips and caps, shader materials, scalar colour maps and contours are refused
  (`PATH_TRACE_UNSUPPORTED`); lines, labels, overlays and the raster effects (bloom, depth of field, ambient occlusion,
  contact shadows, outlines) are not in them.
- **Compute.** Experimental, and display-only; it may change without a version bump.
