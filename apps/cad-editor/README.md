# CAD Editor application

Private React/shadcn host for `@barocss/cad-editor`. Menus, project/document routes,
body tree, file picker, genuine download and canonical fixtures live here.
Reusable editing state, inspector and Viewer bridge live in the package.

## On-demand modeling preview

At `#/model`, use a dimension command, enter pending values and click **Preview dimensions**.
The viewport shows an unapplied candidate while accepted source and history remain intact.
Apply accepts that same candidate; Cancel restores the retained accepted viewport. Another
input invalidates the preview. Lost-worker recovery is explicitly labeled before the click.
Face picking is disabled during preview, and diagnostics identify editing context without
inventing an offending feature. Legacy files remain Apply-only.

Run `node apps/cad-editor/flows/modeling-draft-preview-flow.mjs` locally for the focused
React/controller transaction flow. Its provider, Worker and renderer boundaries are explicit
doubles; retained genuine baseline geometry is reused for mocked edited states. It is not
native edited-geometry, GPU-pixel or physical acceptance. App runtime flows stay local;
CI retains lint, types and builds. [#1959](https://github.com/barocss/barocss/issues/1959)
tracks the exact source/results and deferred physical gate.

Use the installed Node 22 runtime. No new dependency or browser download is
required by the focused flow.

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app build
pnpm --filter @barocss/cad-editor-app dev
```

The independent host uses `http://127.0.0.1:52010/`. File → Open reads a real UTF-8
native file. File → New sample loads the weighted Surface and visible reference
Line. Select **Weighted surface**, choose U/V, enter pending values, and Apply.
Download contains accepted native bytes; pending fields remain pending.
The status says “Download started”. Open those bytes in a fresh app to re-edit.

The fixture is `canonical-surface-and-curve.cad-document.json`: Surface degrees
2/2, weighted 3×3 original control net, plus an untouched separate two-pole Line.
The first edit is U1/V1, Z18→24 mm and weight1.5→2. The native midpoint changes
from `[30,20,70/9]` to `[30,20,56/5]`. After fresh Open, Z24→28 gives
`[30,20,64/5]`. The Line midpoint remains `[-15,20,-5]` throughout.

```sh
node apps/cad-editor/flows/canonical-surface-flow.mjs --source --headed --port 52010 --evidence /Users/user/.barocss-ai/v3/evidence-cad-editor-foundation
node apps/cad-editor/flows/canonical-surface-flow.mjs --compiled --headed --port 52010 --evidence /Users/user/.barocss-ai/v3/evidence-cad-editor-foundation
```

The single bounded source flow drives the real file input, native Apply,
Undo/Redo, camera changes, genuine download, a fresh browser context and re-edit.
It checks complete Curve source/coefficients/binding preservation, independent
native vectors, actual RGBA changes, native weight0/parser/profile/Viewer
refusals, stale candidates and one component unmount/remount. The compiled
checkpoint uses explicit transitive published JS/types/CSS maps and a shorter
real file flow. Attempt logs, first failures, downloads and screenshots remain
in the evidence directory. The flow closes its own browser and Vite server.

`--browser` and `--playwright` select already installed runtimes. Defaults point
to the installed local Chromium1223 and bundled Playwright. The `?flow` route
enables a bounded test seam with copied snapshots/diagnostics and declared host
actions. It provides no renderer handle.

The app preserves authored XYZ and uses the existing Viewer basis assertion,
native sampling units1 and one mm-to-scene scale0.01. Camera and display data are
absent from downloaded native files. General documents, native feature graphs,
sketches, assemblies and exchange remain separate roadmap stages.

For #1044 draft/selection evidence, add `--draft` to either focused flow command.
The additional real browser flow records native composition events, guards Enter
during composition, checks selection Apply/Discard/Cancel and focus, refuses an
invalid native weight without changing the accepted frame, highlights the read-only
Curve, refuses stale targets, exercises actual text/document keyboard undo and
performs a genuine Download → fresh Open → Enter re-edit. Its extra midpoint
checks are `[30,20,68/5]`, `[30,20,72/5]` and `[30,20,76/5]`.

For #1045 complete-inventory evidence, add `--inventory` (and `--draft` for the
previous draft flow). `complete-native-inventory.cad-document.json` has four
assets and sixteen bodies. Open asks for one to four visible objects before
adoption. Checkboxes hide/reveal bodies without modifying native data. Fit selected
uses actual native bounds, and actual canvas picking resolves a full qualified
body reference. A foreign asset has the same Surface ID and remains unchanged.
Supported Surface poles in multi-object assets are editable through the actual
whole-source API; Model names and sibling source/native data are retained. A hidden degree5Curve remains valid native content;
showing its asset reaches the actual unsupported-preview refusal and retains
the prior frame. Over-display-budget requests are refused without truncation.
The genuine full-document download retains all hidden sources/models/body IDs
and revisions. Fresh Open chooses a new display set and re-edits the original
Surface; foreign same-ID geometry stays exact. Native file budget is2MiB.

