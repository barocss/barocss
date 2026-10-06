## Default example gallery

The loopback root now shows only a canvas and an Example selector. Existing GPU
sphere, box and combined scenes, the original native six-face box, and current CAD
surface fixtures are available in one list. All gallery examples support mouse orbit. GPU SDF scenes opt into the strict
presentation camera; callers without a camera keep the original fixed view. Selection creates an owned view
and disposes the previous renderer/context; errors keep the previous view.

The existing CAD workspace and its editing/inspection/project/history tools remain
at `/workspace.html`. The gallery adds no new grammar, geometry, project schema or
Box authoring tool. Actual browser checks are in `gallery-browser.mjs`.

# Native CAD to GPU preview

This local consumer imports the built private `@barocss/cad` and
`@barocss/gpu` ESM APIs. It creates no new package.

## Run

From the repository root:

```sh
pnpm --filter @barocss/cad build:library
pnpm --filter @barocss/gpu build:library
node examples/cad-preview/server.mjs
```

Open the loopback URL printed by the server. Select a fixture, edit its model
source, then apply it. Grid counts, scene scale, scene translation and color
are host controls. Source text is parsed as the bounded CAD grammar. It cannot
provide scripts, callbacks, shaders, imports or remote resources.

The quarter-cylinder source has radius 10 mm and height 30 mm along Y. Its
control points are authored in these axes. GPU applies no geometry rotation; camera controls change only the view. The other
fixtures are an asymmetric plane with U domain `[-2,3]` and V domain `[4,6]`,
and a rational nonplanar patch. The supplied control-point and rational-weight
edits change actual native geometry. A grid edit changes only its preview.

## Data and units

1. Source text creates the native NURBS model in millimetres.
2. CAD evaluates the selected surface on a U-major grid. It produces packet v0
   and a finite sampled approximation report. Preview normals average incident
   triangle normals; they are not exact NURBS derivative normals.
3. Both CAD and GPU validate the actual generated packet. The host specifies
   `mmToSceneUnit` and translation in scene units. No unit is inferred and no
   camera fitting occurs. Canonical model and packet coordinates stay in mm.
4. GPU renders the packet with its default or explicit mesh camera and fixed shaders. The application
   adopts source, model, report, packet and revision only after success. A
   rejected candidate retains the previous accepted state and usable frame.
   Context loss makes the preview explicitly unavailable.
5. IGES comes from the accepted native model, not from preview triangles. It
   describes open geometry and is not a manufacturing solid.

The report checks five points per mesh cell. `maxSampledDeviationMM` is the
largest measured distance at those probes. `certified` is false. The report
does not establish a global error bound, exact normals or export compatibility.
The existing independent OCP exchange consumer remains the exchange gate.

## Verify and retain evidence

```sh
node examples/cad-preview/test.mjs
PW_DIR=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node examples/cad-preview/browser.mjs
BAROCSS_CAD_PYTHON=/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/bin/python pnpm --filter @barocss/cad test:exchange
```

The browser runner retains artifacts outside the checkout: authored source,
native model, actual generated packet/report, explicit options, native IGES,
actual framebuffer PNG, fixed shaders and backend metadata. Its manifest pairs
each accepted revision with hashes and the exact task or merge SHA. Capture
timestamps and backend metadata can vary; native source replay is deterministic.

Browser controls compare real pixels after source, rational-weight, grid and
scene-transform edits. They also check rejection preservation, context loss,
resize, repeated updates and owned-resource disposal. Software WebGL proves
functional composition. It does not measure physical GPU performance.


## Inspect the same geometry

Front, side and oblique buttons set explicit camera poses; reset removes the
optional camera and restores the original fixed view. Eye/target and near/far
use scene units. Up is a dimensionless direction; FOV uses degrees. Invalid
axes, optics or a failed candidate retain accepted view metadata and usable
pixels. No camera fitting, picking, animation or geometry transform is added.

A camera action calls the GPU with the accepted packet. It performs no CAD
parsing, tessellation or IGES export. Source/model/packet/report/IGES and model
revision stay unchanged; successful view events have a separate `viewRevision`.
Source actions retain their model revision contract and also record the new
accepted view. Display controls do not imply view-dependent native exports.
The browser capture records model/view revisions and explicit camera options
alongside actual readPixels, world-normal shaders and backend metadata.

## Explicit construction source

