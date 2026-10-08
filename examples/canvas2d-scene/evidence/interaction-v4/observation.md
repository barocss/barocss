# C2D-06 host interaction observation

2026-10-08. Native parent `f35f46c6`, isolated `codex/canvas2d-703`. One compiled-dist Chromium session at `http://127.0.0.1:52384/examples/canvas2d-scene/`. Browser/server stopped after capture. No package publication.

## Build and bounded host behavior

- Node 22 with existing integration toolchain: `pnpm --dir packages/barocss-canvas2d build:library` exited 0; bundle 60.1 KiB. `node --check` for main and `git diff --check` exited 0.
- `node examples/canvas2d-scene/interaction-probe.mjs` exited 0. It checked two-node translation, world-origin 10px snapping, ancestor+child selection moving only once, a rotated/scaled parent affine transform, and copied subtree deletion.

## Actual browser

- The initial accessibility snapshot exposed focusable toolbar buttons, a named `Scene objects` list of stable node IDs/kinds/layers, a live selection status, and enabled/disabled inspector controls. The list uses `aria-pressed` for selection. This is semantic DOM evidence, not full accessibility certification.
- Object-list click selected MintCard and Shift-click added VioletCard. With Snap 10px enabled, a pointer drag of (+13,+7) from MintCard moved its local origin `(100,95)` to `(110,105)` and VioletCard `(20,25)` to `(30,35)` in one history entry. Both object-list buttons remained pressed. After reopening, actual canvas click on VioletCard and Shift-click on MintCard also produced both selected IDs.
- After the final list-name and selection-click adjustment, a second Chromium pass verified that clicking MintCard in the object list collapsed the two-node selection. With Snap off, a canvas drag (+13,+7) moved MintCard `(100,95)` to `(113,102)` and VioletCard `(20,25)` to `(33,32)` together in one history entry. A subsequent plain canvas click on MintCard collapsed selection to that ID, and only its list button had `aria-pressed=true`.
- With Snap off, focused-object ArrowRight moved MintCard x=110→111; Shift+ArrowRight moved it to 121. Ctrl+Z gave 111 and Ctrl+Shift+Z restored 121. Width +10 and Height +10 changed the rect from 170×125 to 180×135; Rotate +15° set rotation to 0.2617993877991494 radians.
- A duplicate-ID command returned `INVALID_SCENE`. Before/after were identical: selected MintCard, history position 6/length 7, x=121, 180×135, rotation 0.2617993877991494, pixel `[20,32,56,255]` and GlyphHI hit at `(552,253)`.
- Actual [Save JSON](saved-interaction-v4.json) and [screenshot](scene-after-controls.png) captured the edited scene. Keyboard Delete removed MintCard and cleared selection/object-list row; Ctrl+Z restored its ID and authored values. Open v0 then Open JSON restored v4, MintCard x=121/180×135/rotation, an empty selection, and a one-entry history root without UI error.
- The only console error was an unrelated missing `favicon.ico` (404).

The interaction is a bounded host example. It does not implement caret/text shaping, asset bundling, document collaboration, screen-reader certification, or cross-browser support. The inspector offers +10 size and +15° rotation steps; it is not a continuous resize/rotate handle system.
