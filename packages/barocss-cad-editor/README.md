# @barocss/cad-editor

Pure native CAD editing sessions and reusable React viewport/inspector components.
This locally public-configured ESM package is `0.0.0-experimental`. It has not
been published to npm.

## Entries

| Entry | Workspace development | Published configuration |
| --- | --- | --- |
| Root | `src/index.ts` | `dist/index.js`, `dist/index.d.ts` |
| `/react` | `src/react/index.tsx` | `dist/react/index.js`, `dist/react/index.d.ts` |
| `/styles.css` | `src/styles.css` | `dist/cad-editor.css` |

The root has no React, Viewer, DOM, CSS, listener or clock initialization.
Creating a session owns copied native CPU data. The React component owns one
Viewer/canvas and its controls. Unmount disposes them and retains the caller's
session. The caller disposes the session when its document closes.

```tsx
import { createCadEditorSession } from '@barocss/cad-editor';
import { CadEditor } from '@barocss/cad-editor/react';
import '@barocss/cad-editor/styles.css';

const session = createCadEditorSession(nativeDocument);
const displayOptions = {
  viewer: { mmToSceneUnit: 0.01, background: [0.07, 0.08, 0.10] },
  document: {
    basis: 'authored-xyz-matches-rhyup',
    native: {
      sourceVersion: 0, countU: 17, countV: 17, unitsPerMillimeter: 1,
      curveDisplay: { chordToleranceMM: 0.1, maxSegments: 64, maxDepth: 8 },
    },
    bodyIds: ['surface_body', 'curve_body'],
  },
};
// Use a container with a defined height. The application owns menus and files.
<CadEditor session={session} displayOptions={displayOptions} onError={showError} />;
```

The example tuple values must be typed as the exported `CadEditorDisplayOptions`
in TypeScript. React callbacks contain copied CPU snapshots, errors or display
diagnostics. They do not expose a renderer. `fitRequest` triggers Viewer fit.
`readRequest` requests fresh pixels without changing camera or display input.
`onDisplay` includes actual RGBA hash/count, read index, native Viewer inventory,
camera and component mount/disposal counts.

## Accepted transactions

`createCadEditorSession(initialDocument)` validates with the real CAD APIs.
`selectSurfacePole({bodyId,uIndex,vIndex})` creates a revision-qualified native
binding. `stageSurfacePoleField(field,rawText)` holds raw `xMM`, `yMM`, `zMM` or
`weight` text separately from accepted coefficients.

`prepareApply()` performs a real native control-net edit and recreates the
complete document. A copied candidate enters the snapshot. The mounted React
bridge presents that candidate with `Viewer.loadDocument`, reads its frame and
then calls `acceptCandidate(token)`. Preparation changes no accepted document or
history. Native/display refusals retain pending fields, accepted native content,
history and the previous frame. Stale acceptance restores the accepted display;
restoration failure is reported explicitly.

`prepareOpen(text)`, `prepareUndo()` and `prepareRedo()` use the same admission
path. Open preserves incoming file revisions and starts a new history baseline.
Effective Apply advances document and edited asset revisions by one. Undo/Redo
restore authored source with fresh revisions; unaffected assets remain exact.
Bitwise native no-ops clear pending fields without adding a history state.
History holds at most 20 states and 8 MiB of serialized UTF-8 content.

`serializeAccepted()` returns `{token,text,suggestedFilename}` from the actual
native serializer. It excludes pending fields, camera and runtime caches.
`markDownloaded(token)` refuses a stale accepted capture and reports
“Download started”. It cannot certify filesystem persistence.

Candidates and snapshots are owned copies. Candidate mutation by a caller does
not change the private prepared result. Tokens are session-local and absent from
native files. `subscribe(listener)` returns an unsubscribe function.
`discardPending()` clears raw fields. `dispose()` is idempotent; later mutations
refuse with `LIFECYCLE`.

## Current support

The foundation admits exactly two original Source0 assets/bodies: one Surface
and one separate Curve. Each asset contains one original geometry object.
Construction nodes and valid native documents outside this editor profile are
refused as whole inputs. This prevents a selected one-Surface edit result from
replacing a multi-object asset and dropping siblings.

Surface degrees are 1–3, grid axes 2–16, total poles at most 256. Curve degrees
are 1–3, poles at most 16 and native spans at most 8. Native clamped domains,
positive weights `1e-6..1e6`, original IDs, knots, coefficient bits and signed zero
remain authoritative. Coordinates are within ±10000 mm. Files are UTF-8 with
at most 524288 bytes/code units. Each native source has the original 262144
byte/code-unit bound. Raw fields have at most 128 characters and accept finite
decimal/exponent notation. Revision overflow at 2147483647 is refused atomically.

Authored XYZ has no hidden axis conversion. Viewer uses one positive mm scale;
the reference app uses `0.01`, with native sampling units unchanged. Sampling and
picking are display approximations. This package does not certify solids,
topology, manufacturing tolerances, general feature graphs or assemblies.
Curve poles remain read-only. Keyboard draft-transition UI is tracked in #1044.

Errors use `INPUT`, `UNSUPPORTED`, `BUDGET`, `STALE`, `NATIVE`, `DISPLAY`, `FILE`,
`REVISION` or `LIFECYCLE`, messages bounded to 1024 characters, and actual reached
causes plus context where available.

## Build and focused evidence

Use Node 22 and the workspace's installed dependencies:

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app build
node apps/cad-editor/flows/canonical-surface-flow.mjs --source --headed
node apps/cad-editor/flows/canonical-surface-flow.mjs --compiled --headed
```

The build emits owned ESM/declarations/CSS with native dependencies external.
The focused compiled checkpoint separately resolves actual transitive published
maps and emits native runtime/declaration inputs from the fixed source checkout.
It checks a declaration consumer, imports the pure built root without browser
globals, and mounts the built React entry in the real app. It does not perform
pack/archive, independent-reader, broad-suite or publication validation.

See [#1043](https://github.com/barocss/barocss/issues/1043) and the
[CAD Editor roadmap](https://github.com/barocss/barocss/wiki/CAD-Editor-Product-Roadmap)
for exact receipts, current integration status and later stages.
