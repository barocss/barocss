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
Context loss pauses and disposes Viewer while the context is lost, retaining
CPU/source for reporting. After actual restoration, explicitReset reconstructs
Viewer/native/material and a fresh CPU pair on the same caller-owned canvas.
No automatic continuation.

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
0/60/240 positions/index/normal buffer readbacks, actualWebGL2 pixels/bothfaces/
shareddepth/completefrustum/native source/material retention, controls/lateGPU
failure/non-atomicreset/copies/contextloss/restoration/resources/console and
ownedcleanup. Rendering-only native/cloth controls are deliberately labelled
inspection evidence, not accepted host physics updates. GLloss code is recorded
separately; normal/restored/finalGL must be0.

After numerical/control/pixel gates pass, use the final driver argument `cost`
for one warm then three actual240-step/2s browser plays per source and compiled
graph. CombinedBOTH-world solver p95≤8.33ms and simulated/wallratio≥.90 are
required; Viewer submission and totalhost work are separate. Raw readback,
hashing/reference/IO are outside timing; ordinary resource counters remain
on and their overhead is disclosed. This is not GPU completion or FPS proof.

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
