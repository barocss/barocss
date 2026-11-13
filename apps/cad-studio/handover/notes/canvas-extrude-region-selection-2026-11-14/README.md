# D1134 — Carry a canvas region pick into Extrude

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2459](https://github.com/barocss/barocss/issues/2459)

A click in a tagged material interior can highlight an individual region. A nearby outline selects the sketch. Shift toggles regions in the same sketch. Extrude reads a single selected region and explicitly refuses several. The Browser retains the whole-sketch route. Region indices clear when authored nodes change. Visible geometry takes precedence over a retained sketch profile, and explicit body, face and edge filters bypass profile hits.

| Result | Check |
| --- | --- |
| PASS | Desktop Studio highlighted the isolated region alone, then the isolated and shared-edge regions together. E refused two selected regions before preview and retained the document. Shift removed the isolated region, and the remaining Region 2 went directly to the HUD. |
| PASS | The 2 mm preview applied only the shared-edge rectangle. Strict native evaluation verified one body, centroid (19, 12, 1) mm, volume 240 mm³ and the exact source edge IDs. Undo and Redo restored the exact documents. |
| PASS | After Apply, Pick all selected the front cap in its source footprint. Bodies selected the same solid. After framing both regions, the empty neighboring profile remained selectable in Pick all. |
| PASS | The HUD-only, full-sketch and two-sketch controls passed. Sol High reviewed body and region hit ownership. Studio 22/22, Model 53/53, both type checks, build, scoped lint, syntax and diff passed. |
| FAIL | An initial body regression run clicked an out-of-frame remaining region. The revised driver frames both points. The next type check required an explicit shared pick result type. Final Studio and scoped checks passed. |
| NOT_RUN | Competing projected interiors from different sketches, arbitrary contours or holes in an individual region, direct transfer from an Overlaid Lines occurrence to the chosen Trim target, full suites and mobile. |

#2459 remains open for the direct Overlaid Lines to Trim route. Desktop QA is **21/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
