# D715 — Extend a sketch line to its nearest valid boundary

P1 daily parts, rows 09 and 16. FULL qualification for the changed geometry decision and numeric boundary. Parent `a7a655db7b8063cdae28e54ecb8a22b7b520923b`. [#2432](https://github.com/barocss/barocss/issues/2432).

## Reproduction and decision

The parent derives a long extension segment from the entire sketch. Its parameter threshold then excludes a different distance when the sketch moves or gains a distant shape. In actual Studio, a local line ended correctly at 1.015625 mm. Moving the fixture 8192 mm made hover and Finish choose 8194 mm instead of 8193.015625 mm. Adding a nonintersecting line near X=8192 mm made the local case choose 2 mm. The error was 0.984375 mm in both cases. A direct parent run at offset 16384 mm also refused when the near boundary was the only one.

The straight source now uses a ray from the selected end and ranks finite line and arc intersections by forward distance in mm. The click reach remains the existing pixel-to-sketch selection input. Local arithmetic uncertainty can block a potentially earlier hit. An exact zero contact does not move the endpoint. A positive first hit that cannot move the stored endpoint within the existing `1e-6 mm` budget produces a refusal. Preview and commit use one resolved endpoint. The shared Trim/Split intersections and curved-source Extend path retain their existing geometry.

## Qualification

- **PASS** — Actual desktop Studio opened five native documents in Chrome WebGPU. Local, translated, unrelated distant and near-only cases matched the exact authored endpoint `offset + 65/64 mm`. The maximum SVG preview error against its independently projected point was `1.81e-5 CSS px` within a 0.25 CSS px budget. The support body stayed 4 mm³ within `1e-8 mm³`. An independent Python Fraction comparison found zero endpoint error in the four applied sketch states.
- **PASS** — A positive subprecision hit refused without changing the document, body or history. Trim-to-Extend switching cleared the old preview. The near-only repeat refused and preserved the first edit. Its unchanged side tags, construction role and surviving point IDs persisted. The translated case passed first Undo/Redo, Studio project Save, fresh Open of the saved bytes, Edit sketch and Escape of a new draft. The saved file SHA-256 is `410ed22cc8c163fd4d43e9a61ae40092df9366951ac636b894dab3ff070f7668`. Sixteen snapshots were recorded and all 791 frozen inputs matched through cleanup. No downloads, page errors or console errors.
- **PASS** — Studio 11/11 scoped Trim, Extend, Split and sketch ID tests. The cases include signed translations, source and target order, oblique line intersections, finite line and arc targets, tangent and near-tangent boundaries, a stored-grid refusal and a cancelled floating-point difference. Model 50/50 sketch reopen tests, final Model and Studio TypeScript, affected lint, Studio production build, driver syntax and diff checks passed.
- **FAIL** — On the parent, translation and unrelated distant geometry skipped the first boundary. D715 fixes both. Studio also confirmed that an explicitly hidden construction line can still receive an Extend preview. That independent selection defect remains open in [#2312](https://github.com/barocss/barocss/issues/2312).
- **NOT_RUN** — Full suites, mobile, broad large-coordinate arithmetic qualification and new curve families. The four exact endpoints qualify the declared fixtures.

Run from the repository root with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. Use the baseline switch only with the parent production source.

```sh
D715_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-extend-first-hit-browser.mjs "$EVIDENCE/studio"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test trim sketchIds
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test sketch-reopen-parameters sketch-reopen-side-ids sketch-reopen-main-role
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
```

Next D716 reproduces the edit attempt on hidden construction and checks which boundaries visible edits can still use. [#2312](https://github.com/barocss/barocss/issues/2312). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
