# Choose original native assembly instances

This bounded host reads the unchanged GPU874 assembly revision0/1 JSON files
through public `loadBaroCadAssembly`. Each original file is4207bytes. At startup Viewer
selects `child`, `surface_grandchild`, `shared_root` and `asset_b_instance`
from six native instances, in that caller order. It preserves the complete
native assembly, sources, full references and original hierarchy matrices.
The instance list shows current revision, parent, ancestors and native asset
identity. Inspect original point reports copied local versus assembly-space
millimetres through the revision-pinned native query.

One canvas uses scale0.05scene units/mm, authored XYZ matching right-handed
Y-up, public approximate picking/visibility/camera/fit and readonly authored
display poses. Repeated original parts have distinct Viewer namespaces. The
list does not edit placement, and assembly mode refuses display-motion
overrides and legacy unqualified native measurements/projection. Native
inspection remains available for hidden instances.

The `child` Curve lies on the opaque `surface_grandchild` boundary. Existing
native picking can report it occluded. Use the Surface's Show checkbox to
inspect the covered Curve, then restore visibility. Proof records four
qualified hits with each actual visibility state; it does not claim all four
simultaneously pickable or change the original geometry/picker.

## Stage and apply an original instance choice

Expand **Change admitted instances (1–4)** to use the separate **Choose assembly instances** panel. It lists all six original IDs,
native kinds, parents and full original references. **Metadata only** means
an instance is not currently admitted for display or native point inspection.
These rows do not have Show, Select or point-query controls. Accepted bindings
and their visibility controls stay in the existing list.

Check **Admit <instanceId>** to stage a different set, including the original
`parent` and `xyz_order_root` omitted by the startup set. The draft can
temporarily contain zero or more than four IDs while you edit it. **Apply
instance choice** requires1..4 unique current original IDs. It submits IDs in
the complete original inventory order. Selecting a child does not require
selecting its parent: the complete retained native hierarchy supplies placement.

Staging changes only this host draft. It keeps current Viewer source, camera,
poses, visibility, primary selection, inspection and pixels. **Discard instance
choice** copies the actual accepted IDs back into the draft without presentation.
View, fit, selection/filter, visibility and CSS-only refresh keep the draft and
connected chooser checkbox focus.

Apply calls public `loadAssembly` once with a fresh complete accepted assembly
and private fixed native options. It uses the API's fitted camera; it does not
call the old revision helper's separate `setView`. Even equal IDs perform real
admission. Success clears Viewer primary selection/measurement layers under the
existing API contract, shows all chosen bindings, resets the draft and clears
old host point inspection. Failure keeps the prior accepted scene and draft and
shows the original error.

A complete original content pin and host epoch guard the draft and row actions.
A known successful revision load resets the draft after admission, before its
separate old fixed-camera action. A failed admission keeps it. Changed external
source content is detected on the next explicit render or action; no unseen
identical-reload history or global observer is claimed. Detached or replaced
chooser and accepted-binding callbacks refuse stale input.

Apply needs a ready Viewer: otherwise it is disabled and direct Apply refuses,
including an equal-ID choice. Clear or another source mode empties the panel. Dispose clears its local pins/draft and
blocks new chooser calls before fresh Viewer reads; existing disposed-state
diagnostic rendering remains separate.

The new proof hooks `stageAssemblyChoice(ids)`, `applyAssemblyChoice()`,
`discardAssemblyChoice()`, copied `assemblyChoice` and `render()` are
example controls, not SDK APIs. The raw stage hook accepts only a current-realm
ordinary dense own array0..32 of unique original ASCII IDs of at most48
characters. Caller getters/coercion are not invoked; original Proxy input is
refused. Apply/Discard accept zero arguments. The example's physical inventory
is the authentic six; Viewer display capacity remains1..4.

With Node22, development uses public names with the manifest default source
exports. The server resolves each own public export inside this clone so a shared
installed tool runtime cannot select source from another checkout:

```sh
node examples/viewer-assembly-scene/server.mjs
```

