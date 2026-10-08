# Native Curve arc length in Viewer

This bounded browser example uses one canonical CAD document and one own-GPU
WebGL2 canvas. The displayed Curve is sampled. CAD computes the original
Curve arc-length estimate. The host positions an ordinary DOM label from
Viewer's native point projection. The estimate and its positive error value
are heuristic; the global error is not certified.

With Node 22 and built `@barocss/cad`, `@barocss/gpu`,
`@barocss/cad-interop` and `@barocss/viewer`, run:

```sh
VIEWER_CURVE_LENGTH_EVIDENCE=/tmp/viewer-898-browser.json node examples/viewer-curve-length/server.mjs
```

Open <http://127.0.0.1:52998/> in Chromium. The server checks the exact
3027-byte canonical fixture SHA-256 before serving it. The page checks
qualified binding, CAD whole-result validation, π mm, original endpoint chord,
camera and pose label movement, invalid candidates, visibility, clear and
resource disposal. It then opens the same document again in the caller canvas
so the Curve and label stay visible. It records the actual browser result at
the given path.
