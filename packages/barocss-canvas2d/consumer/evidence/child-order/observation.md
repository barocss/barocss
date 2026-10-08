# Public child order: compiled browser and file observation

This receipt covers one fixed Node 22.22.0 build and Headless Chromium 155/WebGL2 flow for Issue #808. The consumer imports the compiled public package entries; it does not import renderer source. It uses a 120 × 120 logical-pixel canvas at DPR 2, two overlapping layer-0 rectangles (Red and Blue), and a layer-1 Green rectangle inside Team.

| Checkpoint | Team child order | Pixel and hit at (40,40) | Pixel and hit at (70,70) |
| --- | --- | --- | --- |
| Initial | Red, Blue, Green | `[0,0,255,255]`, Blue | `[0,255,0,255]`, Green |
| Move Red to final index 2 | Blue, Green, Red | `[255,0,0,255]`, Red | `[0,255,0,255]`, Green |
| Reject index 3 | Blue, Green, Red | Red retained | Green retained |
| Open saved document on fresh generation-2 canvas/tree | Blue, Green, Red | `[255,0,0,255]`, Red | `[0,255,0,255]`, Green |
| Move reconstructed Blue to final index 2 | Green, Red, Blue | `[0,0,255,255]`, Blue | `[0,255,0,255]`, Green |

The rejected index returned `INVALID_SCENE` and left the rendered and tree scenes equal to the prior accepted scene. A real pointerdown on Red at (40,40) routed `Red → Team → stage`. The browser downloaded the actual [803-byte v1 document](order-document.json). After page reload, a file chooser opened that file into a new renderer, canvas and display tree; the restored Blue handle was moved again. [The final screenshot](reopened-edited.png) shows the second canvas after the restored edit. Browser console: zero errors and zero warnings.

The deterministic `child-order-probe.mjs` separately checks stage, container and frame moves, copied child lists and snapshots, reconstruction, stable handle identity/listeners, and 13 invalid direct-child/index cases with unchanged snapshots. This fixed test does not establish a global z-index, cross-parent reparenting, broad browser support or performance bounds.