## Boolean extrusion workspace

File → New Boolean extrusion opens the separate feature workspace. The tree shows actual native Face/Boolean/extrusion dependencies. Length controls edit literal values or offsets from existing parameters. Select Combine faces to change union/intersection/difference, then Apply. Discard removes unapplied values. Surface and feature modes retain their host sessions when navigating between them.

The workspace uses the public native Boolean graph evaluator/updater/serializer and the existing qualified native mesh/GPU Shell renderer. The native profile is two coplanar Faces →Boolean →normal extrusion, not two solids. Extrusion/length lifecycle and referenced Face/Boolean replacement use the bounded workflows below. Suppression, full parametric constraints, assembly, Viewer Shell pointer selection and certified solid modeling remain unavailable. Original inclined authored XYZ/mm stays intact; display scale is0.01.

Download saves the accepted authored graph. Open reads that same graph format and requires the configured extrusion/output slot. Pending fields and display state are excluded from files. Invalid length/dependency/contact/file/native mesh/GPU changes retain accepted graph/history/draft/frame. Help contains technical profile details.

Run the focused actual gate with installed Node22 and Chromium, without downloading dependencies:

```sh
node apps/cad-editor/flows/feature-graph-flow.mjs --source --headed --port 52012 --evidence /Users/user/.barocss-ai/v3/evidence-cad-editor-feature-graph
node apps/cad-editor/flows/feature-graph-flow.mjs --compiled --headed --port 52012 --evidence /Users/user/.barocss-ai/v3/evidence-cad-editor-feature-graph
```

The server guard requires its own child to listen before browser access. Source and built public entries use the same bounded native edit/refusal/file flow. Integration registration and release remain separate.

File → New shared extrusions creates the native four-leaf sample. Select outputs with checkboxes, Show all, or Show only selected. Fit selected frames a displayed nonempty extrusion. Height/Boolean edits rebuild all four native outputs even when some are hidden. Download retains the complete authored graph; visibility is excluded from native files.

`node apps/cad-editor/flows/feature-fanout-flow.mjs --source --headed --port 52012` runs the existing single-output gate and one four-output extension. Replace `--source` with `--compiled` for built public entries. Evidence defaults to `/Users/user/.barocss-ai/v3/evidence-cad-editor-feature-fanout`. The flow verifies true native fanout vectors, full-scene pixels/refusals, view-only draft/history/download preservation, different fresh-app display choices and genuine full-graph re-edit.


## Add, edit and remove extrusion

Select an extrusion and use Edit extrusion or Remove. Add extrusion offers literal height(mm) or an existing length parameter plus offset(mm). The app creates fresh native feature/slot/evaluation/prefix identities. Choose the complete display set in the dialog. Remove requires at least one remaining visible output and keeps at least one native leaf. Cancel/Escape restores trigger focus. Refusal keeps dialog input and the accepted native file/history/camera/frame. Dialog fields are excluded from Download.

History uses the current display set. If Undo would remove a newly displayed leaf, select a surviving extrusion, choose Show only selected, then retry Undo. No automatic view replacement occurs. Parameter creation/removal uses the separate Lengths workflow below. Suppression/reorder and general Face/Boolean creation remain separate work.

Focused native lifecycle gate: `node apps/cad-editor/flows/extrusion-lifecycle-flow.mjs --headed --port 52012 --evidence <directory>`; add `--compiled` for actual built public root/React/CSS and explicit native runtime/types consumer. It checks genuine native file Download/fresh Open/re-edit, real GPU/refusal retention and explicit history view repair. This is not a broad publication/parity/release campaign.

## Full-source Surface edits

`node apps/cad-editor/flows/source-preserving-flow.mjs --headed --port 52012`
runs the existing bounded draft/inventory gate and the full-source mixed Model
fixture. Add `--compiled` to consume actual built public root/React/CSS and native
runtime/types. Evidence defaults to evidence-cad-editor-source-full. It checks
source comments/spelling/Model name/siblings, foreign/hidden assets, genuine
Download/fresh Open/re-edit and the actual degree5 whole-asset preview refusal.
Native source-edit eligibility and display admission are separate decisions.

## Length parameter lifecycle

