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
    // The pure session controls the explicit displayed body set.
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

## Draft selection and keys

`requestSelection({bodyId,uIndex?,vIndex?,reference?})` validates a native target.
Surface targets use original pole indices. Curve targets select the read-only body.
An optional native reference must resolve at the current document/asset revisions.
The snapshot reports `selectedBodyId` and `selectionTransition`. With pending
fields, a different target creates a copied `{token,baseGeneration,target}` decision.
The accepted selection and draft stay unchanged.

`resolveSelectionTransition(token, 'apply'|'discard'|'cancel')` makes the decision.
Apply validates the real native edit and switches to the requested selection only
after the candidate displays and commits. Failure retains the decision, draft,
accepted selection, history and frame. Discard explicitly clears the draft and
switches. Cancel retains the draft and selection. Stale decisions refuse.
`selectSurfacePole` delegates to this path. Same targets do not clear drafts.
Valid Open and Undo/Redo refuse unresolved drafts; apply or discard them first.

Enter in a coefficient input applies after composition ends. Enter during
composition cannot apply. Escape in that input retains its draft and focus.
Escape in the selection decision means Cancel and restores the last input focus.
Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z and Ctrl+Y outside editable fields use accepted
history only when no draft/decision is active. Text undo stays in the browser.
Canvas Escape retains the accepted editor selection. Native camera controls remain
owned by Viewer. The bounded browser flow uses the actual Chromium CDP composition
pipeline; it does not certify every operating-system input method.

## Current support

Native inventory uses the complete canonical document profile: 1–4 Source0 assets
and 1–16 asset-qualified direct geometry bodies. Original native Curve/Surface
objects, including unbound siblings, remain authoritative. Same geometry IDs can
occur in separate assets. Source0 Models may contain up to 16 objects per asset.
Native degrees1–5, knots, weights, coordinates, IDs and signed zero remain in the
original source. The editor does not narrow hidden native data to a preview profile.
Canonical file bounds are 2097152 UTF-8 bytes/code units; each source is at most
262144 and aggregate source is at most1048576 bytes. The actual CAD parser and
validator enforce these bounds. Raw fields retain the 128-character limit.

A body is editable only when its asset has one original Surface, its Model name
matches the Surface ID, and its coefficients meet the actual control-net edit
profile: ID1–48, degrees1–3, axes2–16/at most256poles, coordinates±10000mm,
positive weights1e-6..1e6. Curve bodies, multi-object Surface assets and other
native Surface profiles can be selected and inspected but are read-only.
The public native edit emits one Surface source; no public whole-asset replacement
writer exists. This explicit limit prevents loss of siblings or Model identity.

`createCadEditorSession(document,{displayBodyIds})` and `prepareOpen(text,options)`
choose unique existing1–4body IDs. When a document has at most4bodies, the default
is all bodies. Larger documents require an explicit choice; there is no first4
truncation. IDs are normalized to canonical body order. Snapshot `displayBodyIds`,
`displayGeneration` and `bodyCapabilities` describe the independent display set
and each body's edit eligibility.

`prepareDisplayBodies(ids)` prepares a display-only candidate. Actual successful
Viewer admission commits the new set and increments only `displayGeneration`.
Native source/revisions/generation/history/dirty/provenance/pending fields and
accepted download capture remain unchanged. Native Apply/history keep the display
set; Open adopts its chosen set. Every candidate records both base generations
and copied displayed IDs. Hidden bodies stay in the full native document and can
be selected; their missing display selection is cleared without losing native
selection. Display set data is absent from native downloads.

React uses the session display set for every load and ignores host `bodyIds`.
Use native `nativeCapacity:{version:1,maximumObjects:16}` for multi-object assets
and explicit Curve display options. The bridge previews whole selected assets;
an unsupported sibling can refuse the entire attempted display. Display samples
and pointer picks are approximations. Pointer selection maps the actual Viewer
asset namespace and original geometry ID to a current native body binding.
Camera drags beyond3CSSpixels do not select. `fitSelectedRequest` requests actual
native bounds for a displayed selected body/current document revision; `fitRequest`
fits the displayed bodies. Authored XYZ and one Viewer mm scale remain unchanged.
No solids, topology, manufacturing tolerance, feature/assembly graph or full16body
GPU display certification is made.