Select **1 · construction** or a construction example to use the built
`compileCadModel(source, {sourceVersion: 1})` API. The default **0 · native model** uses the same API with `sourceVersion: 0`. Compilation returns owned AST, semantic IR, native model and structured diagnostics. A rejected compilation does not replace the accepted preview.
Version/source mismatches reject; there is no detection or parser fallback.
Accepted version0 snapshots retain their original fields. Version1 snapshots
also retain `sourceVersion`, copied `constructions` and `selectedConstruction`
(output ID, input curve ID, operation, vector and source/reference spans). Native
model and preview packet versions remain0. Selecting the input curve as a surface
is rejected. Changing the version choice adopts data only after successful draw.

The construction cylinder is a rational XY quarter-circle of radius10mm extruded
along canonical Z by30mm. The asymmetric fixture extrudes a degree-one rational
curve with nonuniform U knots by[3,-2,7]mm. Source coordinates are never rotated.
The view uses explicit scale/translation and an oblique camera. Vector and rational
weight buttons edit actual construction source; applying edits preserves the chosen
camera. Camera actions retain all construction/native/export provenance.

Extrusion yields open surfaces, not caps, topology or a closed solid. A construction
may compile yet have a singular/folded preview; tessellation rejects invalid triangles
or cancelling incident normals. A failed compiler, preview, camera or GPU candidate
retains the last accepted source, operation, geometry, export and usable frame.

For one exact committed checkout, set a fresh evidence directory for the browser and
exchange runs below. The exchange command requires that exact browser capture: no
stale or missing-artifact fallback. Reuse installed Chrome/Playwright/OCP.

```sh
export BAROCSS_CAD_PREVIEW_BROWSER_EVIDENCE=/absolute/fresh/evidence-directory
node examples/cad-preview/test.mjs
PW_DIR=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node examples/cad-preview/browser.mjs
BAROCSS_CAD_PYTHON=/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/bin/python node examples/cad-preview/exchange.mjs
```

The gallery links accepted source, operation/native/preview/view records, actual PNG
and selected native IGES. Independent OCP reads those captured/downloaded bytes as
one intended open entity128 surface in MM scale1. It compares17×9 samples with
accepted native positions and a separate rational-curve affine formula; selected
analytic/reader limits are1e-9mm/1e-7mm. These checks do not certify global accuracy.
The exact known C0 continuity warning is allowed only for the asymmetric degree-one
fixture with its interior knot; warning and degree/knot multiplicities are retained.
Other diagnostics fail. No healing or tolerance override is applied. Wrong-export
and changed-pole controls must fail independently. Module/artifact hashes and HEAD
link the captured pixels and exports to this checkout. Software WebGL2 evidence
does not establish physical-GPU performance or manufacturing fitness.

## Accepted native object inspector

The object list comes only from the last successful native model, with at most16
rows. **Inspect** is read-only for curves and surfaces. It reports degrees, original
knot domains/counts, pole counts, weight range and native control-point bounds inmm.
Construction outputs retain their actual input/output/operation/vector/source-span
record; objects from source0 are marked native-v0. Inspected and displayed IDs are
separate. The control-point bounds and displayed sampled preview-mesh bounds are
labelled separately; neither is a tight surface extent or certified tolerance.

**Show surface** selects a supported surface from the accepted model. It reuses the
accepted source/version, grid, display and camera options through the existing
transactional pipeline. Pending textarea/version/grid/display values are ignored.
The original manual Surface ID and Apply source controls remain available. Curve
inspection performs no CAD calls and keeps the displayed packet, export, pixels
and revisions unchanged. A successful Show action uses the existing Apply model
and view revision semantics; a camera action still advances only view revision.
Failed selection retains the accepted list, inspector and usable frame. Successful
source changes reconcile the inspected ID to the newly displayed supported surface.
Lost/disposed contexts disable object actions and retain explicit unavailable state.

The Objects examples contain native curves arc/polyline and surfaces wall/oblique_wall.
The native-v0 example authors both surface nets directly; the construction-v1 example
uses the two original curves and explicit extrusions. Select the second surface and
return to the first to compare actual pixels and selected IGES identity. Safe text
properties render IDs/labels; no object metadata provides HTML or code. No picking,
source editing grammar, derivative normals, topology or new engine API is added.

