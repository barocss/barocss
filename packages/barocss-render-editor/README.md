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

The browser flow requires the running app on `127.0.0.1:52047` and the already installed Playwright CLI/Chrome. It saves actual downloads, opens a saved disk file in a fresh tab, and checks pixels, rejected updates, history, routing and owned cleanup. The compiled checkpoint reads transitive published maps separately from source development. No download, packed-consumer or publication step is performed. Native receipts and Integration adoption are recorded in #1047/#1051.

CAD assets/Viewer, qualified materials, Physics and shared-depth SDF+CAD remain later roadmap contracts. See the [Render Editor roadmap](https://github.com/barocss/barocss/wiki/Render-Editor-Product-Roadmap).
