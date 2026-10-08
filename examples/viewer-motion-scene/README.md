# Viewer Motion scene

This bounded browser example loads two weighted native BaroCAD surfaces and binds two targets from one public `@barocss/motion` clip. The caller samples at 0, 2, or 4 seconds. Viewer displays the poses and has no playback clock.

The explicit `part-xyz-matches-rhyup` declaration says this clip's part XYZ/mm axes already match Viewer's right-handed Y-up/mm surface axes. The declared `mmToSceneUnit` value is applied once. The source, IDs, and native UV remain available.

With Node 22 and the workspace packages built, run `node examples/viewer-motion-scene/server.mjs`. The default address is `http://127.0.0.1:52881/` and can be changed with `VIEWER_MOTION_PORT`.
