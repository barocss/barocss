## Navigate the original native view

Open a supported original Source0 or IGES file. Enable **Navigate native view**.
Drag with the primary pointer to turn the view. Hold Shift before the drag to
move the view. Use the wheel to zoom. Navigation starts off. It is available
for an idle, ready original native scene, including a scene with all objects
hidden. Other source modes keep this control disabled.

Camera changes keep the original source, Model, selected geometry, display
poses, visibility, native point, chord and derivative reports, SDK measurement
caches, parameter drafts and File intentions. Native coordinates and derivatives
keep their original units. Camera movement changes the displayed pixels.

A change to source, selection, visibility, pose, canvas backing size or CSS
rectangle cancels an active drag. Start a new drag in the current view. A known
successful source reload also cancels it when the content matches. A failed
source candidate keeps the accepted view. This controller cannot detect an
unobserved identical external reload as a new source generation.

Disable navigation to remove its pointer controls. Presentation loss or failure,
Clear, unsupported mode and disposal detach them. Caller context restoration
does not resume a lost Viewer. The earlier CPU inspection rules still apply.
The controller restores the prior inline touch-action value and priority.
It uses the existing public Viewer pointer adapter and adds no camera solver,
selection action, native hit, geometry edit, animation timer or export action.
If a host callback fails after an accepted camera change, the camera is already
committed. No camera or framebuffer rollback is promised for that callback.

## Capture two original points for a chord

Select an original Surface or Curve and enter its native U/V or t in the
selected-point controls. Select **Capture chord point** to store the first
point. Select another original object, or change its parameters, then select
**Capture chord point** again. The completed report shows the straight-line
distance between the two original authored XYZ points in millimetres.
The next capture starts a new first point. **Reset chord points** clears this
captured set and keeps parameter drafts and the separate point inspector.

This uses the existing public Viewer point-distance method. A successful pair
updates the SDK latest native measurement. First capture and Reset do not
change that measurement. The operation preserves the original source, whole
Model, current view, display poses, other measurement fields, File choice and
import provenance. It does not draw a line or marker on the canvas.

Captured points retain their original parameters when selection, visibility,
view or display pose changes. A hidden first endpoint remains original CPU
geometry; it does not become a hidden SDK selection. A new capture needs a
current selected object. Source/Model or mode changes, successful source
admission, Clear and Dispose clear the captured set. Invalid parameters or a
failed source candidate keep a current set. Matching selected CPU geometry can
still be captured and measured after presentation loss; new selection remains
blocked when graphics are unavailable.

The whole current Source0 and Model, both tagged references, original domains,
parameters and fresh public native points are checked before the paired SDK
call. Inputs and reports are copied. Point records retain the existing8192
value/depth16 budget; combined copies are bounded to32768 values/depth18,
512 array entries,64 record keys and65536 UTF8 bytes/code units per string.
The supported native Source0 family keeps1..4 complete objects. No original
object is stripped or replaced by display data. These bounds are input guards,
not a maximum-workload or numerical-accuracy certificate.

The distance is an original point-to-point chord. It is not Curve arc length,
a minimum distance between objects, a posed-world distance, a native screen
hit or a history certificate. A represented zero chord is valid. If the SDK
pair call succeeds and a later report callback fails, the latest SDK measure
is already updated; no cache rollback is promised.

## Inspect the selected original geometry

Open a supported original Source0 or IGES file. Select a visible original
Surface or Curve. The new **Selected native parameter point** pane shows its native
parameter domain. Enter U and V for a Surface, or t for a Curve, then select
**Inspect selected native point**. **Reset point report** clears this host report.
The separate original Curve inspection button keeps its existing behavior.

The parameters are dimensionless values in the original numeric domain. They
are not normalized screen coordinates. New selections start at the original
domain midpoint. Only the active parameter fields are read. Invalid input
keeps the current report. The result shows original authored XYZ in millimetres.
Display poses, camera and the0.13scene scale do not modify this result. It is
not a native screen hit, certified precision result or editing-history record.

The helper recompiles the whole current Source0 and compares every Model value
with the accepted original Model. The selected tagged reference must belong
to the complete current inventory. It then calls the existing public CAD D0
evaluator. It changes no Viewer measurement, selection, File intent, import
provenance or graphics state. Complete technical JSON retains the source,
whole Model, reference, exact parameters, domain and original point.

