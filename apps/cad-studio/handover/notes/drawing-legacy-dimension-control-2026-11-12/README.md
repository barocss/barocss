# D755 — Refuse geometric control edits with an ambiguous dimension

P0, rows 11 and 16. FEATURE qualification. Parent `91c3f7939d8c0d4ee9c269d90fe1a48cd1950348`. [D754 dimension allocation](../drawing-dimension-ids-2026-11-12/README.md).

The manual geometric control editor requires exactly one matching dimension ID in the whole drawing before it commits a dimension-attached change. It uses the existing Drawing status for the reason. The editor keeps uncommitted field values when the commit is refused. Legacy dimensions remain readable and the operator can remove an exact duplicate from its sheet.

## Qualification

- **FAIL (parent)** — In a two-sheet drawing, a 30 mm Top dimension on sheet 1 and an Ø8 through-hole dimension on the A3 continuation both used `d1`. Add geometric control on the Top dimension saved `control-d1` and displayed `Ø0.1` under the continuation's diameter. No frame appeared on the selected Top dimension. Three desktop states across 332 frozen files. The first driver run found the same wrong attachment and compared the diameter to exact 8; the native result `8.000000000000002` passes a `1e-12 mm` comparison in the replay. Fixture SHA-256 `54b59b3259114fb02e70a3c71cf9b8781a2d0b427819ca0dafb94fc17868bde4`.
- **PASS** — Add geometric control from either sheet reports the duplicate ID and leaves the exact drawing, selected dimension and Undo/Redo state intact. Removing the continuation diameter leaves the original Top dimension. Undo restores both exact legacy dimensions and Redo removes only the continuation one.
- **PASS** — The unique Top dimension accepts one `control-d1` with position tolerance 0.1 mm. The first Undo and Redo restore exact states. Local-project Save, Close, reload and Open retain the frame and its visible `Ø0.1` on Top. Five current WebGPU desktop states across 332 frozen files. Zero page errors, console errors or downloads. Saved SHA-256 `737c77bebfaf1324c4a11df529afbb128b01dd8aa7c535876d70f081bce70149`.
- **PASS** — Studio 17/17 focused tests. Both type checks, affected lint, driver syntax, production build, diff check and the D754 four-state desktop replay.
- **FAIL, inherited** — Model 31 PASS and one deferred ASME PDF golden mismatch in `drawing-sheets`. The actual digest `a3c0e4473a82fab17f7cb9fe4f56cd65b769ba7078ba368aa989b3e17d0f036e` and expected digest `7643251eca96357dd48c9868cc0722c5c46e37bf9aad9f6d58c9b4bd368f4d3a` match the [recorded failure](../shaft-drawing-fix-2026-11-03/qualification.json). This change touches Studio editor files only.
- **NOT_RUN** — Full suites, mobile, Studio PDF, alternate frame authors, and presentation of an ambiguous frame already stored in a legacy file.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D755_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-legacy-dimension-control-browser.mjs "$EVIDENCE/baseline-replay" --baseline
D755_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-legacy-dimension-control-browser.mjs "$EVIDENCE/studio"
D754_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-dimension-ids-browser.mjs "$EVIDENCE/d754-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test drawing-composite-frame-consumer drawing-standalone-frame-consumer drawing-sheets
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test drawing-commit-roundtrip stop-work-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint apps/cad-studio/src/ui/DrawingWorkspace.tsx apps/cad-studio/src/ui/drawing/FrameEditor.tsx
node --check apps/cad-studio/test/drawing-legacy-dimension-control-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D756 checks whether a geometric control already saved with an ambiguous dimension can appear on the wrong sheet or in the current SVG. Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
