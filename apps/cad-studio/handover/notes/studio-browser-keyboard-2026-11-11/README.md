---
work_id: D667
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D667 — Keep Browser Space and palette Escape local

P4, row 21. SMALL qualification for keyboard activation and focus in desktop Studio.

Space activates a focused Browser button through its native click. Escape on the Box row clears the body selection and leaves focus on the row. The workspace still uses Space to open the command palette. When the palette handles Escape, it closes and preserves the existing model selection.

| Check | Result | Evidence |
| --- | --- | --- |
| Original Browser Space | FAIL | At 1280 × 720, Tab reached the Box row. Space opened the command palette with zero selected bodies. Closing it on Escape left focus outside the row. |
| Palette Escape after the Browser fix | FAIL | Opening the palette from the workspace with the Box selected kept the selection. Escape closed the palette and also cleared the body selection. |
| Final desktop Studio | PASS | Tab reached the Box row. Space and Enter selected the Box. Escape cleared the row selection and retained visible keyboard focus. Space over the workspace opened the palette and focused the search. Search found Chamfer. Escape closed the palette and kept the existing selection in the selected-body control. The working document and history stayed exact. |
| First driver attempts | FAIL | The first driver added a Box to the starter plate. The next role lookup excluded the Browser while the palette hid it from accessibility APIs. The first fixed driver clicked a canvas position covered by the toolbar. The final driver starts a new part, checks the same row while hidden, and clicks an exposed viewport position. |
| Focused Studio checks | PASS | 17 focused tests. Studio and CAD Model TypeScript, changed source lint, browser script syntax and the Studio production build passed. |
| Wider coverage | NOT_RUN | Other Browser row types, the full Studio flow and the five adapted cut-pattern flows, mobile and whole CAD readiness. |

Use Node 22.19.0. Run one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. Run browser commands from `apps/cad-studio` and use an external `EVIDENCE` directory.

- Baseline `D667_SOURCE_FROZEN=1 node test/browser-row-keyboard-browser.mjs "$EVIDENCE/reproduced" --baseline`. Receipt SHA-256 `64b140e9ba2e5645071258467a421cd8e6c7f279b42f2b56e4c9569c02912ded`.
- Driver setup failures SHA-256 `af842248639feb9e34f17c54700666a3f43ac527208b3275638fb323a1743bf1`, `4318e71b576e208b4a0c20dd259f3f08a1167767928f7ab019ad7bfb83374fce` and `7086d56555ddc341f48e794041bfcfa49d82b1317c295aa7617c123f3355a992`.
- Palette Escape failure receipt SHA-256 `f5e5f1ee6cf3efc1d2c20a213e29062b3923f388949b4410637708ba1427f7bf`.
- Final desktop `D667_SOURCE_FROZEN=1 node test/browser-row-keyboard-browser.mjs "$EVIDENCE/final" --fixed`. Receipt SHA-256 `38e64694ec1e683cd281444c587740e77cbaeec5f451f422dd5bb72fed04ebb8`. The flow verified 320 frozen files through cleanup and recorded zero page errors, console errors or downloads.
- From the repository root run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test palette nested-selection`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm --dir packages/barocss-cad-model run type-check`, `pnpm exec eslint apps/cad-studio/src/App.tsx apps/cad-studio/src/ui/Palette.tsx`, `node --check` for the eight changed browser scripts, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/vite-build"` and `git diff --check`.

The affected browser drivers use the workspace shortcut after leaving Browser button focus. The final Studio run exercises this helper with an existing selection. Initial scenarios remain 4/10, B09 remains 9/9 and whole CAD readiness is **NOT_MEASURED**. D668 checks model framing against the visible work area. [#2287](https://github.com/barocss/barocss/issues/2287) remains open for broader contextual UI acceptance.