A different selection, changed source/Model, cleared selection or unsupported
mode clears this report. Hiding the selected object clears SDK selection and
also clears this report. View and display-pose changes keep a current report.
A failed source candidate keeps a current report. If presentation becomes
unavailable, the retained selected CPU geometry can still be inspected.
New selection needs available presentation. Disposal clears and disables the
new controls before they can read Viewer state.

The scope is ordinary native Source0 with1..4 complete original objects,
including generated Source0 from accepted IGES. Document, Face, assembly,
Shell and uniform Curve modes have their separate inspection operations.
Sources require1..65536 UTF8 bytes and code units. Owned JSON snapshots are
bounded to depth16,8192 values,512 array entries and64 record keys. These
bounds are guards, not a maximum-workload or numerical-accuracy certificate.
No object is stripped or retagged to make this operation available.

## Open a local IGES geometry file

Choose an **IGES geometry file** and confirm **Authored XYZ matches Viewer Y-up**.
Then select **Open IGES geometry**. IGES does not define the authored up axis.
The host does not rotate coordinates or convert units. **Discard IGES choice**
removes the draft and keeps the accepted scene and import provenance.

The supported input is the existing CAD writer profile: open, nonperiodic,
untransformed126 Curves and128 Surfaces, millimetres and scale1, printable
ASCII80-column LF records with a final LF. File names and extensions are hints.
The host reads a genuine same-realm File of1..1048576 bytes, preserves its exact
UTF8 bytes and SHA256, and refuses BOM/CRLF/invalid UTF8 instead of normalizing it.
The importer also applies its separate1MiB request-JSON budget.

The host retains all six fields of the imported result: original request,
generated Source0, complete Model, metadata, entity mappings and report.
Directory labels can repeat or truncate. Display identity uses the actual
pointer-derived generated IDs. Original full author IDs, source spelling,
feature history and pre-export zero signs are not recovered. Technical JSON is
an inspection disclosure, not an exchange codec or a history certificate.

Complete display requires1..4 objects and generated Source0 within65536 UTF8
bytes and code units. Every original imported object remains in the complete
candidate. Adaptive-v1 Curves retain their degree1..3,2..64-pole/70-knot profile;
Surface preview retains its existing degree1..5 profile. A valid imported
Curve5 or five-object file can refuse display. The host does not drop objects,
reduce degrees or substitute the separate selected uniform Curve operation.
Existing weights, spans, sampler, scene bounds and device limits still apply.

Each Open calls ONE public `replaceNativeScene`: native version0, Surface5×5,
adaptive chord tolerance0.02mm/512 segments/depth16, no motion, all original refs
visible and fitted camera. The constructor scale remains0.13scene units/mm once.
Select a current visible generated Surface or Curve with its `Select <ID>`
button. Original Curve inspection uses the imported native numeric domain.
Imported coefficients and full original file provenance remain separate from
prepared GPU buffers and display coordinates.

New Stage/Open/Discard attempts cancel older reads, including competing native
Source0 File reads. Checkbox changes cancel a pending IGES Open. Source actions,
Clear and Dispose also cancel it. Failed import/profile/recoverable presentation
keeps the old accepted scene, inspection and provenance. A stale completion
returns null. Accepted metadata commits only after successful presentation;
post-commit callback failures do not imply presentation rollback.

The local ticket range is1..1000000. Exhaustion cancels pending work and refuses
new Stage/Open without reuse. Discard, invalidation and Dispose remain safe.
The copied controller snapshot keeps version, intent, staged, accepted, pending,
disposed and bounded error fields. Its whole import plus metadata has a checked
4MiB+8192 UTF8/code-unit budget before presentation. `readIGESFile(file,ticket)`
is a CPU read/import/candidate preparation API, not a trusted presentation token.

The source download action offers **generated imported Source0** with its own
filename and SHA256. It does not offer the original raw IGES bytes under their
original File name. No raw IGES download, project SaveAs or saved-result reader
is introduced here.

After loss or unavailable presentation, matching CPU import provenance remains
readable and Stage/Discard remain available. Open and Select stay blocked.
Caller restoration does not resume the GPU backend. Retained original Curve
inspection is a CPU query. Dispose clears this local controller before the
native download/File controllers and Viewer. No framebuffer rollback or actual
lost-hardware deletion-zero guarantee is made.

The four example paths are tracked in Issue1421. The separate existing CAD1403
runtime alignment is already adopted upstream and is not part of this feature
handoff. Source and all-published browser acceptance, native implementation,
exact Integration adoption and release are separate records. This geometry-only
route does not execute the denied complete-material first mount in Issue1375.

