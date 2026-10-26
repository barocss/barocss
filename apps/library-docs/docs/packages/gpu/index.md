# @barocss/gpu

The studio's WebGPU viewer, and a small CSS-shaped scene and material language. It depends only on `@barocss/cad`.

This package supplies the low-level canvas renderer. For the `Viewer` SDK class and its review-state API, see
[`@barocss/viewer`](/packages/viewer/).

- **Version.** The package is `0.0.0`, experimental and unreleased.
- **How the studio uses it.** The studio draws with this viewer when the browser has WebGPU. Its WebGL2 fallback is
  the studio's own renderer, not part of this package (see [WebGPU and WebGL2](#webgpu-and-webgl2)).
- **In code.** `@barocss/gpu/api` describes a scene as an immutable object: a part's meshes, their materials, lights
  and a camera view. `show(viewer, scene)` puts it in the viewer below. See [Object API](/packages/api#scenes).

### Scene geometry input candidate

The API source candidate proposes the following input contract. It has not been validated or integrated
into the product; this section does not confirm public support.

In this candidate, `Scene.add()` uses the Viewer's CPU geometry validation. Ordinary lines use segment pairs.
A contour uses `topology: 'lines'`, `contour: true` and triangle positions with normals, without edge ids. Its elements
contain three vertices or indices. Labels use `topology: 'labels'`; an empty `positions` array and an empty label
collection are allowed. Label text and world anchors come from `labels`. Empty positions for other topologies are
refused with `MESH_INVALID`.

The Scene retains the original geometry arrays. Validation does not replace them with prepared buffers or copy their
contents. Treat these shared arrays as read-only. Before clearing the Viewer or changing its lights or background,
`show()` applies the same geometry checks to every mesh, including meshes supplied through `new Scene(data)` and
later changes to shared arrays. A geometry refusal leaves the Viewer untouched. This preflight does not provide
rollback for material errors, device failures or other presentation errors, or establish browser validation results.

The follow-up source candidate also copies value settings when a Scene is constructed and when its `data` is read:
lights, background, camera vectors and supported nested material settings. Editing these copied settings does not
edit the Scene. Geometry arrays stay shared, and Viewer-owned texture and shader resources retain their identity;
this is not a deep copy of every resource.

Material ids are resolved only from the Scene's own registered material entries. Standard camera names are resolved
only from the view table's own entries; inherited object properties are not valid names. Invalid light kinds or
required light vectors give `LIGHT_INVALID`. Invalid camera directions or up vectors give `CAMERA_INVALID`. These
guards do not validate every light or material property. No performance measurements or runtime validation results
are established for this candidate.

Camera checks first scale finite, non-zero three-component vectors before normalization, including very large or
subnormal components. Direct `new Scene(data)` camera settings use the same direction/up alignment threshold,
projection choices and field-of-view range as `Scene.camera()`: perspective or orthographic, with finite `fovY`
strictly between 0 and 180 degrees. Direct camera data must supply these fields; the constructor copies its vectors
as supplied, while `Scene.camera()` stores normalized vectors and supplies its documented defaults.

## The viewer

`@barocss/gpu/viewer` is one WebGPU renderer for a canvas. It:

- owns one device and canvas context;
- keeps geometry in long-lived buffers;
- draws on demand, at most one frame per animation frame;
- follows the canvas's size and pixel ratio;
- replaces a lost device and uploads the scene again.

```js
import { createViewer } from '@barocss/gpu/viewer';

const viewer = await createViewer(canvas, { background: { top: '#2e3035', bottom: '#18191b' }, grid: true });
const box = viewer.add({ positions, normals, indices, faces }, { material: { color: '#c0c4cc', roughness: 0.5 } });
viewer.add({ positions: edgeSegments, topology: 'lines' }, { material: { color: '#111111', unlit: true, lineWidth: 1.5 } });
viewer.lights = [{ kind: 'directional', direction: [-0.4, 0.6, -1], castShadow: true }];
viewer.environment = { ambientOcclusion: { strength: 1 } };
viewer.fit();

const hit = viewer.raycast(x, y);        // the mesh, triangle, face, instance and point, on the CPU
const gpuHit = await viewer.pick(x, y);  // the same from the GPU's id and depth targets
box.outline = '#e8c25a';                 // a selection outline round the visible part
```

This example is the package README's. It needs a browser with WebGPU, so it isn't one of this site's samples. The
package's own browser tests drive it in Chrome.

- **Camera.**
  - Perspective, with an infinite far plane, or orthographic.
  - Reversed depth, and clip planes fitted to the scene.
  - `fit()`, and rays from the cursor.
  - Orbit, pan, and zoom to the point under the cursor; `controls: false` lets you drive the camera yourself.
- **Materials.**
  - Metal–roughness, lit by directional, point and spot lights and a hemisphere ambient; or unlit.
  - Vertex colours, colour maps with mipmaps, transparency drawn back to front, shadow catchers.
  - Shader materials, below.
- **Lines.** Screen-space width, segment ids, and `pickLine()`.
- **The scene.**
  - Instancing (one draw for many copies) and frustum culling.
  - Directional shadows, ambient occlusion, a gradient or transparent background, and a ground grid.
  - Soft shadows: `environment.softShadows`, the shadow-casting light's angular size in degrees, widens the penumbra
    with the distance from what casts it (PCSS). With 0 or none, the edge stays hard. Only the one shadow-casting
    light is softened.
  - Contact shadows: `environment.contactShadows: { length?, strength? }` darkens where the depth buffer blocks a short
    ray toward the shadow-casting light, in the creases the shadow map is too coarse for.
  - Bloom: `environment.bloom: { strength?, threshold?, knee? }` adds a glow from pixels above a linear-light threshold
    before tone mapping. Defaults are strength 0.05, threshold 1 and a soft knee one quarter of the threshold. Set
    `bloom` to false, omit it, or set strength to 0 to turn it off. A half-resolution prefilter and a downsample/upsample
    chain spread the highlights; the targets are recreated on resize and released with the viewer.
  - 4× MSAA, exposure and ACES tone mapping in a linear half-float pipeline.
  - Clip planes and cap hatching for sections.

### Depth of field

The low-level viewer accepts `environment.depthOfField` as `false` or `{ focus, blur? }`:

```js
viewer.environment = {
  ...viewer.environment,
  depthOfField: { focus: 160, blur: 6 },
};
```

`focus` is a positive distance along the camera's view axis in the scene's world units. `blur` is a maximum
radius in CSS pixels. Omitting `blur` uses 8; positive values are capped at 24. The renderer scales CSS pixels
by the device pixel ratio. Omitting the effect, setting it to `false`, or using zero blur disables it.
Non-finite or non-positive focus, and non-finite or non-positive blur, do not enable the effect.

The example assumes an existing WebGPU viewer and its scene units; 160 is not automatically 160 mm.
Studio stores its focus distance in mm and both its focus and blur values, as described under
[Focus and blur](/studio/rendering#focus-and-blur). These are image settings, not geometric or physical accuracy bounds.

![View-axis focus depth is 80 mm while eye-to-point distance is 100 mm; blur is a separate CSS-pixel value](/diagrams/focus-distance.svg)

[Open the focus diagram at full size](/diagrams/focus-distance.svg).

This coordinate example uses Studio mm; use the GPU scene's own world unit when applying the same view-axis rule.

## The scene and material language

The Render tab's props and its authored materials are written in this language. It runs on the CPU, so these
samples run in Node:

<<< @/../samples/gpu.test.mjs#scene

<<< @/../samples/gpu.test.mjs#shader

- **Scenes.**
  - A scene has exactly one `@scene`, a version, and objects styled by type or id selectors.
  - It has no classes, inheritance, expressions or scripts.
  - Anything it doesn't take is refused, with its line and column. Nothing is silently ignored.
- **Materials.** An `@shader` material declares its uniforms and a fragment colour, and lowers to the WGSL the viewer
  draws with.
- **Showing a scene.** On a viewer, `showScene(viewer, source)` adds a mesh per object, and `view.update(source)` shows
  an edited source or returns its diagnostics.

The package README is the language's full reference.

## Errors

gpu refuses with its own `BarocssError`, of the same shape as the other packages': a `code`, and a message that starts
with it in brackets. gpu imports neither cad package, so the class is its own. Each error class is one of these, and
some codes are shared by several classes, so tell refusals apart by `code`.

- **The viewer's input** is refused with a `ViewerError`:

  | Code | What it refuses |
  |---|---|
  | `GEOMETRY_INVALID` | Geometry input: positions, indices, topology counts, normals, faces, edges, UVs, labels, colours and their range, scalar fields |
  | `INSTANCES_INVALID` | Instance transforms or colours of the wrong length, or instancing a mesh that isn't triangles |
  | `TRANSFORM_INVALID` | A transform that isn't 16 numbers |
  | `COLOR_MAP_INVALID` | A colour map with fewer than two stops, or stops that don't rise |
  | `COLOR_INVALID` | A colour that isn't hex, when a frame is drawn |
  | `MATERIAL_INVALID` | A shader material with more than 16 parameters, when a frame is drawn |
  | `CLIP_INVALID` | Too many clip planes, or a plane without a normal or a finite offset |
  | `TEXTURE_INVALID` | A texture without a size, or data that isn't width × height RGBA |
  | `SIZE_INVALID` | A backing size under 1 × 1 |
  | `MATRIX_SINGULAR` | Inverting a matrix that has no inverse |

  When it can't start or draw, it refuses with `WEBGPU_UNAVAILABLE`, `NO_ADAPTER`, `NO_CONTEXT`, `SHADER`,
  `PIPELINE`, `DEVICE_LOST` or `DISPOSED`.
- **The package entry's inputs** are refused with a `GpuInputError`, with the same words as before its code. Where it
  wraps a check, its cause is that check's own error:

  | Code | Entry |
  |---|---|
  | `SCENE_INVALID` | `parseScene`, `compileScene` |
  | `MESH_PACKET_INVALID` | `validatePreviewPacket` |
  | `MESH_OPTIONS_INVALID` | `validateMeshOptions` |
  | `MESH_INVALID` | `prepareMesh` |
  | `CAMERA_INVALID` | `validateMeshCamera`, `prepareCamera` |
  | `FACE_PREVIEW_INVALID` | `prepareKernelFacePreview`, `resolveKernelFaceReference` |
  | `PRIMITIVE_FRAME_INVALID` | `preparePrimitiveSceneFrame` |
  | `BOOLEAN_BUFFERS_INVALID` | `prepareCoplanarBooleanBuffers`, `prepareBooleanShellBuffers` |
  | `GPU_BVH_DEPTH` | A hierarchy too deep for a GPU analysis (`computeExperimental`) |

- **Compiling the language** doesn't throw: `compileGpu` and `materialShader` return `{ ok: false, diagnostics }`, each
  diagnostic with its code and where it is.
- **The object facade's** codes are on [Object API](/packages/api#scenes).

## WebGPU and WebGL2

The studio keeps one interface over two renderers:

- **WebGPU** is this package's viewer, used when the browser has an adapter.
- **WebGL2** is the studio's own renderer (`apps/cad-studio/src/viewport/renderer.ts`): a multisampled scene pass,
  screen-space ambient occlusion and an id pass for picking.

Both draw the model, the display modes, sections, overlays and placed parts. The analysis maps and the mould's halves
draw only with WebGPU; on WebGL2 their buttons are disabled and say why. `?renderer=webgl2` forces WebGL2.

## Compute analyses

`computeExperimental` runs analyses on the GPU:

- **Wall thickness:** for each display triangle, a ray inward from its centre to the next wall. The local thickness is
  the sphere that fits there.
- **3-axis access:** from each sample, a ray along each of ±X, ±Y and ±Z, and whether it leaves the part.

Both trace the kernel's triangle hierarchy, packed for WGSL, and each has a CPU mirror. They are for display only: the
exact values a report uses stay the CPU's. The namespace is experimental and may change without a version bump.

## Frame costs

With `viewer.costs` on, each mesh counts what the last frame cost it:

- its draw calls;
- the triangles, lines and points they drew;
- its draws by pass: `shadow`, `surface`, `transparent`, `oit`, `hiddenLines`, `caps` and `outlineMask`.

These are work counts, not times; a frame's CPU time is in its stats. The studio reads them per body and display
mode, but doesn't show them yet.

### Measured

The studio's heaviest scenes were measured on both renderers: an orbit per display mode, at 1440 × 900 on an Apple
M-series machine in headless Chrome, with other work running. The scenes ranged from a 38-body assembly and a
120-bracket pattern to a 114,000-triangle spring.

- **Frame rate.** Every scene held 60 Hz: the frame interval's median was 16.7 ms.
- **Headroom.**
  - The main thread's work stayed under about 4 ms a frame.
  - On WebGPU, the GPU's time stayed under about 5 ms a submit.

  That leaves at least three times the 16.7 ms budget.

The full tables are in `apps/cad-studio/handover/notes/g11-scene-profile.md`. Times depend on the machine. Only the
counts are the same everywhere.