Errors use `INPUT`, `UNSUPPORTED`, `BUDGET`, `STALE`, `NATIVE`, `DISPLAY`, `FILE`,
`REVISION` or `LIFECYCLE`, messages bounded to 1024 characters, and actual reached
causes plus context where available.

## Build and focused evidence

Use Node 22 and the workspace's installed dependencies:

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app build
node apps/cad-editor/flows/canonical-surface-flow.mjs --source --draft --inventory --headed
node apps/cad-editor/flows/canonical-surface-flow.mjs --compiled --draft --inventory --headed
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

## Native Boolean extrusion mode

`createCadEditorFeatureSession` is a separate pure session for the actual native Boolean extrusion graph V0. It does not add feature data to canonical document1. Native evaluation requires two coplanar original Face inputs, one Boolean, one to four normal-extrusion leaves and at most eight typed length parameters. Native suppression is unavailable in this profile.

```ts
import { parseBooleanExtrusionFeatureGraph } from '@barocss/cad';
import { createCadEditorFeatureSession } from '@barocss/cad-editor';
const native = { maximumParameterResolutions: 8, maximumFeatureEvaluations: 7 };
const session = createCadEditorFeatureSession(
  parseBooleanExtrusionFeatureGraph(authoredText, native).document,
  { native, display: { featureId: 'extrusion_feature', outputSlotId: 'extrusion_slot' },
    mesh: { meshId: 'editor_mesh', maximumVertices: 384, maximumTriangles: 288,
      maximumEdgePaths: 192, maximumNativeSamples: 1024 } },
);
session.stageLengthParameter('base_height', { kind: 'literal', rawValueMM: '3' });
session.stageBooleanOperation('boolean_feature', 'intersection');
const candidate = session.prepareApply();
// A host must admit candidate.display through its actual renderer before accepting the token.
```

`CadEditorFeature` in the React entry mounts the existing GPU Boolean Shell scene renderer. It maps the actual interop-qualified graph output to the GPU scene reference, admits the complete native mesh and reads fresh RGBA before committing the session candidate. No Viewer Shell-load API is assumed. Authored XYZ remains unchanged; the default display uses one mm-to-scene scale0.01. Camera and Fit affect presentation only. A GPU or native failure preserves the previous accepted graph, draft, history and frame. Native outputs and the derived mesh are not authored editing authority or certified solids.

Length drafts retain literal or offset definitions. Missing or cyclic dependencies, invalid lengths, unsupported contacts, stale tokens and native mesh budgets refuse. Existing Face inputs are retained by height/operation edits. Open requires an explicit qualified extrusion/output slot from the session options; it does not silently choose the first leaf. Native files contain only authored graph data. The graph limit is1MiB and history is bounded to20 accepted states /8MiB. Download excludes pending values, native evaluations, camera, mesh and editor history. Public subscribe/dispose have no renderer ownership.

The focused source/compiled gate is `apps/cad-editor/flows/feature-graph-flow.mjs`. Its actual file download is opened in a fresh browser context and re-edited. Native region area, inclined extrusion vectors, signed zero, original Face inputs and actual pixels are checked separately. This gate is not full parametric, topology, manufacturing, OS IME or commercial parity acceptance.

## Shared extrusion outputs

`prepareDisplayOutputs([{selection,mesh},...])` requests one to four explicit actual graph/revision/feature/output-slot references. Each mesh ID is explicit and unique. Duplicate, stale, foreign or over-budget requests refuse. Accepted outputs are ordered by native authored feature order. Snapshot/candidate `displays` contains the complete selected set; legacy `display` remains its first entry. `displayGeneration` identifies view changes; candidates bind both it and native generation.

Display-only admission preserves the complete native graph, native revisions/history, raw draft, dirty state and download capture. Native Apply/history rebuilds all native leaves and derives every displayed mesh. Open starts from the existing explicit one-leaf options. Native files always retain all authored features and parameters, including outputs excluded from display.

The React bridge renders the selected native meshes in one actual GPU depth scene. Nested extrusions share a region and can occlude each other. Checkbox/solo choices support inspection without moving native geometry. `fitSelectedRequest` frames a displayed nonempty extrusion from actual mesh bounds; hidden, empty or non-extrusion selection refuses and retains the camera/frame. This is presentation framing, not a native BRep Fit or pointer leaf-picking API. Suppression and feature creation/removal remain unavailable.
