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
The display scale is 0.11 scene units per mm, so a translation can meet the
input limit yet exceed the Viewer's GPU scene bound. That refusal also keeps
the accepted pose and draft separate.

For a selected visible body, enter display X/Y/Z translations in mm and use
Apply. The accepted complete four-body pose frame is updated through public
`applyGeometryMotionFrame`; other bodies keep their poses. Typing alone does
not move geometry. Discard restores accepted values. Invalid input or a Viewer
refusal leaves the accepted scene in place and keeps the draft for correction.
Changing selection, hiding the selected body, Reload and Clear discard drafts.
This control changes only the Viewer display pose. It does not edit the CAD
source or the native document binding.

The same panel accepts an absolute Y-axis yaw in degrees from -180 through
180. The rotation is about the original authored source origin, before the
display translation and scene-unit conversion. It is not a native CAD edit or
a local-center drag handle. The panel only represents accepted pure Y-axis
quaternions; it refuses other rotations instead of showing a false yaw value.
Apply changes the selected body's translation and yaw in one complete Viewer
frame while retaining its scale and the other bodies' poses. A yaw draft and
Discard have the same no-change behavior as translation drafts. The field shows
12 significant decimal digits. Leaving it unchanged retains the full accepted
quaternion rather than rounding the pose to the displayed text.

The optional `?proof` route exposes `window.viewerObjectTreeProbe` and tracks
Viewer-created WebGL resources for an actual browser lifecycle check.
