# Native Surface area in Viewer

This bounded browser example serves the two existing canonical CAD document
revisions from `examples/gpu-scene/fixtures/`. CAD computes the original,
unposed Surface parametric-area estimate. Viewer draws one sampled Surface and
projects a native point for a caller-owned DOM label. The area estimator is
heuristic; its global error is not certified. Display scale and triangle area
are not the native measurement.

With Node 22 and built `@barocss/cad`, `@barocss/gpu`,
`@barocss/cad-interop` and `@barocss/viewer`, run:

```sh
VIEWER_SURFACE_AREA_EVIDENCE=/tmp/viewer-902-browser.json node examples/viewer-surface-area/server.mjs
```

Open <http://127.0.0.1:53002/> in Chromium. The server verifies both
committed document byte lengths and SHA-256 hashes before serving them. The
page checks the original 6→12 mm² revision edit, current body binding, label
position after camera and display pose, candidate refusal, visibility, clear,
and resource disposal. It reopens the accepted revision-2 scene on the same
caller canvas to leave the Surface and label visible.
