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

`prepareApply()` performs a real native control-net edit and recreates the
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
canonical file. Rename does not add duplicate/remove/asset replacement or a
complete-source Curve editing API; existing isolated Curve edit output is not
authority for replacing an original multi-object asset.

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

A Surface body is editable when its selected coefficients meet the native profile:
ASCII ID1–48, degrees1–3, grid axes2–16/at most256poles, coordinates±10000mm
and weights1e-6..1e6. Multi-object assets and a different Model name are supported
through actual `editSourceSurfaceControlNet`. Complete `result.source/model`
retain Model name/order, sibling coefficients, comments, whitespace and untouched
literal spelling. `result.edit` is the selected Surface child proof; it never
replaces the full asset. Its provenance remains the pole edit receipt. The owned
native validator reconstructs the provider proof; internal validation work is
separate from the direct editor operation. Native no-op preserves exact spelling
and revisions. Curve coefficients and unsupported selected Surface profiles remain
read-only. Actual source binding/size/native/display failures retain prior state.

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
preview; a separate hidden degree5 asset remains untouched. No degree5 display,
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
