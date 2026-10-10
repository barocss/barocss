# CAD Editor application

Private React/shadcn host for `@barocss/cad-editor`. Menus, project/document routes,
body tree, file picker, genuine download and canonical fixtures live here.
Reusable editing state, inspector and Viewer bridge live in the package.

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
