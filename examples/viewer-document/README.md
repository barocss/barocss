# Selected CAD document bodies in Viewer

This compiled Viewer/GPU browser flow reads a real 3,172-byte direct-geometry
document1 file through Loader. It contains six body references and two
643-byte source0 assets with duplicate native Curve and Surface IDs. Viewer
displays four explicitly selected bodies with original document, asset, body,
Model and geometry provenance. The caller explicitly asserts that authored XYZ
matches the right-handed Y-up display basis; the document tag alone does not
make that assertion.

With Node 22, build `@barocss/cad`, `@barocss/gpu`,
`@barocss/cad-interop` and `@barocss/viewer`, then run:

```sh
node examples/viewer-document/server.mjs
```

Open <http://127.0.0.1:52926/>. The page reports actual WebGL pixels,
qualified screen hits, body resolution, native measurement, display pose,
invalid candidate retention, visible subset/isolation/all-hidden background,
hidden-object native inspection, clear/reload and old source/model-set
compatibility. Two caller-owned HTML labels use native Surface/Curve point
projections and exact document-body bindings. Camera and display-pose changes
move these anchors without changing native measurements. Off-frustum points
return null, while invalid or hidden native refs refuse without changing the
scene. Visibility changes Viewer display only. No CAD placement or assembly
transform is inferred; the labels do not test occlusion or certify dimensions.