Use Add length or the Edit/Remove controls in the Lengths sidebar. Add/Edit accepts
a literal length in mm or an existing parameter plus an offset in mm. Existing
native IDs/types remain; the host assigns a fresh bounded identity for new lengths.
Remove lists direct dependent lengths and extrusion distances. Enable and choose
each required replacement explicitly. Missing repairs reach the actual native
dependency refusal and keep the modal values. No dependent value is silently
replaced by its evaluated length.

Apply commits only after native evaluation and actual full GPU scene admission.
Cancel/Escape keeps the accepted graph and restores trigger focus. A refused GPU
update keeps raw values, repair choices, history, view and fresh frame. Parameters
and distance repairs use one actual #915 transaction; feature lifecycle remains
a separate #922 operation.

Focused gate: `node apps/cad-editor/flows/parameter-lifecycle-flow.mjs --headed
--port 52012 --evidence <directory>`, with optional `--compiled`. It runs the
bounded feature/fanout/extrusion core and actual length Add/Edit/Remove, missing
repair refusals, explicit dependent length/four-distance repairs, genuine native
Download/fresh Open/re-edit and real GPU/refusal/focus checks. Native inclined
vectors and actual pixels are verified separately. This does not certify packed
publication, OS-wide IME or general commercial CAD support.

The length dialog's Help opens its related topic without discarding modal values.
Close help returns focus to Help and keeps raw fields and repair choices. The long
repair list scrolls inside fixed title/actions. Text Enter does not apply a modal
edit; use its explicit Add/Apply/Remove button. Technical native causes are
expandable inside Help.

## Replace referenced features

Use **Replace** in a Face or **Combine faces** sidebar row. Face replacement keeps
the actual authored Plane and ordered Line input and creates a fresh logical
feature and output slot. It changes identity and references, not coordinates or
imported geometry. Combination replacement copies the original operands and
budgets, creates a fresh native evaluation/prefix context, and offers Union,
Intersection and Difference. Generated IDs stay in native data; task controls
show **Face replacement N** or **Combine faces N**.

Choose **Use replacement face** for every direct dependent Boolean operand, or
**Use replacement combination** for every dependent extrusion. All repair choices
start unchecked. Only checked feature upserts enter one actual native feature
transaction, followed by removal of the original target. Missing or partial
repairs reach the native dependency refusal. There is no automatic cascade,
parameter transaction or extrusion creation/removal in this action. Existing
leaf distances, slots, options, source inputs and parameter definitions remain
authoritative. Apply or discard existing scalar drafts before replacement.

The dialog keeps the accepted viewport while choosing; it does not preview
pending operations. A native, mesh or GPU refusal retains the operation, checked
repairs, error, accepted graph/history, camera and fresh frame. Replace closes only
after actual bridge acceptance and focuses the new row's Replace button without
selecting it. Cancel/Escape restores the old trigger. Nested **Help** closes to
its Help trigger and preserves all choices and errors; native/API limits and
technical diagnostic details stay there. The fixed dialog header/footer and
scrolling body keep actions reachable without resizing the viewport.

The narrow facade uses `prepareReferencedFeatureTransaction` with the actual
`BooleanExtrusionFeatureTransaction`: expected revision, exact next revision and
1–8 unique feature operations. The native provider owns whole graph admission,
working capacity8, final two Faces/one Boolean/1–4 extrusion leaves, stable
existing identities/options and fresh replacement names. All current selected
qualified meshes enter one actual GPU Shell scene update and RGBA read before
commit. Native suppression, feature reorder and general solid Boolean remain
unsupported. Undo/Redo restores the complete authored structure with the current
logical extrusion display choice. Download serializes only accepted native data.

## Edit Face corners

Select a Face in the feature tree. The reusable inspector lists **Corner 1..N**
from the original ordered native Line endpoints, with authored XYZ/mm values.
Choose **Edit** for one corner. The app dialog keeps raw X, Y and Z text until
you select **Apply**. Enter, Tab and composition do not apply a change, and
there is no live preview. Coordinates must be finite and from -10000 to 10000 mm.
Keep the point on and within the current face plane's finite authored domains,
and preserve its closed convex boundary.

One corner joins the previous Line's pole 1 to the next Line's pole 0. The exact
shared endpoint triples, including signed-zero bits, define its current qualified
binding. Exact endpoint pairing is required by the native Face profile. Missing
or unsupported bindings show an honest unavailable message; the editor does not
weld or renumber endpoints.
Apply changes exactly both adjacent endpoint triples to the same explicit point.
It preserves Plane data, all other Line coefficients, IDs, order, knots, weights,
options, sibling Face, Boolean, lengths including signed zero and extrusion leaves.
The existing native transaction rebuilds the Boolean and all selected output
meshes. Full GPU scene admission and a fresh RGBA read precede acceptance.

