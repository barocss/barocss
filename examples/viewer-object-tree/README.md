# Selected CAD document body list

This standalone Viewer example reads the existing 3,172-byte document1 fixture
through Loader. It displays four selected Surface and Curve bodies from two
assets. The list uses copied `getState().documentBodies` bindings and exact
qualified refs. Row controls call public selection, visibility and fit methods.
The Selection filter offers All, Surfaces and Curves. Canvas selection passes
the chosen kind to public `pickGeometry`; All omits the kind restriction.
Excluded bodies remain visible and stay in the inventory. Their Select buttons
are disabled, while visibility and Fit remain available. Changing the filter
clears an excluded selection, cancels active display gestures and discards a
numeric draft. An eligible selection and accepted display poses are retained.
Reload and Clear retain the host's filter preference. The filter is disabled
while the document is unavailable, after context loss and after disposal.
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

Use each row's `Include … in fit set` checkbox to choose 2 through 4 visible
bodies, then click Fit set. This frames their conservative original native
control-hull bounds with their current display poses. It keeps the primary
selection, source and poses. The pick filter does not change fit membership.
Hiding a member removes it; showing it does not re-add it. Reload, Clear,
context loss and Dispose clear membership. Membership changes discard pending
pose drafts with a status notice. Apply or Discard a numeric draft before
Fit set. Clear fit set removes only the host membership.

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

The panel also accepts a unitless uniform display-scale ratio from the public
`VIEWER_POSE_LIMITS.scaleMin` through `scaleMax`. Scaling is about the authored
source origin before yaw, translation and scene-unit conversion. It changes
display pixels, not native dimensions or area. The field only represents an
accepted pose whose X/Y/Z scale components are equal; it does not reduce a
nonuniform pose to a misleading single value. Unchanged drafts retain the
exact accepted scale vector, yaw quaternion and translation values.

The circular Move handle appears for a selected visible body when its original
Surface or Curve anchor projects onto the canvas. Drag it with the primary
pointer to preview a screen-plane move. Release after 3 through 256 CSS pixels
to update only that body's display translation. Apply or Discard any numeric
draft first. Pointer cancellation, a changed body/camera/pose, an oversized
move and a Viewer refusal leave the accepted pose in place. The handle uses
an approximate native-point projection; it does not test occlusion or edit the
CAD source. Fit remains a separate action.

The `↻ Y` handle is a screen-horizontal display yaw control for the same
selected body. Dragging 2 CSS pixels right adds 1 degree to accepted Y yaw.
The marker sits beside an approximate original native-point projection; it is
not a geometric rotation ring or CAD pivot. During drag, only the marker and
status preview move. Releasing after 2 through 160 CSS pixels applies the
selected body's new pure Y quaternion and updates the numeric yaw field.
Moving more than 24 CSS pixels vertically, exceeding ±180 degrees or leaving
a numeric draft pending refuses the gesture. Translation, scale, other body
poses and the original CAD source remain unchanged.

The optional `?proof` route exposes `window.viewerObjectTreeProbe` and tracks
Viewer-created WebGL resources for an actual browser lifecycle check. Its Lose
context button invokes the browser's `WEBGL_lose_context` extension to check
that the move handle is removed after context loss.
