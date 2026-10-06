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
`compileConstruction` API. The default **0 · native model** uses `parseModel`.
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