A native coordinate, coplanarity, closure, convexity, CONTACT or GPU refusal keeps
the dialog raw fields and accepted graph/history/selection/camera/frame. Nested
Help keeps values and errors and returns to its Help trigger. Cancel/Escape drops
only the dialog values and restores its corner Edit trigger. A genuinely accepted
edit closes the dialog and restores the same corner focus. Undo/Redo and Download
use complete accepted native data; raw coordinates, camera and visibility remain
outside the saved file. Fixed dialog actions and a scrolling body leave the
viewport layout unchanged.

The public `getFaceCorners` result carries the exact graph/revision/feature/slot,
corner index and adjacent Line/pole identities. `prepareFaceCornerEdit` verifies
that current binding and uses one existing-Face upsert through the actual native
feature transaction. There is no projection, snapping, solver, mesh-derived
authoring, arbitrary Curve/NURBS weight editor, drag or certified solid claim.

## Inspect native extrusion properties

Select a normal extrusion and choose **Inspect native properties** in its
inspector. The explicit read shows the accepted graph revision, **Section area
(mm2)**, **Construction volume estimate (mm3)** and **Centroid X/Y/Z (mm)**. It
measures the accepted native output even while scalar fields have pending
values. It does not measure a draft or use the displayed mesh, pose, scene scale,
camera, pixel coverage or bounding box as authority. The button is disabled
during a candidate; selection and typing do not trigger a query.

Readable numbers are rounded to six decimal places. The public typed
`onProperties` callback receives a separately copied full native result, including
its qualified binding and original unrounded numeric values. A real empty
output reports zero area/volume, no components and centroid unavailable.
ConstructionEstimateOnly remains true. The geometric centroid is not an interior
witness and can lie outside material or in a hole. Topology, Solid, manifold,
sewing, manufacturing, density, mass and inertia certifications remain false.
Each read measures one selected output; it does not total or union overlapping
extrusion leaves.

Native geometry/revision/selected feature/output-slot changes and unmount clear
the previous summary and send `onProperties(null)`. A new native acceptance also
invalidates a report if Open reuses the same declared graph/revision tuple.
Camera and display-only changes retain a still-current report. Query refusal
retains such a report, native state/history/drafts/capture and viewport; successful
requery clears only the property-query error. Use **Help** for actual native
quality, work/budget scope, error details and requery guidance. Closing Help
returns focus to Help without changing query data or native state.

The actual public interop bridge reconstructs/validates the native extrusion and
measures its original directed boundaries/support. Budgets allow 0–64 boundary
segments and 0–8 new component support evaluations; parent reconstruction work
is excluded and native helpers can perform it more than once. The default
reusable `propertiesOptions` is 64/8. The focused `?flow` host exposes copied
`properties()`, an actual `setPropertiesBudget(boundary,surface)` prop control,
and `readFrame()` using the existing read request. These are flow-only controls,
with no user-facing budget knobs or provider mocks. Native files exclude property
reports and all query/display UI state.

## Review and download IGES

In the direct document workspace, choose **Export IGES** in the toolbar. Select
1–16 original canonical bodies independently of the visible subset. Hidden and
read-only Curve/Surface bodies remain eligible original geometry; the writer
supports Source0 degree1–5 independently of the Viewer preview limits. Set the
explicit model ID and each selected output ID. IDs must be distinct ASCII
identifiers, from 1 to 48 characters, beginning with a letter or underscore.
The app does not automatically truncate, rename or repair collisions.

**Review export** calls the actual accepted-document exporter once and captures
its real IGES5.3 ASCII bytes and native loss/identity report. Review never exports
pending pole edits or displayed mesh/pose. The panel shows accepted revision,
mm/authored XYZ, selected/unselected counts, byte count, Curve126/Surface128
entities/domains and directory/parameter mapping. Directory labels have eight
characters and can truncate or collide; retain the full-ID loss sidecar. The
reported numeric negative-zero normalization is visible, while original native
source/coefficient bits remain unchanged. Writer geometryLoss none does not
mean original comments/source, full native identities, unselected objects or
authoring history are embedded in IGES. Actual omissions and unsupported domains
are listed and the complete native report remains available in details.

