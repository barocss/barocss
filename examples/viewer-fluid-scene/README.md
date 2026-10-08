# Viewer fluid Surface proof

Build the Viewer, Physics and CAD interop workspace libraries with Node 22. Start `node examples/viewer-fluid-scene/server.mjs`, then open the printed URL in Chromium with WebGL2. The page runs one actual host-owned Physics world through steps 0, 60 and 240, displays its copied metre positions through Viewer, and posts a JSON result to the server. Set `VIEWER_FLUID_EVIDENCE` to an output file path to retain the result.

The native source0 Surface is a display occluder. Its pose is moved only to show shared depth; it is not a Physics collision object. The proof checks one canvas/context, 256 point submissions, raw metre SHA-256 values, one metre-to-scene conversion, frame retention, camera/selection/visibility, layer clear, replacement and disposal. It does not certify CFD, exact CAD collision, timing or publication.
