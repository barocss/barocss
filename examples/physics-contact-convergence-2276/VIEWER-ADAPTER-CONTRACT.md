# Actual Viewer adapter scope

Source-only before execution. Root owns scene/display.mjs; the other source
helper owns app/worker/server/browser files. Root alone executes. CAD React is
owned by another Work. No CAD React, Studio, Viewer, GPU or Physics product
source/dependency is changed by this adapter. Existing HOLDs remain.

The numerical dt and long campaigns and paid-data observer controls must pass
before desktop execution. The desktop loads the same actual canonical Physics
provider as those runs and current workspace Source @barocss/viewer, which uses
the real @barocss/gpu/viewer presenter. This is not compiled/published Viewer or
GPU package qualification. No direct WebGPU renderer or expected-state playback
substitutes for the Viewer path. The worker owns one World and empty commands;
Viewer never steps or owns physics time.

Display exactly the current centered box proxies, including floor: three or
four primitive Surface packets, within the existing Viewer maximum of four.
These packet vertices are display-only and have no native CAD provenance.
Local vertices m->mm once, accepted body translations m->mm once; Viewer uses
mmToSceneUnit=.001. Identity local collider frames and the authored matching
Y-up XYZ basis are required. All actual accepted XYZW rotations are copied;
no pose snap or interpolation. No CAD solid COM/full tensor/axis converter is
claimed. An off-origin native Surface needs the separate cadProxyPose adapter.

present(state,model) configures immutable display geometry only when the model
changes and applies a complete public applyMotionFrame. Its bindings map each
actual body ID to one actual loaded model/surface ID. Validate the actual public
Viewer.getState() motion/displayPoses against each displayed accepted Physics
state and independent known primitive dimensions/corner values. This proves
public pose acceptance and units; it is not a readback of private GPU matrices
or Float32 vertex buffers. Actual Viewer.readPixels(), changed pixels and
screenshots separately prove real drawing. No screenshot is a physical oracle.

Desktop proof covers both long-two and long-three from initial through512 on
their retained actual Worlds, with the preregistered numerical window boundaries
[0,32,128,256,384,512]. Complete captured states/ALLnumeric words in each window
must equal paid Native windows, including exact cross-window continuity. No
expected future state is sent to worker/solver. Keep request2MiB/512KiB numeric
words, evidence16MiB, inner170s/outer180s, fixed640x360 RGBA readback and unchanged
pixel predicates: colored pixels>100, physical-motion changed pixels>10; any
blue-pixel check keeps the existing channel-difference predicate. No compression,
truncation, unregistered packet split or limit increase after a failure.

Actual page/console/network errors fail. Test desktop1280/1440/1920, play/pause,
single-step/reset/selection and camera isolation without changing the clock or
state by view actions. The adapter has no contact-marker API. Do not invent a
marker checkbox or misuse the fluid domain to draw contact dots. Contact data
remains in actual numerical state; contact-marker rendering is NOT_SUPPORTED
by this adapter. No mobile, device-loss recovery, assembly-pose override,
Studio runtime, publication or deployment claim.

The public Viewer primitive path refuses authored assembly pose overrides. This
boundary is established by source inspection, not a new assembly runtime test.
Current Studio instead uses its @barocss/gpu/viewer host's instance-transform
path; this task does not replace or resume it. A Viewer frame presentation
failure must remain distinct from a numerical refusal and must not claim to
roll back a state already accepted by Physics.