Choose **Download IGES** for the captured `.igs` file and **Download loss report**
for the captured native report JSON. They are independent explicit downloads of
copied capture data and do not call native `markDownloaded`, clear pending fields,
change dirty/download status or replace the native save capture. Use the existing
**Download** native-document action separately to retain complete authored data.
The fixed native writer output limit is 2MiB; its records contain80ASCIIcolumns
plus LF. No IGES reader/reimport/equivalence or certified Solid/manufacturing
claim follows from this export.

Changing raw export options or accepted native content invalidates the review
and its download actions. Selection, camera and display-only changes keep a
still-current capture. Failed review preserves raw options and any earlier
capture that is still current; changed options require Review again. Downloads
recheck current qualified references and use captured bytes only. Close/Escape
returns focus to Export IGES. Nested Help closes to Help without changing options.
Technical capability/loss/limit/error details stay in Help and report details.
Feature mode does not offer a fabricated exporter. STEP is unsupported here;
GLB remains an external derived bridge rather than this canonical writer.

The flow-only `?flow` host exposes a copied `exportReview()` and `readFrame()`
using the existing actual Viewer read request. Existing `setMounted(false)`
unmounts both Viewer and review UI, invalidating the capture while preserving
the host-owned native session. The canonical Viewer has no public GPU resource
counts; disposal/status/lifecycle, fresh remount pixels and native state retention
are separate evidence.

The ordinary export review shows object names, format/mm, selection and real geometry-only/history/name-loss decisions. Export naming is secondary; full native mappings, signed-zero counts and certification details remain in expandable Export details and Help. No generic No loss claim follows from the writer geometry-loss field.

## Inspect original geometry

Select a named Curve or Surface, including a hidden or read-only object, then
use its Analysis section. Curvature is the default query. Enter Parameter t
for a Curve or U/V for a Surface within the displayed original knot domains.
These parameters are independent of Surface control-pole indices. Inspect
reads the accepted native geometry; typing, Tab and Reset parameters do not
evaluate geometry or apply pending coordinate/weight edits. Reset restores
domain midpoints. Enter inspects from a parameter field outside text
composition, and Space activates the focused button.

Ordinary curvature values use six decimals and native units: Curve curvature
1/mm and radius mm, Surface mean/principal curvature 1/mm and Gaussian
curvature 1/mm². Details contains point XYZ/mm, first and second derivative
vectors in original parameter units, the current qualified reference and the
full native result. The typed callback retains full precision and signed zero.
Help explains original-domain, continuity, regularity and arithmetic limits;
closing Help returns focus without changing the inputs or result.

Changing original native content, selected body, raw parameters or query mode
invalidates the result. Selecting another control pole on the same unchanged
Surface, camera movement and display-only changes keep it. A refused
same-current query retains its last valid result, native source, history,
pending edits and view. Invalid changed raw values stay visible and need a
new successful Inspect. This local analysis does not certify G2, torsion,
principal directions, trims, Faces, Solids or manufacturing quality and does
not repair geometry.

The flow-only host exposes a private `geometryAnalysis()` result or null and
uses the existing `readFrame()` request for actual Viewer pixels. Unmount
clears the analysis while the host-owned native session survives. Canonical
Viewer lifecycle/status and remount pixels do not claim public GPU counters.


## Rename an original object

Select a Curve or Surface, then choose Rename object in the Inspector. Enter a
new name and choose Rename. Cancel or Escape retains the document and returns
focus to the entry. Help explains the file name limit. Native names keep their
exact spelling; duplicate friendly names are allowed. Invalid names retain raw
input for repair. Apply or discard pole edits before renaming.

Rename changes only the canonical body name and document revision. Original
Source0 assets, IDs, coefficients and asset revisions remain intact. The actual
Viewer gates acceptance and retains its camera. Undo/Redo restores both names
and source edits at fresh revisions. Download/Open retains the names and full
native sources. This does not rename native IDs or add Curve pole authoring.

Run the same bounded source/public compiled consumer with Node22:

```sh
node apps/cad-editor/flows/body-rename-flow.mjs --headed --port 52026
node apps/cad-editor/flows/body-rename-flow.mjs --compiled --port 52027
```

Receipts are stored outside the repository. Prepared checkpoint metadata is
separate from actual execution. Native completion, Integration adoption and
publication remain separate.


## Protect accepted changes before Open or New

Open/New sample first requires resolved pole fields and selection decisions. A
valid incoming native file and visible-body choice are frozen before replacing
accepted content. If the current accepted document has unsaved changes, choose
Download copy, Continue without downloading, or Cancel. Download copy starts the
actual accepted native download and keeps the decision open; it does not prove
disk persistence or continue replacement. Cancel/Escape keeps the native file,
history, raw fields, selected object and frame. Help explains the difference
between accepted content and pending fields.

