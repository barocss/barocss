# D750 — Keep Feature Editor Apply with its submitted draft

P0, rows 07 and 16. FEATURE qualification for ordinary Feature Editor Apply. Parent `94976a162908804aff28d104632666fc6a33c737`. [#2323](https://github.com/barocss/barocss/issues/2323). [D749 command preview](../failed-feature-preview-2026-11-12/README.md).

The Feature Editor owns each submitted draft. Typing, changing a field or binding, Reset, closing the editor and changing the document or feature retire the request. Apply accepts one request for the current draft and permits field changes while it evaluates. The current Worker refusal shows the original failed feature and kernel detail inside the editor. The command HUD shares the same notice. The accepted document and native file format retain their existing contracts.

## Qualification

- **FAIL (parent)** — Apply at 4 mm reports a generic refusal over the viewport while the actual Worker identifies downstream Fillet `n41` with `RADIUS_EXCEEDS_FACE`. After the user applies 12 mm and changes the visible draft to 14 mm, delivery of the real 12 mm success commits the older 12 mm solid. The parent recorded three desktop states.
- **PASS** — The current inline refusal identifies `Fillet R8 (n41)` while editing Extrude `n23`. It keeps the exact accepted document, history, selection, dirty state and `23587.964473723074 mm³` solid. A real late 12 mm success leaves that accepted solid in place and keeps 14 mm in the editor. A delayed 4 mm failure stays retired through 4 → 12 → 4. The next explicit Enter submits the current 4 mm draft and gets its own refusal.
- **PASS** — Closing the editor and opening a second document with the same native ID retires the first document's refusal. A genuine current failure in the second document names its own `Fillet R6 (n41)`. The normal 14 mm retry commits one result, with `16387.964473723117 mm³` against `1200 × 14 − 30 × 8² × (1 − π/4) mm³`. Undo and Redo restore exact states. Project Save, Close, reload, Open and Edit show the accepted 14 mm and no old diagnostic. Eight current desktop states across 795 frozen files. No downloads, page errors or console errors. Fixture SHA-256 `6d785f9403e747aa50be46196cccda460e7c403dd2e64c542c8a5d5778eb6280`. Saved SHA-256 `ba2c5b83f61d8da75b5b52a9a30030725c075de828c56b59619b81216cf15dff`.
- **PASS** — D749 desktop replay passes nine states on the shared notice. Model 23/23 and Studio 68/68 focused tests, including existing placed bearing, pattern candidate and sketch identity controls. Both type-checks, affected lint, driver syntax, production build and diff checks passed.
- **NOT_RUN** — Full suites, mobile and new face/edge attribution. This work covers the ordinary editor Apply and the prior command HUD. The existing staged pattern and placed-bearing paths have focused software checks.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D750_SOURCE_FROZEN=1 node apps/cad-studio/test/failed-feature-editor-browser.mjs "$EVIDENCE/baseline" --baseline
D750_SOURCE_FROZEN=1 node apps/cad-studio/test/failed-feature-editor-browser.mjs "$EVIDENCE/studio"
D749_SOURCE_FROZEN=1 node apps/cad-studio/test/failed-feature-preview-browser.mjs "$EVIDENCE/d749-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test r7-findings ids
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test failed-feature fillet-family bearing-edit fill-pattern-candidate direct-curve-candidate sketch-edit-identity
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint apps/cad-studio/src/{App.tsx,app/failedFeature.ts,app/commandState.ts,ui/NodeEditor.tsx,ui/FeatureFailureNotice.tsx,ui/Hud.tsx}
node --check apps/cad-studio/test/failed-feature-editor-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D751 checks native text Undo and Redo in the command search against both CAD history stacks. [#2301](https://github.com/barocss/barocss/issues/2301). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
