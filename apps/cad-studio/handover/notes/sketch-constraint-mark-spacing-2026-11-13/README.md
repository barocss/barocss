# D926 — separate nearby sketch constraint marks

2026-11-13 · SMALL · rows 09 and 15 · [#2377](https://github.com/barocss/barocss/issues/2377)

The actual Edit sketch view reproduced 33.022088188678026 CSS px² of overlap between Fixed marks for points 2 and 3. Layout now checks the rendered screen boxes of the marks and of ordinary and driving dimension labels. It first tries the existing position, then nearby offsets with a 2 px gap. The farthest tested offset is 40 px. A moved mark has a dashed line to its original point or edge midpoint. The layout operates on up to 128 explicit marks and retains the original position when its local search finds no room.

- **PASS** In Studio WebGPU, both Fixed marks kept their targets and the overlap fell to 0 px². The marks avoided all measured dimension labels at the initial size, after zoom and desktop resize, and after Edit sketch reopened. Moved leaders began at the independently projected original points within 0.02 px. The fixed view and resized view passed visual review.
- **PASS** Double-click opened the original 22 mm driving length. Escape canceled the draft. The accepted document, history, selection, solver status and dirty state stayed equal across zoom and resize. Finish retained the exact sketch node. A 2 mm Extrude returned one valid native solid and exactly 1096 mm³ within the 1e-8 mm³ tolerance.
- **PASS** 59 Studio focused checks, including 3 layout tests, both type checks, driver syntax and diff check. The passing desktop run reported zero page errors, console errors and downloads, and the source manifest matched through cleanup.
- **FAIL** The first baseline recorded the overlap, then the driver targeted the SVG rectangle behind its dimension text. The second baseline double-clicked the visible text and verified the original editor.
- **NOT_RUN** Dense-scene feedback, the other explicit mark types in Studio, native Save and fresh File Open, light theme, high-density screens, build, full suites and mobile. The wider issue stays open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
