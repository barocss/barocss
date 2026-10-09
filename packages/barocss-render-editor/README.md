# @barocss/render-editor

An experimental source-authoritative GPU scene document, pure session/controller, and reusable React workbench. The full shadcn application is `apps/render-editor`. This module uses the public BaroCSS GPU compiler and renderer.

```tsx
import {createRenderEditorSession, createRenderEditorController} from '@barocss/render-editor';
import {RenderEditor} from '@barocss/render-editor/react';
import '@barocss/render-editor/style.css';

const session = createRenderEditorSession(originalDocument);
const controller = createRenderEditorController(session);
// Mount in a React host. The host owns menus, routes, files and the session lifetime.
<RenderEditor controller={controller} onError={showError} onAction={handleFileRequest} />;
```

The root imports without React, DOM access, clocks or global listeners. Session setters change draft data. `prepareDraft('source' | 'camera' | 'both')`, `prepareOpen(text)`, `prepareUndo()` and `prepareRedo()` produce immutable session-bound candidates. `commitPrepared(candidate, beforeCommit?)` locks mutations, runs a synchronous callback, and commits only after successful presentation. A headless consumer can omit the callback; CPU acceptance alone does not prove a displayed frame.

The controller accepts an injected `RenderEditorPresenter`. The React `SceneViewport` attaches the actual source1 GPU adapter. `apply`, `open`, `undo`, `redo` return `{ok:true}` or `{ok:false,error}`. `getSnapshot()` tracks `presentedRevision` separately from the session's accepted document revision. A direct headless session commit while attached requires explicit controller recovery before the next visible transaction.

Source Apply calls `SceneRenderer.update`. Camera Apply calls `setCamera`. Combined Open/history uses source update then camera update. On a second-call refusal, the adapter compensates previous source then previous camera and checks framebuffer liveness. Failed recovery/context loss retains CPU authoring and marks presentation unavailable. `recover()` explicitly disposes and mounts a new renderer. There is no new atomic GPU API.

The exact version0 `gpu-scene` document stores `documentId`, `title`, `revision`, `sourceVersion:1`, byte-exact `sceneSource` and the public `MeshCamera` fields. It saves no IR, GLSL or buffers. File input is limited to 262144 UTF-8 bytes, source to 65536 bytes, history to 32 entries and 4 MiB. Plain own enumerable data is required. Unknown fields, unsupported versions, accessors, stale/foreign/forged/reused candidates and invalid source/camera refuse.

Accepted metadata copies real compiler scene name, object IDs/types and declaration ranges. Selecting a row locates its declaration; it is not SDF canvas picking. Complete admitted source1 scenes can add/remove/reorder supported objects. Source and camera drafts remain independent. Undo/Redo uses increasing editor revisions; Open retains the imported revision and starts fresh history. `savedRevision` records an explicitly marked revision or an imported baseline; the host distinguishes file downloads from local workspace opens.

React exports `RenderEditor`, `SourcePanel`, `ObjectPanel`, `CameraPanel`, `DiagnosticsPanel`, `SceneViewport`, and `createSceneViewportPresenter`. `header` and `toolbar` slots take host-owned controls. Optional `onAction` requests New/Open/Save; the module performs no file I/O. Viewport disposal releases owned renderer/listeners/resize observation and preserves caller canvas/DOM. The caller disposes its session.

Source-default main/types/exports use `src`. Complete public `publishConfig` maps root/React JS/declarations and explicit CSS to `dist`. `build:library` emits external-provider ESM, declarations and copied CSS. Public configuration is separate from registry publication.

```sh
pnpm --filter @barocss/render-editor build:library
pnpm --filter @barocss/render-editor-app build
pnpm --filter @barocss/render-editor-app dev
node apps/render-editor/cpu-flow.mjs --output <unique-evidence-directory>
PLAYWRIGHT_CLI_PATH=<installed-cli.js> node apps/render-editor/source-flow.mjs --output <unique-evidence-directory>
node apps/render-editor/compiled-flow.mjs --output <unique-evidence-directory>
```

The browser flow starts and closes the actual app's Vite server on `127.0.0.1:52047`. It needs the already installed Playwright CLI/Chrome and a free app port. It saves actual file downloads, opens a saved disk file in a fresh tab, and checks pixels, rejected updates, history, routing and owned cleanup. Unchanged requests reuse the same Vite transform object; a real fixture source edit changes it and appears after reload, then the source is restored. The compiled checkpoint reads transitive published maps separately from source development. No dependency download, packed-consumer or publication step is performed. Native receipts and Integration adoption are recorded in #1047/#1051.

