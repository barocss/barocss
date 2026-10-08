# C2D-05 SceneHistory observation

2026-10-08. Native parent `b4018264`, isolated `codex/canvas2d-702`. One compiled-dist Chromium session at `http://127.0.0.1:51240/examples/canvas2d-scene/`; browser and server stopped after capture. No package publication.

## Build and command invariant

- Node 22 with the existing integration toolchain: `pnpm --dir packages/barocss-canvas2d build:library` exited 0; bundle 60.1 KiB. `node --check` for main/history and `git diff --check` exited 0.
- `node examples/canvas2d-scene/history-probe.mjs` exited 0. A preview rendered x=42 without recording it, restore returned x=35, two commands reached x=50, undo/redo crossed x=45/50. Duplicate ID returned `INVALID_SCENE` without changing renderer scene, history cursor, redo or frame count. A 3-entry probe evicted the oldest entry; file replace started one new root.

## Actual browser

- Selected `MintCard` via visible hit at viewport `(560,253)`. Two `Move selected +10` clicks changed its local x from 100 to 120 and history to position 2/length 3. At x=120, the old `(560,253)` pixel was `[131,82,225,255]` with VioletCard hit; glyph pixel at `(580,253)` remained `[20,32,56,255]` with GlyphHI hit.
- UI Undo twice gave x=110 then x=100; Redo gave x=110 and kept a redo entry. A duplicate-ID command returned `INVALID_SCENE`. Before and after: history position 1/length 3 with redo available, pixel `[30,164,153,255]`, MintCard hit and local x=110 were identical.
- A pointer drag moved MintCard from x=110,y=95 to x=130,y=115. Four preview pointer moves produced one committed history entry and cleared redo. Dragging the FilledBadge quadratic control by (+20,-10) changed its authored control from `(145,153)` to `(165,143)` in one entry.
- Actual Save wrote [saved-after-edits.json](saved-after-edits.json); [screenshot](scene-after-edits.png) shows the accepted scene. Opening v0, then using Open JSON, restored v4, MintCard ID/x=130/y=115 and FilledBadge control `(165,143)`. History became one new root with Undo disabled.
- After one new command x=140, renderer recreation retained history length 2 and the visible old pixel. Undo after recreation returned x=130.
- The only console error was an unrelated missing `favicon.ico` (404). No UI error remained.

The record proves the bounded host command flow in one Chromium session. Selection and authored history are host state; this does not prove multi-selection, accessibility conformance, durable atlas bundling, or cross-browser behavior.
