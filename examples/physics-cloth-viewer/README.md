# Actual pinned cloth Viewer host — #981

This independently runnable example uses public Physics/cloth and the adopted
ViewerClothFrameV0 bridge. A17×17 sheet drapes on the fixed sphere collision
proxy; an original authored CAD reference panel remains unchanged. The sphere
is an explicitly labelled projected guide with no depth. The CAD panel is not
collision geometry. There is no native sphere identity or calibrated fabric
claim.

## Run

Use Node22 and the repository's normal public package source maps.

```sh
node examples/physics-cloth-viewer/setup.mjs
node examples/physics-cloth-viewer/server.mjs source
```

The server prints its localhost URL. Play/Pause/OneStep/Reset and front/underside
use actual public states. Two genuine worlds keep accepted CPU state separate
from a rejected Viewer submission. Both normal producer steps/copies count in
cost. Reset clear-then-submit is not atomic: a failed second stage reports an
empty display and retained old CPU. Reset recovers; a late submit failure keeps
prior accepted CPU/display and requiresReset. No hidden replay/state setter.

Metres stay metres in the nine-field Viewer DTO. Viewer applies1000×.001 once.
Native source millimetres stay original. Hashes bind paused context/generation/
step and discard stale completions; live playback computes them when paused.
The Viewer draws with WebGPU: startup awaits `createViewer` once and Reset
reuses it. `viewer.readPixels()` is awaited and returns top-down RGBA rows.

## Verification

```sh
node examples/physics-cloth-viewer/numeric-probe.mjs source /tmp/cloth-source
node examples/physics-cloth-viewer/numeric-probe.mjs compiled /tmp/cloth-compiled
node examples/physics-cloth-viewer/decode.mjs /tmp/cloth-source
node examples/physics-cloth-viewer/decode.mjs /tmp/cloth-compiled
node examples/physics-cloth-viewer/browser-driver.mjs /tmp/cloth-browser /tmp/cloth-source /tmp/cloth-compiled numeric
```

Compiled verification uses every transitive public publishConfig map, never a
source alias or fallback. Build the actual required public library dependencies
with their unchanged build:library commands before that checkpoint. All241
states have lossless LE position/velocity data and independent numeric replay.
Check structural extension≤.1, exactpins, envelope vertex penetration≤1e−6m
and triangle centroid/edge-midpoint physicalsphere penetration≤.002m. Sampled
triangle checks do not prove continuous contact.

The browser driver checks all public host states againstNode raw bits, actual
0/60/240 WebGPU readPixels captures/bothfaces/shared depth/completefrustum/native
source/material retention, invalid frame retention, controls, an injected late
Viewer submission failure, non-atomic reset with an injected second-stage
failure, copies, console and disposal. Rendering-only native/cloth controls are
deliberately labelled inspection evidence, not accepted host physics updates.

After numerical/control/pixel gates pass, use the final driver argument `cost`
for one warm then three actual240-step/2s browser plays per source and compiled
graph. CombinedBOTH-world solver p95≤8.33ms and simulated/wallratio≥.90 are
required; Viewer submission and totalhost work are separate. Raw readback,
hashing/reference/IO are outside timing. This is not GPU completion or FPS proof.

CONTRACT.md and Issue981/6093857136 froze actual parentec20329c/ownership/API/
units/transaction/clock/proof. The first source camera clipped the nativefloor;
pre-edit addendum6094025980 moves camera offsets1.35× without changingphysics.
The first restored-context late disposal produced realINVALID_OPERATION
warnings; addendum6094143693 moves oldGPU disposal into the actuallost phase.
First screenshots/reports/warnings and verifier-only readback/export/fault
placement/extension lookup failures remain in evidence/first. They are not
silently erased or passed. No old producer/property/material/fluid campaign.

Only new examples/physics-cloth-viewer paths are owned. No package/kernel/root/
lock/gallery edit, productpush/PR/pack/deploy/publish/release. Native author
proof, exact Integration adoption and current integrated screen/file/recovery
under674 remain separate. Discoverable gallery registration is a later narrow
Issue if required.

## Executed native gate

The record below and `evidence/` describe the earlier WebGL2 renderer (GL
buffer readbacks, resource counters, allocation-failure injection, context
loss). Those WebGL2-only probes were removed with that renderer.
`browser-replay.py` still verifies only that saved evidence, not a new run.

Actual parentec20329c → clean measured sourcea8a4a61f. Original required public
CAD/CAD-interop/GPU/Physics/Viewer library builds pass with unchanged commands.
Node22.22.0 source9/0dist and fullcompiled0src/9dist numeric runs pass all241
states and exact repeats; browser source216/0dist/fullcompiled0src/176dist.
All Node/source/compiled/browser position AND velocity bits match. Independent
saved numeric decoders replay all states; browser-replay.py verifies full saved
browser records, all raw pixel hashes, timing samples and disposal independently.

Peak structural extension0.05174255069177636≤.1, vertex/envelope penetration
1.1102230246251565e−16m≤1e−6, sampled triangle penetration
0.0013840839157666096m≤.002, pins exact. Actual Chrome155 screenshots/readPixels
at0/60/240 and front/underside/native/cloth/depth controls passed; frozen geometry
fits frustum. Actual867position/867normal/1536index GL readbacks qualify, original
metre data and sampled area normals independently match. All16 RGBA case buffers
are bit-identical across source/compiled graphs. The sphere remains a projected
non-depth guide, not an invented native mesh.

One warm run then3actual240-step/2splays pergraph passed. BOTH-world combined
solver worstp95 **2.5ms** in each graph; Viewer submission worstp95 source5.5ms/
compiled6.200000003ms, separately measured. Minimum simulated/wall ratios
source0.9888262632284652/compiled0.9894622272809325. All720 pergraph solver/submit/
hostsamples and RAF/debt/480twinsteps pertrial saved. Normal counters stayon;
getBufferSubData/hashes/reference/screenshots/IO are off during timing. This
is main-thread work/playback, not GPU completion/FPS.

Actual late allocation failure preserves activeCPU+display; clear-then-second
reset failure exposes emptydisplay/oldCPU and retryrecovers. Repeatedreset counts/
bytes stable. Real contextloss pauses; disposal whilelost avoids obsolete-handle
errors; restored explicitreset draws on samecanvas with healthy initialstatus.
Final allbuffer/program/VAO/texture/renderbuffer/shader counts ANDbytes0, GL0/
consoleerrorwarning0, callerCanvas retained, ownedbrowser/serverclosed.

First clipping, verifier readback/export/faultplacement/lost-extension lookup,
real post-restore late-disposal warnings and first canonical stale asyncstatus
screens remain intact in evidence/first. The camera/lifecycle addenda and final
status correction do not change Physics/model/targets. The final a8 canonical
run is clean and passes the corrected actual restored UI gate. Final child adds
saved evidence/README and the independent saved-browser replay tool only;
app/controller/clock/metrics/probes/driver/source remain a8 exactly.

No exact Integration adoption or currentRoot screen/file/recovery/release claim
follows from nativeGO. #981 staysOPEN until its exact handoff is adopted under
owner674. Existing #1064 is separately scopedCLOSED after exactRoot adoption;
actual capsulehost#1065 is ready to freeze/implement using that available API.
