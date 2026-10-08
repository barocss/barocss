# C2D-40 native consumer observation

Source: local `@barocss/canvas2d` build on the exact `1719837e` merged parent. Chromium 155, WebGL2, 100×80 logical pixels, DPR 2. The host imported only the two public package entries. This is one browser and one fixed scene.

- Initial sprite at `(10,10)` was red `[255,0,0,255]` and hit `Sprite` at `(15,15)`. The later target `(35,25)` was gray `[64,64,64,255]` and hit `Back`. The horizontal line was blue `[0,0,255,255]` and hit `Line` at `(80,20)`.
- `setPosition(30,20)` and `setScale(2,2)` moved the sprite and made `(35,25)` and `(45,35)` red Sprite hits. The old point became a gray Back hit. `setRotation(π/2)` moved the line ink and hit to `(70,30)`; the old line point became a gray Back hit.
- A real canvas pointerdown at the moved sprite reached `Sprite`, then `stage`. A second at the rotated line reached `Line`, then `stage`. `setScale(0,1)` returned `INVALID_SCENE` and retained the same observation.
- The browser downloaded the 1,039-byte v1 JSON document. After page reload, the file chooser opened that actual file on a fresh canvas, renderer and display tree. Scene v9 transforms, all four asset bytes and the measured pixels/hits matched. Editing the restored sprite with `setPosition(50,20)` changed `(65,25)` to a red Sprite hit and `(35,25)` to a gray Back hit. [Screenshot](reopened-edited.png) and [saved document](document.json) are retained here.
- Browser console: zero errors and zero warnings. This observation does not establish broad device compatibility or rendering performance.