Current-session changes or another file action invalidate the target. Failed
copy download leaves no queued replacement. The actual Viewer must admit the
Open candidate; only its exact accepted token updates the host filename. The
module callback onAccepted(snapshot,candidate) supplies that accepted copy;
existing one-argument callbacks remain valid. Host guards do not change the
module prepareOpen API, file schema or native dirty/download semantics.

CAD/Feature mode navigation retains both host sessions. This protection covers
canonical Open/New sample. Feature-graph replacement and durable autosave, crash
recovery, OS unload interception and verified disk storage are separate tasks.

The supported desktop workspace minimum is1000x700 CSSpixels. At this compact
size, File/Open/Download, the tree, scrolling Inspector/Apply/Discard and footer
Unsaved changes/Draft pending state remain reachable. Below this minimum and
mobile support are unclaimed. The focused flow also observes1440x960.

```sh
node apps/cad-editor/flows/unsaved-replacement-flow.mjs --headed --port 52028
node apps/cad-editor/flows/unsaved-replacement-flow.mjs --compiled --port 52029
```

Selected extrusion properties shows current/refresh task status. Exact accepted
revision/output binding remains in Help/details and full typed records, with
Construction volume estimate and Geometric centroid terms unchanged.


## Inspect original Curve length

Select a named Curve and choose Length estimate in Analysis. Full curve is the
default. Parameter interval exposes Start and End in the original knot domain.
Inspect explicitly reads the accepted original native Curve. Reset interval
retains the extent choice and restores original bounds without calculating.
Typing and Tab do not calculate; Enter outside composition or Space on Inspect
can run the query. Invalid interval/profile input keeps raw text and native data.

Main values are Estimated length and Estimated error in mm. A small positive
estimated error uses scientific notation rather than apparent zero. The error
is a local numerical estimator, not a certified global upper bound. Help and
Details retain native limits, original source/reference/options/panels/guards
and full work/quality report. Length supports degree1..3; wider D2/curvature and
new native source-Curve writers do not imply wider length or Curve editing UI.
Zero speed and recorded C0 guards are valid length cases. Surface area/mass and
Curve pole authoring remain separate.

Optional onLength callbacks receive copied full native records or null. Existing
onAnalysis records remain unchanged. Native/body/raw/extent/mode changes clear
length; camera/display-only changes retain it. Pending/active pure reads use
accepted data. Surface edits/history and native-file replacement refresh current
references; this property does not add a Curve editing transaction. Existing
unsaved replacement decisions apply to Open/New. Desktop minimum1000x700 and
ordinary1440x960 access are observed by the same focused flow, not mobile proof.

```sh
node apps/cad-editor/flows/curve-length-flow.mjs --headed --port 52030
node apps/cad-editor/flows/curve-length-flow.mjs --compiled --port 52031
```

Native author completion, sole Integration adoption, later integrated checks and
publication remain separate. No new engine/dependency or broad suite follows.


## Manual accepted recovery copy

File → Recovery copies stores one applied native document in IndexedDB in this
browser/profile/origin. Save current copy is manual. Pending fields are excluded
without applying or discarding them, and later edits are newer than the captured
copy. Replace/Delete require confirmation. Storage Save does not change native
dirty/history/download status or the private native download capture.

Open copy requires drafts to be resolved, uses the existing unsaved replacement
decision and passes the complete candidate through the actual Viewer gate. Only
the accepted Open token changes the filename or recovery provenance. A copy made
with unsaved accepted changes remains visibly unsaved after reopening, although
the native Open correctly reports dirty=false. A successful native Download or
an ordinary accepted Open clears that host provenance. Failed Download/Viewer
operations retain it. Stored camera/selection/history/raw drafts are not restored.

The app-owned version1 envelope uses actual CAD serialize/parse and complete
Source0; native text2MiB bytes/code units, envelope16MiB, filename1..512 and
1..4 unique displayed body IDs. Same-transaction compare/get/put/delete protects
a stale copy in another tab. Read/confirmation/Open rechecks use actual storage;
BroadcastChannel messages are hints. Unknown/corrupt strings remain until an
explicit replacement/deletion. Unsupported non-string slot values stay unreadable
and cannot be overwritten or deleted by this version. No silent migration.

A completed browser transaction and normal persistent-profile close/restart are
separate from disk, power-loss/crash, eviction, private-browser or cloud guarantees.
No autosave/unload worker/backend/dependency/root API is added. Cancel is blocked
only while a storage mutation settles; asynchronous Open verification can be
cancelled. Help preserves the task and returns focus to Help.

