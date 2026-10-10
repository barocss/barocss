# Independent original source-qualified Faces

This bounded host submits public `loadQualifiedFaceScene` with2..6 independent
original Source0/forward Face assets, explicit camera, grid and scene translation.
Each complete Model0/mm file contains one Surface and four Curves. Repeated local
Face/loop/edge IDs remain qualified by sourceId A..F. No global Shell/Solid,
unqualified ViewerRef, source truncation or new topology construction is used.

Fixtures are copied byte-for-byte from the recorded original1072 inputs under
`evidence-qualified-face-scene-gpu/actual-flow-first`. The complete authored
requests preserve all six source/Face associations. Six original Source0 files
and the authentic edited F Source0 remain separate unchanged files:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| warped.authentic-request.json | 16612 | 8a442e2fec3c69b02e4bf4b29738e43ed5923607c6db55ef4cd6efc45aa698a4 |
| interior_edit.authentic-request.json | 16612 | 14a9dc3d457e756e40d422eb97d8b7bbbd7f8a1dd6cc5bbd1503f1a6d5bda515 |
| warped_A.source0.css | 773 | 9f75c6ddad305dc72dc4fc2eb76bb829e93751fb22d6e05e7866736608bdbf54 |
| warped_B.source0.css | 794 | 2bb4abf4f6c378a318c04a683d395c34617f1a127b3b3a6adde0dbcbb8bc9fd3 |
| warped_C.source0.css | 773 | 25c6b01d796eda77215ccf604d3a786dbc51104ee6258f41e58d61d2cf0d38e9 |
| warped_D.source0.css | 794 | b816382c441d516eafcd59cf7bb2f5b7c187d04e088d75a415541e9be68ba0b8 |
| warped_E.source0.css | 773 | ad81f4179fe973184f42b2af16984de7fdc88b719ef67cf76ba0889aaf4b7b76 |
| warped_F.source0.css | 794 | ea6b3d1bdaeaa4a4a94eb557ca2b700e2acb8f68e3427e1f09225650579c2f29 |
| interior_edit_F.source0.css | 794 | 7cb9ebdb1be95b85d77bbeeb441fbe0f2a517834dbc1db6e9675794b071be7e0 |

Startup preserves the producer's camera `[2,1.5,3.2]`,0.12scene units/mm,
global scene translation `[-.6,-.6,-.7]`, background `[.02,.03,.04]`, six assets
and17×17grid. Two-asset control admits original B/F. Color changes, reversed
order, count changes and authentic F interior edit submit complete candidates.
Source edit with previous Face intentionally demonstrates atomic mismatch
refusal, while retaining the old inspection. No producer flow or1057 topology
constructor is executed.

Rows inspect only the current accepted sourceId/whole Model/Face/Surface/UV
association. Native D0 at(.5,.5) is evaluated by public CAD under that explicit
source scope. The report is CPU source inspection, not GPU highlight/picking.
Successful scene replacement/Clear/Dispose clears it; failed candidates and
camera/resize preserve it. The host has no combined fit, legacy native metric,
picking/selection/motion/material/particle/cloth controls in this first profile.

The two point controls measure a source-qualified original Face Surface or
retained Curve through `measureQualifiedFacePoints`. Each point pins the current
sourceId, exact source text, Face/model/geometry IDs and original U/V or t.
The read-only result labels native points/distances in mm and converted points/
distances in scene units. It is a straight chord, not arc length or a certified
measurement. Source replacement/Clear/Dispose clears the report after success;
failure keeps it. Camera/resize leaves the report intact. Retained CPU sources
keep the Measure action enabled after context loss or presentation unavailability.
The existing source inspection remains separate; no native highlight is added.

After Measure, numbered sourceId/geometryId labels use copied point pins and
public `projectQualifiedFacePoint`. The mm chord label appears at the projected
midpoint only when both points are in view. Camera/backing resize and a
ResizeObserver update current canvas CSS coordinates without GPU writes.
Offscreen points remove their labels. Source/Clear/Dispose scope changes clear
labels and report after success; failures retain the accepted context. Loss or
unavailability removes display labels while keeping CPU measurement available.
Dispose disconnects the observer.

