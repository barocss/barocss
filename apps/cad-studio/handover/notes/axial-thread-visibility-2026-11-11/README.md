# D700 — Honor hidden-line settings for axial cosmetic threads

P2 B06, row 11. [#2421](https://github.com/barocss/barocss/issues/2421). Parent `a68c1cbe39ff30eb3438f7438f8b5802fe729451`. SMALL private drawing repair, implemented and verified with Sol Medium.

## First failure and decision

**FAIL.** On the parent, a 32 × 32 × 8 mm part has a Ø5 blind hole with saved M6×1 thread metadata, opening at Y = 32 mm and ending at Y = 27 mm. From Y−, the native front projection reports one hidden piece for each of the two opening arcs and two floor arcs. The original Studio sheet, actual SVG and actual DXF all show a solid Ø6 cosmetic arc with Hidden lines off and on. The physical rim is correctly omitted with Hidden lines off. Two new Model cases also fail on the original solid arc. The side and oblique control passes.

The axial branch uses the existing visibility of the rim group. If no rim piece is visible, omit the 270° cosmetic arc when Hidden lines is off and draw it with the hidden pen when on. Visible groups keep the thin pen. Empty pieces do not establish visibility. The Model uses the same marks for Studio and both exporters. The native projection, physical drill, side and oblique rules, and saved drawing format are unchanged.

### Baseline SHA-256 receipts

- Native projection probe `171992ca26a64a502b365600c83ead9fd5dcb85d5d6e4f89e04eb01ff99fbb49`
- Model `e35ad4481141c8d1e2f80eb96f66c23a71960561a84e825cbe91ccad363fdb59`
- Desktop and two independent SVG/DXF reads `f266eaf8878c8d36a59d6e7404d608ae2e3305d6926ee451713cda7302f4a944`

## Actual desktop and file readback

**PASS.** Chrome WebGPU at 1440 × 1000. Open the authored native project through Studio. With all four front rim pieces hidden, the cosmetic arc count is zero with Hidden lines off and one dashed arc with it on. The first Undo and Redo restore the exact drawing documents and matching marks. Save and reopen each setting in a fresh context. From Y+, the Worker returns two visible opening pieces and two empty floor piece lists. A single thin cosmetic arc remains in both Hidden lines states. Turning back to Y− restores the dashed result.

**PASS.** Apply a 5→6 mm depth edit through the actual feature editor. The floor moves from Y = 27 to 26 mm. The opening keeps its edge, the measured diameter stays 5 mm, and the callout changes from `M6×1 × 5 DEEP` to `M6×1 × 6 DEEP`. The existing reference upgrade records the opening's signature without rematching the edge. The first fixed runner stopped after this edit because it required the unsigned dimension object to remain byte-identical. Its first six export pairs had passed. Receipt SHA-256 `c82562e9eca51d87089ba8bee39800c4691742717a5b0d8d90b9f19f6658bbc6`. The final runner checks the exact signature addition as well as the unchanged edge, near point and placement.

**PASS.** ElementTree and ezdxf 1.4.5 read eight pairs of actual SVG and DXF 2000 files. The reader locates the center 10 mm from the front outline's left edge when seen from Y− and 22 mm when seen from Y+. Both use a 4 mm vertical offset and radius 3 mm at 1:1. The arc is absent, dashed on HIDDEN, or solid on THIN as specified. The DXF sweep is 270°. Both readers preserve the expected Ø5 physical rims, center marks and callout. DXF audit reports zero errors and fixes in all eight files.

## Verification

- **PASS.** From Studio run `D700_SOURCE_FROZEN=1 node test/drawing-thread-visibility-browser.mjs "$EVIDENCE" --fixed` under `gate.sh` with Node 22.19.0 and the existing Chrome, Playwright and ezdxf. Eleven observations and eight file pairs pass. Four desktop screenshots were reviewed. All 327 frozen paths match through cleanup. Browser downloads, page and console errors, and watched source changes are zero. Final receipt SHA-256 `871c1080a674a1b84e36e3a7994c4644f3baafa85d6f84e8bea5d936b161e31d`. The `--baseline` run intentionally reports the original solid-arc failure after it captures both states.
- **PASS.** The three new Model tests cover internal and external threads, visible and hidden groups, empty pieces, coaxial rims, reversed view direction, scale and placement, repeated calls, side views, oblique omission, unthreaded inputs, iso and omitted views. Existing drawing, viewport thread, saved hole and drawing currentness controls pass. `pnpm --filter @barocss/cad-studio-app test drawing-commit-roundtrip` passes 4/4. Model and Studio type checks, scoped ESLint, Node and Python driver syntax, and Git whitespace checks pass.
- **FAIL, inherited.** `TEST_CONCURRENCY=2 pnpm --filter @barocss/cad-model test drawing-thread-visibility drawing.test threads.test hole-thread-depth-compatibility drawing-current-contract` selects 48 tests, 47 PASS and one `chat-drawing` failure with `TEXT_OVER_LINES` for dimension 12. The filename substring selects this extra file. The failure reproduces with the exact parent source and matches [D698](../detail-hidden-lines-2026-11-11/README.md). The parent check SHA-256 is `e07d0a7f8ac655e0d7f36a9dcf57a7bc0ba97b478e67078ae83a2fa924fa2c22`. Fixed run SHA-256 `7c896961b11cef0368a14ddbdee439e0ce209ad3abc70e3b5920a327a4db5048`.
- **NOT_RUN.** Full suites, PDF, partial-occlusion clipping, new thread catalog admission, assembly and pattern identity. B06 remains unadjudicated. Initial scenarios remain 5/10 accepted. Whole CAD and core readiness remain NOT_MEASURED.

Next D701 checks whether a new Detail inherits a deleted Detail's dimensions when its letter is reused. This is the B06 missing-reference and view ownership check. [#2366](https://github.com/barocss/barocss/issues/2366)