```sh
node apps/cad-editor/flows/recovery-flow.mjs --headed --port 52032
node apps/cad-editor/flows/recovery-flow.mjs --compiled --port 52033
```

The focused flow uses real IndexedDB and dedicated persistent Chromium profiles,
actual controlled transaction abort/stale mutation/Viewer refusal, genuine native
Download/fresh Open/re-edit and minimum1000x700 task focus/layout. Controlled abort
does not prove physical quota exhaustion, security denial or crash durability.
Native author completion, sole Integration merge and later integrated checks are
reported separately. Feature-graph recovery and automatic recovery remain gaps.


## Canvas Curve pole authoring

Open a native file and explicitly choose Curve focus when its complete original
Curve needs the degree1..5 route. Retain one to four document-view choices.
Select a named Curve, choose Point, and use XYZ(mm)/Weight or drag a visible
control point. Focus Curve shows one original Curve with its complete source
retained; Return to document view restores the current accepted document subset.
Surface editing continues in document view.

A point drag uses the camera-facing plane through that original coefficient.
Move shows a pending handle/control-polygon ghost; native Curve waits for
PointerUp's actual engine/view admission. One accepted drag creates one Undo
step. Escape/pointercancel restores only the gesture's draft/previous selection;
existing raw edits must be applied/discarded before dragging. Typed numeric
fields remain useful for exact coordinates and weight. Typing/Tab/composition
does not apply. Invalid native or view input retains original/native/history/raw.

Focused whole source1..4objects/65536bytes+codeunits, count65, IDsASCII1..64 and
actual scaled samples<=1000 sceneunits are supported here. Larger native
16object/262144 sources and simultaneous mixed focus are tracked gaps; source
is never extracted/clamped to manufacture support. Focused receipts truthfully
have documentnull/bodyreceipts[] and separate actual native qualification.

Native Download/fresh picker Open/re-edit and manual recovery retain full
original sources/siblings/-0/IDs/names. Recovery version1 excludes focus; the
host can explicitly choose incoming focus without changing stored raw.

```sh
node apps/cad-editor/flows/curve-pole-flow.mjs --headed --port 52034
node apps/cad-editor/flows/curve-pole-flow.mjs --compiled --port 52035
```

The flow uses original quartic/quintic mixed assets, actual point mouse drag,
real focused GPU/Viewer/native/file/refusal/return/recovery and minimum1000x700
controls/Help/footer. Canvas Surface dragging, axis Gizmo, snapping/live shape
preview and full Autodesk/Plasticity-level modeling remain planned required
product work. No broader profile/device/numerical/durability/commercial parity
is certified by this bounded native workflow.

## Solid Split route

Open `#/solids/split` for the authentic translated-strip constant-Y sample. The
route starts with the complete original Body; Split shows both children in one
explicit legacy WebGL2 canvas. Previously visited app sessions remain mounted.
The fixture is 8,240 bytes, SHA256
`b558f2f4bb29d97080032e74c1839e75558c3a04bd28c8966ecad5d5b0910a56`.

Bounded CPU/controller verification uses
`node apps/cad-editor/flows/solid-split-workspace-flow.mjs --controller --evidence <directory>`
followed by ONE serial `--native` run, never automatic reruns. Before native
execution, complete Editor type-check/library build, app build, changed-file lint
and emitted React/type smoke. Admit at least 500,000,000 free disk bytes, cap Node
heap at 2,048 MiB and the complete process tree at 60 minutes. The run budget is
four native parses, one cut edit/additional split, two explicit serializations
and ten complete-Body meshes across initial/first Split/Undo/Redo/cold Open/edit.
The harness records phase timing and partial receipts; timeout means incomplete.
Controlled renderer receipts establish call order, not physical pixels.

External visual checklist (not replaced by CPU tests): original Body → both
complete children with shared depth; qualified Body/Face tree and approximate
canvas selection; Fit original/pair/selected; Undo original and Redo pair; actual
native download → fresh file picker Open → Cut Y 3→4 → second download; dirty
replacement cancellation; hidden-route draft retention; viewport resize; context
loss and explicit fresh-canvas recovery; repeated mount/dispose. Canvas cut grip,
general-cut capability and commercial completion remain outside this increment.

## Primary CAD command workspace (#1943)

Open `#/model`. The primary route now gives the real viewport a persistent central
area, with a model/feature Browser and Create / Modify / Inspect / File groups.
For the representative workflow, choose **Create → Modeling examples → Resize a
constrained plate**, acknowledge replacement and **Load example**. Select **Sketch
01**, then **Modify → Edit dimensions**. Stage width `40`, **Apply dimensions**,
then **Undo**. Accepted native state changes only through the existing controller;
Cancel/Escape discards, a refused edit retains its draft, and opening a different
drawer does not silently discard it. Options close only after the current Apply
succeeds. The viewport and worker remain mounted across these UI operations.

