# Fit a native CAD document body in Viewer

`viewer.fitGeometry(ref)` frames sampled display points. This example also
calls `viewer.fitNativeDocumentBody({ref,documentRevision})` to frame one
visible body's original positive-rational control-pole hull. The hull is
conservative and may be wider than the evaluated shape. It does not certify
tight extrema or floating-point containment.

It also calls `viewer.fitNativeDocumentBodies({refs,documentRevision})` for an
explicit Curve and Surface pair. The camera frames their combined original
hulls, including an independent display pose on the Curve. The method does
not include unlisted or hidden bodies. The same two committed documents
exercise revision replacement and stale-set refusal.

The two canonical direct-geometry documents in `fixtures/` are exact copies
of the saved local merged CAD #852 evidence at
`/Users/user/.barocss-ai/v3/evidence-852-integration/demo-output/`:

| Revision | Bytes | SHA-256 |
| --- | ---: | --- |
| 1 | 1829 | `2e2208d2e9bcf7ae010e1cd21c19cfa153a5149149791fb3dc7f4d4f7f93eb12` |
| 2 | 1831 | `ac48cb3b51ecf8345e1e1f90efd7ef90af8d749f3f62c17ef7a5b5450ddefcaa` |

The example does not rebuild the CAD fixture or copy its bounds algorithm.
It reads both files through the public Loader HTTP reader and validates CAD
bounds with public APIs. It verifies a weighted Curve control max Y of 4 mm
versus sampled max Y below 3.5 mm, current display pose, an edited document
revision, refusal and disposal. The Viewer is created with
`await createViewer(...)` and draws with WebGPU; the page compares
`await viewer.readPixels()` captures before and after selection.

With Node 22 and built `@barocss/cad`, `@barocss/gpu`,
`@barocss/cad-interop` and `@barocss/viewer`, run:

```sh
VIEWER_NATIVE_BOUNDS_EVIDENCE=/tmp/viewer-906-browser.json node examples/viewer-native-bounds/server.mjs
```

Open <http://127.0.0.1:53006/> in Chromium. The page leaves the accepted
revision-2 Curve visible after its teardown check. The server writes the
actual browser result to the named evidence path and exits when it receives
that result.