# Original native source and initial display scene

This bounded host consumes the unchanged canonical
`packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json` through
public Loader. It retains revision5, both original native assets/revisions and
complete compiled source authority. Display selects four original bodies:
`body_0_curve`, `body_0_surface`, `body_1_curve`, `body_1_surface`.

The host obtains all ten-field expected body pins through public
`prepareBaroCadDocumentPrimitiveNativeRefsV2`. Those original pins use compiled
Model name `authored_part`; display refs use asset namespaces `asset.a` and
`asset_b`. The identical original geometry IDs are preserved. No cached mesh,
foreign packet, copied model subset or saved material becomes source authority.

One `replaceNativeScene` request submits original authority, complete initial
motion, visible refs and camera. Each admitted body, including hidden bodies,
has an identity quaternion/unit scale and explicit X/Y translation. Initial
body0Surface is hidden; all four remain in source inventory. The display scale
is0.13scene units/mm. A fixed camera is copied exactly, or null camera requests
a fit of only visible posed observations. Fit is display bounds, not a native
control hull or source-history certificate.

Physical controls load the document with saved/fitted view, load the original
document or one original native asset through legacy APIs, replace native
with initial settings, Show/Hide bodies, Fit, inspect an original Curve, restore
the saved camera and Clear. Source queries remain original-local despite
display poses. Native replacement uses the complete first original asset,
including its extra unselected source Curve, with all admitted refs covered.

With Node22, ordinary development resolves public package names using normal
source-default exports without source aliases or custom conditions:

```sh
node examples/viewer-native-scene-replacement/server.mjs
```

Open <http://127.0.0.1:53061/>. The server bundles once and serves the exact
original document bytes at `/document.cad-document.json`. Its manifest records
the original file path/byte count/SHA256. Native asset endpoints extract exact
source strings from that original file, without rewriting source coefficients.
Browser startup checks the original bytes and loads through public Loader.

After building the affected providers and Viewer, explicit compiled browser
acceptance maps every transitive own public package entry/subpath through
complete `publishConfig.exports.import`:

```sh
VIEWER_REPLACEMENT_COMPILED=1 node examples/viewer-native-scene-replacement/server.mjs
```

`/input-audit.json` requires own src with zero own dist in ordinary mode, and
own dist with zero own src in compiled mode. Missing compiled maps refuse.
`VIEWER_REPLACEMENT_PORT` changes the port; `VIEWER_REPLACEMENT_EVIDENCE`
optionally records `/result`. Existing original Uniform, Assembly, Shell and
cloth-panel source fixtures support root-owned old-mode transition controls.
`/slow-native.barocad` holds the actual first original document asset response
until POST `/release-slow`, for deterministic request-generation checks.

Run proof checks initial visible transformed original positions against actual
GL buffer readback with exactly one scale, copied source/pins/signed-zero data,
an independent null-camera union fit, all-hidden explicit-camera acceptance,
stale pins/ref/motion/quaternion/hidden scene-bound/camera/getter refusals,
consumed texture allocation failure after geometry uploads, old native/document
generation compatibility, subsequent commands and Clear. It records the first
failure and preserves accepted page state. Status shows a bounded summary;
the complete evidence stays in the probe/result and optional output file.

`window.__viewerReplacementProof` exposes public Viewer/createViewer,
document result/original bytes/text/manifest, native source strings, public
projection/options/pins/ref helpers, candidate builders, independent posed
points/union fit/upload helpers, native query and public Loader/CAD/GPU/Physics
modules. Global instrumentation installed before the first mount tracks seven
resource classes, overlap peaks and actual readback. Fault hooks can target a
specific allocation class/attempt. The loss extension is captured before loss.

The main runner owns complete actual source/compiled acceptance, old cloth/
Uniform/Assembly/Shell transitions, held URL winners, presentation-before-CPU
commit, normal cleanup resources0 and separate loss/restore/refusal/Dispose.
No lost-handle deletion0 or Editor Save/fresh Open acceptance is claimed.
This proves a provider seam; editor consumer/history/publication gates remain
separate from native completion and serial Integration.


## Open an original local Source0 file

Choose **Original Source0 file** to stage a local file. The staged name and byte
count are shown before any read, native parse or display replacement. Choose
**Open original source** to read and admit it. **Discard file choice** clears
only the draft. A dialog cancel keeps the previous choice. The retained File
can be reopened or selected again. File names and extensions are display hints.

