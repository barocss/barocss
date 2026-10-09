# Selected CAD document body list

This standalone Viewer example reads the existing 3,172-byte document1 fixture
through Loader. It displays four selected Surface and Curve bodies from two
assets. The list uses copied `getState().documentBodies` bindings and exact
qualified refs. Row controls call public selection, visibility and fit methods.
The properties panel shows source identity and revision, not computed physical
properties. No editor internal or new library API is used.

With Node 22, build `@barocss/cad`, `@barocss/gpu`,
`@barocss/cad-interop` and `@barocss/viewer`, then run:

```sh
node examples/viewer-object-tree/server.mjs
```

Open <http://127.0.0.1:52935/>. Select a row or click a displayed object.
Hide a row, isolate a body, fit visible geometry, reload or clear. Hidden
bodies stay in the document inventory. A rejected action keeps the accepted
scene and reports an error. The host owns DOM, HTTP, canvas and listeners.
Viewer owns one WebGL2 context and its GPU resources. The source is authored
XYZ/mm; the host explicitly declares that XYZ matches right-handed Y-up.

The optional `?proof` route exposes `window.viewerObjectTreeProbe` and tracks
Viewer-created WebGL resources for an actual browser lifecycle check.