The canvas is borderless, padding-free and axis-aligned inside a relative
wrapper; the overlay has pointer-events:none. Contextual About screen labels
Help explains approximate binary64 camera mapping and not-tested occlusion.
A point covered by another Face can still have a label; this is no native hit
or rendered pixel/depth certificate.

Original Surface area inspection is a separate read-only report. Source choice
`#area-source` defaults to F; `#inspect-area` uses the example `surface-area.js`
helper with its frozen `AREA_OPTIONS`. It constructs a real ephemeral one-source
document from the complete unchanged Source0, creates a public native reference,
and completes public CAD area query/validation before adopting the result.
`#area-output` shows the source/Surface, native mm² estimate and heuristic error
estimate. Camera/mm scale do not rescale the original native area. Help states
whole parametric Surface rather than trimmed Face/BRep/union and no certified
upper error bound. A..D are planar controls; E/F are warped originals.

`#surface-area-label` projects the original parameter-domain midpoint through
1123, not a centroid or native visible hit. It reprojects on view/CSS/backing
resize. Accepted color/grid/order changes retain this independent area report;
original source/Face/model/content replacement or absent mode invalidates it.
Failure preserves the accepted area context. Retained Face CPU inspection stays
enabled after loss/unavailability while the area label is hidden. Clear/Dispose
clears area state, and the shared observer disconnects on Dispose.

Original Curve length inspection is independent from area and point reports.
`#length-source` defaults to F and `#length-curve` lists only current retained
native Curves, defaulting to c2 when present. `#inspect-length` uses the example
`curve-length.js` helper and frozen `LENGTH_OPTIONS` to construct a real ephemeral
one-source document, create a native reference and complete public arc query/
validation. `#length-output` shows the source/Curve, length estimate in original
mm and separately the endpoint chord in mm. The chord never substitutes the
derivative-based arc estimate. Native length does not depend on scene scale,
translation, camera or rendering grid.

`#curve-length-label` projects the midpoint of the measured original parameter
interval. This is not an arc-length midpoint, centroid or rendered Curve hit;
the Curve can remain CPU-only in the Face scene. Help explains the heuristic
error estimator, uncertified bounds and ephemeral wrapper. Camera/grid/color/
order/resize retain this report and refresh its label. Original source/Face/
Model/Curve kind or presence changes invalidate it. Failed query keeps accepted
context. Retained CPU inspection stays enabled after loss/unavailability while
the label is hidden; Clear/mode/Dispose clears state and the shared observer
disconnects on Dispose. The authentic F Surface interior edit changes the whole
source pin but leaves boundary Curve coefficients unchanged; it is not a Curve
edit or evidence that its length changed.

With Node22, ordinary development uses public package names through normal
source-default exports without aliases or custom conditions:

```sh
node examples/viewer-qualified-face-scene/server.mjs
```

Open <http://127.0.0.1:53180/>. The server bundles once, serves exact fixture
bytes and `/fixture-manifest.json`, and prints an input-audit summary. Explicit
compiled acceptance maps every transitive own public package entry/subpath
through complete `publishConfig.exports.import`:

```sh
VIEWER_QUALIFIED_FACE_COMPILED=1 node examples/viewer-qualified-face-scene/server.mjs
```

`/input-audit.json` requires own src with zero own dist in ordinary mode and
own dist with zero own src in compiled mode. Missing mappings refuse.
`VIEWER_QUALIFIED_FACE_PORT` changes the port;
`VIEWER_QUALIFIED_FACE_EVIDENCE` optionally records `/result`. Original mixed
Sphere/native, native panel, Shell graph, assembly revisions, canonical document
and uniform sources are served for root-owned transition tests. Held
`/slow-native.barocad` releases only after POST `/release-slow`.

The bounded Run proof records complete source/Face copies and actual native
one-scale/translation GL positions, normals and indices; authentic F edit
versus stale Face refusal; exact-input/getter/grid and late sixth-Face allocation
retention; inspection lifecycle; reversed order; camera/resize; two assets and
Clear. It preserves the first failure and accepted page state. It does not
automatically replay tests or dispose afterward. Full actual six-direction
pixel/shared-depth verification and old-mode/race/unavailable/loss gates are
owned by the main acceptance runner.

Order comparison checks a qualified interior F native point and records both
frame hashes. Touching equal-depth original boundaries can resolve color by
draw order under strict LESS; whole-frame hash equality is not promised.