File/STL, output-view choice, finishing configuration, selected-face evidence and
native limits remain accessible in their command drawers. Direct Curve/Surface,
Boolean and other retained routes are not converted to this modeling schema.

Local focused runtime check (application tests are local/Execute Tester under the
current CI policy):

```sh
node apps/cad-editor/flows/modeling-workspace-flow.mjs
```

This jsdom flow mounts actual React controls and exercises the real modeling
serializer/controller/CPU receiver. It explicitly mocks provider, Worker and
display boundaries, replaying the retained genuine constrained-plate baseline;
edited geometry is a fixture substitute, not new native evidence. Physical layout,
GPU pixels, actual file chooser/download and keyboard behavior still need the
existing Execute Tester on an exact adopted build.

### Author a new rectangular part

In `#/model`, **Create → New rectangular part** accepts your width, profile height
and thickness (32×24×8 mm by default). Inspect the authored source, then choose
**Replace current model**, or **Create part** if no document is accepted. Existing
model drafts must first be applied/canceled in their own editor. Replacement is
explicit and starts a new document history; it does not save the old document.
Cancel/Escape preserves the current document. Native/display refusal keeps it
visible and leaves creation settings available for correction.

Edit the resulting named dimensions or select Extrude 01 → Edit extrusion to
change thickness; existing Apply/Undo/Redo and Save/Open remain available. File
Download model saves accepted values, so apply desired edits before downloading.
Local focused runtime check: `node apps/cad-editor/flows/modeling-new-part-flow.mjs`.
It uses actual React/controller/receiver paths with explicitly mocked delivery and
baseline geometry reuse, not a new native or physical-browser campaign. Track the
exact-source creation/file acceptance in [#1951](https://github.com/barocss/barocss/issues/1951).


## Selected rectangle Sketch command

On `#/model`, select an accepted rectangle Sketch and choose MODIFY → Edit
sketch dimensions. Only that profile's direct named Min/Max coordinate drivers
are shown; sharing remains global. Apply sketch dimensions admits the candidate,
Cancel/Escape preserves accepted geometry, and unrelated drafts stay in the
model-dimension editor. Literal/derived terms are read-only. Other profiles keep
their existing model-dimension controls.

Run the focused local app contract with installed dependencies:

```sh
node apps/cad-editor/flows/modeling-sketch-command-flow.mjs
```

The flow uses actual React/controller/serializer/receiver code with a controlled
provider/Worker/display port and retained #1835 baseline geometry. New authored
variants and edited displays are mocked, not fresh native/GPU evidence. Exact
case counts, first failures and physical limits are recorded under
`flows/fixtures/modeling-sketch-command/verification.json` (#1957).


## Accepted versus pending model files

FILE → Save or open a model shows pending dimensions beside their accepted
values. Download accepted model saves only accepted intent; Review dimensions
before saving preserves the draft for an explicit Apply/Cancel. Clean documents
keep Download model. Staged file text is not downloaded or opened implicitly.

Run the bounded local save contract with installed dependencies:

```sh
node apps/cad-editor/flows/modeling-accepted-save-flow.mjs
```

This uses actual React/controller state and controlled Blob/anchor/URL APIs to
check bytes, stale callbacks and owned cleanup. It is not a physical browser
file-picker/download result; #1958 retains that separate acceptance status.


## Normal-command L plate authoring

CREATE → New rectangular part (32×8×8), Add rectangular arm (0,0;8×24),
MODIFY → Union bodies, then Cut rectangular through-slot (16,2;8×4).
Each structural command has separate temporary fields, explicit output targets,
Preview operation, Apply operation and Cancel. Preview retains accepted history
and file bytes. Structural Undo/Redo restores full authored intent. Pending model
dimensions are never silently applied or discarded; shared thickness is explicit.
The composed Cut requires an omitted extrusion start and thickness8; unsupported
coordinates/native topology/complete packet budgets refuse without replacing work.

Run only the focused local app flow (not PR CI runtime tests):
`node apps/cad-editor/flows/modeling-structure-flow.mjs`.
It uses actual React/controller/serializer/receiver paths with controlled Worker,
provider/native validation and renderer boundaries. Retained geometry/context
adaptation does not establish newly measured native output, pixels or physical
files. #1960 records finite counts, first failures and its separate device gate.
