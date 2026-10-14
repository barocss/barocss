# @barocss/cad-editor

Pure native CAD editing sessions and reusable React viewport/inspector components.
This locally public-configured ESM package is `0.0.0-experimental`. It has not
been published to npm.

## Preview pending dimensions before Apply

In the primary modeling workspace, edit a named dimension and choose **Preview dimensions**.
This explicit action evaluates one native candidate and shows its temporary geometry; accepted
source, parameter summary, saved bytes and Undo history stay unchanged. **Apply** promotes
that exact current candidate once, without repeating native evaluation. **Cancel** restores
the retained accepted canvas and follows the current command's draft-discard behavior.
Changing another input removes the old preview before staging the next raw value. Preview
is on demand, never per keystroke. Equivalent numeric input makes no native call or history
entry. Legacy files retain their existing Apply-only behavior.

A lost Worker offers **Recover accepted model and preview**, which first reconstructs the
accepted source. Cancel computation terminates synchronous native work; this recovery cost
is explicit. During visible preview, face picking is disabled so candidate pixels cannot
create accepted face references. The preview may use a newly fitted camera; Cancel restores
the accepted canvas and camera without requiring a resize or remount.

The controller keeps one private full candidate and token-bound accept/discard messages.
Public preview snapshots contain metadata only. The Worker, controller and display each
have bounded single-candidate ownership; shared immutable native data is released by
reference, not recursively destroyed. Two retained canvases are not a total GPU-memory
ceiling because evaluation, transport and resize create temporary allocations.

