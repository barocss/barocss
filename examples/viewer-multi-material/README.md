# Viewer qualified multi-Surface material example

Build Viewer with Node 22. Start `node examples/viewer-multi-material/server.mjs`, then open the printed URL in Chromium with WebGL2. Set `VIEWER_MULTI_MATERIAL_EVIDENCE` to an output file path to retain the browser result.

The host loads two source0 models with the same original Surface ID and distinct qualified aliases. It compiles two CSS-shaped opaque materials, checks separate pixels and per-target changes, then exercises camera, pose, selection, visibility, refusal, replacement, clear and disposal. The example does not certify other material targets, performance or publication.