`window.__viewerQualifiedFaceProof` exposes Viewer/current copied scene,
original requests/source files/raw bytes/manifest, `candidate(overrides)`,
`load`, `inspect`, `render`, native upload `witness`, `pixelInfo`, global seven
resource counters/readbacks/errors, allocation hooks and `dispose`.
`measurementInput(sourceId,geometryId,params)` creates the current exact pin;
`measure(first,second)` calls the public CPU query and displays its result.
The `measurementReport` getter returns an independent copy. The physical
Measure button is `#measure-points`; First/Second source/geometry/U/V/t labels
identify the two sets of controls.
`updateLabels()` refreshes only DOM annotations. `labelSnapshot()` and copied
`currentProjections` expose the accepted label context for the actual host flow.
DOM IDs are `#qualified-face-view`, `#measurement-labels`,
`#measurement-point-1`, `#measurement-point-2` and `#measurement-distance`.
Area hook members are `AREA_OPTIONS`, `areaPin`, `queryQualifiedFaceSurfaceArea`,
`inspectArea(pin?,options?)`, `updateAreaLabel`, `areaSnapshot`, and a copied
`areaReport` getter. Public CAD document/reference/area query/validation exports
are available in the same hook for the main runner's independent checks.
Length hook members are `LENGTH_OPTIONS`, `lengthPin`,
`queryQualifiedFaceCurveLength`, `inspectLength(pin?,options?)`,
`updateLengthLabel`, `lengthSnapshot` with nested label fields, and a copied
`lengthReport` getter. Public CAD arc query/validation are exposed for the main
runner's independent checks. All query reports remain caller-owned copies.
Public CAD `tessellateSurface`, `validateFaceBundle`, original evaluation, GPU
`prepareCamera`/qualified scene and renderer APIs, mixed/uniform/Shell providers,
Assembly/Model-set/document Loader and Physics cloth creation are available for
the root's independent controls. The loss extension is captured before loss.
No private renderer, framebuffer or hidden resource getter is used.

Native author, actual consumer verification, exact code merge availability,
later integrated checks and publication remain separate. No global closure,
manufacturing accuracy, persistent topology/picking, editor Save/Open,
performance or lost-handle deletion0 is inferred from these original inputs.

## Original three-point angle (#1141)

Choose three current original Surface or Curve points, then select **Measure
native angle**. The middle point is the vertex. The output shows the unsigned
angle in degrees. These are original native parameter points, not picked mesh
vertices. Each point keeps its complete source, sourceId, Face, Model, geometry
and parameter pin. The caller label sits at the native vertex; its CSS mapping
is approximate and does not test occlusion.

`queryQualifiedFaceAngle(viewer,first,vertex,third)` reuses two public native
point-pair queries. It checks repeated vertex bits, then normalizes the two
original mm vectors and uses atan2 of cross magnitude and dot product. Zero or
nonfinite legs, nonzero normalization collapse and nonzero multiplication
underflow refuse. Ordinary binary64 cancellation remains; there is no global
angular accuracy certificate. Radians, degrees, original points and leg lengths
are copied to the caller. This is not a screen, tangent, dihedral or Solid angle.

View, grid, color, order and CSS changes preserve the native report. Original
source or reference changes clear it. Failed queries retain the prior report.
Retained CPU authority can query after context loss or presentation failure,
while projection refuses and the label hides. Clear, mode change and Dispose
invalidate it. Existing distance, area and Curve length outputs are independent.

The hook exposes `queryQualifiedFaceAngle`, `measureAngle(first?,vertex?,third?)`,
`updateAngleLabel`, `angleSnapshot` and a copied `angleReport` getter. No SDK,
provider, package config, release or broad earlier campaign changes are part of
this example. The earlier #1080 transition anomaly remains separately pending.

## Original Curve curvature and local radius (#1145)

Choose a current source, original Curve and original parameter **t**, then select
**Inspect Curve curvature**. The output shows local radius in mm and curvature
in 1/mm. A regular point with exact zero curvature has no finite radius. This
is a local osculating radius, not an authored circle or a global minimum radius.

