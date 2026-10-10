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
