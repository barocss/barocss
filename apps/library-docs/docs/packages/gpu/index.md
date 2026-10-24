# @barocss/gpu

The studio's WebGPU viewer, and a small CSS-shaped scene and material language. It depends only on `@barocss/cad`.

- **Version.** The package is `0.0.0`, experimental and unreleased.
- **How the studio uses it.** The studio draws with this viewer when the browser has WebGPU. Its WebGL2 fallback is
  the studio's own renderer, not part of this package (see [WebGPU and WebGL2](#webgpu-and-webgl2)).
- **In code.** `@barocss/gpu/api` describes a scene as an immutable object: a part's meshes, their materials, lights
  and a camera view. `show(viewer, scene)` puts it in the viewer below. See [Object API](/packages/api#scenes).

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
  - 4× MSAA, exposure and ACES tone mapping in a linear half-float pipeline.
  - Clip planes and cap hatching for sections.

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
