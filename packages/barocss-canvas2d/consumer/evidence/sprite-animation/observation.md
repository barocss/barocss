# Host-driven sprite animation: compiled browser and file observation

This receipt covers one fixed Node 22.22.0 build and Headless Chromium 155/WebGL2 flow for Issue #838. The compiled consumer imports the public package entries. It uses a 100 × 80 logical-pixel canvas at DPR 2, one stable Sprite over a yellow Back rectangle and two registered 2 × 1 RGBA8 atlases. A manual browser scheduler supplies deterministic timestamps to the public ticker; the ticker's `deltaMS` drives the public animation controller. The host explicitly submits a Scene v6 snapshot and renders after each changed frame.

| Checkpoint | Frame/source | (35,40) pixel/hit | (60,40) pixel/hit |
| --- | --- | --- | --- |
| Initial and first ticker callback (delta 0) | 0, cropped AtlasA red | `[255,0,0,255]`/Sprite | `[255,0,0,255]`/Sprite |
| Ticker delta 40 ms | 1, cropped AtlasA blue | `[0,0,255,255]`/Sprite | `[0,0,255,255]`/Sprite |
| Ticker delta 60 ms | 2, full AtlasB | `[0,255,0,255]`/Sprite | `[255,255,0,255]`/Back |
| Cold Open saved document | 2, full AtlasB | `[0,255,0,255]`/Sprite | `[255,255,0,255]`/Back |
| New controller, first delta 0 then delta 20 ms | 0, cropped AtlasA red | `[255,0,0,255]`/Sprite | `[255,0,0,255]`/Sprite |

A real pointerdown on the green frame routed `Sprite → stage`. The browser downloaded the actual [733-byte v1 document](sprite-animation-document.json) at frame 2. It contains only the referenced AtlasB asset. After reload, a file chooser opened it into a fresh generation-2 canvas/renderer/tree. The host explicitly registered AtlasA and bound a new controller at frame index 2 before advancing it. [The final screenshot](reopened-advanced.png) shows generation 2 after the red frame returns. Browser console: zero errors and zero warnings.

The deterministic `sprite-animation-probe.mjs` separately covers copied frames, exact boundaries, multiple-frame advance, looping, one-shot completion and restart through seek, paused and disposed behavior, 12 invalid frame cases, four invalid options, six invalid deltas, six invalid seeks and a refused source transition that retains controller state. This fixed manual-clock test does not measure real-time cadence, large spritesheets, broad browsers or devices.
