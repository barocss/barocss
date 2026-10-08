# Viewer Motion clip transition

This example uses the public `@barocss/motion` transition player and the existing
`@barocss/viewer` `applyMotionFrame` API. It loads two native source0 Surfaces
in one own-GPU canvas. The host owns two version-0 clips, the player, an explicit
clock and a complete target-to-Surface binding. No Viewer playback timer or
interpolation engine is added.

With Node 22 and the Motion, CAD, GPU, cad-interop and Viewer libraries built:

```sh
VIEWER_TRANSITION_PORT=52919 node examples/viewer-motion-transition/server.mjs
```

Open `http://127.0.0.1:52919/`. Press **Start**, **Advance 1 s**, then
**Change clip over 2 s**. Each later **Advance 1 s** moves both clip clocks
and the fade by one second. The first step shows the midpoint; the second
adopts the destination clip. **Pause** holds the pose even when Advance is
pressed. **Resume** continues the caller-driven clock. **Try wrong context**
before a fade and **Try second fade while active** during a fade show
accepted-state refusal. **Reset** recreates the host-owned player and
restores the identity display pose. **Dispose** releases
the host-owned Viewer and player.

The explicit `part-xyz-matches-rhyup` basis says clip translation in part
XYZ/mm already matches Viewer's authored right-handed Y-up/mm source. Viewer
applies `mmToSceneUnit:0.001` once for display. Exact context/target IDs bind
`panel-a` and `panel-b` to the two qualified Surface refs. Original source,
native U/V, and the measured Surface-to-Surface distance remain unchanged
while display poses move. The native distance is not an assembly/display
distance or a certified dimension. The example does not claim Curve Motion,
hierarchy/assembly animation, markers during fades, skinning or physics.
