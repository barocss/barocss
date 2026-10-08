# Viewer Motion scene

This bounded browser example loads two weighted native BaroCAD surfaces and binds two targets to direct caller-owned Viewer pose frames at 0, 2, or 4 seconds. Viewer displays the poses and has no playback clock or clip dependency.

The explicit `part-xyz-matches-rhyup` declaration says these frames' part XYZ/mm axes already match Viewer's right-handed Y-up/mm surface axes. The declared `mmToSceneUnit` value is applied once. The source, IDs, and native UV remain available.

With Node 22 and the workspace packages built, run `node examples/viewer-motion-scene/server.mjs`. The default address is `http://127.0.0.1:52881/` and can be changed with `VIEWER_MOTION_PORT`.
