# D375 — Row 05 closed: Viewer product close-out

Tier: **small** (close-out). Owner order "Go to 01–06", 2026-10-31. [Qualification](qualification.json).

**Viewer package**
- Types pass, and the unit tests pass 62/62.
- The actual WebGPU browser tests pass 3/3: draw/pick/select/resize/clear, the D319 Geometry lifetime check ([receipt](d319/receipt.json)) and the native lights and materials.
- The first D319 attempt failed only because its artifact-directory variable was missing.

**cad-viewer app**
- Types pass, the unit tests pass 133/133, and the build check passes.
- One actual app flow ran in the built-in browser:
  1. The assembly sample opened, and 4 instances loaded.
  2. An instance was selected; its path and placement are shown.
  3. A saved view was added.
  4. A native point was inspected.
  5. Close CAD file returned the app to Ready.
- The console showed no errors.

**Limits**
- PNG export downloads a file, so it was not run in the UI; a unit test covers it.
- Limited IGES, driver/OOM and device-loss recovery stay outside this close-out, as the row says.
- CI and release NOT_RUN.
