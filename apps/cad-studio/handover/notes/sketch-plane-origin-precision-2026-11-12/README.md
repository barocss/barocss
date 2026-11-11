# D739 — Preserve sketch plane origins and offsets

P1, rows 09 and 16. FEATURE qualification. Parent `5f53d0bc61df4bb605f2b0fda0685fe2f9738e52`. [#2363](https://github.com/barocss/barocss/issues/2363).

The plane origin and authored offset now use the computational coordinates. Short plane labels retain their display formatting. The offset input retains the entered numeric value and ignores an empty intermediate input. Face sketching, face profiles and section sketches use the native planar point and outward normal when present. A legacy planar mesh face retains its centroid and normal fallback. Local outline fitting retains its existing precision. The direction normalization, plane basis and default XY omission rule stay as before.

## Qualification

- **FAIL (parent)** — Actual Studio displayed +0.0004 and −0.0004 mm but stored the default XY plane. It stored +0.0006 mm as +0.001 mm. The B-rep vertices of the extrusions started at the rounded positions. Native Top, Right and Left faces at Z=8.0004, X=40.0004 and X=0.0004 mm became sketch origins 8, 40 and 0 mm despite the display face centroid already carrying the native level. The baseline driver passed its 16 reproduction and control states.
- **PASS** — Actual Studio retained +0.0004, +0.0006, −0.0004 and +0.00004 mm, and accepted 0 and 12.5 mm controls. Native extrusion spans match the authored base and the signed 3 mm displacement. The positive small offset gives `[0.0004, 3.0004]` mm and the negative small offset gives `[-0.0004, 2.9996]` mm. Real face picks preserve the exact native levels and outward direction. Native spans are `[8.0004, 11.0004]` mm on Top, `[40.0004, 43.0004]` mm on Right and `[-2.9996, 0.0004]` mm on Left. The independent expectations use authored levels, signed displacement and rectangle area. The test reads native B-rep vertices separately from the Studio volume. The absolute tolerances are `1e-9 mm` and `1e-7 mm³`.
- **PASS** — First Undo and Redo, unchanged sketch reopen and Finish, local-project Save and fresh Open retain the exact +0.0004 mm plane and its solid. Twenty current desktop states over 790 frozen inputs. Zero page errors, console errors and browser downloads. Face-source SHA-256 `51b3047dc2242bbd253b7d42ce9f9775e38db4ca44ffb44d1ad71c694aa53a3f`. Saved offset document SHA-256 `cfa28dd1431f0ecac52edf456d3f6f44de4a6413b661d3c022caaeae12033d40`.
- **PASS** — A Sol High read-only review checked the native plane provenance and the oblique projection. Model 64/64 covers ±axis planes, right-handed bases, tilted residual and local/world round-trip at `1e-12 mm`, the legacy fallback, a deliberate native-plane versus centroid discrepancy and ordinary native Join/Cut volume controls. D736 and D720 desktop replays passed seven and twenty states. Studio 70/70, both type-checks, affected lint, driver syntax, production build and diff check passed.
- **NOT_RUN** — Sub-ULP displacement at distant coordinates, generalized face fitting, full suites and mobile. The decision uses the existing binary64 and native geometry support boundaries.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D739_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-plane-precision-browser.mjs "$EVIDENCE/baseline-real" --baseline
D739_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-plane-precision-browser.mjs "$EVIDENCE/studio"
D736_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-finish-ownership-browser.mjs "$EVIDENCE/d736-replay" --expect=associations
D720_SOURCE_FROZEN=1 node apps/cad-studio/test/thin-section-span-browser.mjs "$EVIDENCE/d720-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test sketch-plane-precision sketch-associative-inset drawing-associative-sketch section
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test sketch-edit-identity section-planes section-view project-open-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/{sketch/plane,app/faceProfile}.ts packages/barocss-cad-model/test/sketch-plane-precision.test.ts apps/cad-studio/src/{App,ui/SketchPanel}.tsx
node --check apps/cad-studio/test/sketch-plane-precision-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D740 reproduces silent Count clamping in X/Y Circular pattern creation. [#2354](https://github.com/barocss/barocss/issues/2354). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
