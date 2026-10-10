# Run the examples

Choose a browser example when you want to see geometry or pixels. Choose a saved CPU example when you want to inspect a compiler, data, file bytes or a refused input. Both use the fixed local source snapshot `5f5ad866205a21510ac69552e704cc162fa253b5`.

## Prepare the repository

Run commands from the BaroCSS repository root. Use Node 22 or later and the repository's existing dependency setup. The documentation runner needs the existing esbuild and TypeScript dependencies. It does not install packages or publish them.

```sh
node --version
pnpm --filter @barocss/library-docs dev --host 127.0.0.1
```

Open the URL printed by VitePress, then select **Run examples**. The dev command builds the app's source bundle before starting the site. A build and static preview use:

```sh
pnpm --filter @barocss/library-docs build
pnpm --filter @barocss/library-docs preview --host 127.0.0.1
```

These commands require the actual local Git source pin. They are workspace commands, not npm installation instructions. If the pin or a required dependency is missing, resolve that setup condition before running the example.

## Edit an input and inspect its result

Open the [visual playground](/playground). Choose a tab, edit the input and select **Run input**. Read the numeric report next to the output. Select **Reset example** to restore its original input.

| Tab | Executed operation | Input version |
| --- | --- | --- |
| GPU scene | Compile a scene and draw with SceneRenderer | GPU source1 |
| CAD curve | Evaluate native geometry and plot it with host Canvas2D | CAD source0 |
| CAD surface | Tessellate native geometry and draw with MeshRenderer | CAD source0 |
| GPU material | Compile a mesh material and change its scalar uniform | CAD source0 geometry; mesh-material grammar |
| CAD extrusion | Compile a Curve and Extrude, then sample and draw its Surface | CAD source1 |
| CAD parameters | Compile lengths/scalars, edit a parameter, then resample the Surface | CAD source2 |
| GPU six shapes | Compare sphere, box, cylinder, capsule, rounded-box and torus | GPU source1 |
| Eleven material function samples | Select an independent complete program for each source function | Mesh-material grammar |

WebGL2 is required for GPU scene, surface and material drawing. The curve plot requires a browser Canvas2D context. The curve tab does not execute the BaroCSS Canvas2D package. The original Curve/Surface tabs select CAD source0; the two added CAD presets explicitly select source1 or source2. A source header does not change a selected tab's compiler version. Use the matching preset or the CPU examples below.

The [material function gallery](/packages/gpu/function-examples) gives complete input and result images for all eleven source functions. Each preset supplies `amount` from0 to1. The host owns that control; the source creates no timer. The new CAD presets fit their sampled bounds to the viewport. A uniform size change can keep the same screen size; read the native millimetre values in **Actual result data**.

For GPU scenes, a refused edit retains the accepted frame. For materials, a refused compilation or binding retains the accepted material. Read the error before changing the input again. A refusal is not a successful adoption of the new input.

## Execute a saved CPU example

Run this complete command from the repository root:

```sh
node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/cad-example.ts
```

The CAD task prints JSON for a Curve, weighted Surface, Extrude and parameter edit. The original Curve midpoint is `[10,0,0]` mm. The source1 wall midpoint is `[10,0,15]` mm. The source2 midpoint changes from `[50,0,50]` to `[60,0,60]` mm after the width changes from `10 cm` to `12 cm`. It also asserts expected `KIND`, `VERSION`, `UNIT` and `DIVISION_ZERO` refusals. This command performs no drawing.

The last JSON record gives the source pin, source mode and consumed source/dist counts. `matching-workspace` uses the matching local source. `pinned-git-snapshot` uses an app-local snapshot extracted from that exact local Git commit when package source or manifests have changed. The runner checks the pinned Git blobs; it does not silently use a newer API. In snapshot mode, a consumer must use literal bare package imports. Relative or computed consumer imports are refused.

To run another saved task, replace only the last filename in the command:

| Filename in `apps/library-docs/scripts/snippets/` | Expected result and execution boundary |
| --- | --- |
| `cad-example.ts` | Native geometry, source0/1/2, parameter edits and compiler refusals |
| `gpu-language-example.ts` | Scene/material compilation and refusals; no renderer |
| `canvas2d-example.ts` | Accepted tree width100 and invalid-tree refusal; no drawing |
| `interop-example.ts` | Native Surface buffers and input refusal; no external reader |
| `viewer-example.ts` | CAD/Loader input preparation and Viewer factory import; no Viewer instance |
| `physics-example.ts` | Rigid and cloth state steps, fixed-step refusal and reset; no simulation display |
| `cad-editor-example.ts` | CPU candidate acceptance, serialized file and reopen; no visible editor |
| `render-editor-example.ts` | CPU candidate acceptance and retained source after refusal; no visible editor |

Each saved task has assertions. A failed assertion or setup error stops the command. A successful exit establishes that selected CPU task. It does not establish browser pixels, every public export, emitted packages or a registry release. Render uses a dist-default package entry; this source runner does not substitute a Render source entry.

To try a standalone CPU code block, save its complete module as `apps/library-docs/scripts/snippets/local-example.ts`, then replace `cad-example.ts` with `local-example.ts` in the command above. Include its public imports and full input. A fragment with variables supplied by another section is not a complete module. Keep browser-only calls in a browser host. Use literal bare public imports so the module can also run against the pinned snapshot.

## Use a browser host for browser APIs

The CPU runner executes with a Node target. Do not put `document`, a canvas mount or a Viewer instance into that command and expect browser behavior. The [Canvas2D examples](/packages/canvas2d/examples) and [Viewer examples](/packages/viewer/examples) describe standalone browser-host files and their setup. Their saved CPU tasks and browser recipes have separate execution status.

Continue with [CAD language](/packages/cad/language), [GPU scene language](/packages/gpu/language), [GPU material language](/packages/gpu/material-language), or [versions and availability](./versions).
