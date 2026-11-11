# D717 — Preserve authored sketch dimensions on inline confirmation

P0, rows 09 and 16. FEATURE qualification for desktop sketch editing. Parent `acd9b0c2d246d40763bfbc8fff103524388e20ff`. [#2293](https://github.com/barocss/barocss/issues/2293).

## Reproduction and decision

On the parent, an authored width of `10.123456 mm` opened as `10.12`. Enter and Finish stored `10.12 mm` and changed the extruded volume from `121.48147199999998` to `121.44000000000003 mm³`.

The inline field opens with the exact authored constraint. The visible chips retain their compact format. Enter on the same authored value closes the field before the solver or sketch history runs. A reference dimension still becomes driving on Enter. An attached circle already stores its diameter through its radius, so confirming its existing size adds no change. An edited value follows the existing solver and refusal path. Commit checks the source shape, and changes to the sketch retire an obsolete draft.

Finish of a reopened, unchanged sketch keeps the existing document and history. Legacy positional-side migration remains on the existing Finish path. No solver tolerance, document schema, or documented package API changed.

## Qualification

- **PASS** — Desktop Chrome WebGPU, 18 states and 790 frozen source inputs through cleanup. Length, radius, angle, attached circle size, and three types of circle distance kept their exact values on Enter. The angle opened with authored `111.234567°` while the measured geometry gave `111.23456690000005°`. Integer and two-decimal controls passed. Empty length and `180°` angle drafts were refused. Repeated Enter, Escape, Tab, dimension-key change, document replacement, and promotion of a reference length passed.
- **PASS** — An edit from `10.123456` to `10.124567 mm` kept the same visible `10.12` label and produced one real edit. Sketch Undo/Redo and document Undo/Redo restored the exact values. The no-op Finish kept the native document and the Undo/Redo actions. The positional legacy fixture received its four side IDs and retained the exact width. Studio project Save, fresh Open and Edit sketch kept `10.124567 mm`. The stored outline span and Studio volume and centroid agreed with independent rectangle arithmetic within `1e-8` in their respective units. The saved volume was `121.49480400000004 mm³`. Saved native SHA-256 is `630d158a61d4e9fa4515924ae5fc6cb68d1f7f07e7198961da28412ff2daaef2`.
- **PASS** — D716 desktop replay recorded 30 states, including hidden construction through native Save and reopen. Both desktop runs had zero downloads, page errors and console errors. Model 61/61 and Studio 33/33 focused tests, Model and Studio type-checks, affected lint, driver syntax, Studio production build and diff checks passed.
- **FAIL** — Parent unchanged Enter rounded the driving dimension and changed the solid. The first expanded test also incorrectly assumed that Open leaves no Undo entry. The final test compares the actual pre-edit Undo and Redo actions.
- **NOT_RUN** — Full package and kernel suites, mobile, unrelated numeric fields and the proposed arc diameter input mode.

Run with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. The baseline mode is for the parent production source.

```sh
D717_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-dimension-confirmation-browser.mjs "$EVIDENCE/studio"
D716_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-cut-visibility-browser.mjs "$EVIDENCE/d716-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test sketch-profile-precision sketch-rectangle-driving-retention sketch-reopen-parameters sketch-reopen-main-role
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test named-sketch-guards sketch-edit-identity sketchIds sketch-cut-visibility
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint apps/cad-studio/src/{App.tsx,sketch/useSketchActions.ts,ui/SketchMarks.tsx,viewport/Viewport.tsx,viewport/studioSketchViewportActions.ts} packages/barocss-cad-model/src/sketch/rules.ts
node --check apps/cad-studio/test/sketch-dimension-confirmation-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D718 checks the existing arc radius path and adds a diameter input mode for the same constraint. [#2397](https://github.com/barocss/barocss/issues/2397). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
