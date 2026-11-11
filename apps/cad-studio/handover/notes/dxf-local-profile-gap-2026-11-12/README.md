# D725 — Keep DXF profile gaps independent of world position

P0, rows 13 and 16. FEATURE qualification of the Model DXF admission tolerance and Drafts consumer, with independent numerical review and isolated mutations. Parent `3324cb48dd4685ce1675fb2e8b31ff6f24d1b711`. [#2403](https://github.com/barocss/barocss/issues/2403).

Four self-authored LINE records had a 0.125 mm gap. The parent refused the contour at the origin. It accepted the same contour as a draft at X = ±1,048,576 mm and when an unrelated circle at X = 1,048,576 mm appeared before or after the LINE records. It assigned area 200 mm² in three of those cases and 198.75 mm² with the entity order reversed.

The same inclusive Euclidean distance of 1e-6 mm now applies at every join after conversion to millimetres. This was the previous minimum allowance and matches the draft's coordinate resolution. A join with multiple candidates reports `DXF_OPEN`. Round recognition compares the retained centre and radius of each authored arc against the first arc, including reversed arcs. Its tolerance is the greater of the existing native linear floor (1e-7 mm) and the relative linear factor (1e-11) times the smaller radius. Neither test adds a world-coordinate allowance. The result applies to represented binary64 coordinates. The tolerance does not recover distinctions that input quantization removed.

## Qualification

- **PASS** — Actual desktop Chrome WebGPU, 9 states and 792 frozen inputs through cleanup. Add drawing refused all five open profiles and preserved the host solid, existing draft and segments, body selection, dirty state and available Redo. Redo restored the earlier closed draft edit. The 20 × 10 mm control had area 200 mm². Editing its width to 25 mm produced points [24,30], [49,30], [49,42.5] and [24,42.5]. A browser-project Save and fresh Open retained the edited profile. It remained editable to width 30 mm, and Undo restored the saved state. Native SHA-256 `79d2cda69e794871ed0f3826344d9c698b25bcfa7bbcb60cfad88efcba41e60e`.
- **PASS** — Independent source-group comparison confirmed the represented gap at the origin and both translations. Exact closed controls retained area 200 mm², translated bounds and no holes at ±1,048,576 mm in the parser. Focused tests covered X and Y joins, near-boundary and inclusive-axis values, a refused diagonal, mm/inch/metre, duplicate and branch refusal, reverse ARC, opposite bulge winding, AC1015, AC1009 and underlay fixtures. The mixed-radii loop retained two arcs and area 46.405037823536006 mm². Equal-radius controls retained area 16π mm². These compare against independent analytic values.
- **PASS** — The isolated mutation harness detected world-position growth, the old axis-box distance, radius inference from snapped points, and greedy ambiguous joining. The unmutated control passed. The D721 desktop TEXT regression replay passed 8 states. Model 25/25 and Studio 38/38 focused checks, both type-checks, affected lint, syntax, diff check and Studio production build passed.
- **FAIL** — The parent silently created the four incorrect closed drafts. The first baseline harness expected area 200 mm² after reversing the entity order. The first focused harness expected a branch diagnosis after starting on a dead-end edge, where the reader correctly returns an open-profile diagnosis. Final runs preserve and distinguish both observations.
- **NOT_RUN** — Full package and kernel suites, mobile, independent third-party app, general DXF healing, and modeling at interchange-only large coordinates. The kernel and native file schema are unchanged.

The closed and open fixtures are generated from explicit DXF groups. The translated +X fixture SHA-256 is `92ee0ca473907d03a0494d4c603b41c6d51fb653341eb6ce63c7a045117fa790`. Evidence remains outside Git.

Run with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. Use the baseline switch with the parent production source.

```sh
D725_SOURCE_FROZEN=1 node apps/cad-studio/test/dxf-local-gap-browser.mjs "$EVIDENCE/studio"
D721_SOURCE_FROZEN=1 node apps/cad-studio/test/reflected-dxf-text-browser.mjs "$EVIDENCE/d721-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test dxf drafts
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test draft project-open-ownership
node "$EVIDENCE/mutations.mjs" "$PWD" "$EVIDENCE/mutation-results"
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/sketch/dxfRead.ts
node --check apps/cad-studio/test/dxf-local-gap-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D726 checks whether library sharing accepts an invalid default configuration when the named variants pass. [#2417](https://github.com/barocss/barocss/issues/2417). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
