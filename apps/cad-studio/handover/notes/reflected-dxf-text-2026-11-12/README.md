# D721 — Refuse reflected planar DXF TEXT underlays

P0, rows 13 and 16. FEATURE qualification for the drawing reader and desktop Studio consumer. Parent `c10a1824668a8335cba067b6c7ceb0c1ea498ca7`. [#2424](https://github.com/barocss/barocss/issues/2424).

The parent accepted an asymmetric `F2` at `[4,6]`, height 2 and rotation 30° with a negative-Z extrusion. Studio stored `[-4,6]`, height 2 and rotation `150.00000000000003°`, counted it as one visible TEXT and displayed it with the existing positive-handed label frame. The insertion and baseline survived, but the glyph reflection did not.

The DXF drawing reader refuses a reached planar TEXT with a left-handed transformed frame. It uses the existing `DXF_UNSUPPORTED` reason before the draft or underlay commits. The check follows composed transforms, so an orthogonal negative INSERT is refused when it leaves a reflection and two cancelling reflections remain admissible. The document representation and native file schema stay unchanged. A legacy native label keeps its stored angle and height.

## Qualification

- **PASS** — Desktop Chrome WebGPU, 8 states and 792 frozen inputs through cleanup. Reflected `F2` at 0°, 30° and 90° was refused by the underlay reader, sketch reader, draft tool and actual Drafts import. Studio showed the reason. The accepted native solid stayed at `360.00000000000006 mm³`. The document, history, Undo/Redo and dirty state stayed exact. A refusal with Redo available preserved it.
- **PASS** — A subsequent ordinary +Z drawing imported the circle, hole, three draft dimensions and one underlay label. The circles kept radii 5 and 1 mm. The label kept insertion `[4,6]`, height 2 mm and rotation 30°. The inches control kept position `[101.6,152.4] mm`, height `50.8 mm`, rotation 90° and dimensions `254,254,50.8 mm`. The WebGPU label was removed and restored by Hide and Show. The accepted geometry matched a fixture with the TEXT removed.
- **PASS** — Studio project Save and fresh Open kept both ordinary drawings. The older native angle/height record reopened and displayed as before. Native saved SHA-256 is `d77d1b31edf428ffbdbcccb24502f198268b7a68189c441e75f292a1e2a95f0f`. Both desktop flows had zero downloads, page errors and console errors. Model 21/21 and Studio 38/38 focused checks, both type-checks, affected lint, driver syntax, production build and diff checks passed.
- **FAIL** — The parent silently presented the reflected glyph frame as ordinary text. The first fixed driver compared cross-runtime trigonometric results byte for byte. Node and Chrome differed by approximately `3.55e-15°` on the ordinary control. The final comparison uses `1e-10` for angle and height and exact equality for the rest of the document.
- **NOT_RUN** — Full suites, mobile, general affine text, new MTEXT and TEXT generation-flag policies, and a new representation for mirrored native labels.

Run with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. Use the baseline switch with the parent production source.

```sh
D721_SOURCE_FROZEN=1 node apps/cad-studio/test/reflected-dxf-text-browser.mjs "$EVIDENCE/studio"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test dxf-underlay dxf drafts
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test draft project-open-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/{sketch/dxfUnderlay,chat/drafts}.ts packages/barocss-cad-model/test/dxf-underlay.test.ts
node --check apps/cad-studio/test/reflected-dxf-text-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D722 reproduces reached STEP complex spline entities with implicit knot forms and checks the existing typed refusal path. [#2423](https://github.com/barocss/barocss/issues/2423). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