The bounded profile is 1 to 65,536 UTF-8 bytes and code units, with one to four
complete native Surface/Curve objects. All original objects and refs must be
admitted. UTF-8 decoding is fatal on invalid bytes. Source text keeps its BOM,
newlines and signed-zero tokens without trimming or normalization; the public
parser decides whether that complete text is supported. The original bytes
are SHA256 hashed. Unsupported input does not become a partial model.

Open uses the existing atomic native replacement with no initial motion, all
original refs visible and automatic display fit. The fixed source profile
uses a 5×5 Surface sample and adaptive Curve version1 with .02mm chord tolerance,
512 segments and depth16. Display remains .13scene units per original mm.
Source0 geometry does not imply Face topology, a saved canonical document,
Shell, assembly, history or a full editor Save/Open flow.

Only the latest owned Open/source intent may commit an asynchronous read. A
new choice, another Open attempt, Discard, source action, Clear or Dispose
cancels the previous local intent. The File read itself need not be abortable.
A failed latest attempt retains the accepted scene and file provenance.
Successful source actions clear accepted file provenance after adoption and
keep the staged choice. Clear also keeps that choice so Open works from empty.

The Curve inspector uses the current original domain midpoint and lower
endpoint. It does not normalize arbitrary file parameters. A Surface-only
file disables Curve inspection. Loss or unavailable recovery retains readable
CPU source/provenance and blocks Open. Picker/Discard remain CPU draft actions.
Dispose clears the file controller before the Viewer. Failed recovery has no
pixel rollback promise. These local intent rules do not certify unseen SDK
reloads, global numerical accuracy or release acceptance.


## Download the accepted original source

Choose **Download original source** to offer the current ordinary native
Source0 as a local UTF-8 file. The action uses accepted CPU source authority.
A staged file does not replace that authority. An opened file keeps its name
as a browser hint; a source loaded without File provenance uses
`<modelId>.source0.css`. The report shows bytes and SHA256.

The helper validates the complete current Model against the public parser.
It keeps all original Surface and Curve refs, including a legacy unrendered
Curve. The fixed profile supports one to four original objects. Source bytes
keep BOM, newlines and signed-zero tokens. There is no formatting or source
rewrite. Unsupported mode, stale content or mismatched File metadata refuses
the offer. The downloaded file can be selected and opened through the local
File controls; reopening admits all supported original objects.

Download does not change File Open intent, staged choice, camera, visibility,
poses, inspection or GPU state. Each offer owns a temporary anchor and Blob
URL. The anchor is removed after the click. The URL is revoked after one
second, or during Dispose. A pending hash is canceled by a newer download,
changed native content, Clear, mode change or Dispose.

CPU source download remains available after context loss or unavailable
presentation. This does not fix the primitive recovery defect tracked in
#1334. The local File feature in #1322 remains partial until that required
native recovery check passes. Download saves original geometry only; it does
not save camera, display settings, Face topology, document history or a full
editor project. An offered link and a verified saved download are separate
results.


## Prepare document appearance on the CPU

`scene-appearance-preflight.mjs` checks the public
`prepareViewerNativeSceneAppearance(input, context)` function. It uses the
original canonical document, two authored shader sources, fresh document
bindings, explicit poses, visibility, camera, lighting and constructor context.
It compares the complete result with independent public Interop and GPU CPU
preparation. It also checks uniform defaults, hidden and empty frames, stale
pins, malformed data, ownership and a cold Node consumer.

Build both consumers before their first run. Use Node 22 and an output directory
outside the checkout. The commands below do not build a package. Run the Viewer
package build first so that published imports contain the new CPU function.

```sh
node examples/viewer-native-scene-replacement/scene-appearance-preflight.mjs --build --root "$PWD" --evidence /tmp/viewer-appearance-proof
node examples/viewer-native-scene-replacement/scene-appearance-preflight.mjs --build --compiled --root "$PWD" --evidence /tmp/viewer-appearance-proof
node /tmp/viewer-appearance-proof/source-consumer.mjs --run --mode source --root "$PWD" --evidence /tmp/viewer-appearance-proof
node /tmp/viewer-appearance-proof/compiled-consumer.mjs --run --mode compiled --root "$PWD" --evidence /tmp/viewer-appearance-proof
```