Open <http://127.0.0.1:52997/>. The server bundles once, prints an input-audit
summary and serves `/input-audit.json`, requiring own source inputs and zero
own dist inputs. Revision buttons replace the accepted complete scene. The
filter limits picking/Select while keeping original instance inventory and
visibility independent.

After building the affected providers and Viewer, explicit compiled browser
acceptance uses a test-only resolver for every transitive own public package
name/subpath through its `publishConfig.exports.import`:

```sh
VIEWER_ASSEMBLY_COMPILED=1 node examples/viewer-assembly-scene/server.mjs
```

This mode requires own dist inputs and zero own src inputs. It is separate
from source-default development and refuses missing compiled export maps.
`VIEWER_ASSEMBLY_PORT` changes the port; `VIEWER_ASSEMBLY_EVIDENCE` optionally
records the bounded browser `/result` JSON. Original fixture URLs are
`/assembly-revision0.json` and `/assembly-revision1.json`. The server also
serves the original #979 authored panel source for the prior genuine cloth
scene used by atomic replacement checks; no native packet is fabricated.

Run proof consumes public Loader results, checks fixture hashes, independently
composes authored Rz*Ry*Rx hierarchy matrices, compares analytical fixture
local/world points, records declared visibility hit controls, and verifies
parent edits affect descendants while roots and original parts remain
unchanged. It checks exact options/IDs/getter/forged matrix/report/translation
refusal retention (state and the captured WebGPU pixels; `readPixels` is async
and resolves after the frame is drawn), camera/selection and visibility, query
copies, and successful native mode replacement/Clear.
An actual public Physics step0 cloth scene supplies the previous derived
frame for failed-retention and successful-reset admission. This is one bridge
consumer, not a cloth numerical campaign.

`window.viewerAssemblyProbe` exposes public Viewer, original `assemblies`,
default IDs/options/camera, native query/list helpers, original fixture URLs,
public Loader/CAD `updateCadAssembly`/reference resolution, errors and
`runProof()`.
The first runtime failure remains recorded with completed receipts and the
accepted page state. Main acceptance additionally covers pending URL races,
posed-only bounds and extra exact-input gates.

Dispose is separate from Run proof. It performs idempotent Viewer cleanup,
disposes the caller-owned cloth world and records the disposed status and
browser errors. Native completion,
Integration and publication require separate evidence.


## One assembly review flow

The accepted instance list now follows the original hierarchy. Expand **Original
source reference** on a row to inspect the complete original reference. A dashed ancestor
is context only when it is not admitted. It has no Show, Select or Inspect action.
Existing original-reference and stale-row checks also cover nested rows. The
complete native source and local/world matrices remain the authority.

Select an admitted instance in the hierarchy or click it in the viewport. Both
routes update the same selection and highlighted row. **Hide selected** removes
that instance from the visible subset and clears its selection. **Isolate
selected** keeps only that admitted instance visible. **Show all admitted** shows
the accepted 1–4 bindings; it does not admit metadata-only instances.

Use **Orbit** or the existing **Fit visible** control to change the camera. Use
**Save assembly review**, change the camera/selection/visibility, then open the
actual downloaded JSON file with **Open assembly review**. This uses the V1 SDK
`captureReviewState` and `applyReviewState` methods. It creates no new scene
format or renderer. File input is bounded to32KiB. A successful Open resets the
host selection filter to All and refreshes the selected hierarchy row. Original
point inspection can then be requested again. Failure preserves the accepted
Viewer state, filter and point inspection. A revision/load change during the
file read refuses the pending Open through the host epoch check.

The saved review binds the assembly ID/revision and actual admitted inventory.
Load revision1 or apply another instance choice, then open the saved file to see
explicit refusal. The current camera, visibility, selection, original hierarchy,
source references and local/world placements must remain unchanged. Revision
pins are not source authentication or a file-integrity signature.

`window.viewerAssemblyReviewEvidence` provides read-only review/state/pixels and
native point-to-screen inspection. Browser acceptance uses public controls and
real Save/Open files for changes. It does not run the older full proof campaign.
`/input-audit.json` adds input size/hash pins and the served bundle SHA-256 for
source binding. Compiled package acceptance remains a separate explicit mode.
