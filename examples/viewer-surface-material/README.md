# Viewer qualified Surface material example

Build the Viewer library with Node 22. Start `node examples/viewer-surface-material/server.mjs`, then open the printed URL in Chromium with WebGL2. The host loads one native source0 Surface, compiles a CSS-shaped opaque material, supplies caller times 0/1/2, and sends one actual 256-particle Physics state. The page records its result at `/result`; set `VIEWER_MATERIAL_EVIDENCE` to save JSON outside the repository.

This example checks visible material colors, camera and pose retention, particle coexistence, refusal retention, explicit clear, scene replacement, and disposal. It does not certify performance, other material targets, or publication.