Source mode uses ordinary public workspace exports. Compiled mode resolves all
transitive public BaroCSS names through their published import maps. Each build
records source/dist inputs and hashes. Evidence files use exclusive creation;
keep first failures and use a new output directory for an authorized remaining
check. The private V8 parameter file keeps runtime signed-zero values. It is not
an authored Render save format or an editor project file.

This CPU function creates no Viewer, canvas or GPU backend. It does not mount,
render, replace an accepted scene or make file Open atomic. A future renderer
must re-admit the prepared frame through a supported public mount API. The full
appearance replacement operation and its first-frame mount remain separate.


## Replace appearance on an accepted native backend

Select **Replace scene and appearance** to replace the canonical document,
three admitted bodies, poses, visibility, camera, two opaque Surface shaders
and light through one public operation. The time uniform accepts0..2; the
amount accepts0..1. The two light presets are explicit. Accepted details come
from public Viewer state after success, including canonical material values
and effective lighting. Original asset sources, three-object Models, six
authored bodies and revisions are retained.

The initial page uses the existing legacy document bootstrap. The new action
updates only an already accepted qualified V2 or Viewport backend. It does not
create a complete first material mount or certify fresh Render file Open.
The SDK rejects unsupported, unmounted, lost, unavailable or disposed targets.
An empty candidate is supported on Viewport only. The button's coarse public
ready/empty status check does not certify the internal backend family.

The action uses the existing File intent rule: cancel older local reads before
the attempt; clear accepted File metadata and native inspection only after
success. Drafts and original File/download controls remain separate. A failure
retains accepted appearance under the SDK recovery policy. Live fatal failure
has no pixel rollback promise. Later primitive views and operations retain
the accepted light under the mounted operation contract; independent Face and
MixedDepth modes reset to their constructor light policy on successful load.

The exact shader literals come from mesh-material-cpu-probe.mjs and
material-shorthand-flow.mjs. They are compiled and validated through public
GPU APIs. The host builds fresh document TEN-field pins and candidate display
Surface refs; repeated native IDs do not select a different asset's material.
No prepared execution buffer is treated as native source or a trusted token.

Proof hooks add buildMountedAppearanceInput, buildMountedAppearanceCandidate,
replaceMountedAppearance and mountedAppearanceSnapshot. Explicit action
arguments pass unchanged to the SDK; only zero arguments read physical drafts.
Existing source/compiled server modes and fixture routes remain unchanged.
New first-mount APIs, arbitrary backend switches, full authored Save/Open,
editor history and release acceptance remain separate.

## Inspect selected original derivatives (#1473)

Select an original Surface or Curve. Use the existing native U/V or t inputs.
Click **Inspect selected native derivatives** to show its original authored XYZ
point in millimetres and its raw first derivative vectors. Curve dP/dt and
Surface dP/dU/dP/dV use millimetres per original dimensionless parameter. The
complete report includes the unchanged original source, Model, reference,
parameters, native domains and the whole public CAD D1 result.

The example uses `querySelectedNativeDerivatives(viewer, expected, input)`.
`expected` contains the complete `{source, model, ref}` pin. Surface input is
exactly `{u, v}`; Curve input is exactly `{t}`. Every parameter must be an
explicit finite number. The helper checks owned data and the complete current
source, Model and selection before one public D1 evaluation. It checks them
again before returning a copied eight-field report. It uses the existing
8192-value/depth-16 copy limit, arrays up to 512, records up to 64 fields, and
strings up to 65536 UTF-8 bytes and code units. These limits are bounded input
checks, not a maximum workload certificate.

Raw zero vectors are valid. An exact C0 interior knot can refuse D1 even when
its position can be evaluated. Provider endpoint and error rules remain intact.
The vectors are not normalized and do not include display pose or scale.
This report does not certify regularity, outward orientation or global accuracy.
It does not create a normal, angle, marker or new SDK method.

Inspection and **Reset derivative report** preserve the separate point report,
captured chord, all SDK measurements, File intents and import provenance.
Reset clears only this derivative report and keeps the parameter drafts. A
same-current invalid query keeps the last completed report. A changed selection,
hidden selected object, source, mode, Clear or Dispose clears it. A known
successful same-source reopen also clears it. View, pose and CSS changes keep
it when its full original pin is current. Retained selected CPU geometry can
still be inspected after presentation loss or unavailability; new GPU selection
remains blocked. No new renderer, provider build or release follows from this
example operation.
