# Public cross-parent reparent: compiled browser and file observation

This receipt covers one fixed Node 22.22.0 build and Headless Chromium 155/WebGL2 flow for Issue #809. The consumer imports compiled public entries. It uses a 140 × 80 logical-pixel canvas at DPR 2, container A at (0,0), container B at (70,0), Red with local transform (10,10) and Yellow under B.

| Checkpoint | A children | B children | Pixel and hit at (20,20) | Pixel and hit at (90,20) |
| --- | --- | --- | --- | --- |
| Initial | Red | Yellow | `[255,0,0,255]`, Red | `[255,255,0,255]`, Yellow |
| Move Red to B index 1 | empty | Yellow, Red | `[0,0,0,0]`, null | `[255,0,0,255]`, Red |
| Reject index 99 | empty | Yellow, Red | transparent/null retained | red/Red retained |
| Open saved document on fresh generation-2 canvas/tree | empty | Yellow, Red | `[0,0,0,0]`, null | `[255,0,0,255]`, Red |
| Move reconstructed Red back to A | Red | Yellow | `[255,0,0,255]`, Red | `[255,255,0,255]`, Yellow |

Red's local transform remained (10,10) during both moves. A real pointerdown at (90,20) after the first move routed `Red → B → stage`. The invalid index returned `INVALID_SCENE` and retained child lists, accepted/tree scenes, pixels and hits. The browser downloaded the actual [764-byte v1 document](reparent-document.json). After page reload, a file chooser opened it into a new renderer, canvas and display tree, and the reconstructed Red moved back to A. [The final screenshot](reopened-edited.png) shows the second canvas after that edit. Browser console: zero errors and zero warnings.

The deterministic `reparent-probe.mjs` separately covers stage/container/frame destinations, insertion, copied children, reconstruction, stable handle/listeners, changed event ancestry, 15 invalid moves and a rotated-frame clip rollback. This fixed case does not establish cross-tree transfer, automatic world-pose preservation, broad browser support or performance bounds.
