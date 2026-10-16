# Explicit Viewer clear

This compiled Viewer/GPU browser flow awaits `createViewer`, starts with a
genuine blank WebGPU frame (captured with `await viewer.readPixels()`), loads
native source0 mixed Surface/Curve geometry, selects and poses it, measures
original native points, clears the scene, changes the empty camera
and size, refuses an invalid load, supersedes an older URL load, reloads a
qualified two-file model set, clears it and disposes the Viewer. Native source
and IDs are never replaced with fake geometry.

With Node 22, build `@barocss/cad`, `@barocss/gpu`,
`@barocss/cad-interop` and `@barocss/viewer`, then run:

```sh
node examples/viewer-clear/server.mjs
```

Open <http://127.0.0.1:52925/>. The page reports actual pixel hashes and
the accepted/refused operations. The canvas remains host owned.