`curvaturePin(scene,sourceId,curveId,t=.5)` captures current qualification.
`queryQualifiedFaceCurveCurvature(scene,pin)` checks six own fields, rebuilds the
complete original Source0 Model and checks all original geometry bits. It calls
public native curvature once. The copied result includes actual D2 point,
first/second derivatives, speed, unit tangent, curvature vector/magnitude and
radius. Native domain, continuity, regularity and arithmetic errors propagate.
The literal default t=.5 is not a normalized fraction for other knot domains.

The label uses the original parameter point, with approximate CSS projection
and no occlusion test. Curves need not be separately drawn in this Face scene.
View, grid, color, order and CSS changes retain native curvature; original
source/reference changes clear the report. Invalid queries retain prior output.
After loss or unavailable presentation, retained CPU queries remain possible,
while projection refuses and the label hides. Clear, mode change and Dispose
invalidate authority. Other point, angle, area and length panels are independent.

Hook: `curvaturePin`, `queryQualifiedFaceCurveCurvature`, `inspectCurvature(pin?)`,
`updateCurvatureLabel`, `curvatureSnapshot` and copied `curvatureReport`. Public
CAD `evaluateCurveCurvature` and `evaluateCurveD2` support independent controls.
No derivative substitution, global accuracy, manufacturing or release claim is
made. The earlier #1080 transition anomaly remains a separate pending check.


## Original Surface local curvature (#1154)

Choose a current source and original **u**, **v**, then select **Inspect Surface
curvature**. The output shows signed mean H and ordered principal curvatures in
1/mm, and Gaussian K in 1/mm². Sign follows the original native U/V normal;
Gaussian curvature is independent of orientation. A regular plane has zero
curvature. Failed derivatives or a singular metric are errors, not plane values.

`surfaceCurvaturePin(scene,sourceId,u=.5,v=.5)` captures current qualification.
`queryQualifiedFaceSurfaceCurvature(scene,pin)` validates seven own data fields,
recompiles the complete original Source0 Model and checks all original geometry
bits. It calls public native curvature once. The copied result retains actual
D2 point/du/dv/duu/duv/dvv, native unit normal, normalized metric/second form,
mean, Gaussian, sorted principals and discriminant roundoff/clamp metadata.
Literal defaults .5 are original parameters, not normalized domain fractions.
Native domain, continuity, regularity and arithmetic errors keep their causes.

The label uses that original parameter point. CSS projection is approximate
and does not test occlusion. View, grid, color, order and CSS changes retain the
native result. Source/reference changes clear it; failed queries retain prior
output. Retained CPU authority remains queryable after context loss or unavailable
presentation, while projection refuses and the label hides. Clear, mode change
and Dispose invalidate authority. Other five inspection panels are independent.

Hook: `surfaceCurvaturePin`, `queryQualifiedFaceSurfaceCurvature`,
`inspectSurfaceCurvature(pin?)`, `updateSurfaceCurvatureLabel`,
`surfaceCurvatureSnapshot` and a copied `surfaceCurvatureReport`. Public CAD
`evaluateSurfaceCurvature` and `evaluateSurfaceD2` support independent controls.
These are local native values. They do not certify whole-Surface regularity,
Face/Solid orientation, manufacturing, principal directions or global accuracy.
No principal radius or heatmap is inferred. The earlier #1080 transition anomaly
remains a separate pending Integration check.


## Native Curve tangent angle (#1157)

Choose two current Sources, original Curves and original parameters **t**. Select
**Measure native tangent angle**. The output gives the unsigned angle, 0..180°,
between increasing-parameter native tangents. It is not a three-point chord,
screen angle, edge traversal angle or topological dihedral angle.

`tangentAnglePin(scene,sourceId,curveId,t=.5)` captures current qualification.
`queryQualifiedFaceTangentAngle(scene,first,second)` validates both six-field pins,
compiles both complete Source0 Models and checks all original geometry bits
before two public `evaluateCurveD1` calls. D2 is not required: a D1-valid C1 knot
can be inspected when native curvature D2 refuses. The literal default .5 is
an original parameter, not a normalized domain fraction.

The copied result keeps original points, derivatives, norms, unit tangents,
radians and degrees. Derivative norms are in mm per original numeric parameter,
not physical speed. Positive finite norms and representable normalization and
products are required; zero tangents and nonfinite/underflow values refuse.
The computation uses atan2 of normalized cross magnitude and dot product,
without epsilon or clamping. There is no global angular accuracy certificate.

