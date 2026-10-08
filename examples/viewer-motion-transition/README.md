# Viewer caller pose sequence

This example uses only `@barocss/viewer`. It loads two native source0 Surfaces into one GPU canvas and supplies direct pose frames at caller times 0–4 seconds. The caller owns the time and chooses the frame. Viewer owns no player or interpolation. The example directory name is retained for historical links; the original #719 transition evidence remains in its Issue and commits.

With Node 22 and CAD, GPU, cad-interop and Viewer built:

```sh
VIEWER_TRANSITION_PORT=52919 node examples/viewer-motion-transition/server.mjs
```

Open `http://127.0.0.1:52919/`. Press **Start**, then **Advance 1 s** to apply the next caller frame. **Pause** holds the current pose. **Resume** allows further advances. **Try wrong context** demonstrates refusal without changing the accepted Viewer pose. **Reset** restores identity display; **Dispose** releases Viewer resources.

`part-xyz-matches-rhyup` says frame translations in mm already match the authored right-handed Y-up/mm source. Viewer applies `mmToSceneUnit:0.001` once. The two exact target IDs bind to qualified Surface refs. Original source, native U/V and the measured native Surface distance remain unchanged while display poses move. This is not a certified dimension, animation player or physics simulation.
