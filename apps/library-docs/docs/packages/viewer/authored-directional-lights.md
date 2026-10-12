# Authored directional lights on native documents

Use `createNativeDirectionalLightWebGPUViewer` for a complete original CAD document with authored colored directional lights. This is an explicit asynchronous, required-WebGPU facade. The synchronous `createViewer` path remains separate; there is no implicit WebGL fallback, injected device or prepared-token API.

## Availability and scope

This addition documents public source at [`78ff80606497875cf148c860e58a213b27dd0cf3`](https://github.com/barocss/barocss/tree/78ff80606497875cf148c860e58a213b27dd0cf3), independently of the Manual's historical API/example catalog pins. See the [#1580 software receipt](https://github.com/barocss/barocss/issues/1580#issuecomment-6117896054). Source availability does not establish an npm release or physical-device acceptance.

## Build one complete original composition

The host provides a visible `HTMLCanvasElement`, calls `mountLights(canvas)`, and disposes the returned controller on page close. Use a TypeScript-capable browser bundler and the matching workspace packages. This maintained snippet uses only public package entries; its checker compiles the exact block without executing CAD, Viewer or GPU code.

```ts
import { parseBaroCadDocument, prepareBaroCadDocumentPrimitiveNativeRefsV2 }
  from '@barocss/cad-interop/document';
import { compileMeshMaterial } from '@barocss/gpu';
import { createNativeDirectionalLightWebGPUViewer, ViewerNativeDirectionalLightError }
  from '@barocss/viewer';
import type { ViewerNativeDirectionalLightInput, ViewerNativeDirectionalLightWebGPU }
  from '@barocss/viewer';

function originalInput(): ViewerNativeDirectionalLightInput {
  const source = `@model original_panel {
    version:0; length-unit:mm;
    @surface #panel {
      type:nurbs; degree-u:1; degree-v:1;
      knots-u:[0,0,1,1]; knots-v:[0,0,1,1];
      control-points:[[[0,0,-0],[0,3,0]],[[2,0,1],[2,3,1]]];
      weights:[[1,1],[1,1]];
    }
  }`;
  const nativeFrame = 'authored-xyz-no-axis-conversion';
  // JSON.stringify is used only for this unsigned document envelope.
  // The original Source0 string itself retains its authored -0 token.
  const result = parseBaroCadDocument(JSON.stringify({
    schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry',
    documentId: 'panel_document', revision: 5,
    units: { length: 'mm', angle: 'rad' }, nativeFrame,
    assets: [{ id: 'panel-asset', revision: 2, role: 'authored-native-source',
      sourceVersion: 0, sourceFrame: nativeFrame, source }],
    bodies: [{ id: 'panel_body', name: 'Original panel',
      kind: 'direct-geometry-object', assetId: 'panel-asset', geometryId: 'panel' }],
    features: [], parameters: [], constraints: [], placements: [], derivedCaches: [],
  }));
  const options = { native: { sourceVersion: 0 as const, countU: 5, countV: 5,
    unitsPerMillimeter: 1 }, basis: 'authored-xyz-matches-rhyup' as const };
  const entries = prepareBaroCadDocumentPrimitiveNativeRefsV2(result, options);
  const refs = entries.map(entry => ({ kind: 'surface' as const,
    modelId: entry.ref.modelId, surfaceId: entry.ref.geometryId }));
  const compiled = compileMeshMaterial(`@shader #panel_white {
    @uniform amount:float(-0,1,.8);
    @fragment {color:mix(#888,#fff,amount);}
  }`);
  if (!compiled.ok) throw new Error('Material refused', { cause: compiled.diagnostics });
  return {
    format: 'barocss-viewer-native-directional-light-input', version: 0,
    owner: { id: 'panel-light-study', revision: -0 },
    source: { kind: 'document', result, options, bindings: entries.map(e => e.binding) },
    display: {
      visibleGeometry: refs,
      camera: { eye: [0, 2, 11], target: [0, 1, 0], up: [0, 1, 0],
        fovYDegrees: 45, near: .1, far: 100 },
      motion: { frame: { contextId: 'panel-pose', timeSeconds: -0,
        poses: [{ targetId: 'panel', translation: [-1, -1, 0],
          rotation: [0, 0, 0, 1], scale: [1, 1, 1] }] },
        bindings: refs.map(ref => ({ contextId: 'panel-pose', targetId: 'panel', ref })),
        basis: 'part-xyz-matches-rhyup' },
    },
    materials: refs.map(ref => ({ ref: { modelId: ref.modelId, surfaceId: ref.surfaceId },
      binding: { material: compiled.material, uniforms: {} } })),
    lights: { format: 'barocss-gpu-native-directional-lights', version: 0,
      profile: 'native-world-directional-linear-v0', sourceId: 'panel-light-study',
      revision: -0, ambientStrength: .15,
      lights: [{ nodeId: 'red-key', label: 'Red +X', enabled: true,
        directionScene: [1, -0, 0], colorLinearRGB: [1, 0, -0], intensity: .9 }] },
    context: { mmToSceneUnit: 1, background: [.035, .045, .065] },
  };
}

export function mountLights(canvas: HTMLCanvasElement) {
  let closed = false;
  let viewer: ViewerNativeDirectionalLightWebGPU | undefined;
  function dispose() {
    if (closed) return;
    closed = true;
    window.removeEventListener('pagehide', dispose);
    viewer?.dispose();
  }
  window.addEventListener('pagehide', dispose, { once: true });
  const ready = (async () => {
    try {
      const mounted = await createNativeDirectionalLightWebGPUViewer(
        canvas, originalInput(), { width: 800, height: 600 });
      // Closing while the async factory is pending must not leak its late result.
      if (closed) { mounted.dispose(); return; }
      viewer = mounted;
      return mounted;
    } catch (error) { dispose(); throw error; }
  })();
  return {
    ready, dispose,
    async applyRedIntensity(intensity: number) {
      const current = await ready;
      if (!current || closed) throw new Error('Host is closed');
      // Clone raw originals, preserving -0 and omitted material overrides.
      const next = structuredClone(current.originals);
      if (next.owner.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Revision exhausted');
      next.owner.revision += 1;
      next.lights.revision = next.owner.revision;
      next.lights.lights[0].intensity = intensity;
      const result = await current.replace(next);
      if (!result.ok) throw result.error;
      return current.accepted;
    },
    async pickAndSelect(xBacking: number, yBacking: number) {
      const current = await ready;
      if (!current || closed) throw new Error('Host is closed');
      const hit = await current.pick(xBacking, yBacking);
      if (closed) throw new Error('Host closed during pick');
      const result = current.select(hit.ref);
      if (!result.ok) throw result.error;
      return hit; // generation, full ref, complete original TEN binding
    },
  };
}

export function reportLightError(error: unknown) {
  if (error instanceof ViewerNativeDirectionalLightError) {
    console.error(error.code, error.message, error.cause);
  } else console.error(error);
}
```

Catch rejected `ready`, Apply and pick promises in the host, for example with `.catch(reportLightError)`. Serialize host controls while pending. `replace` and `resize` resolve an `UpdateResult`; awaiting alone is insufficient: inspect `ok` and preserve the error/cause on refusal. Factory, `readPixels` and `pick` can reject. `select` is synchronous and also returns `UpdateResult`.

## Original ownership, aliases and raw values

- `owner.id/revision` exactly match `lights.sourceId/revision`, including the distinction between `0` and `-0`. These are composition/light revisions, independent of CAD document revision 5 and asset revision 2. A light edit advances only the composition/catalog pair after accepted replacement; it does not rewrite CAD source or TEN pins
- `source` contains the complete parsed canonical document, explicit basis, Source0 sampling options and every selected original binding. Keep all ten TEN fields: `documentId`, `documentRevision`, `nativeFrame`, `bodyId`, `assetId`, `assetRevision`, `sourceFrame`, `modelId`, `geometryKind`, `geometryId`. They are declared revision pins, not content hashes
- Join display selection and materials by the full `modelId`/`surfaceId` pair. Interop derives the display alias from the asset ID (`panel-asset` becomes `panel.asset`); TEN `modelId` still names `original_panel`. Use the returned references and bindings, never rewrite native IDs to force a join. Identical local Surface IDs in different assets are distinct
- `display` supplies current visible references, camera and complete poses/bindings. Select 1–4 original Surfaces, including hidden objects, with at least one visible; native grids are 2–17 samples per axis and `unitsPerMillimeter` is 1. Original packets/poses pass through so GPU applies pose/unit conversion once
- `materials` retain raw material source/IR and supplied overrides. Empty `uniforms: {}` leaves defaults omitted; an explicit `{ amount: -0 }` is a different original. `lights` is the complete ordered 0–4 directional-light catalog, including disabled entries, plus ambient; directions are scene-space, colors linear RGB. `context` supplies the native-mm display scale and background

The facade returns independent frozen `originals` and immutable `accepted` metadata: composition owner, original document identity/revision, full inventory, visible references, TEN bindings and presented generation. Selection survives reorder by the full pair and clears on hide/removal/disposal. `pick` uses top-left backing-pixel coordinates, returns null ref/binding on background, and joins rendered selection to original TEN metadata. It is not a CAD-exact intersection, UV or topology certificate. `readPixels` is asynchronous RGBA readback in top-left backing-pixel order.

## Refusal, lifetime and device loss

`ViewerNativeDirectionalLightError.code` is `INPUT`, `BUDGET`, `OWNER`, `SOURCE`, `GPU`, `BUSY`, `STATE` or `DISPOSED`. Retain nested provider diagnostics rather than interpreting one message as a universal error. The wrapper locks through preparation/presentation/adoption; overlapping operations refuse `BUSY`. Disable or queue conflicting controls in your host.

CPU or recoverable GPU refusal retains prior accepted metadata and selection. There is no second Viewer rollback. Metadata remains readable after loss/disposal, but retained metadata does not promise retained pixels. Check `status.state`; once the GPU is unavailable, operations refuse `STATE` and require explicit remount. Keep accepted originals, dispose the old facade, and call the asynchronous factory again on a suitable canvas/device path. There is no automatic remount or fallback.

`dispose()` is idempotent, invalidates pending operations and clears selection. Do not reuse the disposed facade. The snippet removes its pagehide listener and disposes late factory completion; the host must similarly remove its own controls/listeners and catch pending operation errors.

Raw own-data limits include depth 32, 327680 visits, arrays up to 4096, records up to 64 fields and a 4 MiB signed representation; profile-specific arrays and provider limits are stricter. The complete retained projection has a separate 12 MiB/depth-64/1048576-visit budget. Passing TypeScript does not prove runtime admission.

## Run the existing editor and original-file flow

Use the [existing two-Surface example](https://github.com/barocss/barocss/tree/78ff80606497875cf148c860e58a213b27dd0cf3/examples/viewer-native-directional-lights), which includes red +X and blue +Z lights, stable light IDs, add/remove/disable, selected TEN inspection and asynchronous resize. From the repository root with the existing Node 22/pnpm 9 dependencies:

```sh
pnpm exec vite examples/viewer-native-directional-lights --host 127.0.0.1 --port 4180 --strictPort
```

Open `http://127.0.0.1:4180/` in a WebGPU-capable browser. Save exports the accepted original composition, never an uncommitted draft or GPU program. Open re-parses the embedded canonical CAD document, recompiles original material source and revalidates TEN ownership. The example-owned exact version-0 codec caps files at 4 MiB, preserves signed `-0` and omitted overrides, and is not equivalent to ordinary `JSON.stringify`. It is not a general Interop/Render codec or a replacement for original IGES import. Reuse that example rather than copying its codec into an application without its validation and budgets.

## What this guide verifies

Run `node --max-old-space-size=2048 apps/library-docs/scripts/check-viewer-authored-directional-lights.mjs` from the repository root. It checks the maintained snippet against public source types with strict/noEmit only. Manual build/link checks establish documentation discoverability. Existing #1580 software receipts remain separate from this check.

Actual WGSL device compilation, colored-light pixels, physical canvas picking, browser Save/Open and device-loss/remount UI acceptance remain externally owned **UNRUN** here. No native tests, GPU/browser qualification, provider rebuild or new demo is part of this guide.