The caller label uses the first original point. CSS projection is approximate
and does not test occlusion; the Curve need not be drawn separately. View, grid,
color, order and CSS changes retain the native report. Source/reference changes
clear it; failed queries retain the prior output. Retained CPU authority remains
queryable after loss or unavailable presentation, while projection refuses and
the label hides. Clear, mode change and Dispose invalidate authority. Other six
inspection panels are independent.

Hook: `tangentAnglePin`, `queryQualifiedFaceTangentAngle`,
`measureTangentAngle(first?,second?)`, `updateTangentAngleLabel`,
`tangentAngleSnapshot`, copied `tangentAngleReport`, and public CAD
`evaluateCurveD1`. No new SDK/provider API or release is claimed. The earlier
#1080 transition anomaly remains an independent pending Integration check.

## Native Surface parameter-normal angle (#1166)

Choose two current Sources, their Face Surfaces and original **U/V** parameters.
Select **Measure native normal angle**. The copied report gives the unsigned
angle, 0..180°, between native `du × dv` parameter-normal directions. It does
not give outward Face/Solid orientation, an acute unoriented plane angle or a
topological dihedral angle. Display scale, translation and camera do not change
the original native angle.

`normalAnglePin(scene,sourceId,u=.5,v=.5)` captures the seven current fields.
`queryQualifiedFaceNormalAngle(scene,first,second)` validates both pins and both
complete Source0 Models before two public `evaluateSurfaceD1` calls. All five
original objects must bit-match each current Face geometry. D2 is not required:
a D1-valid C1 Surface can be inspected when D2 continuity refuses.

The result retains original D1 points/du/dv, derivative norms in mm per original
numeric parameter, normalized tangents, their dimensionless cross and unit
normal, radians and degrees. Finite positive derivative and Surface cross norms
are required. Nonzero components/products must remain representable. A zero
Surface cross refuses; a zero cross between two valid normals gives 0° or 180°.
Represented nonzero near-parallel tangents use the same calculation without an
epsilon or clamp. This does not certify global regularity or angular accuracy.

The caller label uses the first declared native parameter point. Projection is
approximate and does not test occlusion. View/grid/color/order/CSS changes retain
and reproject the report. Current source/Face/Model/Surface changes invalidate
it. Failed queries retain accepted output. Retained CPU authority remains
queryable after loss or unavailable presentation; projection refuses and the
label hides. Clear/mode/Dispose removes authority. The seven prior panels remain
independent. The F interior pole edit changes its non-midpoint normal while the
midpoint D1/normal stays unchanged; the complete Source pin changes in both cases.

Hooks: `normalAnglePin`, `queryQualifiedFaceNormalAngle`, `measureNormalAngle`,
`updateNormalAngleLabel`, `normalAngleSnapshot`, copied `normalAngleReport`, and
public `evaluateSurfaceD1`. No new SDK/provider API or release is claimed. The
earlier #1080 transition anomaly remains an independent Integration follow-up.

## Inspect a current Face from a screen point (#1174)

Enable **Face inspect mode**, then click the canvas. The host calls the separate
read-only `pickQualifiedFace` query and marks the current source row. Its concise
report names the original Source/Face/Model/Surface, local derived triangle and
positive view depth. GPU colors do not change. Help explains approximate filled
Float32 triangle observation, no native UV/topology hit and no pixel precision
or selection guarantee. Original duplicate local IDs stay qualified by sourceId.

Accepted source/view/backing/CSS changes clear the screen row. Failed recoverable
loads retain it. Other CPU inspection actions retain it when the scene/view is
unchanged. Detached row callbacks check current scope and connection. Loss,
unavailable presentation, mode change, Clear and Dispose remove the row;
Dispose disconnects the shared observer. Observable direct SDK changes are
checked on render/refresh. Same-content unseen reload has no SDK generation
certificate. The eight prior CPU panels remain independent.

Hooks: `inspectFaceAt`, `faceInspectionSnapshot`, `refreshFaceInspection`,
public `prepareCamera`, `prepareMesh` and `tessellateSurface` for bounded current
display witnesses. The query returns independent full source refs and points.
It writes no GPU, Viewer selection, measurement or request state. The earlier
#1080 allocation-retention anomaly remains a separate unresolved Integration
follow-up.