Browser evidence retains six additional multi-object selected/replay frames with
inspected/displayed IDs, object summaries, native/source/feature hashes, actual PNG
and downloads. The same current-HEAD captured-export gate independently reads the
selected entity128 bytes for both source versions. Native-v0 analytic fixture
descriptors are test oracles, not invented construction history. Selected checks
still use153 parameter samples/export and1e-9mm analytic/1e-7mm reader limits.
Wrong same-type surface exports and the prior wrong-curve/pole controls must reject.
All prior source/view/lifecycle and exact module/artifact hash gates remain required.

## Numeric construction parameters

The panel targets only the accepted displayed source-v1 extrusion and its input
curve. It shows the input/output IDs, vector inmm, input weight index/value and
all outputs sharing that curve. Read-only inspection does not retarget the panel.
Native-v0 and nonconstructed data show an unsupported-panel state.

Apply numeric parameters generates explicit canonical source in the existing
construction grammar. All original declarations/IDs/order and unedited native
values are retained; source comments/formatting and feature spans are replaced.
The shortest binary64 decimal is expanded when necessary, preserving values and
negative zero without fixed precision, locale formatting or clamping. Generated
UTF-8 source must fit256KiB. Unknown or unrepresentable provenance rejects. A
weight edit changes every derived output sharing that input; unrelated curves
and other feature vectors remain intact.

Source stays authoritative. Numeric actions reuse the accepted selected ID/grid/
camera/options through the existing compiler, tessellation and transactional GPU
pipeline. Generated CSS replaces the editor only after success. If the raw editor
differs from accepted source, first explicitly Apply source or Discard pending
source; numeric actions never silently discard pending text. Empty/nonfinite input,
bad index/weight, singular/native/compiler or GPU failures retain accepted state
and usable pixels. Camera/inspection actions still perform no CAD recomputation.

The browser gate enters vector and weight numbers through actual controls and
retains requested values, generated accepted source/native/feature spans, packet/
report/view/pixels and selected download hashes. Independent OCP compares those
actual edited files using the same rational/affine selected-fixture position limits.
Shared-input propagation, mixed updates, pending source protection and existing
object/view/resource/context-loss gates remain required. Canonical generation is
private example code, not a public serializer, new parser/operation or geometry
model. Surfaces stay open and software pixels do not establish manufacturing or
physical-GPU guarantees.

## CAD workspace layout

The topbar identifies the actual accepted scene and selected native export. The
central viewport and camera poses remain visible on desktop; object navigation
is on the left, native properties/history and typed extrusion controls on the
right. On narrow screens the viewport comes first and panels stack without
horizontal scrolling. Only implemented controls are shown.

Source, grid/display, camera optics and raw diagnostics use keyboard-operable
details. The Source button opens the editor and focuses it. Inspection/Show
buttons restore focus to their native row after a list rerender. Removing an
object moves focus to the object heading. Lost contexts disable unavailable
actions. Live status and the pending-source label distinguish accepted geometry
from unsubmitted text. No raw source is automatically discarded.

Scene properties use the actual inspector fields. Display-only numbers use four
significant digits; raw inspection/source, numeric input, geometry and IGES retain
full values. Native-v0 is direct authorship; construction history comes only from
accepted records. Control-point and sampled mesh bounds remain distinct and are
not presented as tight extents or certified accuracy.

The browser gate captures full-page1440×900 and390×844 before/after UI screenshots
from committed baseline/current checkouts, separately from actual readPixels. It
checks first-screen viewport/core actions, overflow, labelled/unique controls,
keyboard collapse/focus and accepted labels during source rejection, then retains
all original numeric/source/selection/view/download/lifecycle/OCP gates. The
`ui-workspace.json` records screenshot hashes, exact SHAs, dimensions/backend and
baseline native/framebuffer identity; current package/host module hashes remain
in index.json. Use a fresh evidence directory for each exact pre/post run.

For baseline screenshots, build both packages in the clean baseline checkout,
then use the installed browser/runtime with:

```sh
PW_DIR=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node examples/cad-preview/screens.mjs /absolute/clean/baseline /absolute/private/baseline-evidence 3b5e3acbf9fdb902d2d1381809e7e4edebd2a203
```

