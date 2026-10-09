# C2D-60 polyline native observation

- Parent: verified local `develop` merge `e9da07341cf98ab89f70d4dffd5f00a2edfdd98f` (#932).
- Node 22 library build: 178.2 KiB; strict compiled consumer type check: pass.
- Focused probe: ordered `M,L,L` without `Z`, frozen input, copied output, 12 invalid arrays/points rejected with prior commands retained, two 128-point polylines at the 256-command limit, next append `SCENE_LIMIT`, explicit `closePath` and existing polygon behavior: pass.
- Chromium 155/WebGL2 DPR 2: both V segments at (35,40) and (65,40) show `[0,0,255,255]` and hit `Line`; interior (50,30) shows background `[64,64,64,255]` and hits `Back`. Real pointer at (35,40) routes `Line:Line`, `stage:Line`. Rejected path edit retains the frame. Browser console: zero warnings and errors.
- Real Save chooser produced `document.json` (722 bytes). Open input staged that exact file on a fresh canvas/renderer/tree, generation 2, with matching pixels/hits. Editing the restored path moved the middle vertex from y=60 to y=50; old segment sample (35,40) became background and new (35,35) became blue.