CAD assets/Viewer, qualified materials, Physics and shared-depth SDF+CAD remain later roadmap contracts. See the [Render Editor roadmap](https://github.com/barocss/barocss/wiki/Render-Editor-Product-Roadmap).

## Original-source mixed document foundation (#1092)

`RenderMixedDocumentV1` is an explicit separate `version:1, kind:'mixed-depth'` authoring format for GPU profile `sdf-sphere-native-surface-v0`. It stores original source1 Sphere text and complete original Source0 CAD model text, a declared asset revision/model/Surface selection, camera, color, sampling counts and one explicit mm-to-scene conversion/scene translation. Unrendered native objects remain in the saved source. V0 source editor files and their parser/session remain unchanged. The current app does not open/render this new kind.

```ts
import {parseRenderMixedDocument, serializeRenderMixedDocument,
  prepareRenderMixedDocument} from '@barocss/render-editor';

const authored = parseRenderMixedDocument(savedText);
const prepared = prepareRenderMixedDocument(authored);
// Save the document; frame/packet/model/metadata are reconstructed display or query data.
const text = serializeRenderMixedDocument(prepared.document);
```

`copyRenderMixedDocument`, parse and serialize validate schema, original string/byte limits and public camera data; they do not certify source/native/GPU admission. The explicit `prepareRenderMixedDocument` compiles both original sources through public CAD/GPU, qualifies selected original model/Surface IDs, tessellates only that Surface, then calls actual public `prepareMixedDepthFrame`. It returns copied/frozen complete native model and metadata plus the derived frame. Declared asset revision is a host association, not historical content certification. GPU packet shape validation does not certify the original CAD; this host preparation reconstructs it from its actual source each time.

Each source is limited to65536 UTF-8 bytes/code units, the authored file to524288 UTF-8 bytes, sample counts2..17. Exact plain own data is required; unsupported fields/versions, accessors/symbols/sparse/foreign/nonfinite data refuse. The JSON encoder preserves real numeric `-0` and original source strings without a sentinel or source rewriting. `RenderMixedDocumentError` preserves actual provider causes under INPUT/VERSION/BYTES/SOURCE/QUALIFICATION/NATIVE/GPU.

The profile requires exactly one Sphere and one selected Surface, at most289 derived vertices/512 triangles; actual GPU camera-inside/clip/travel/F32 guards apply. Complete native source/weights/UV/IDs remain authoritative. No renderer, session/history, mixed app UI, Viewer mode, CAD editing, materials, picking, Physics or additional SDF shape support is added by this pure foundation. Integrated code availability and integrated validation are separate.

`node apps/render-editor/mixed-document-flow.mjs --output <new-evidence-directory>` exercises ordinary headless source imports, authentic full native source/qualification, real authored file cold reconstruction, copied data and refusals. This is a source/API/file CPU flow, not a mixed framebuffer or app Save/Open receipt. It uses installed tools and current source providers without provider rebuild, alias or packed-reader campaign.

## Reusable mixed editing (#1099)

`createRenderMixedSession` keeps accepted original document/preparation separate from numeric/text drafts. Source, native source, camera, display and selected original references have explicit setters. `prepareDraft/Open/Undo/Redo` produce session-bound immutable candidates; `commitPrepared(candidate,beforeCommit?)` locks mutations and accepts only after its synchronous presentation callback succeeds. History stores at most32authored entries/4MiB of serialized documents. Native source changes advance the declared asset revision once per accepted edit, not per key; this is not historical source certification. Open starts fresh history at imported revision; Undo/Redo advances editor document revision.

`createRenderMixedController` injects a presenter and coordinates complete-frame Apply/Open/history. The React entry exports `RenderMixedEditor`/`MixedSceneViewport`/`createMixedViewportPresenter`. The adapter calls the public mixed renderer's full updateFrame once before committing authoring/history; no private GL target/geometry kernel is copied. Accepted/presented revisions stay separate. Loss preventsDefault and disposes during the event; explicit restored-context recovery mounts a fresh public renderer using accepted preparation. Caller canvas/DOM and pure session remain host-owned. Dispose releases owned GL/listeners/canvas observation; host disposes its session.

The same private shadcn app has `mixed.html` with actual File/Edit/Help/workspace routes, picker/download, dirty Apply/Discard/Cancel and two original source pairs. Existing source-editor index.html remains the broader source1 mode. The mixed workbench shows exactly one sphere/selectedSurface; complete original native inventory remains in source/file, with stored objects distinguished from shown objects. Source/CAD tabs, camera scene units/degrees and native mm conversion/globalZ/color are authoring controls. No precise canvas picking/material/Physics/perassetpose/newshape support is implied.

Contextual Help entry is Help→Mixed scene editing or the collapsed Help:mixed preview; manual topic is this section and app 'Mixed scene workflow'. Draft values are preserved while Help opens/closes, and native dialog focus returns to its trigger. Runtime/diagnostic causes remain in optional Details; retained preview offers Retry, lost preview Restore. Source/camera/history/file failure does not overwrite accepted authority. App shortcuts exclude editable/composing targets; no full IME/device quality certificate is implied by the bounded flow.

`PLAYWRIGHT_CLI_PATH=<already-installed-cli.js> node apps/render-editor/mixed-app-flow.mjs --output <new-evidence-directory>` starts the app's actual Vite multi-page host on strict52049, preserving author52047, and closes its owned host/browser. It checks actual mixed pixels, source/native/display/history, real-file fresh Open/re-edit, failures and restoration/cleanup. Native, merged code, deferred integrated validation and publication are distinct.
