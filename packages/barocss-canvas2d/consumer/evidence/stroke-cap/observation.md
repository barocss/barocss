# C2D-61 path stroke caps native observation

- Parent: separately verified local `develop` merge `9c378714cfc3eca4d0981fed9fa52a125327e608` (#933).
- Node 22 library build: 181.7 KiB. Strict compiled consumer type check: pass.
- Focused probe: Scene v17 accepts legacy stroke and rejects cap; Scene v18 requires exact cap; public omission writes `butt`; invalid/missing/extra style fields refuse; invalid `setPath` retains snapshot; 10px square and round caps produce 18 and 36 stroke vertices; closed path geometry remains identical for round/butt; large composed device cap refuses `SCENE_LIMIT`; v1 JSON round-trip retains cap.
- Actual Chromium/WebGL2 DPR 2: endpoint sample (16,20) is gray/Back for butt; (16,40) is blue/Square; (16,60) is blue/Round. Corner (16,36) is blue/Square while (16,56) is gray/Back. Center stroke is blue/Butt and empty space is gray/Back. Real browser click at (16,40) routes `Square:Square`, `stage:Square`. Invalid cap edit returns `INVALID_SCENE` and retains the sampled frame. Browser console: zero warnings/errors.
- Rotated round path at x75 has blue/Rotated at (75,14), gray/Back at (75,11), world bounds `{x:71.25,y:12.5,width:7.5,height:45}` and local bounds `{x:-5,y:-5,width:30,height:10}`.
- Real Save chooser produced `document.json` (1,688 bytes). File input reopened that exact v1 Scene v18 document on a fresh canvas/renderer/tree (generation 2), with matching cap pixels/hits and transformed bounds. Editing restored Round to butt changed (16,60) from blue/Round to gray/Back.
