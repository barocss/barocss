---
work_id: D555
artifact_type: viewport-pointer-input-extraction
status: qualified-for-selected-desktop-gestures
last_updated: 2026-11-10
---

# D555 — Extract the viewport pointer input lifecycle

P4, rows 20–22. The owner selected this follow-up to [D554](../viewport-sketch-overlay-2026-11-10/README.md). The product parent is `26789a0b23ca55013c03a70cda9d04098b685aa1`. The prior P0 clipboard history intake moves to D556.

The private `viewportPointerInput.ts` owns canvas pointer and wheel dispatch, drag and sketch draft refs, pointer capture, native drag/drop and picking helpers. Viewport keeps its canvas, camera, renderer, focus and overlay lifecycles. The same component registers the effects in the same order. The source comparison matched 43 named arrow bodies, including nested helpers. Pointer move differed only in its equivalent sketch accessor. App, SceneViewport, the sketch overlay and the cad-model package manifest match the parent bytes. Viewport.tsx went from 1,582 to 902 lines. The new input module has 794 lines.

## Actual Studio

The existing selection, context menu and 60 mm inline sketch flow passed. The existing construction-circle Band flow passed at width 3, 5 and 3. The rendered path returned exactly to its original state.

The first pointer run passed wheel zoom and middle-button pan. Pan continued beyond the canvas under capture and stopped on release. The left toolbar covered the first marquee start and the bottom controls covered its end. The first driver stopped before sending marquee input. The second driver used two public wheel steps to expose both endpoints. Left-to-right marquee then selected the sole body only on release and preserved the accepted document. That run stopped before Width X input because the driver looked for the command HUD before beginning the drag. The HUD opens during the drag.

The final continuation began from the same retained 10 mm box and ran the handle case only. Width X reached 11 mm during the drag. After release, the HUD and inline value box agreed at 11 mm. The accepted document stayed exact until Apply. The applied box measured 1,100 mm³ with an absolute budget of 1e-6 mm³. First Undo restored the original document exactly. Root inspected the marquee result and handle preview captures.

All five runs closed their owned context, Chrome and Vite. Each kept its recorded source pins through cleanup. Page errors, console errors, watched changes and downloads were zero. The executed driver versions, commands, hashes and runtime counts are in [qualification](qualification.json). Raw evidence stays outside Git.

- **PASS** — source comparison, scenario syntax, Studio and final Model types, the selected desktop cases, and owned cleanup.
- **FAIL** — two driver checks before the intended gesture. The retained prefixes and the final handle continuation qualify the selected cases.
- **NOT_RUN** — other pointer tools and cancellation paths, native drag/drop, Print and renderer recovery runtime, full kernel and mobile. Whole CAD is NOT_MEASURED.

Next is D556, P0 rows 12 and 16. Reproduce the clipboard history crossing after a successful Open. [#2310](https://github.com/barocss/barocss/issues/2310).
