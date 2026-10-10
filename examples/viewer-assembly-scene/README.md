# Four selected original native assembly instances

This bounded host reads the unchanged GPU874 assembly revision0/1 JSON files
through public `loadBaroCadAssembly`. Each original file is4207bytes. Viewer
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
inspection remains available for hidden instances and after context loss.

The `child` Curve lies on the opaque `surface_grandchild` boundary. Existing
native picking can report it occluded. Use the Surface's Show checkbox to
inspect the covered Curve, then restore visibility. Proof records four
qualified hits with each actual visibility state; it does not claim all four
simultaneously pickable or change the original geometry/picker.

With Node22, ordinary development uses public names with normal source
default exports and no custom conditions/source aliases:

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
local/world points and actual GL upload readback, records declared visibility
hit controls, and verifies parent edits affect descendants while roots and
original parts remain unchanged. It checks exact options/IDs/getter/forged
matrix/report/translation/allocation refusal retention, camera/selection and
visibility, query copies, and successful native mode replacement/Clear.
An actual public Physics step0 cloth scene supplies the previous derived
frame for failed-retention and successful-reset admission. This is one bridge
consumer, not a cloth numerical campaign.

`window.viewerAssemblyProbe` exposes public Viewer, original `assemblies`,
default IDs/options/camera, native query/list helpers, original fixture URLs,
public Loader/CAD `updateCadAssembly`/reference resolution, public GPU
constructors, actual GL upload readback, resources/errors and `runProof()`.
The first runtime failure remains recorded with completed receipts and the
accepted page state. Main acceptance additionally covers pending URL races,
posed-only bounds, extra exact-input gates and separate actual context loss.

Dispose is separate from Run proof. It performs idempotent Viewer cleanup,
disposes the caller-owned cloth world and records all seven resource classes.
Use a separate fresh page for actual `WEBGL_lose_context`, retained CPU
source/query and mutation refusal before disposal. Native completion,
Integration and publication require separate evidence.
