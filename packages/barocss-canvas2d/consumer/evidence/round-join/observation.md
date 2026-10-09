# C2D-62 round path joins: native observation

The native chain `520bd6db` → `85dba295` → `3f79f99c` is based on the separately verified #938 local `develop` merge `9a524be0`. Only `packages/barocss-canvas2d/**` changed.

- Node 22 library build (184.0 KiB) and strict compiled consumer type check passed. The focused `probe.mjs` accepted v18 stroke without join, rejected v18 join and missing/unknown/extra v19 join, checked public bevel default and join-only butt cap default, checked transformed vertices within public world bounds and atomic invalid edit, compared straight, open-turn, reversal-disk and closed-seam vertices, and refused a device-tolerance limit with `SCENE_LIMIT`. V turn vertices: bevel 15, round 27; reversal 63; closed triangle 84.
- Actual Chromium 155/WebGL2 at DPR 2: the exterior pixel `(43,17)` was gray/Back for bevel and `(43,52)` was blue/Round for round join. Centers stayed blue. Empty `(45,15)` and `(45,50)` stayed gray. A real pointer down at the round exterior recorded `Round:Round`, `stage:Round`. Console warnings and errors: zero.
- The transformed Turned path returned world bounds `{x:64.07072938718429,y:14.07072925567627,width:22.465146755416583,height:33.07174587249756}` and local bounds `{x:-5,y:-5,width:20,height:30}`. Invalid join and invalid view edits returned `INVALID_SCENE`/`INVALID_VIEW` and retained the pixel/hit observation.
- Real Save chooser produced `document.json` (1,528 bytes; SHA-256 `79b28f1cbaea88601044faf55ab276100fa4a044089827ad2c0d5e460b377dd2`). It exactly matched the committed artifact. The file input reopened it as a v1 Scene v19 document on a fresh canvas/renderer/tree (generation 2). The round exterior stayed blue/Round. Editing the restored Round handle to bevel changed it to gray/Back.

The separate local `develop` merged-head acceptance is pending.