Preview errors retain bounded provider-reported code/operation/message plus the current
editing context. The context is not an identified failing feature: a shared parameter can
affect other operations. No arbitrary native cause, stack or geometry is exposed as a
new diagnostic authority. Focused local commands are
`node packages/barocss-cad-editor/scripts/modeling-preview-test.mjs` and
`node packages/barocss-cad-editor/scripts/modeling-preview-display-test.mjs`.
See [#1959](https://github.com/barocss/barocss/issues/1959) for the finite software scope;
new native edited geometry, pixels and physical interaction remain separately unverified.

## Start with ordinary modeling

Use `CadEditorModeling` from `@barocss/cad-editor/react`, or open the host's
`#/model` route. Its initial part is built through `cad.model()` handles, named
millimetre parameters, sketches, extrusion, a through-slab cut and a chamfer.
The inspector shows only explicitly named output bodies, including the actual
finished chamfered part. There is no document-version selector or internal
identity/reference authoring in this workflow.

```tsx
import { CadEditorModeling } from '@barocss/cad-editor/react';

export function PartWorkspace() {
  return <CadEditorModeling />;
}
```

`initialAuthoredText` optionally opens a saved model. The controller's `open`,
`stage`, `apply`, `undo`, `redo`, `cancel` and `getSnapshot` methods support the
same workflow without React. Native build/edit/load and tessellation run in a
dedicated Worker. Accepted authored bytes, named dimensions, scene, picking
generation and history move together only after successful display staging.
Failed edits and interrupted work retain the prior accepted model. UI selection
uses a local accepted generation even when the kernel reuses native IDs.

In a **named dimension input** of `#/model`, unmodified **Enter** applies all
pending numeric dimensions using the existing atomic `apply()` operation;
**Escape** discards them using `discard()`. The shortcut is input-local,
requires an accepted model, at least one draft, and a nonbusy live controller,
and ignores key repeat, Alt/Ctrl/Meta/Shift and IME composition (including
keyCode 229). It never changes geometry directly, bypasses the worker,
or treats an invalid edit as accepted. The ordinary Apply/Discard buttons
remain available. The pure keyboard gate has a standalone source test:
`node packages/barocss-cad-editor/scripts/modeling-dimension-key-test.mjs`.
The script is not yet registered in recursive package CI while concurrent
CAD Editor manifest PR #1886 owns that path; actual React/browser/GPU
interaction remains a separate test gate.

Save copies only accepted authored data. Open detects the new model envelope or
previously supported legacy prism files internally. Legacy v0/v2 files delegate
to the original reader and preserve their semantics and original display
lineage; legacy v1 is still unsupported in this editor. Unknown or malformed
formats refuse without conversion. Historical `CadEditorPrismFeature` routes
and APIs remain compatibility entries.

The `#/model` editor's **Choose model file** action opens a native browser
file picker for `.json` / `.cad.json`, then stages the chosen file's raw UTF-8
text in the existing Saved model data field. The picker does **not** call the
CAD Worker, replace the accepted model, advance history, discard pending
dimensions, or change the displayed GPU scene. The user must review the text,
explicitly acknowledge replacement when there is an accepted model, and press
**Open saved model**. That original controller operation remains the sole
authoritative parser/display/admission/rollback path. File selection is not
successful native Open.

The file reader checks a 262144-byte limit before reading and verifies actual
bytes after the read, rejecting malformed UTF-8 and empty contents. The text
field also retains its 262144-code-unit maximum. Failed reads retain the
previously staged text and accepted model; selection clears prior replacement
acknowledgement. A newer picker choice, typed edit, Show saved model or
explicit Open wins over an older asynchronous read. A physical picker flow
and browser/GPU/file-download roundtrip still need independent runtime
verification; the pure preflight regression is
`node packages/barocss-cad-editor/scripts/modeling-file-test.mjs`.

The display adapter keeps native face/use/edge/vertex provenance and namespaces
scene objects by output name. Two output names may alias one native body without
colliding in scene/pick identity. CPU admission checks copied-data consistency;
it is not an authenticity or persistent-topology certificate. Browser pixels,
actual interaction and physical file dialogs require separate device evidence.

Focused checks live in `scripts/modeling-controller-test.mjs` and
`scripts/modeling-engine-test.mjs`. The explicitly bounded real-native campaign
is `node --no-opt --max-old-space-size=2048 scripts/modeling-native-smoke.mjs
source EVIDENCE_DIR`, then the same command with `cold` in a fresh process.
Each phase admits two complete model evaluations and four native tessellations,
followed by CPU scene/raycast checks; it does not exercise GPU rendering.

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
`onAccepted(snapshot,candidate)` supplies the copied actual candidate after the
session accepts its token. Existing one-argument callbacks remain compatible.
Hosts can bind a pending filename to that exact accepted Open token; preparation
or a rendered candidate alone does not authorize an accepted filename change.
`readRequest` requests fresh pixels without changing camera or display input.
`onDisplay` includes actual RGBA hash/count, read index, native Viewer inventory,
camera and component mount/disposal counts.

## Accepted transactions

`createCadEditorSession(initialDocument)` validates with the real CAD APIs.
`selectSurfacePole({bodyId,uIndex,vIndex})` creates a revision-qualified native
binding. `stageSurfacePoleField(field,rawText)` holds raw `xMM`, `yMM`, `zMM` or
`weight` text separately from accepted coefficients.

`selectCurvePole({bodyId,index})` selects an original zero-based Curve pole.
`stageCurvePoleField(field,rawText)` holds its raw XYZ/weight fields in the
default Control point mode (`editTarget: 'pole'`). Curve Apply
requires the selected body's explicit matching Curve focus. The complete-source
writer and its validator preserve the original asset, including sibling objects.

`prepareApply()` performs the selected native coefficient edit or object transform
and recreates the
complete document. A copied candidate enters the snapshot. The mounted React
bridge presents that candidate with `Viewer.loadDocument`, reads its frame and
then calls `acceptCandidate(token)`. Preparation changes no accepted document or
history. Native/display refusals retain pending fields, accepted native content,
history and the previous frame. Stale acceptance restores the accepted display;
restoration failure is reported explicitly.

`prepareOpen(text)`, `prepareUndo()` and `prepareRedo()` use the same admission
path. Open preserves incoming file revisions and starts a new history baseline.
Embedding hosts own Open/New replacement decisions for accepted unsaved data.
They must retain the current session while reading and admitting a proposed file,
resolve existing drafts separately, and recheck session/state identity before
replacement. A Download copy can initiate a native file download while retaining
the proposed target; it does not automatically authorize Open/New. Only a separate
explicit continuation can prepare the frozen target. Cancel, stale state or a
failed download clears host authorization and leaves native accepted data intact.
The root does not add replacement confirmation, persistence or a storage manager.
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

## Canonical body names

`prepareRenameBody(bodyId,name)` prepares a private `rename` candidate for one
existing original Curve or Surface body, including hidden and read-only bodies.
The actual `createCadDocument` admission owns name validation: a nonempty string
of at most128 UTF-8 bytes, without an unpaired Unicode surrogate. Names may be
equal on different bodies. The editor does not trim, normalize, truncate or repair
them. A name is body metadata; it does not rename a native geometry or Model ID.

Resolve pending Surface fields, a selection decision and any active candidate
before renaming. Refusal does not replace them. The same exact accepted name
returns null without notification, revision/history changes or download capture
invalidation, including at the maximum document revision. A changed name updates
exactly that body's name and advances the document revision. All body IDs, order,
kinds and asset/geometry bindings, asset revisions, complete Source0 bytes,
comments, siblings, coefficients, signed zero, units and frame remain unchanged.
Actual native errors and causes retain context field `body-name`.

The existing Viewer candidate admission and fresh rendered frame precede native
acceptance. The React bridge preserves the prior camera for a rename candidate.
Acceptance adds one history state within the existing20-state/8MiB bound,
advances native generation and marks dirty. The display subset and
displayGeneration stay unchanged. Surviving body/pole selection receives a
current qualified reference. Old document references become stale; unchanged
geometry can still use the actual native explicit rebind operation. Cancel or
display refusal leaves accepted names, sources, history and native file capture
unchanged.

Undo/Redo restores the target body names after checking exact body order, IDs,
kinds and asset/geometry bindings. It uses a fresh document revision and retains
the existing rule that asset revisions advance only when their source changes.
Mixed name and Surface edits therefore restore both authored names and source
at current revisions. Native Download/Open retains names in the complete
canonical file. Rename changes body metadata only; it does not duplicate/remove
bodies, replace assets or edit coefficients. Original Curve coefficient edits use
the separate complete-source authoring path described below. An isolated Curve
edit result is not authority for replacing an original multi-object asset.

## Draft selection and keys

`requestSelection({bodyId,uIndex?,vIndex?,index?,reference?})` validates a native target.
Surface targets use original U/V pole indices. Curve targets use an original
zero-based `index`. A body-only target keeps the current index when that same
Curve is already selected; otherwise it starts at zero. Selection alone does not
authorize an edit outside the supported profile
or implicitly enter Curve focus.
An optional native reference must resolve at the current document/asset revisions.
The snapshot reports `selectedBodyId` and `selectionTransition`. With pending
fields, a different target creates a copied `{token,baseGeneration,target}` decision.
The accepted selection and draft stay unchanged.

`resolveSelectionTransition(token, 'apply'|'discard'|'cancel')` makes the decision.
Apply validates the real native edit and switches to the requested selection only
after the candidate displays and commits. Failure retains the decision, draft,
accepted selection, history and frame. Discard explicitly clears the draft and
switches. Cancel retains the draft and selection. Stale decisions refuse.
`selectSurfacePole` and `selectCurvePole` delegate to this path. Same targets do
not clear drafts.
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

A Surface body is editable when its selected coefficients meet the current native profile:
ASCII ID1–48, degrees1–5, grid axes2–16/at most256poles, coordinates±1000000mm
and weights1e-6..1e6. Multi-object assets and a different Model name are supported
through actual `editSourceSurfaceControlNetWide` and
`validateSourceSurfaceControlNetWideEdit`. Complete `result.source/model`
retain Model name/order, sibling coefficients, comments, whitespace and untouched
literal spelling. `result.surface` and `result.provenance` describe the selected
native coefficients; they never replace the full asset. The owned
native validator reconstructs the provider proof; internal validation work is
separate from the direct editor operation. Native no-op preserves exact spelling
and revisions. Original Curve XYZ/weight editing supports degree1–5, 2–64 poles,
at most70 knots, coordinates within ±1000000mm, weights1e-6..1e6 and native IDs
within the ASCII1–48 profile. It uses the actual complete-source Curve writer and
requires matching explicit Curve focus for Apply; the narrower focused display
requirements below still apply. A selected Curve or Surface outside its current
native profile cannot be edited through that action. Actual source
binding/size/native/display failures retain corrective raw and prior accepted state.

Surface Move, Rotate and Scale reuse actual native affine transformation and the
wide complete-source writer. All transformed original Surface poles, up to256,
enter one private request. Temporary affine result IDs and sources are validation
evidence and are never adopted as authored geometry. Native degree1–5 is supported,
but affine admission separately requires original/transformed XYZ and matrix
translation within ±10000mm, and original knot parameters within ±10000. A Surface
may therefore support point editing while refusing an object transform. Weights,
knots, original IDs and untouched siblings remain unchanged. No clamp or implicit
source extraction is used. Existing actual document presentation and history gates
remain in effect.

These are current provider admission requirements, not the final commercial
modeling scope. Surface preview uses existing native degree1–5 D0 evaluation;
canonical document Curve sampling retains its separate degree1–3 profile. A native
source edit is not a promise that every full asset can be displayed.

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

The document-view Canvas toolbar offers `Isolate` and `Restore`. Isolate requires
a selected displayed body and at least two displayed bodies. Both actions use
`prepareDisplayBodies` and the existing actual Viewer admission path. They change
only the displayed body set and `displayGeneration`; native source, revisions,
generation, history, dirty state, camera and body/pole selection stay unchanged.
No automatic Fit or new geometry profile is added.

Restore uses one private ordered bookmark, saved only after the owned isolation
candidate is accepted and its current Viewer frame is observed. Native edits,
Undo/Redo, Open, session replacement, Curve focus, unavailable display or any
unrelated display change invalidate it, including a return to the same body set.
Curve focus hides these document actions. Drafts, selection decisions, candidates,
dialogs, composition, pointer captures and host busy state block live dispatch;
drafts and decisions keep a current bookmark. Refused admission keeps the prior
accepted frame. Restore can be retried while its bookmark remains current. This
bookmark is absent from native files, recovery, history and public snapshots.

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

## Accepted original geometry analysis

`inspectCurveD2(reference,parameter)`, `inspectSurfaceD2(reference,u,v)`,
`inspectCurveCurvature(reference,parameter)` and
`inspectSurfaceCurvature(reference,u,v)` read the private accepted original
Source0 geometry. Each method live-checks, resolves one actual current qualified
native reference, requires the matching geometry kind and calls its actual native
evaluator once. The provider's reference validation rejects caller getters and
stale or foreign document/asset bindings. Hidden and read-only native bodies can
be queried independently of the display set and pole-edit profile.

`CadEditorCurveD2`, `CadEditorSurfaceD2`, `CadEditorCurveCurvature` and
`CadEditorSurfaceCurvature` retain the actual native result DTO, copied qualified
reference and original parameters. Their `kind` and `query` literals discriminate
`CadEditorGeometryAnalysisResult`. Curve records contain `parameter`; Surface
records contain `u` and `v`. Complete native vectors, normal, metric and
discriminant disclosure remain available, without losing signed zero. Returned
data is independent of session and caller data. Pending fields and active
candidates do not change the accepted geometry read. Reads emit no notification
and change no source, history, generation, display, selection, draft, candidate,
serialization, dirty state or native download capture.

The actual D2 profile admits degrees1–5, Curve2–64 poles and Surface2–16 poles
per axis with at most256 grid poles. Coordinates, knots and parameters must be
finite with magnitude at most10000; weights retain native1e-6..1e6 bounds. Query
the original closed knot domain. Endpoints use the interior one-sided span.
An exact interior knot refuses D2 when degree minus multiplicity is below two,
including cases where particular coefficients could cancel discontinuity. No
parameter normalization, nudging, projection, finite differences or mesh-derived
curvature is used.

D2 point uses authored XYZ/mm. First derivative vectors and speed retain mm per
original knot parameter unit; second vectors retain mm per squared or mixed U/V
parameter units. Curve curvature and its vector use1/mm, radius usesmm; a regular
straight Curve has zero curvature and null radius. Surface mean/principal
curvatures use1/mm and Gaussian curvature uses1/mm2. Unit vectors and the
normalized metric are dimensionless. The Surface normal follows native `du×dv`;
mean/principal signs depend on that orientation. Zero derivatives are valid D2
results, while zero Curve tangents or uncertain Surface metrics refuse curvature.
Planar regular Surfaces have zero curvature. The complete native discriminant
roundoff/clamp policy is retained; formatted UI values do not replace it.

Errors retain actual `CadReferenceError`, `NativeSecondDerivativeError` and
`NativeCurvatureError` objects and nested causes under `CadEditorError.cause`,
with context field `geometry-analysis`. Native stale references map to `STALE`,
wrong geometry kinds to `UNSUPPORTED`, and other native refusals to `NATIVE`.
D2 can refuse input, continuity or arithmetic; curvature can wrap a D2 failure or
refuse regularity/arithmetic. Disposal refuses further reads. This local analysis
does not certify trim validity, Face/Solid normals, G2 patch continuity,
principal directions, torsion, manufacturing tolerance or global accuracy.
Source-backed reference reconstruction and native internal validation can repeat
work; no single cheap reconstruction or metadata-only performance claim is made.

## Accepted original Curve length estimate

`inspectCurveLength(reference,options)` reads the private accepted whole document
through the actual `queryCadDocumentCurveArcLength` once. The provider resolves
the exact original Source0 Curve and admits caller reference/options as bounded,
descriptor-safe own data. The editor does not pre-resolve, read caller getters,
invent options or apply D2/curvature defaults. `CadEditorCurveLengthOptions` and
`CadEditorCurveLength` alias the actual native options and complete result.
The existing four-variant geometry-analysis union remains unchanged.

The copied result retains original reference, geometry, source text, options,
estimatedLengthMM, errorEstimateMM, final panels and the full native report with
guards, subdivisions, work counts and signed zero. Pending edits and active
candidates do not change which accepted document is measured. The read emits no
notification and changes no source, history, generation, display, selection,
draft, candidate, serialization, dirty state or native download capture.
Disposal refuses further reads. Actual `CadCurveArcLengthError` and nested native
causes remain under `CadEditorError.cause`, with document ID and context field
`curve-length`. A wrapped native STALE maps to editor STALE; other native failures,
including a selected Surface's actual REFERENCE refusal, map to NATIVE.

The actual length profile supports Curve degrees1–3,2–64 poles, at most70 knots,
XYZ coordinates within10000mm and positive native weights1e-6..1e6. Native knot
and domain validation remains authoritative. `interval:null` uses the full
original domain; an explicit finite strictly increasing interval must lie within
it. Parameters are not sorted, clamped or normalized. D2's separate knot/parameter
magnitude limit and C2-continuity requirement do not govern length.
Native options require absoluteToleranceMM1e-9..1, relativeTolerance0..1e-2,
maximumEvaluations7..16384, maximumSubdivisions0..512 and maximumDepth0..16.
Interval, input, work-budget or representability refusal returns no partial result.

Length is the five-point Gauss estimate of the actual native D1 speed in mm.
Original knot spans split integration panels. Each measured panel uses seven
distinct strict-interior native D1 nodes and two endpoint D0 calls. Exact included
C0 knots receive separate genuine native D1 refusal guards; no knot tangent is
invented and the full length can remain valid. Zero speed is supported, including
constant Curves with zero estimated length/error. The estimator is the maximum
of Gauss-rule difference,64-epsilon floor and native chord shortfall. The chord
chain is a sanity check and never replaces the derivative integral estimate.

The aggregate estimator must meet max(absolute tolerance,relative tolerance times
estimated length). This criterion is not a certified global error upper bound,
binary64 containment, manufacturing tolerance, G1/G2, topology or Solid guarantee.
The full result preserves discarded-parent work and trace; reported quadrature
D1, endpoint D0 and guard counts are separate. maximumEvaluations limits only
quadrature D1 calls, not all native work. Source-backed resolution, validation and
owned-result validation can repeat reconstruction or quadrature. No cheap single
query or total computational budget is claimed. Consumer rendering and numerical
formatting remain separate from full native values and authoring authority.

## Accepted native geometry export

`getExportCapabilities()`, `inspectExport(options)` and `exportAccepted(options)`
read the private accepted canonical document. The public `CadEditorExportCapability`,
`CadEditorExportSelection`, `CadEditorExportOptions`, `CadEditorExportReport` and
`CadEditorExportResult` types alias the actual CAD types. Each call requires a live
session and returns copied native CPU data, preserving original signed-zero bits.
Pending fields and active candidates do not change which document is exported.
These reads emit no update and change no source, history, generation, display,
selection, draft, candidate, dirty state or native download capture.

The actual supported canonical writer is IGES5.3 ASCII Curve126/Surface128.
GLB is an external derived display bridge with its own inputs and frame contract;
this session does not write canonical documents to GLB. STEP and feature-graph
export are unsupported. The original Source0 geometry is export authority,
independent of the one-to-four-body display set. Native degrees1–5 can be exported
without claiming that the Viewer can display them.

Options are exactly `{target:'iges-5.3-ascii',exportModelId,selections}`, with each
selection `{reference,outputId}`. Choose one to sixteen unique original bodies
through current document/asset revision-qualified native references. The derived
model and geometry IDs must all be distinct ASCII identifiers, one to forty-eight
characters. No original ID is rewritten. The provider admits descriptor-safe own
data and enforces its budgets; the editor does not read caller getters first.
Actual `CadDocumentExportError` codes and nested native causes remain available
through `CadEditorError.cause`, with context field `document-export`.

Output uses authored XYZ in mm, with no axis or unit conversion, meshing or
approximation. The writer preserves selected nonzero native coefficients, knot
and pole order, grid indices and parameter domains. It normalizes exported numeric
negative zero to positive zero while retaining the original native bits. Output
is at most2097152 bytes, with eighty ASCII columns followed by LF per record.
The complete actual limits remain in `report.limits`.

Review the actual report before downloading: selected/unselected bodies, output
bytes, qualified-reference/output-ID mappings, Curve126/Surface128 domains,
signed-zero counts and eight-character directory labels. Truncation and label
collisions are reported; IDs are not silently repaired. Retain the full-ID/loss
sidecar. IGES omits original document/body/asset identities and revisions, names,
native source/dialect, authored frame labels and angle declarations, unselected
geometry and authoring history. Feature graphs, parameters, constraints,
placements, derived caches, topology and solid models are unsupported. The writer's
`geometryLoss:'none'` does not mean that authored document data is preserved.
Geometric validity is not certified; topology and solid certification are false.

Inspection stages the actual writer output internally, including source-backed
reconstruction. Export and owned-result validation can repeat this work; inspection
is not a metadata-only query or a single-reconstruction guarantee. The pure root
creates no renderer resources and writes no files. Hosts download captured IGES
and the loss report separately, and bind review to the accepted native revision
and exact export options. Exchange download must not call `markDownloaded` or
clear native dirty state. Native JSON Download/Open remains the authoring-file
route for complete source preservation and re-editing. No IGES import or external
reader equivalence is claimed.

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


## Extrusion lifecycle

`prepareExtrusionTransaction(request, postDisplayOutputs?)` consumes the actual CAD `BooleanExtrusionFeatureTransaction`. Only normal-extrusion upsert/removal is supported. The provider validates stable existing IDs/slots/options, next revision, complete dependencies and final one-to-four leaves. Parameter-table lifecycle uses its separate method below. Face/Boolean CRUD, reorder and suppression remain unsupported here.

Unresolved scalar drafts and active candidates refuse. A displayed removed leaf requires an explicit complete resulting-revision output set; no output is chosen automatically. Actual native derivation, full-scene GPU admission and fresh RGBA precede acceptance. Lifecycle acceptance records one authored history entry and invalidates captured Download tokens. Changed output configuration also advances displayGeneration. Surviving selection remains; a removed selection clears. Undo/Redo keeps the current display choice and refuses if it is absent in the target; choose a surviving view before retrying.

## Whole-source consumer checkpoint

The full-source facade consumes real merged CAD #1071 in an exact combined local
consumer tree. Provider native receipt, merged-code availability, this executed
consumer and Integration screen/file/recovery validation are separate states.
The app's source-preserving flow checks actual native points and full Source0
preservation before and after genuine native Download/fresh Open/re-edit. A
same-asset degree5 Curve can be source-edit legal yet refuse default whole-asset
preview; a separate hidden degree5 asset remains untouched. That earlier checkpoint
does not establish general degree5 Curve document display,
packed/parity/publication or commercial quality certificate follows.

## Native parameter table lifecycle

`prepareParameterTransaction(request: BooleanExtrusionParameterTransaction)`
consumes actual CAD #915 and returns a private `parameter` candidate. The native
request has expectedRevision/revision, 1–16 parameterOperations and 0–4
distanceEdits. Length Upsert uses actual id/type/definition; Remove targets a
starting parameter. Dependent parameter definitions and extrusion distances must
be explicitly repaired in that same parameter transaction. The final table is
0–8 lengths; temporary native working capacity16 does not widen it.

Native next revision, existing IDs/types/order, all-name reservation, unique
operation targets, complete dependencies/cycles and final geometry are enforced
by the provider. Remove/recreate and automatic cascade are unavailable. Feature
IDs/options/source/order remain; this does not combine #915 with #922 feature
transactions. Unresolved scalar drafts and active candidates refuse before
staging. Descriptor-safe bounded copies retain caller ownership without getter
execution.

Every current explicit output receives a fresh native revision-qualified mesh.
The React bridge must admit the entire GPU scene and read fresh RGBA before
accepting the candidate. A parameter acceptance records one authored history
entry, advances generation, invalidates captured downloads and marks dirty.
Logical display choices/displayGeneration and surviving feature selection stay
unchanged. A transaction that restates a value still follows the native revision
policy. Native/mesh/display refusal keeps prior accepted state. Host modal raw
values and explicit repair choices remain outside the native file.

## Referenced feature transactions

`prepareReferencedFeatureTransaction(request)` consumes the actual CAD
`BooleanExtrusionFeatureTransaction` through a separate structural facade.
Include at least one Face or coplanar Boolean upsert/removal. Existing extrusion
upserts may repair only `regionFeatureId`; their IDs, slots, distance definitions
and native options must remain bit-identical. Creating/removing leaves, changing
their heights/options, parameter lifecycle, suppression and reorder use neither
this method nor an implicit combined transaction.

Supply every dependent operand or region repair explicitly in the same request.
For example, replace a Face with a fresh logical ID/slot, upsert its dependent
Boolean operand, then remove the old Face. To replace a Boolean, explicitly
upsert each dependent extrusion region reference before removing the old node.
Use authored Face input, not evaluated mesh data. The native provider owns stable
IDs/options, identity reservation, exact revision advance, dependency/profile
admission, 1..8 operations, working capacity eight and final two-Face/one-Boolean/
one-to-four-extrusion limits. Missing repairs reach actual native refusal.

Unresolved scalar drafts and active candidates refuse preparation. Native result
and every current selected mesh are prepared before GPU admission and a fresh
RGBA read permit acceptance. Acceptance records one authored history state and
advances native generation/revision; logical output choice and displayGeneration
stay unchanged. Removed tree selection is cleared. Native, mesh and GPU failures
retain the previous accepted graph, history, view and dialog choices. Save/Open
retains the complete authored graph; Undo/Redo retains the current output choice.

## Coupled authored Face corners

`getFaceCorners(featureId)` returns copied, revision-qualified
`CadEditorFaceCorner` records from an accepted authored Face. Corner index i joins
the previous ordered Line's pole1 and the next Line's pole0. Line IDs, pole indices,
feature/output-slot identity and native graph revision form the binding.
Current native Face admission already requires exact endpoint closure with
`Object.is`, including signed zero. The corner API repeats this exact-pair guard;
it does not weld, skip or renumber endpoints. No admitted near-closure refusal
route is claimed for the current native profile.

`prepareFaceCornerEdit(binding, pointMM)` copies the binding and XYZ/mm tuple,
checks every current identity/index and changes exactly the two endpoint triples
on a private authored Face copy. One real native feature transaction upserts the
existing Face and rebuilds its Boolean and current one-to-four extrusion outputs.
The provider owns coordinate limits, coplanarity, closure, convexity and CONTACT
refusals. No projection, snapping, constraints or evaluated mesh authoring is used.
Other poles, Line/Plane IDs, knots, weights, options, parameters and signed-zero
fields remain unchanged. Unresolved scalar drafts and active candidates refuse.

The structure candidate follows the existing full GPU scene/readback gate.
Acceptance adds one native history state and revision, retaining the logical
output set/displayGeneration and surviving tree selection. Invalid bindings,
native geometry, mesh or GPU admission retain the accepted graph and raw host
dialog values. Save serializes the complete native graph; Undo/Redo restores
authored content at fresh revisions rather than reviving old corner bindings.

## Accepted native extrusion properties

`inspectExtrusionProperties(selection, options)` reads one current accepted
extrusion through the actual qualified interop properties bridge.
`CadEditorFeatureProperties` and `CadEditorFeaturePropertiesOptions` alias the
original native result and budget types. Selection is the exact graph ID/revision/
feature ID/output-slot tuple; options have maximumBoundarySegments0..64 and
maximumSurfaceEvaluations0..8. Actual native counts must fit those budgets.
The copied result contains the full native binding, extrusion, components and
report, preserving signed zero. Native selection/measurement/owned validation
causes are retained in `CadEditorError` with context `extrusion-properties`.

The read uses the private accepted graph, even while drafts or a candidate exist.
It emits no update and changes no document, history, generation, pending input,
display, selection, dirty state or download capture. Returned reports are derived
CPU data and never enter the saved native graph. A later graph revision makes an
old selection stale; requery the new current binding. Camera/display-only changes
do not change native construction metrics.

Section area uses mm2, construction volume estimate mm3, and geometric centroid
XYZ uses authored mm. Empty construction is valid: zero area/volume, no components,
null centroid and zero new support samples. Centroid is not an interior witness
and can lie outside material or inside a hole. Overlapping displayed leaves are
not unioned or totaled by this API. ConstructionEstimateOnly remains true;
Solid, topology, manifold, sewing, manufacturing, density, mass and inertia
certification remain unavailable. The native helpers can reconstruct the parent
multiple times; the new-support evaluation budget is not total rebuild cost.

The ordinary export review shows object names, format/mm, selection and real geometry-only/history/name-loss decisions. Export naming is secondary; full native mappings, signed-zero counts and certification details remain in expandable Export details and Help. No generic No loss claim follows from the writer geometry-loss field.


## Original Curve coefficients and canvas handles

This section records the original Curve-authoring checkpoint
[#1173](https://github.com/barocss/barocss/issues/1173). Its source and profile
contracts remain current; its pending-tool list describes that checkpoint.

CadEditorSession adds curveSelection beside the unchanged Surface selection.
requestSelection accepts Curve index; selectCurvePole is its wrapper.
stageCurvePoleField uses raw xMM/yMM/zMM/weight and the real complete-source
Curve writer/validator. Native degree1..5/2..64poles/70knots/XYZ1e6mm/weights
1e-6..1e6 stay independent of current display. A changed edit updates only the
selected complete asset source and its/document revisions. Bitwise no-op does
not add history. Curve provenance has separate candidate.curveProvenance and
snapshot.lastCurveProvenance; Surface types are not recast.

Explicit view is document or curve-focus(bodyId,count). prepareCurveFocus and
prepareDocumentView use view-only candidates: native generation/history/source/
dirty/raw/download capture remain; successful view admission increments only
displayGeneration. prepareDisplayBodies proposes actual document view. Curve
Apply supports document view or its matching focus; Surface Apply requires document view.
create/Open may take an explicit incoming view; Open clears selections/history
and does not silently choose a Curve or change source into sampled buffers.

React keeps canonical onDisplay and adds onCurveDisplay with real focused
Viewer state/SelectedUniformCurvePreview/RGBA plus a qualified native association.
Focused state.document is null and documentBodies is empty. Source Model name
can differ from asset ID. Full original source and actual geometry/ref/sample
equality bind that association; it is not a fabricated Viewer document receipt.
The actual active renderer and fresh pixel read precede native acceptance.
Return loads current accepted data with the retained document subset/camera.
Refusal retains native/raw/history; failed restoration marks view unavailable.

Curve focus supports complete Model1..4/source65536bytes+codeunits and65UI
samples (public2..129); Viewer IDsASCII1..64/scaledsamplepositions<=1000 remain
real independent limits. Native16object/262144source support does not imply
wider focus or simultaneous mixed rendering. Canonical Curve display1..3 and
Surface workflows stay separate and unchanged.

Visible original coefficient handles permit camera-plane drag. Move stages XYZ
and shows a pending control-polygon/handle ghost while native Curve remains
accepted. PointerUp performs one actual Apply/history step; Escape/pointercancel
cancels owned raw/selection. Existing drafts must be resolved before dragging.
The host uses public prepareCamera matrices; no sampling vertex is native
authoring authority. Offscreen/occluded handles are approximate overlays; weight
remains an exact field. At this checkpoint, axis Gizmo/snapping and Surface
control-net drag were separate work. They were later added in
[#1198](https://github.com/barocss/barocss/issues/1198) and
[#1194](https://github.com/barocss/barocss/issues/1194), respectively. Full native
whole-shape live preview remains outside the implemented profile. These receipts
record their exact native runs; later integrated acceptance remains separate.

Native files/recovery retain complete authored data and canonical display subset;
focus/selection/raw/history/camera are not new file authority. Exact accepted
Open token drives host filename/recovered-unsaved provenance. Native completion,
sole Integration adoption and integrated/current commercial acceptance are separate.

### Independent original-body copy

`session.prepareDuplicateBody(bodyId, {name?})` prepares one `duplicate` candidate for the currently selected canonical Curve or Surface. The selected complete Source0 asset is copied byte for byte into a generated independent asset ID and body ID. Local native Model/geometry IDs, sibling objects, numeric spelling, signed zeros, knots, weights and units stay unchanged. Other accepted assets and bodies are untouched. The new asset starts at revision0; the document revision advances once on actual acceptance. Without an explicit name, the original accepted name is retained. IDs use bounded `_copy` suffixes within48 ASCII characters and avoid current and retained-history identities; names retain the native128-UTF8-byte limit without trimming.

A candidate is a proposal. The existing Viewer must load the real new qualified geometry, select the candidate target, read a fresh frame and then accept it. Only acceptance commits source, dirty state, selection and one history entry. Refusal, cancellation and stale tokens retain the old accepted data. The copy initially overlaps its source; existing Move can separate it. This copies native authored geometry, not a linked instance, feature graph, general Solid/B-Rep or extracted display mesh.

Document view appends the copy only below the existing four-body display limit. Hide a body before copying when that set is full; no body is silently evicted. Matching Curve focus retargets the new copy with the same sample count and latent document-view set. Return to document view before copying a different body. Existing4-asset/16-body/source/file/revision/history limits remain; full assets or unsupported actual display profiles can refuse a copy.

`selectionTarget` and `presentation: 'structural'` identify a duplication or its structural Undo/Redo candidate. Duplicate history stores a bounded before/after presentation. Traversing that known boundary restores asset/body inventory, display, selection and local tool/axis settings through actual native admission; surviving unchanged sources keep their revisions, while a reintroduced copy receives a fresh accepted high-water revision. Ordinary Apply/Rename history keeps its prior same-inventory behavior. Copied source can be saved, reopened and independently edited; duplicate IDs and local UI settings are not additional file or recovery fields.

### Original sections and dependent NURBS loft

`createCadEditorLoftSession(document, {native})` owns the native V0 NURBS source-loft graph. Its fixed native options are `{maximumSources:3,maximumSourceEdits:3,maximumFeatureEvaluations:4,maximumLoftSections:3}`. Three complete original section sources and their explicit source-edit recipes drive one piecewise degree1/C0 loft. `selectPole`, `stagePoleField` and `prepareApply` merge a requested original XYZ/weight field into the full retained node recipe. Other fields, original sources, comments, siblings, IDs, exact U basis and V stations remain native authority.

`CadEditorNurbsLoftEditor` loads the actual native generated Source0 for Loft view, or the complete edited original source for an explicit section view with65 derived Curve samples. Real native bindings stay separate from Viewer references; these views have no canonical document or body fiction. Native validation, actual load/clear and fresh RGBA precede candidate acceptance. A pending original-point ghost is not a regenerated Surface. Refusal preserves accepted state and corrective raw. Suppress/resume uses the authored native flag; the suppressed Loft view is an actual cleared frame.

Native sources allow up to16 objects and262144 aggregate source bytes/code units; actual section focus retains the existing four-object/65536-byte complete-model limit. The first editor fixture uses three complete source namespaces with1/3/1 objects and Udegree2/Vdegree1. Wider native degree1..5 support does not imply every source or generated result can be displayed. No sibling extraction or native profile widening is used. This is not smooth/G1/G2 loft, topology, Solid, assembly or manufacturing certification.

Accepted history is bounded to20 authored states and8MiB; native authored files are limited to1MiB. Undo/Redo reconstruct fresh native revisions and bindings. True no-op and view-only changes do not add history or alter source. Download uses the matching native authored codec, retaining originals and recipes; derived models, camera, ghosts, pending fields and history are excluded. Native completion, serial adoption and integrated acceptance are recorded separately.

The viewport orientation controls provide Front, Back, Left, Right, Top, Bottom and Isometric directions for both the generated Loft and a qualified original section. They use the current perspective camera and preserve its target, distance, field of view and clip planes. The pressed control follows the actual camera; orbit can show Custom. A camera choice changes no native source, selection, generation or history. Returning from a section restores the last displayed Loft camera.

Resolve pending fields and release active pointer captures before changing direction. Native candidates, file decisions, open dialogs and unavailable displays also block the command. A suppressed empty Loft disables the controls; a supported original section can still be focused and navigated while the Loft is suppressed. Edge-on views can hide geometry or control points. These controls do not provide orthographic projection or Solid certification.


### Assembly local pose and hierarchy

`createCadEditorAssemblySession(assembly, {displayInstanceIds})` retains the complete native Assembly and embedded original part documents. `CadEditorAssemblyEditor` presents explicit0..4 selected instances through the actual Viewer; other native instances stay in the tree and authored file. Logical hidden selection is available for local pose fields. No part sources, body geometry or qualified part references are rewritten by instance pose editing.

Local XYZ uses millimetres; local Euler XYZ uses degrees with native Rz×Ry×Rx rotation. Reparenting keeps the local pose and can change world placement. Canvas handles move a single local translation axis using the parent world rotation and a qualified original-geometry anchor. The selected instance's own rotation is not the translation frame. Pending ghosts leave accepted geometry unchanged; successful complete Viewer presentation precedes one native history entry. Pixel readback is an explicit verification request and is not required by product Apply.

Native limits remain1..4 parts,0..32 instances, depth16, local translation±10000mm and Euler±360°. Current Viewer displays1..4 qualified instances and has narrower world/scene/source bounds. An empty chosen display uses actual clear. Native-valid input can refuse display; corrective fields and accepted sources/history remain, with explicit unavailable status if presentation restoration fails. This is pose editing over original Curve/Surface bodies, not mates, creation, part replacement, Solid union or manufacturing certification.

The native Assembly file envelope is16MiB in UTF-8 bytes and UTF-16 code units. Each embedded document additionally passes its actual standalone2MiB codec. The app uses a separate whole-Assembly reader and an explicit display-subset choice for larger inventories. History retains at most20 authored states and64MiB serialized UTF-8 payload, evicting oldest retained states after accepted changes; this does not bound peak process memory. Undo/Redo advance only Assembly revision and preserve original part/asset revisions. No-op uses exact authored values, including signed zero;0° and360° are different. Native Download excludes display choices, selection, pending fields, camera and history.


### Driving dimensions and selected linear constraints

`createCadEditorDrivingSketchSession(document, {initialProfileId})` retains the complete native authored mixed Sketch seed, workplane, profile IDs and active constraint definitions. An explicit profile is required. The supported native scope consists of selected whole Line and Polyline profiles. Other Arc and Rectangle profiles retain their authored intent and can be viewed. DOF and rank describe the selected scalar scope, not the whole mixed Sketch.

`CadEditorDrivingSketchEditor` displays the current profile's complete local-plus-World Curve source with 65 uniform D0 samples. Existing signed local X/Y distances and fixed-point targets can be edited. Add supports fixed, horizontal, vertical and coincident definitions using actual native selected-point or solver-segment IDs. Removal deletes an active definition; Undo restores it. Native conflicts keep the accepted document and corrective raw values. Original seed points are not replaced by solved target points.

A Canvas handle changes one existing signed distance when its point A has a direct integer fixed anchor on the same local axis and point B is selected. The handle follows the actual authored workplane. Drag displacement rounds to the nearest 1 mm; typed fields are passed to native validation without rounding. Held ghosts leave accepted geometry unchanged. Release performs one native Apply and one history entry. Escape or capture loss cancels only the gesture's owned draft. Keyboard nudges use the same 1 mm step and recheck ownership after staging.

Native candidate validation and complete actual Viewer presentation precede acceptance. Same-profile edits preserve the camera. Product Apply does not require pixel readback; explicit `readRequest` and `onFrame` are verification facilities. Failed display admission restores the complete previous preview, camera and selection. Failed restoration reports unavailable display. Uniform preview does not certify adaptive accuracy, regions, Faces, closed Solid, manufacturing or a general nonlinear solver.

Editor generation and display generation are private epochs. They are not native revisions. Native top-level no-op keeps accepted sources, history and epochs. History retains at most 20 authored states and 8 MiB of serialized UTF-8 payload. The actual native file limit is 262144 UTF-8 bytes and UTF-16 code units. Download serializes the authored seed and constraint recipe through the native codec; solved geometry, camera, selection, drafts, candidates and history are excluded. Native completion and later Integration acceptance require separate receipts.


### Restricting an original Curve interval

In document view or a matching Curve focus view, Control point mode offers `Restrict interval`. Start and end are original Curve parameters. Canvas markers choose among the actual65 displayed parameter samples; perspective overlap or hidden points require exact fields. This is discrete parameter selection over the accepted Curve, not a continuous Curve inverse or control-point movement. Pending markers keep accepted geometry unchanged. Release makes one native proper-interval request.

`stageCurveIntervalField('min' | 'max', raw)` stages `intervalMin` or `intervalMax` in the existing pending draft. `prepareApply` dispatches that draft through native `extractSourceCurveInterval` with maximumObservations256, validates the full result, and rebuilds the complete canonical document. A proper subset is required. Full-domain, reversed, empty or outside intervals refuse without normalization, sorting or clamping. Equal original boundary staging can leave no editor draft; the native API has no full-domain no-op report.

The complete original asset source remains authority. Selected knots, points and weights change; original IDs, body names, sibling objects and untouched source spans remain. Document and changed asset revisions advance once on acceptance. Obsolete Curve pole selection clears after restriction and when Undo/Redo crosses its interval boundary, retaining the body and focused view. Select a fresh point to edit the generated coefficients. Undo may recover the original extent while history is retained. Download saves the complete current restricted source; a fresh Open does not restore discarded extent or a parametric trim recipe.

`curvePresentationPolicy: 'native-state'` opts focused Curve presentation into actual complete-source/ref/state admission with no product pixel dependency. `onCurvePresentation` supplies copied native metadata without pixel metrics. Only an explicit `curveReadRequest` produces measured pixel callbacks. `onDisplayInvalidated` clears a host's stale pixel cache. The default `legacy-pixel` policy and canonical document/Surface behavior remain compatible. The app uses `native-state` for focused Curves and requests verification reads only in its flow mode.

Native extraction supports degree1..5, at most64 temporary and output poles,70 knots, whole Model16 and262144-byte/code-unit Source, with its own2MiB request/result limit. Focus independently admits complete Model1..4/64KiB source and65 uniform D0 samples. A native-valid output can refuse focus; corrective bounds and the accepted whole source/view/history remain, with unavailable status if actual restoration fails. No source extraction bypass is used. This direct Curve source edit does not certify exact ideal equivalence, adaptive accuracy, a trimmed Face, closed Solid, general trim graph, manufacturing or professional CAD parity.

### Refining an original Surface

In document view, `Insert knot` stages one original U or V parameter. `stageSurfaceKnotField(axis, raw)` uses the existing shared draft and `prepareApply`. It calls the actual complete-source `insertSourceSurfaceKnot` and whole-result validator, then rebuilds the canonical document. Existing numeric knots still request insertion and increase multiplicity; they are not no-ops. Exactly empty raw clears that draft. No new session or persisted operation recipe is introduced.

The Canvas grip chooses among 65 original-domain D0 parameter stations at the opposite axis midpoint. A projected iso-line shows the proposed placement over the accepted Surface. This is discrete, perspective-dependent parameter placement. It does not inverse-pick a mesh or turn display samples into coefficients. Use the exact field when projected stations overlap. Held guides leave accepted source and geometry unchanged; release prepares one native command. Escape, cancellation and capture loss restore only owned raw, and post-stage checks preserve foreign data.

Native insertion preserves the original degree and domains. It replaces the chosen knot array, points and weights while retaining the complete Model, sibling bytes and original IDs/names. Acceptance and crossing the refinement history boundary clear the affected U/V pole selection without remapping indices. The body and document view remain. Use `Select a point` to choose a fresh current-net pole explicitly. Undo retains original coefficients only while runtime history is available. Download saves the current refined complete Source, without the knot receipt, draft, history or camera.

Current native insertion admits U/V degrees1–5, one strictly interior knot, selected-axis15→16 poles, total256 poles and final multiplicity no greater than degree. Its selected-coordinate10000 mm profile differs from the wide point writer's1000000 mm profile. Full Source256KiB/Model16 and current document presentation are retained; no Curve-focus capacity restriction or Source stripping is added. Native and actual display refusals retain accepted content and corrective input. These current provider profiles do not define the final commercial modeling scope. Observed native D0 preservation is local, not ideal/global equivalence, topology, Solid or manufacturing certification.


### Editing an original Curve in document view

Original Curve point/weight edits and Move, Rotate and Scale work in document view as well as optional matching Curve focus. The existing native complete-source writer and affine provider remain authority. Root keeps source-qualified original coefficients, source spelling, IDs, domains, siblings, native noOp, raw values, revisions and history. It does not extract a smaller source to fit focus.

The Canvas control polygon and existing point/axis/plane/ring/scale tools use an actual private document presentation: original Curve/reference resolved from the complete accepted source, real displayed body/asset/document binding and the current Viewer camera, scale and Canvas dimensions. Document display namespaces are distinct from the original native Model name. No focus receipt or uniform preview is fabricated for a document Curve. A hidden logical Curve can use native fields; Canvas controls require a genuine displayed binding. Held movement retains the accepted source/frame; ownership checks retain foreign raw or candidates.

The native point writer supports degrees1–5/64 poles/70 knots/coordinates1000000 mm/complete Model16/Source262144 bytes and code units. Current document adaptive Curve sampling independently supports degrees1–3 and coordinates10000 mm. Focus independently supports degrees1–5 but complete Model4/Source65536; an optional focus refusal can leave a larger document editable. Affine coordinates and knots10000 remain separate. Actual native/display refusals remain visible and retain corrective input. These provider requirements do not define the final modeling scope. Interval editing still requires matching focus.

The bounded author flow is `apps/cad-editor/flows/document-curve-flow.mjs`, using an original weighted cubic Curve in a full16-object source larger than64 KiB. It qualifies actual document bindings, original point drag/weight and affine edits, history, optional focus refusal, raw/capture ownership and genuine native Download/fresh Open/re-edit. Execution evidence is recorded separately from source and integrated availability. Degree4/5 document display, general closed Solid Split, OS IME, resources/recovery and commercial CAD parity are not established by this view-policy change.


### Refining an original Curve with a knot

`stageCurveKnotField(rawText)` stages the shared `curveKnot` parameter in Control point mode. The complete accepted Curve source and qualified reference remain authority. `prepareApply` uses actual `insertSourceCurveKnot` and its whole validator, adopts the native full result source and submits one current-view candidate. Document view and matching Curve focus remain distinct real presentation families. No uniform focus preview, mesh coefficient or pixel receipt is manufactured for document editing.

Insert knot offers an exact Parameter and a Canvas grip. The grip chooses among65 original-domain D0 stations through the current camera and Canvas projection. This placement is discrete and approximate; type an exact value when projected stations overlap or leave the view. Held movement changes only the pending guide. Release submits one insertion while its owner/source/reference/view/epochs/camera/options/raw remain current. Escape and pointer cancellation restore only owned raw. Foreign drafts or candidates are retained.

An admitted native request inserts exactly one interior knot, including another multiplicity at an existing knot. The native operation has no no-op flag. Exactly empty raw clears only the editor draft; no motion makes no editor command. Current native insertion supports degrees1–5, at most63 original and64 refined poles,70 knots, coordinates10000 mm and complete Model16/Source262144 UTF-8 bytes and code units. Multiplicity, zero sign, selected coefficient bindings and comments remain native requirements. This coordinate profile differs from the native point writer's1000000 mm; these current providers do not define the final modeling scope.

Insertion and crossing its Undo/Redo boundary clear the affected obsolete pole selection, retaining the logical body and current view. Done exposes explicit selection of a fresh original coefficient; there is no index clamp or implicit point0. One accepted insertion adds one history state. Native Download persists current refined coefficients and complete siblings, not editor raw, insertion receipt, history or an editable discarded recipe. A fresh Open can edit the refined net.

The bounded author flow is `apps/cad-editor/flows/curve-knot-flow.mjs`, using the unchanged full16/72000-byte weighted cubic document fixture. Native shape observations are local D0 evidence, not global equivalence, topology, closed Solid, manufacturing or commercial parity. Geometry-preserving insertion does not require a changed pixel hash. General degree4/5 document sampling, focus4/64 KiB display, actual Split Body, OS IME, resources/recovery and current integrated acceptance remain separate.


### Conserved Solid Split session: native code stage

`createCadEditorSplitSession(authoredText, options?)` owns the complete native constant-Y translated-strip Split result. It uses the native authored codec, whole-result validators and one four-pole wide Source edit for cut Y. It preserves the original closed Body, full sources, both closed output Bodies, recipes and qualified lineage. This session does not cast Solids into the Curve/Surface document family.

The default presentation is `split`. `{ initialPresentation: 'original' }` starts with the original Body active while retaining the admitted complete Split recipe. `prepareApply()` prepares the first Split or a staged `stageCutYField(raw)` edit. `prepareUndo()` and `prepareRedo()` reconstruct native history from authored text and restore its explicit runtime original/split presentation. No native revision is invented. History retains at most 20 states and 64 MiB of actual UTF-8 and UTF-16 payload bytes (UTF-16 is twice the text length); native provider limits remain unchanged.

`acceptCandidate(token)` commits CPU session state only. A future UI consumer must call it after successful display of the whole candidate through an admitted renderer/Viewer contract. It is not proof of GPU, Viewer, pixels, Canvas manipulation, picking or display recovery. Stale tokens refuse; failed Native preparation preserves accepted source, raw draft and history. Returned snapshots and candidates are copies.

`serializeAccepted()` produces the existing native authored Split file only in split presentation. Original presentation refuses serialization because this codec has no unsplit state field. `prepareOpen(text)` genuinely reconstructs the original Body and both outputs and always prepares split presentation. Runtime presentation/history/candidates are not added to native files. Download capture tokens bind to session generation.

Issue #1446 remains open. Whole twelve-Face/two-Body display, selection, atomic replacement, recovery and a real Canvas cut handle require the GPU/Viewer contract. The independent Native/session/file flow explicitly measures CPU commits and physical file writes; it does not substitute for the planned browser flow or professional CAD parity.


Curve interval controls use the actual document or focus presentation. Selecting a logical Curve body is sufficient; a control point and Focus are optional. Document handles evaluate 65 original-domain D0 stations through the public native evaluator and project them with the current camera. No focus preview or extracted Source is manufactured. Overlapping nonadjacent screen stations require the exact parameter fields. Held endpoint guides preserve the accepted Source and frame. Release prepares one native interval command; Escape restores only gesture-owned raw after checking ownership again after capture release. Other endpoint text remains intact.

Accepted restriction preserves the document view, displayed subset and camera. Undo/Redo clears obsolete Curve pole indices, retaining the body until a fresh point is selected. The source file contains the restricted coefficients and domain, with all sibling objects, without restoring discarded extent on Open. Whole-document degree 4/5 sampling remains the separate native #1440 dependency; this change uses the existing admitted document profile.


### Driving fixed Sketch anchors on the original workplane

Choose `Drag point` on an existing fixed constraint for the displayed Line or Polyline. The button selects its real qualified point binding. The Canvas grip changes the constraint's local X/Y target rather than the authored seed or solved Curve coefficients. Its actual pointer ray intersects the original oblique workplane; the local displacement rounds to 1 mm. Both scalar fields form one real native Apply when released. Native constraints regenerate local and World geometry; other profiles, authored points and IDs remain intact.

Held guides preserve accepted native state and the rendered frame. Each field stage checks current ownership after subscriber notifications. Escape discards only the exact gesture-owned pending map after capture release; foreign input or candidates remain corrective. Stale source, profile, point, workplane, view, camera, display options or backing invalidates the gesture. Edge-on and offscreen cases use the exact fields. Typed values retain the native solver's own acceptance rules.

Undo/Redo and native authored files preserve the constraint targets and original complete mixed seed. Display resources and pointer state are not saved. This remains the existing bounded linear Line/Polyline solver; Arc/Rectangle preview, general nonlinear constraints, regions, BRep and Solids are separate capabilities.


### Creating an independent iso-Curve from a Surface

`Create iso-Curve` creates a saved Curve from an original Surface at fixed U or V. The other parameter varies through its original domain. Canvas placement uses 65 real fixed-axis D0 stations and an iso guide; the exact field supports any native-admitted value, including domain endpoints. Held guides preserve the accepted Source and frame. Release or Create performs the actual native extraction and adds a new Curve asset/body after complete document display succeeds.

The original Surface, full asset Source, asset revision, sibling objects and current selection remain intact. The generated one-object Source0 belongs only to the new asset. The original authored XYZ/mm frame is retained. The Curve is an independent snapshot with its original varying knots/domain; later Surface edits do not update it automatically. No trim-edge or live feature recipe is saved. Each Create adds a Curve, including repeated parameter values.

Undo removes the new inventory and restores the saved selection/display set. Redo restores its logical IDs with fresh source-qualified revisions. An original body-only selection stays body-only; no point0 is implied. Save/Open stores current native sources, without the construction receipt, guide, history or camera. Select a fresh point on the new Curve to edit it.

The existing native iso provider admits both Surface degrees 1–3, grids up to 16×16, coordinates within ±10000 mm and inclusive fixed parameters. Local D0 comparisons do not certify global shape or manufacturing tolerance. Current native asset/body and display capacities remain separate gates; hide a displayed body when four are already shown. Refused creation preserves the original document and corrective draft. Degree 4/5 iso construction, Faces, Solids and parent-dependent features remain separate work.


### Move a body without a selected control point

A selected original Curve or Surface can use Move after a coefficient operation
clears its control-point selection. The compact viewport Move button enables the
existing axis and plane handles without selecting an implicit point. When no pole
is selected, the grip uses the actual native control-hull bounds box center. This
is a display anchor for translation, not a pole or center of mass. A real selected
pole keeps its existing grip. Rotate and Scale retain their selected-pole pivots.

The private presentation binds the full original Source, qualified body reference,
actual document or matching Curve focus, Viewer frame and both session epochs.
Hidden objects have exact offset fields and no Canvas handles. Native affine
transformation and the complete-source writers remain the geometry authority.
Their existing coordinate, knot and display limits remain in force. Held gestures
retain accepted geometry; release proposes one whole-source translation. The
actual Viewer must approve it before one history entry is accepted. Escape restores
only gesture-owned raw after release; foreign drafts and tokens are retained.

Apply, Undo and Redo retain the current absence of a selected pole. If the user
explicitly selects a pole later, that selection remains current intent. Save stores
native Sources and body bindings, not the temporary grip or pole-selection state.
Open restores the existing selection policy; a new coefficient boundary can clear
the pole before another body-only Move. The host command palette keeps its existing
selection eligibility; this entry point is the viewport Move control. This feature
does not provide general Solid movement or change the Rotate/Scale pivot policy.


### Join two original Curves

Select an original Curve in document view and open Join Curves. The selected Curve
is First Curve; choose Next Curve from the existing document bodies. The operation
connects the end of First Curve to the start of Next Curve in that order. The
shared endpoints must already coincide numerically. There is no automatic reversal,
snapping, gap bridge or sewing. Both parents must have the same degree within the
existing native degree1–3, sixteen-poles-per-parent and bounded-coordinate profile.

The session captures two actual ordered qualified references and complete Sources.
It calls the existing native join and whole-result validator, then stores only the
generated result Source in a new independent asset and Curve body. Both original
assets, full Sources, Models, siblings, revisions and body identities remain intact.
Native parentSources are regenerated single-object proof files, not replacement
authority for the original whole assets. The joined body becomes visible only after
the complete current Viewer admits the candidate. The operation adds one history
entry and preserves the selected First Curve and its existing point or absent point.

Undo removes the new inventory. Redo restores its logical IDs with fresh document
and asset references. Display, document, Source and history limits remain unchanged;
a full displayed set requires hiding a body before Join. Save includes current native
Sources and body bindings. It excludes the join proof, dialog choice and runtime
history. The new Curve is independently editable after Open; it is a snapshot and
does not regenerate when either parent changes.

The result is a native C0 Curve. Parameter mapping and rational-weight rescaling use
the existing provider. Its local D0/D1 observations and genuine derivative refusal
are retained; they do not certify global error, G1/G2 continuity, wire topology,
manufacturing tolerance or a Solid. A refused operation retains the original accepted
document and the dialog's corrective Next Curve choice.


### Raise the degree of an original Surface

`session.prepareSurfaceDegreeElevation('u' | 'v')` proposes one native degree step for the selected original Surface in document view. No pole selection is required. The contextual Canvas commands Raise U degree and Raise V degree use the complete original Source and its qualified native reference. Existing pending input, another candidate or a selection transition must be resolved first. Actual whole-Viewer approval precedes one history entry; accepted document and asset revisions each advance once.

The existing native `elevateSourceSurfaceAxisDegree` and whole validator retain all untouched Source spans, Model and geometry IDs, siblings, domains and the opposite axis degree/knots. Only the selected Surface's four native value spans are replaced in the same asset. This creates additional coefficients without claiming a global shape or tolerance certificate. Local native D0 observations are bounded evidence.

Degree is discrete. Each Canvas command raises its selected axis exactly once. The current native profile accepts selected degree1–4 to2–5 on a single Bezier or exact C0 Bernstein chain; general lower-multiplicity knot structures are refused. Original selected-axis poles must not exceed13, elevated poles16, opposite poles16 and total256. Native Source256KiB/Model16, XYZ10000mm and positive bounded weights remain separate limits. The UI disables a degree5 axis; direct Root requests retain genuine native refusal and cause.

Elevation changes the coefficient basis. Actual acceptance and Undo/Redo across that boundary clear old U/V pole selection and retain the logical body and view. A same-number index is never treated as the original coefficient; select a new pole explicitly before point editing. Native or display refusal keeps the accepted Source, frame, history and prior pole. Save/Open persists the elevated native document, with no live degree recipe, history or selection.

The bounded author flow is `apps/cad-editor/flows/surface-degree-elevation-flow.mjs`, using the unchanged complete16-object/72000-byte weighted Surface fixture. Source/public-compiled actual Canvas, history and file qualification is recorded separately from native CPU readiness, integration and release. This feature does not qualify general topology, Solid, G1/G2 or manufacturing.


### Extract a Surface region from Canvas

Select an original Surface in document view and enter Extract region. Four exact bounds use the original U and V parameters. Four Canvas grips choose among65 actual native D0 stations across the original domain. These positions are discrete; type exact bounds when projected stations overlap or leave the view. While dragging, only an owned pending bound and its guides change. Release submits one native region construction through the existing whole-document Viewer approval.

`stageSurfaceRegionField('uMin' | 'uMax' | 'vMin' | 'vMax', rawText)` uses shared `surfaceRegionUMin/UMax/VMin/VMax` pending fields and one qualified original Surface/Source binding. Other drafts must be resolved first. Missing bounds use the original domain; empty text clears only that editor field. Equal endpoint text remains a construction request. A complete-domain copy creates a new independent Surface and is not a native no-op.

Only the actual `extractSurfaceRegion` result Source is stored in a new asset/body. Its whole validator and native complete-document admission run before one history entry. The original complete Source, asset revision, siblings, Model and geometry IDs, domains and selected UV or body-only state remain unchanged. The provider's regenerated `originalSource` is proof data and never replaces the original asset. No parent recipe or live binding is serialized.

Undo removes the added inventory. Redo restores the same logical IDs with fresh native references and the reintroduced asset revision highwater. The original Surface selection remains current; no automatic pole0 is selected. Escape, pointer cancellation and stale context restore only still-owned raw. Foreign bounds and candidates remain available. Native or display refusal retains the accepted Source/frame/history and corrective bounds.

The current native provider supports both degrees1–3, axis2–16/total256 poles, XYZ within10000mm, positive bounded weights and increasing bounds inside the original closed domains. Up to four actual parameter splits and128 local observations are permitted; intermediate refinement can refuse at its own capacity. Native errors are not hidden by sorting, clamping or parameter normalization. Existing assets4/bodies16/display4/source/file/history limits remain separate.

The bounded author flow is `apps/cad-editor/flows/surface-region-flow.mjs`, using the unchanged full16/72000-byte weighted Surface fixture. Actual drag, whole native proof/Viewer admission, structural history, original Source preservation and genuine Download/Open/new-Surface Canvas reedit are recorded separately from native CPU readiness, integration and release. Guides and extracted geometry do not certify Face trimming, topology, Solid, G1/G2, global error or manufacturing.


### Split an original Curve from Canvas

Select a Curve in document view and enter Split Curve. Drag the cut grip along the original Curve, or type an exact parameter. The grip uses 65 actual native D0 positions and the existing document camera. A held drag changes only the pending cut and guide. Release prepares one candidate for whole-document Viewer approval. Projected station ambiguity requires the exact field.

`stageCurveSplitField(rawText)` stores one shared `pending.curveSplit` field. It captures the qualified original Curve, full Source, domain, logical body, tool, view and both generations. Foreign drafts must be resolved first. Empty text clears that field; the cut must remain strictly inside the original domain. Values are never clamped or normalized. Native or display refusal retains the original accepted Source, frame, history and corrective input.

The actual `splitCurveAtParameter` constructor checks the complete pair Source, Model, coefficient mappings and shared cut bits. No separate exported split-result validator exists. Native whole-document construction and validation remain admission authority. Both generated Curves enter one new asset and two new bodies. Every original full asset, Source, revision, sibling and binding remains. The selected original point or absent point is preserved without selecting point zero.

Acceptance creates one history entry. Undo removes both bodies and their asset together. Redo restores the same logical IDs with fresh references and the asset revision highwater. The children can be edited independently after Open. They share one complete Source asset, so editing either child advances both asset references while preserving the other geometry. Save persists native geometry and body bindings; it does not persist a parent recipe, proof, history or selection.

The existing native profile supports degree1–3, original and refined curves up to16 poles, XYZ within10000mm, positive bounded weights, distinct ASCII IDs of at most48 characters, and a finite interior parameter. Temporary refinement can refuse. The constructor's at most64 local observations do not certify global error, topology, G1/G2, manufacturing tolerance or a Solid. Existing document assets4/bodies16, displayed bodies4, Source, file and history limits remain separate; split never removes old bodies to fit. Showing two new children requires space for both in the displayed set.

The bounded author flow is `apps/cad-editor/flows/curve-split-flow.mjs`. It reuses the unchanged two complete72000-byte/16-object Join parent assets. Native CPU readiness, actual source/public-compiled Canvas and file qualification, integration and release are recorded separately.


### Split an original Surface from Canvas

Select an original Surface in document view and enter Split Surface. Choose U or V, then drag the cut grip or type an exact original parameter. The grip follows 65 actual native Surface D0 positions at the midpoint of the opposite domain. Its guide follows the original Surface across that opposite domain. These placements are approximate; use the exact field when stations overlap or leave the view. A held drag changes only the pending cut and guide. Release submits one native candidate through existing whole-document Viewer approval.

`stageSurfaceSplitField('u' | 'v', rawText)` uses one of the shared `surfaceSplitU/surfaceSplitV` fields and captures the original full Source, qualified Surface reference, chosen axis, domains, logical body, view, tool and both generations. Existing drafts, candidates and selection decisions must be resolved first. Axis changes require an empty draft. Empty text clears the owned field; finite cuts must be strictly inside the original chosen-axis domain. Values are not clamped, sorted or normalized.

Actual `splitSurfaceAtParameter` internally checks the complete pair Source and Model, direct pole/weight/knot mappings, shared boundary bits and local D0 observations. No separate exported whole split-result validator exists. Native complete-document construction and validation remain admission authority. Both generated Surfaces enter one new Source asset and two bodies. Every original complete Source, asset revision, sibling, ID and binding stays unchanged. The original selected UV or absent UV remains; there is no automatic pole-zero selection.

One approved pair adds one history entry. Undo removes both children and their asset together. Redo restores their logical IDs with fresh references and asset revision highwater. Saved children can be edited independently. They share one complete Source and asset revision, so editing one refreshes both references while retaining the other Surface declaration. Save persists authored geometry and bindings; it excludes the parent recipe, proof, history and selection.

The native profile supports both degrees1–3, at most16 poles per axis and256 per net, XYZ within10000mm, positive bounded weights, distinct ASCII IDs of at most48 characters, and a finite strict-interior cut. Intermediate refinement capacity can refuse. At most128 local observations do not certify global error, trimming, topology, G1/G2, manufacturing tolerance or a Solid. Native and display refusals retain accepted Source/frame/history/corrective input and genuine causes. Existing document assets4/bodies16, display4, Source, file and history budgets remain; no object is evicted. Displaying both new children requires space for both.

The bounded author flow is `apps/cad-editor/flows/surface-split-flow.mjs`, using the unchanged complete16-object/72000-byte weighted Surface fixture. It covers an actual U drag, a separate original V split, pair history and genuine files with one-child Canvas reedit and sibling preservation. CPU readiness, source/public-compiled UI qualification, local adoption and release are separate records.

### Compact Objects labels

New Surface split bodies include their U or V split axis in their default names, for example `U lower Surface` and `V upper Surface`. Existing files keep their authored names.

In the example editor, bodies with the same name show a stable ordinal in the Objects list. The ordinal uses the complete accepted document order, including hidden bodies. Showing or hiding a body does not renumber it. Unique names remain unchanged. Row text, titles and accessible control labels use the same display label; existing geometry icons and row spacing remain.

These ordinal labels are presentation only. They do not rename a body or change its ID, native Source, asset revision, history or saved name. Old files with repeated names remain valid. The native body name limit remains 128 UTF-8 bytes; no schema or name normalization is added.

### Canvas reversed Curve copy

`prepareCurveReversal()` prepares an independent reversed copy of the selected original Curve in document view. The Canvas command shows the original parameter start and end, with a short direction marker from actual native D0 points through the current camera. This is a discrete copy command. It does not stage a continuous reverse drag or replace the original mixed Source.

The session calls `reverseCurveWide` and `validateWideReversedCurveResult`, then validates the complete new document. Only the generated one-Curve Source goes into a new asset and body. The regenerated comparison `originalSource` is proof data. Both original Sources, siblings, asset revisions and logical selection remain. Whole-Viewport approval records one structural history entry; Undo removes the copy and asset, and Redo restores their IDs with fresh references. Saved copy edits use the normal Source writer and leave original assets unchanged.

The Canvas checks the current qualified Source, Curve, selection, view, epochs, frame, camera, size, options and capture state before and after preparation. Foreign drafts and candidates remain owned by their producer. Start/end markers are parameter observations; clipped or degenerate direction glyphs are omitted. Help explains the independent copy. The copy can be chosen in Join, which still requires its actual endpoint and domain conditions.

Native limits remain degree 1–3, at most 64 poles and 70 knots, coordinates within ±10000 mm, positive bounded weights and clamped nonperiodic knots. The existing document, display, Source, file and history capacity rules remain. This does not provide an in-place whole-Source reversal writer, automatic Join/reparameterization, degree 4/5, Solid or a global shape certificate.


### Compact Inspector operation entries

The Inspector groups the existing Focus and Curve/Surface operation entries in a compact wrapping row. Idle entries share spacing instead of repeating a separated panel for each button. An active operation uses the full Inspector width and retains its existing fields, Help, keyboard controls, draft handling and Native approval path.

This layout reduces vertical space and scrolling. It does not change the Canvas width, supported geometry, Source data, operation limits or public API. The same controllers and callbacks still own each operation.


### Independent Surface axis-reversed copies

`session.prepareSurfaceReversal('u' | 'v')` prepares an independent copy through the Native `reverseSurfaceAxis` constructor and validator. Only the generated singleton Source enters one new asset/body. The original complete Source, revisions, siblings, bindings and selected UV or body-only selection remain intact. Whole-document validation and the current whole-Viewport approval precede one atomic history entry. Undo removes the copy; Redo restores its IDs with current references and revision highwater.

The Canvas offers discrete U/V copy commands and display-only parameter guides from actual original Surface D0 points and the current camera. A short projected chord indicates each parameter direction. Clipped or degenerate guides are omitted. The guides do not select a point or certify a Face normal or global winding.

Native degree, control-net, coordinate, Source and document/display limits still apply. Local mapped D0/D1 observations do not certify global orientation, topology, Solid geometry or a double-reversal result. This is an independent generated copy; it does not reverse the original Source in place.

### Canvas command rail

The Canvas groups the existing editing, visibility and construction commands in one stable rail beside the view navigator. Commands use icons with accessible names and tooltip titles. U/V labels distinguish the Surface axes; Q/W/E/R identify editing shortcuts. Commands wrap to fit the available width. Each action has a 36px hit target and a visible keyboard focus ring. At narrow window widths, the rail moves below the navigator.

Only the existing command toolbars move into the rail. Their controllers, settings, geometry guides, Help state, input guards and Native approval paths remain mounted in the viewport. Resizing the viewport does not replace the rail targets. Empty rail space permits Canvas gestures. This changes command presentation; geometry support, Source data, history rules and Canvas size remain governed by the existing editor.

### Surface between original Curves

`session.prepareRuledSurface(secondBodyId)` uses the selected original Curve as the first section and a second original Curve from the document. The Native knot-alignment constructor and whole validator create the rational Surface. The complete generated Model3 Source, including both aligned section Curves, enters one new asset and Surface body. Original complete Sources, revisions, siblings and bindings remain intact.

The Construct rail icon opens a concise section chooser. Hidden second Curves remain available. Native basis, domain, knot, weight and capacity rules decide whether the pair is supported; refusal keeps the choice available for correction. Whole-document and current Viewport approval precede one history entry. Undo and Redo preserve structural IDs with current references and revision highwater.

Native ID-mode preflight may make up to four calls. It retries only the exact typed untouched/refined ID-policy refusal before construction. Other Native failures propagate. This does not remap domains, reverse sections, produce a Solid, certify G1/G2 continuity or preserve a live construction recipe in saved geometry.

### Surface along an original Curve path

`session.prepareTranslationalSweep(railBodyId)` uses the selected original Curve as the profile and another original Curve as the rail. The Native constructor and whole validator create a Surface with fixed profile orientation: `S(u,v) = P(u) + R(v) - R(vMin)`. The two original parameter domains remain independent. The complete generated Model3 Source, including both construction Curves, enters one new asset and Surface body. Original complete Sources, revisions, siblings, bindings and selection remain intact.

The Construct rail icon opens a concise Profile/Rail chooser. Hidden rail Curves remain available. Native refusal keeps the choice available for correction. Whole-document and current Viewport approval precede one history entry. Undo and Redo preserve structural IDs with current references and revision highwater. The generated Surface uses the existing Canvas pole editing tools.

Optional Help describes the fixed orientation. This operation does not transport the profile frame, create caps or a Solid, or retain a live construction recipe. Native and document/display limits still apply.

### On-demand Canvas settings

The Editing rail settings icon opens the existing movement, rotation or scale settings. The panel starts closed. Closing it only hides its DOM; snap values, input text and axis choices remain mounted. An active validation error exposes the relevant settings for correction. The icon provides an accessible name, expansion state and keyboard activation.

Curve, Surface, rotation and scale overlays show short status text during a gesture or pending edit. Idle instructions are hidden. A genuine unavailable-projection message remains available. Settings visibility does not change Native Source, candidate approval, history or Canvas size. Gesture Escape keeps its existing cancellation behavior.

### Inspector operation icons

Idle object operations use 36px icon buttons. Their previous command names remain available through title and aria-label. The existing controllers, visibility rules, guards and active form inputs remain in place. Rename, Join, Focus, Return, interval, knot, iso-Curve, region and split entries use installed SVG icons. Field labels, values, validation messages and active Apply/Create/Discard/Cancel decisions remain readable.

### Driving Sketch command icons

The Driving Sketch Inspector uses 16px icons in 36px buttons for Help, Add, Remove and fixed-point Drag point. Each command keeps its previous accessible name and title. Existing constraint IDs, guards, handlers, point selection and pressed state remain in place. Constraint definitions, DOF/rank, values, field labels, errors and active Apply/Discard/Add/Cancel decisions retain their text. Help keeps the operation explanation available on demand.

### Driving Canvas feedback

Driving dimension and fixed-point overlays show status only during an actual gesture. The status uses the existing rounded local displacement: one axis for a distance, and local X/Y for a fixed point. Idle instructions remain in optional Help and the grip title. Geometry guides, Native admission, draft ownership, capture cancellation, errors and field editing retain their existing behavior.

### Document command icons

The original-document editor uses 16px icons in 32px buttons for Open, Download, Fit and Fit selected. Each button retains its previous name through its accessible label and title. File selection, authored downloads, camera fitting, disabled guards and keyboard activation keep their existing behavior. Direction names, editable values, errors and active decisions remain readable.

### Constant-Y Solid Split workspace (bounded)

`CadEditorSolidSplit` from `@barocss/cad-editor/react` owns one native Split
session in one dedicated module worker and one explicitly labelled opaque legacy
WebGL2 canvas on the main thread. Supply genuine
`initialAuthoredText`; optional `initialPresentation` defaults to `original`,
`initialFilename` defaults to `solid-split.translated-strip-plane-split.json`, and
`className` scopes the host. These props seed one mount, not later replacements.

The original complete six-Face Body and both complete six-Face children use the
same native authority, qualified approximate triangle selection, camera and depth.
Numeric Cut Y is applied only by Split. Display admission/update must succeed
before native session acceptance. A failed rollback makes pixels unavailable while
retaining native authority. Context loss requires an explicit fresh canvas mount.
Fit changes only the camera; Undo restores original and Redo the pair. Hidden
routes retain session/draft state and dispose their canvas resources.

Open requires a genuine bounded authored file and explicit dirty replacement.
Save downloads only accepted native Split authority, excluding pending fields;
original-only Save is unsupported. “Download started” is not disk-persistence
verification. No generic cuts, paired-roof result casting, default-WebGPU policy
change, native API change or Canvas cut grip is included. Native reconstruction and complete qualified meshing run off the UI thread;
renderer admission, camera/picking and file initiation remain on the main thread.
There is no synchronous fallback. Private bounded versioned DTOs omit complete
native authority, history and prepared renderer resources. Main renderer admission
precedes the worker ACCEPT request; only its matching ACK publishes the new
session, filename and selection. Duplicate ACCEPT cannot commit twice. Loss or
timeout after ACCEPT is ambiguous: authority and presentation become unavailable,
with the last confirmed view retained rather than a silently restarted session.

Cancel preparation immediately prevents unaccepted canvas adoption, then waits for
a worker drain acknowledgement before another operation. Synchronous native calls
cannot be interrupted; queued cancellation can skip candidate meshing at a task
boundary. Initial loading is special: it completes and retains its initial display
DTO while hidden/cancelled, allowing remount without rebuilding native authority.
Once ACCEPT is sent, cancellation is no longer offered; a late accepted ACK can
update retained state while the canvas is hidden. Disposal terminates the worker,
rejects pending requests and clears listeners, timers and object URLs. Raw Cut Y
editing stays local until Split stages it in the worker, so typing and IME do not
wait for a worker round trip. Pending input remains excluded from Save.

The package and app emit ES-module worker assets with a bundled native dependency
closure. The bounded worker CPU smoke initializes original, admits one presentation
Split, canonically serializes it and disposes. Pre-invocation guards cap parser1,
meshes3, serializers3, validators4 and native edits/top-level new splits0;
the canonical codec and validator necessarily reconstruct five nested splits
(parser-owned1, standalone-validator-owned1, serializer→validator-owned3); one process group has a 180s
wall deadline with TERM/KILL cleanup and no retry. Cheap real-thread lifecycle
checks precede it. Earlier native Undo/Redo/Open/edit evidence remains applicable
to the unchanged native session; it is not replayed for this transport increment.
Worker compute, DTO size, postMessage sender duration, main ingestion and total
round-trip are separate measurements; round-trip is not pure transfer latency.
CPU host-timer evidence does not establish actual browser responsiveness, physical
WebGL pixels or browser file-picker/download behavior; those checks remain external.

The old app flow `solid-split-workspace-flow.mjs --native/--cold` is retired for
this worker coordinator; its earlier successful native receipts are preserved.
Run cheap controller coverage with `node apps/cad-editor/flows/solid-split-workspace-flow.mjs --controller`
and worker lifecycle coverage with `node apps/cad-editor/flows/solid-split-worker-flow.mjs --cheap`.
The single guarded emitted-worker smoke is an explicit separate invocation:
`node apps/cad-editor/flows/solid-split-worker-flow.mjs --native --worker packages/barocss-cad-editor/dist/assets/<emitted-worker>.js`.
Use the pinned toolchain Node and the documented heap/disk preflight; do not
repeat it automatically after failure or replay the historical native campaign.

The worker smoke's first instrumentation attempt incorrectly treated those
mandatory nested reconstructions as new user splits and stopped before the first
split invocation. Preserve that failed attempt; a separately approved corrected
attempt uses exact call-stack ancestry caps. The guard-only `--guard-plan --worker
<emitted-worker>` preflight validates these counters without invoking native code.
Native function timing is inclusive of nested calls and must not be summed as
independent total compute time. Additional native attempts require a fresh decision.


### Solid Split constant-Y draft grip (#1446)

The Solid Split canvas has an approximate Y editing guide. Drag it or edit the
Cut Y field, then explicitly choose **Split**. A drag updates only the local raw
field: it never calls the worker, prepares native geometry, changes accepted
Bodies, writes a file or creates history. Existing worker-owned Split acceptance
and native refusal remain unchanged. This guide is not certified cut geometry.

The anchor is the complete admitted display bounds centre in native X/Z, at the
current draft Y, using the established scene basis `[x,z,-y]`. The real GPU camera
matrices project it; pointer displacement is inverted along that projected line
with homogeneous perspective arithmetic, including backing/CSS aspect. No fixed
mm-per-pixel approximation or clamping is used. A clipped/behind-camera guide,
view-aligned axis, singular inverse or invalid raw field has no usable grip;
use the numeric field instead. This adds no camera orbit or zoom controls.

The gesture captures pointer, display/generation/selection, camera, canvas size
and position, and the exact pre-gesture draft token. Conflicting commands and the
numeric field lock during drag. No movement preserves the original lexical
text. Escape, cancellation/lost capture, secondary pointer, blur/composition,
resize, view changes, route hiding, context loss and unmount interrupt safely.
Cancellation restores the exact previous raw value (including an absent local
draft) only while it still owns the draft; a newer draft or accepted generation
cannot be overwritten. A successful pointer-up leaves a pending draft only.

Focused CPU verification (pinned Node 22; existing development dependencies):

```sh
node apps/cad-editor/flows/solid-split-cut-handle-flow.mjs
```

This runs real camera mapping and actual React editor/handle events in jsdom,
with explicitly substituted workspace transport, DOM layout and pointer capture.
It checks perspective round trips, clipping/degeneracy, lexical restoration,
stale/interrupt lifecycles, numeric synchronization and exactly one stage/apply
sequence after explicit Split. It invokes no native provider. The source and
worker/session/codec/provider contracts are unchanged, so their existing
`d36ed9bb` native/canonical-file/worker acceptance is reused rather than replayed.
Actual browser drag/capture, responsiveness, GPU pixels, physical file flow,
full CI and release qualification remain unrun here and are not inferred from
CPU component events.

### Authored affine-prism dimensions (experimental #1601)

`CadEditorPrismFeature` (`@barocss/cad-editor/react`) and
`createCadEditorPrismFeatureController` consume the public v0 authored five-node
sketch/prism/subtraction engine in a dedicated Worker. The existing app exposes
`#/features/affine-prism` from File → Prism dimensions. Select an actual feature,
edit named literal-mm dimensions, Apply, Undo/Redo, or cancel a computation.
Accepted source/results remain intact after native refusal; cancellation destroys
only in-flight worker state and the next operation reconstructs accepted intent.
Late responses cannot replace newer state. History is bounded to 20 states and
8 MiB (charged as canonical authored bytes). Parameter restores advance the native
revision and requalify original wall references; drafts are never saved.

The source panel exposes canonical authored-only JSON and opens pasted v0 source
through the native codec. Explicit replacement consent discards history/drafts.
This is a text codec workflow, not native OS file Save/Open or persistent recovery.
Native exact volumes and fixed component identities are displayed; empty roles
remain explicit. The existing route now consumes the public trimmed-solid mesh
provider: Source prism shows the first authored prism, Subtraction results shows
all nonempty fixed first/second outputs. The dedicated worker retains native
geometry; its bounded display DTO copies original-mm mesh positions, flat normals,
UVs, face/vertex/use/boundary/diagonal provenance and full original feature lineage.
Scene basis is x,z,-y with one scene unit per mm. Each component is one generic
triangle geometry, so the native 12-face limit does not exceed the renderer's
16-geometry limit. Internal fan diagonals are never BRep edges.

Display staging uses a hidden second canvas. Only a current successful candidate
swaps canvas and commits authored state/history; refused/cancelled/late candidates
retain the accepted canvas and reset worker authority when necessary. Resizing
uses actual accepted backing dimensions for picking after a resize failure.
Click selection is approximate triangle picking, qualified by document revision,
fixed component role, Solid and face/source identity; full lineage stays in the
receipt. Fit and source/result switches do not change native history. Empty results
have an explicit empty presentation, never a bounds box or rectangle fallback. No manufacturing, whole-editor, GPU pixel or
commercial-parity acceptance follows from the inspector.

Scoped checks (Node 22, normal repository dependencies):
`node scripts/prism-feature-controller-test.mjs` uses mocked worker transport;
`node scripts/prism-feature-smoke.mjs` executes the real native engine and codec,
with at most ten cold-equivalent phases plus twelve bounded mesh parent validations.
`node scripts/prism-feature-scene-test.mjs` uses recorded #1602 meshes and the real
CPU generic scene/raycast adapter (its fixture lineage is intentionally empty; full
lineage is asserted in native smoke). `node scripts/prism-feature-display-test.mjs`
uses mock DOM/canvas/renderer lifecycle only. Browser/physical GPU pixels are UNRUN. `EVIDENCE_DIR` selects an external evidence
directory; `REPO_DEPS_ROOT` may select an existing dependency store checkout.

### Explicit serial prism part v2

The host route `#/features/serial-part-v2` starts a separate six-node v2 fixture.
The existing `#/features/affine-prism` remains v0; neither inspector silently
migrates files or accepts the other version. The v2 route exposes literal
coordinate, prism-height and chamfer-distance bindings from the authored recipe.
Its target is read-only: the second subtraction component, followed through
complete original source/use provenance to the supported top-edge chamfer.

Source view shows the original prism. Finished results show the unchanged first
component and the actual negative/retained chamfer Solid. The intermediate second
Solid ID and final retained Solid ID are shown separately, including in picked
face provenance. Full original, subtraction, chamfer and split lineage is copied;
internal fan diagonals remain display-only. Geometry is regenerated on import and
history replay. Unsupported geometry/references retain the last accepted state.

Scoped software, native-to-CPU mesh and controller checks are distinct from
browser Worker execution, rendered GPU pixels and native OS file workflows.

### Build artifact checks

`node packages/barocss-cad-editor/scripts/build.mjs` runs checked declaration
emission and Vite bundling in separate processes. This releases the compiler's
whole-program graph before Vite builds the native split, prism and modeling
workers. A successful build contains both ESM entries, all source declarations,
scoped CSS and three self-contained module workers. Only the main library
entries leave their package dependencies external. A failed phase returns a nonzero
exit and removes incomplete/stale `dist` output; only a successful build is consumable.
Both phases default to a 1536 MiB old-space limit and one Rayon thread. Explicit
Node heap flags (including `NODE_OPTIONS`) and `RAYON_NUM_THREADS` remain
authoritative; other execution flags and environment options are inherited.
The current declaration graph exceeds a 768 MiB old-space budget.

After building, run `node packages/barocss-cad-editor/scripts/check-build.mjs` to
check emitted imports, declaration coverage, worker URLs and isolated worker
startup. This artifact check does not claim native geometry, browser rendering,
or Save/Open workflow coverage.

### Download a selected accepted convex output as STL

In **Model a part**, choose a named **STL output**, independently of the visible body or selected face, then **Download STL**. Only primary convex outputs are currently supported; legacy, hole, circle and orthogonal-cell outputs are unavailable. Apply or discard dimension drafts first. The worker exports directly from its accepted native snapshot, with revision, output identity and task freshness checks. Model source, history and display are unchanged.

If the worker has been lost, the action explicitly becomes **Recover accepted model and export STL**. It rebuilds the accepted saved source, verifies matching source/summary and admits the recovered display packet without replacing the display or history, then exports. Cancellation or refusal produces no download.

Files use binary STL, an mm convention, authored XYZ coordinates and approximate Float32 facets, at most40 facets/2084 bytes. The status reports the provider's maximum vertex displacement. STL does not store units or editable modeling intent. Browser disk persistence, slicer/manufacturing acceptance and physical UI testing remain separate. The focused tests replay retained genuine left/right gusset bytes with mocked provider/Worker delivery; they do not run native export or establish changed-geometry/GPU results.

## Primary modeling command workspace (#1943)

`<CadEditorModeling workspace />` uses the command-context layout: persistent
native viewport, feature/output Browser, grouped commands and a feature-history
strip. `workspace` is a mount-time layout choice; changing it on the same mounted
component does not replace its active document or viewport. Omit it to retain the
existing embedded layout. Neither layout changes the controller, authored codec,
worker/native limits or accepted-output authority.

Select a feature in the Browser, then **Modify → Edit dimensions** for the exact
constrained-plate recipe. Other recipes expose **Edit model dimensions** because
their named parameters may affect multiple features. Successful Apply closes the
options; a refusal keeps the draft and diagnostic visible. Cancel or unmodified
Escape discards through the controller. Other drawers preserve pending dimensions
and offer **Resume dimension edit**. Undo/Redo use existing accepted history;
Ctrl/Cmd-Z outside text fields follows those same guards.

Create contains the existing example picker. Inspect retains output choices,
selected native-face provenance and capabilities/limits. File retains saved-model
staging/replacement consent and the independently selected convex STL export,
including explicit lost-worker recovery. Feature selection, visible output and
STL output remain distinct identities. Unsupported creation, Surface, construction,
feature reordering and camera tools are not advertised by this first shell slice.

### Selected extrusion drivers (#1948)

Select an existing primary-model **Extrude**, then **Modify → Edit extrusion**.
Height and start-Z fields that directly name a model parameter use the existing
draft/Apply controller. Literals (including omitted start-Z = 0) and derived
expressions are read-only. **Review model dimensions** returns to the existing
global controls; this command does not rewrite expressions or authored literals.
Named parameters update every use, including other fields and dependent features.

The command pins its feature, accepted generation, controller lifetime and command
instance; changing Browser selection does not retarget it. Closing/reopening
options invalidates old callbacks, and controller replacement clears the command.
Reopen after a model or output-view generation change.
Unrelated pending dimensions route opening to the global editor. If they appear
while options are open, local Apply is disabled and Cancel only closes, retaining
those drafts. A current command's Cancel/Escape discards its drafts normally.
Successful Apply and Undo/Redo retain the existing admission/history behavior.
The focused local flow replays genuine round-post baseline geometry with mocked
provider delivery and edited-state geometry; native edits and physical pixels are
not newly measured by this UI slice.

### New rectangular part (#1951)

**Create → New rectangular part** authors a public model document from width,
profile height and thickness. Its rectangle starts at XY [0,0] and extrudes from
Z=0; all three sizes are named parameters. The private source builder validates
positive finite decimal input ≤10000 mm, while the existing native loader owns
geometry and representability. No model, mesh or worker protocol is invented.

Temporary creation fields do not stage edits on the current model. Pending model
drafts block replacement and can be reviewed in their existing editor. The
explicit **Replace current model** action warns that accepted work should be
downloaded first and that successful creation resets document history. Cancel
preserves accepted state and existing drafts. Source/generation/controller and
command-instance guards reject stale callbacks. Refusal or canceled computation
retains the accepted viewport/history; only successfully admitted replacement
closes options. The viewport and controller remain mounted.

Use existing named-dimension, selected-Extrude, history, file and STL commands
after creating the part. Local tests reuse genuine 32×24×8 convex body/preview
bytes with explicitly adapted authored state and mocked provider/display delivery;
edited geometry and the new physical creation/file workflow need separate evidence.


## Selected rectangle sketch coordinates

The Model a part workspace offers **MODIFY → Edit sketch dimensions** for an
accepted rectangular Sketch. The command pins the selected feature and presents
Min X / Min Y / Max X / Max Y as signed coordinates. Exact named driver leaves
are editable and deduplicated; literal values and expressions remain read-only.
A shared parameter retains its global effect, including downstream features.
The native provider owns coordinate ordering and geometric admission.

Apply/Cancel use the existing controller and accepted history. Controller,
source/generation, command-instance and completion guards protect newer work;
unrelated drafts require global review. Viewport, New part, files and STL remain
mounted and available. Other profiles retain their existing model-dimension
controls. No sketch drawing, expression rewrite or live draft geometry is added.
See #1957 for bounded local controlled-delivery evidence and physical gate status.


## Accepted-only model download

The modeling File panel distinguishes accepted values from pending raw dimension
input. Download accepted model explicitly excludes drafts and staged file text;
Review dimensions before saving preserves the draft and focuses the existing
editor. A clean document retains Download model. Neither action silently applies
or discards changes. Download binds controller/source/generation/drafts and File
context, owns only its anchor/object URL, and reports request/cleanup failures.
A click is not a persistence guarantee. The codec, history and named outputs are
unchanged; physical acceptance is tracked separately in #1958.


## Owned structural authoring

The primary workspace adds Add rectangular arm, Union bodies and Cut rectangular
through-slot as bounded semantic commands. Explicit native output identities,
canonical signed source and controller/command epochs bind every candidate.
Temporary fields do not stage model dimensions. Preview uses public cad.load;
Apply promotes its retained snapshot once. Complete source history supports real
structural Undo/Redo without resetting the document. Failed acceptance leaves
source, display and history cursor unchanged; uncertain native acknowledgement
terminates the Worker for verified recovery.

The supported graph progresses 2→4→5→8 features. Cut atomically appends its tool
and subtraction and requires omitted extrusion starts with height8 (Z0..8).
Union can support other integer thicknesses, while Cut is unavailable. Output
consumption is explicit and final-only transport retains its embedded parent.
No receiver cap, provider family, codec or orthogonal STL support is expanded.
Run the pure18 and transaction18 local suites with Node and installed dependencies:
`node packages/barocss-cad-editor/scripts/modeling-structure-test.mjs` and
`node packages/barocss-cad-editor/scripts/modeling-structure-history-test.mjs`.
See #1960 for source/runtime provenance and pending actual-device acceptance.

## Local model view orientation

The modeling controller exposes `setView('top' | 'isometric', generation)` and
`snapshot.viewOrientation`. Top uses native +Z with native X-right/Y-up;
Isometric preserves the original perspective camera. Both remain perspective.
The live accepted display updates its existing renderer transactionally, while
source, dimensions, native identity, generation and history remain unchanged.
Busy or retained-preview state refuses camera switching. Each later prepared
scene keeps the session's view, including its native and convex picking camera.
Renderer loss/rollback errors preserve the prior logical state without promising
retained pixels. A new controller starts in Isometric; view is not file content.

Run `node packages/barocss-cad-editor/scripts/modeling-view-test.mjs` explicitly.
The finite CPU/display suite uses retained geometry and renderer doubles, with
zero native evaluation and no physical GPU acceptance claim. See #1965.

## Selected rectangular-plate through-hole (#1966)

Select the accepted Extrude of an origin-zero, omitted-start rectangular part,
then MODIFY → Add through-hole. The pure structural helper appends one hole and
three owned drivers: holeCenterX, holeCenterY and holeRadius. Decimal center/radius
inputs are separate command state; Preview and Apply reuse the existing atomic
source transaction and full-source history. The sole part output is consumed by
the result while the original extrusion remains in authored intent. Selecting a
different feature closes the command; stale source/lifetime/field callbacks cannot
promote a candidate. Pending model drafts must be reviewed without discard.

This narrow branch requires positive safe-integer plate spans/thickness, an
interior circle with radius at least0.001 mm, and unoccupied driver names. Native
exact-UV and receiver limits remain authoritative. No second hole or transformed,
finished or Boolean parent is admitted. Hole volume/mass are unavailable and
convex-only STL remains refused. Geometry/provider replay and physical acceptance
are separate; edited radius tests retain explicitly mocked baseline geometry.
Run `node packages/barocss-cad-editor/scripts/modeling-hole-authoring-test.mjs`
for the finite pure/source and controlled transaction groups, with no native call.

## Selected rectangular pocket (#1971)

Select the accepted Extrude of a sole origin-zero rectangular part, then MODIFY
→ Cut rectangular pocket. Positive integer Wall thickness and Floor thickness
append the tool sketch, offset extrusion and difference as one2→5 source
transaction. Preview/Apply reuse the existing candidate/history authority;
Cancel/Escape and stale selection/source/lifetime/field callbacks cannot promote
another command. Pending model dimensions remain separate. The two new drivers
are pocketWall and pocketFloor, with valid defaults derived from the current
outer dimensions. The original feature prefix and expressions are preserved.

Initial positivity is a command guard, not a saved constraint: later global
parameter edits can remove the floor or walls. The UI keeps that warning after
Apply; provider geometry remains authoritative. No second pocket, fractional
corner, transformed/Boolean parent or STL expansion follows. Local replay uses
retained46 top-pocket Surface packets with explicit authored-context/provider
adaptation; edited displays are baseline mocks. Current flat-color rendering
may not visibly distinguish a blind cavity. Actual new-command/pixel/file
acceptance remains separate.

Run `node packages/barocss-cad-editor/scripts/modeling-pocket-authoring-test.mjs`
for the frozen12 pure and10 controlled transaction groups, without native calls.

## Orthogonal native-face presentation (#1974)

Qualified orthogonal-cell scenes partition original triangle occurrences into at
most six exact native axis/sign groups with categorical unlit shades. Positions,
normals, UVs and each triplet's winding are unchanged. Upward rim and floor share
the same shade; this does not provide general depth cues or new native authority.
Private per-output geometry IDs map each draw-local triangle back to its original
packet triangle and prepared face. Generation-specific IDs prevent alias across
outputs, replacement and resize. Picking still returns original face references
and lineage. Other display families retain their existing presentation.

Run the focused local CPU fixture with
`node packages/barocss-cad-editor/scripts/modeling-orthogonal-presentation-test.mjs`.
Its ten groups replay 104 unchanged retained Surface packets (46 pocket, 14 union,
44 composed cut), check exact partition/picking/edge-tie authority, two aspects,
accepted-view restoration and nonorthogonal parity. The receiving/raycast fault
doubles are confined to malformed private-map controls. No native calls or GPU
pixels are established; visible cavity readability remains an actual Tester gate.