Set `BAROCSS_CAD_PREVIEW_BASELINE_UI` to that baseline evidence directory for
browser.mjs (default private path is the recorded #513 baseline). Screenshots
show actual software-WebGL geometry; they do not replace native/selected-export
checks or imply physical-GPU performance or manufactured solids.

## Mouse camera orbit

Drag the viewport with the primary left mouse button to rotate the accepted
camera around its existing target. Distance, up direction, FOV and near/far
remain unchanged. Pitch movement stops short of a singular up axis. Mouse orbit
calls the existing validated camera transaction; it changes only view revision,
not CAD source, native geometry, packet/report, model revision or selected IGES.
Presets, reset and explicit camera inputs remain available.

Pointer capture keeps a drag active outside the canvas until release. Cancellation,
window blur, context loss, disposal or another accepted source/view action ends
the gesture. Invalid/out-of-bound camera candidates retain the accepted view.
No inertia, timer, zoom, pan or touch-scroll interception is added.

## Create dimensioned open surfaces

Choose Sheet or Quarter-cylinder wall in Create, enter width/radius and extrusion
height in native mm, then click Create. Dimensions1..300mm are explicit tool
limits and accept decimals without rounding/clamping. Sketches lie in XY and
extrude along+Z. A sheet uses a degree-one line; the quarter wall uses the stored
rational quadratic arc weightMath.SQRT1_2. Results are open surfaces, not capped
solids or whole circles. Existing source-v1 remains visible and authoritative.

Create uses deterministic tool settings: mmToSceneUnit0.01, explicit centre
translation computed from those dimensions, fixed oblique camera and documented
grid. This is tool initial placement, not generic geometry auto-fit. Update
dimensions preserves the accepted camera/grid/display and replaces only a matching
tool-owned source. Other successful raw/fixture/typed/selection replacements
invalidate primitive provenance; readonly inspection and orbit keep it.

Typing only stages values. Apply or discard pending raw source before Create or
Update. Invalid dimensions, unavailable contexts, ownership mismatch or failed
GPU candidates retain accepted source/native/pixels/export/provenance. After
success the actual accepted generated source and displayed dimensions are shown.

The browser gate creates both defaults and performs two entered decimal updates
per shape, orbits, and downloads six actual current selected surfaces. Separate
primitive receipts/source/native/feature/packet/view/readback/module/HEAD records
feed independent line/rational-affine OCP controls at153 parameters/export with
unchanged1e-9mm native/1e-7mm reader limits. Desktop/mobile screenshots and repeated
create/update resource checks are retained alongside all prior regression gates.


## Local projects

Save project downloads `accepted.barocad.json` with the accepted native source, selected
surface, grid and display options. Staged source and numeric fields are not adopted by Save.
Open uses a local file input; apply or discard pending source before opening. Files are bounded
at 300 KiB UTF-8 and source at 256 KiB. Invalid data or failed rendering retains the accepted
scene and staged fields. Format/version, own fields, finite settings, native source and selected
surface are checked before a single renderer transaction. No authored code or URL is executed.

Tool-created sheet/quarter-wall dimension hints restore Update only when canonical source and
IDs match exactly. Manual projects retain native geometry without claiming tool ownership.
The data serializer preserves binary64 settings, including negative zero. Project files contain
no cached geometry certificate or revision. IGES remains a separate original native export;
project files are not STEP, IGES, BREP or shared-topology exchange.


## Modelling history

Undo and Redo retain at most 20 accepted document states, bounded to 8 MiB total and
300 KiB per serialized project. Source, selection, grid, placement and tool dimensions
belong to a state. Current camera settings are retained during restoration. Typing,
inspection, camera gestures and Save do not enter history. Apply or discard pending source
before restoration. A successful new modelling change truncates Redo; rejection preserves it.

History records completed outer actions only. New documents are preflighted before GPU
adoption; restoration uses one validated project load with new revisions and the existing
renderer. No historical native/GPU handles, cached certificates or old revisions are restored.
Saved project files still contain only the current accepted document, without history.


## Whole-box transfer consumer

The separate test consumer builds one source-v0 Model with six named native surfaces,
validates six independently owned face bundles and the restricted shell/solid, then calls
native tessellation for each 2×2 face. The existing packet-v0 has 24 vertices/12 triangles,
with local UV ranges and per-face normals retained at duplicated crease corners.
`box_view` is a derived mesh identity, not a native Surface or single-Surface project.

The owned consumer canvas never adopts the application document. Explicit fixture options
control scale, translation and camera; there is no geometry auto-fit. Retained source/native/
solid/per-face/composite/range/pixel hashes and thirty separate original face exports feed
the independent installed reader. This adds no Box UI, file-v2, packet protocol, whole-solid
IGES action, STEP, general-solid certificate or hardware performance claim.

### Separate source2 parameter consumer

The browser verification also compiles the original source2 named-length/scalar
fixtures, tessellates their native surfaces, draws four real framebuffer states,
and reads the exact selected IGES files with the installed independent OCP reader.
AST/IR2/native0/packet0/source/PNG/file hashes are retained. Width edits from
10cm to12cm resolve to100mm and120mm, including the dependent height expression;
rational radius/height controls use the same original compiler and math.
This is a separate test canvas. The current application and project version1
continue to accept only source0/1; this task adds no parameter editor or file schema.

## Box authoring prototype

Choose **Box workspace · Create / Edit** from the default Example menu, or open
`/workspace.html#box`. The existing surface tools remain at `/workspace.html`.

The Box tool creates one editable native rectangle/extrusion part. Sizes are integer
millimetres from 1 to 300; XY origins are integer millimetres within ±300. Create and
Update center and fit the native geometry through explicit host display options.
Mouse drag changes the view; the native document stays unchanged.

Save writes the accepted `barocss-axis-rectangle-feature` version 0 authoring intent
as `body.feature.json`. Open evaluates that intent again and rebuilds the six native
faces. Pending dimensions are not saved. This is separate from legacy surface
project1 files; it does not store mesh caches, body history, or whole-solid interchange.

Prototype verification is the short `model-smoke.mjs` browser run with
`PW_DIR`, `CHROME`, and a fresh `BAROCSS_MODEL_EVIDENCE` directory. Broader numerical,
file/resource/compatibility and whole-browser validation is deferred.

The Box prototype defaults to **Original CAD edges**. Its twelve global edge paths
come from qualified native shell/face/curve data, without triangulation diagonals.
The toggle is a view action and is not saved in the feature document. Surface tools
have an **Edges** control for their four original natural parameter boundaries,
sampled at the accepted grid count with at most 64 points per path. This is not
arbitrary trimming, silhouettes, picking or a complete hidden-line drawing system.
Run the same short browser demonstration with `model-smoke.mjs --edges` for actual
native-path/toggle/orbit/rear-occlusion/stale-packet prototype evidence.

## Additional shape previews

The root Example menu includes GPU Sphere, native Triangle/L filled regions, and
native Triangle/L capped prism previews. The Box workspace's **Preview shape**
menu links directly to these views. Native polygon examples call the actual region,
triangulation and prism APIs; the L has area7mm² and its6mm prism has volume42mm³
and area110mm². The missing concave quadrant remains empty in the real top view.

Sphere uses the existing own GPU source compiler/SDF renderer. It is not represented
as a CAD B-Rep sphere. Polygon/prism packets are prototype displays, with no generic
solid/topology or interchange certification. Root stays canvas plus Example.

## Editable polygon prism

Open `/workspace.html#polygon-prism`, or choose **Polygon prism · Create / Edit**
from Example. Create a Triangle or L preset, edit numbered integer X/Y rows and
Height, then Apply. Add/remove vertices within the native 3–63 range without
reordering or silently closing the profile. Invalid input retains the last prism.

Save downloads the original `barocss-xy-polygon-prism-feature` format0 intent in a
`.barocad.json` file. Open uses the native128KiB/duplicate-key parser and rebuilds
before adoption. This is separate from Surface project1 and rectangle feature0.
Metrics describe the closed preview family, not a certified B-Rep solid. Camera,
mesh caches and general history are not stored. The short actual workflow is
`polygon-workspace-smoke.mjs`; comprehensive regression remains deferred.

## Original native topology displays (prototype)

The root canvas + Example menu now includes:

- **CAD · Original L shell + edges** at `/#cad-native-l-shell`. The actual original
  polygon Curve builds a native shell; its owning cap/wall Surfaces and D1 values
  produce the displayed36 vertices/20 triangles. All18 global edge paths come from
  qualified native Curves; cap diagonals are not supplied as CAD edges.
- **CAD · Planar face with hole + edges** at `/#cad-native-hole-face`. The actual
 10x10 outer and4x4 inner profiles build one two-loop native face. Its actual
  Surface/pcurves and slab connectivity produce16 vertices/8 triangles, area84mm²,
  and8 original outer/hole boundary paths. The cutout remains empty; slab seams
  are not displayed as CAD edges. This is a planar face with no thickness.

Fill and existing MeshEdgeOverlay0 use the same complete packet, centered mm
placement, camera and depth. Both examples show original edges by default. Drag
orbits the camera; authored/native data, packet/revision and edge provenance stay
unchanged. Candidate preparation and renderer mount finish before view adoption.
Invalid packet/path/complete binding retains the prior renderer/frame. Snapshot
exports own copies of actual authoring/shell or face, consumer output, packet,
original paths/provenance, accepted overlay and options; no saved-file schema changes.

After affected CAD/GPU builds, run `native-topology-gallery-smoke.mjs` with existing
PW_DIR/CHROME and BAROCSS_NATIVE_TOPOLOGY_EVIDENCE paths. The short real gallery run
records native/source/packet/PNG/camera lineage, projected filled/empty controls,
outline off/on, stale same-identity packet rejection, orbit and Sphere reselect.
It also records GL errors and backend. No pointer selection, through-hole shell
raster, general geometric/topology/solid certificate or physical GPU performance
is claimed. Broader unit/packed/readers/package/workspace/gallery/numerical/resource
validation remains deferred under the prototype policy.

## Original through-hole shell display (prototype)

Select **CAD · Through-hole shell + edges** at `/#cad-native-hole-shell`.
The actual outer10x10 square/inner4x4 square first produce the native two-loop
face, then the original6mm through-hole shell. Its actual world cap/wall Surfaces
and D1 produce the577 packet64 vertices/32 triangles and24 original global Curve
paths. It is a distinct3D view from the planar hole-face example; both annular
caps retain the opening and actual inner walls provide the depth.

The existing complete-packet overlay uses the same centered mm placement, camera
and depth as fill. Original source/face/body/Surface/Curve identity, shell, packet,
face ranges and edge provenance remain in own snapshots. Mouse orbit changes only
the view. Root remains canvas+Example with original edges enabled and no edit or
selection controls. Existing L-shell, hole-face and authoring workspaces remain.

Run `native-hole-shell-gallery-smoke.mjs` after affected CAD/GPU builds using
PW_DIR, CHROME and BAROCSS_NATIVE_HOLE_SHELL_EVIDENCE. The short mounted-gallery
run records actual native/source/world Model/packet/overlay/camera/PNG lineage,
top filled/open/outside controls and an oblique inner-wall Surface/D1 point bound
to its native face range. It checks edge off/on, stale same-identity packet
rejection, orbit ownership, GL error0 and one hole-face reselect. Software backend
functional results do not establish physical GPU performance. Broader campaigns
remain deferred. Native geometricValidity:not-certified,topologyCertified:false,
solid:false persist; combinatorial closure/Euler0 is not a solid certificate.
No picking, document edit or saved-file schema changes are added.

## Editable cutout prism (prototype)

Open `/workspace.html#cutout-prism`, or choose **Cutout prism · Create / Edit**.
Edit both outer/hole profiles as explicit JSON integer XY pairs and Height in mm,
then Apply. At least3 vertices per loop, at most12 combined, coordinates±10000mm,
height1..10000mm. Both profiles are evaluated in one whole native transaction, so
moving them together does not pass through an invalid intermediate model. All six
intent IDs stay stable. Discard restores applied draft values. New square/Open
require Apply or Discard before replacing any pending input.

The real579 document API rebuilds profiles→native face→world shell→actual577 mesh
and original edges. A detached candidate renderer draws before the view/native
intent is adopted; invalid parse/native/packet/overlay/view retains accepted data,
camera and frame. Apply/Open retain the accepted orbit camera while fitting the
new actual packet. Edge toggle/drag change view revision only. Same-page workspace
switching preserves each tool's accepted state and drafts.

Save native intent downloads the accepted `barocss-xy-polygon-prism-hole-feature`
version0/mm `.barocad.json`; pending text, source/Model/topology/packet/revision,
metrics/camera/history are excluded. Open uses the actual128KiB/duplicate-decoded-
key parser and complete native evaluation before candidate adoption. Other Box,
single-loop or project formats are rejected without migration. Authored ordering,
CW/CCW and negative zero remain native intent. Net profile area and Reference swept
volume are construction metrics, not certified solid mass properties.

After affected CAD/GPU builds, run `cutout-workspace-smoke.mjs` with existing
PW_DIR/CHROME and BAROCSS_CUTOUT_EDITOR_EVIDENCE. The short mounted editor run
records actual downloaded bytes/Open, height/hole/whole-profile edits, original
IDs/source/world Models/packet/path/camera/PNG lineage, pending-draft gates,
invalid retention, edge toggle/orbit, projected open cutout and one polygon-tool
state-preservation visit. Broader suites and numerical/resource/performance
campaigns remain deferred; software backend pixels are functional evidence only.
Native uncertified/solid:false status persists; no picking/Boolean/feature-graph
or exchange capability is added.

## Original face selection (prototype)

The cutout workspace defaults to **Orbit**. Choose **Select face**, then click
material to select its original CAD face. A blue highlight, face role/ID, Surface
ID, native mm hit point and outward normal identify the accepted result. A miss
clears selection; ambiguous-nearest/coplanar shows real candidates and chooses no
single face. Clear selection restores fill. Orbit and edge toggle keep the native
identity; successful Apply/Create/Open clears stale selection, failed edits retain
it. Saved intent never includes selections, rays or highlights.

The host maps CSS coordinates to physical framebuffer pixel centers and unprojects
near/far OpenGL clipping points with inverse projection*view from the exact exported
Float32 camera matrices. It reverses the accepted mm mapping and sends only that
finite segment to the original581 shell query. Unsupported native ray bounds or
stale accepted/view/viewport bindings reject rather than clamp. The actual native
face/Surface resolves one exact577 face range for complete-packet highlight.

`cutout-face-selection-smoke.mjs` uses actual mouse events for top, void, outside,
inner-wall, orbit and resized view clicks, an odd-buffer supporting-plane ambiguity,
face-only/hidden-face pixel controls, stale/range/ray failures, edit clear/retention
and saved-intent exclusion. Use existing PW_DIR/CHROME and
BAROCSS_FACE_SELECTION_EVIDENCE after affected CAD/GPU builds. Exact ray/matrix,
query/native/range/packet/camera/PNG lineage is recorded. This is bounded display
selection, not certified manufacturing accuracy or general curved B-Rep picking;
broader numerical/resource/performance and compatibility campaigns remain deferred.

## Rectangle feature graph workspace (prototype)

Open `/workspace.html#rectangle-features`, or choose **Rectangle features · Create /
Edit**. The authored-order list retains native feature/body IDs and applied restricted
body volumes. Select a row to draft its existing rectangle/height reference or
suppression. Shared length rows edit literal or existing-parameter+offset definitions;
existing rectangle rows edit numeric coordinates/dimensions. Other admitted sketch
profiles stay read-only and remain in the saved graph.

Add generates fresh feature/body IDs on existing admitted inputs. Delete drafts one
feature. Apply coalesces each target once and uses the actual585 update or586 feature
lifecycle API for a whole native transaction. No intermediate graph is adopted.
Errors retain applied graph/geometry/camera/selection and the recoverable draft.
Discard restores applied fields. New/Open require clean drafts. Save downloads the
accepted native graph0 only; pending fields/source/Model/IR/mesh/selection/view data
are excluded. Native128KiB/duplicate-key parser rejects old/unknown formats.

Each active original555 body result supplies its actual six Surfaces to the existing
2x2 tessellator. Face-local vertices/normals/UV and vertex-offset indices are joined
into an explicit display packet, with qualified feature/body/local Surface/face and
source2/IR/body ranges kept separately. Existing bodyEdges consumes each actual shell
and its12 canonical original Curve paths bound to that complete display packet.
No independent display box, topology welding, Boolean union or assembly is created.
One camera and centered mm placement fit all actual body bounds; Apply/Open retain
pose and New resets framing. All suppressed means an honest empty canvas, no fake
packet/body; graph Save/Open and later unsuppression still work.

`rectangle-feature-workspace-smoke.mjs` after affected CAD/GPU builds, with existing
PW_DIR/CHROME and BAROCSS_RECTANGLE_FEATURE_EVIDENCE, runs actual native editor/file
flow:72/80→96/100→135/110, suppression/empty native file, fresh C165→rebound90,
deleteB, accepted-only download/Open and concrete invalid retention. It records
actual source/IR/native/face/body/packet/path/pixel/camera/file/PNG lineage, original
seeded separated-body material controls, edges/orbit and one cutout-return state
visit. Broader numerical/resource/performance/unit/packed/readers/workspace/gallery
campaigns remain deferred. This bounded graph consumer is not whole551 completion
or a combined solid certificate; software pixels are functional evidence only.
