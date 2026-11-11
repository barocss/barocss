# D698 — Apply Hidden lines to Detail views

P2 B06, row 11. [#2408](https://github.com/barocss/barocss/issues/2408). Parent `a39e79c53256037c408f822695e8e8a6d85a010b`. FEATURE verification of the existing drawing setting.

## Decision

Use the drawing's Hidden lines setting when generating orthographic Detail marks. The same mark loop handles a parent on the same sheet or on a different sheet. Section details retain their visible edges and hatch policy. The detail parent lookup continues to handle placement and projection. The clipped projection retains its hidden pieces and the dimension resolver reads the same edge and point references. Studio, SVG and DXF consume the filtered marks.

## Actual desktop Studio

**PASS.** Chrome WebGPU at 1440 × 1000. Open the 64 × 32 × 8 mm native starter plate with its Ø8 through hole. Detail B enlarges a model disk centered at (36, 8) with radius 4 mm to 5:1 on A3. Its paper center is (330, 80) mm. The native front projection gives the visible top segment from (32, 8) to (40, 8) and the clipped hidden side from (36, 4) to (36, 8). The latter's original endpoint references resolve an 8 mm vertical dimension.

| Flow | Parent hidden marks | Detail hidden marks | Detail dimension |
| --- | --- | --- | --- |
| Same sheet, on → off | 2 → 0 | 1 → 0 | 8 mm |
| First Undo → first Redo | 2 → 0 | 1 → 0 | 8 mm |
| Move Detail B to Sheet 2, off → on | Parent on Sheet 1 | 0 → 1 | 8 mm |
| Separate native Saves and fresh Opens, off / on | Parent on Sheet 1 | 0 / 1 | 8 mm |

The checkbox edit changes only `drawing.hidden`. On the split drawing, Sheet 1 retains the parent and its `SEE SHEET 2` marker. Sheet 2 retains `FROM SHEET 1`. Toggling from Sheet 2 also updates the parent when viewed on Sheet 1. Both reopened documents match their accepted native Save bytes. The raw Front projection reports two hidden pieces in all eight observations. The source feature nodes and the authored dimension references match the original. The existing hidden-reference drawing notice remains available.

**PASS.** Six actual SVG and DXF 2000 pairs cover same-sheet on/off, split-sheet off/on and each saved state after fresh Open. ElementTree and ezdxf 1.4.5 read the exact visible segment (310, 80)–(350, 80) and the hidden segment (330, 80)–(330, 100), with the DXF Y axis reversed about 297 mm. The hidden segment appears once when enabled, with the SVG dash and DXF HIDDEN layer. When disabled, both outputs omit that segment. The visible line, 20 mm paper radius, 8 mm dimension and the same-sheet Top center marks remain. DXF audit reports zero errors and fixes.

## Verification

- **PASS.** Run under `gate.sh` with Node 22.19.0 and the existing Chrome, Playwright and ezdxf. From Studio run `D698_SOURCE_FROZEN=1 node test/detail-hidden-browser.mjs "$EVIDENCE"`. Receipt SHA-256 `981b2b8153e69b69aeefac9808fa888be4cf287092905acf39c2c820125e31cd`. All 328 frozen paths match through cleanup. Zero browser downloads, watched source changes, page errors and console errors. The native projection probe SHA-256 is `eff8f3feef7f1f85b8643051df92dfe8a6b644d6a4438458093b14d4bb079d46`.
- **PASS.** `TEST_CONCURRENCY=2 pnpm --filter @barocss/cad-model test drawing-detail drawing-breaks reorient drawing-current-contract` passed 37/37. It covers Front/Top/Right mark filtering, clipped line and arc controls, tangent ink, the unchanged hidden reference, a broken parent, section hatch and orphan behavior, orientation and currentness. The Model checks both supported split-sheet orders, including parent on Sheet 3 with Detail on Sheet 2. The current file format assigns an unlisted Detail to its parent, including when the parent is on Sheet 2. The opposite sheet order uses explicit assignments for both sheets.
- **PASS.** Studio drawing history 4/4 via `pnpm --filter @barocss/cad-studio-app test drawing-commit-roundtrip`. Both type checks, scoped lint, driver and reader syntax, and Git whitespace passed.
- **FAIL, original product.** In Studio, turning Hidden lines off produced zero hidden Front marks and one hidden Detail mark. Independent reads of those original SVG and DXF bytes find the same unwanted segment in both. Receipt SHA-256 `23d5a35de606e345c4d20648273009a485baa782eea280cbf8c63aa0c6b032bf`. An earlier runner assertion omitted Studio's default part-scope normalization. The final fixture declares that scope. Runner receipt `0e2bd354628ed1c54a37670f66e1f75cba23644eed0cf795073c99e32cd36255`.
- **FAIL, inherited checks.** The expanded Model run `pnpm --filter @barocss/cad-model test drawing-sheets chat-drawing` passed 30/32. Its accepted-tolerance text overlap and ASME PDF hash failures match D697's results at this parent. [D697 evidence](../auto-layout-refusal-2026-11-11/README.md).
- **NOT_RUN.** Full suites, new PDF or DXF R12 qualification, and browser-managed file delivery. Whole B06 remains unadjudicated. Initial scenarios remain 5/10 accepted. Whole CAD and core readiness remain NOT_MEASURED.

Next D699 checks whether section culling retains a crossing body far from the origin. Compare equivalent near-origin and translated sections and a true miss. [#2418](https://github.com/barocss/barocss/issues/2418)
