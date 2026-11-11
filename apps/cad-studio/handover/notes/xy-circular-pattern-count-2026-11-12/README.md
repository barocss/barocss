# D740 — Refuse unsupported X/Y circular pattern counts

P0, rows 08 and 16. FEATURE qualification. Parent `fa1f29480835f31ae674a2116d813e14e04e1379`. [#2354](https://github.com/barocss/barocss/issues/2354).

The Studio command builder accepts only integer X/Y counts 2, 3 and 4, including the original. It refuses an out-of-range value before creating either a combined output or separate outputs. The Count field shows an axis-specific maximum and retains the authored value through axis and result changes. The existing HUD explains the refusal and the 90° step. Existing Z creation, native file interpretation and X/Y quarter-turn placement retain their current rules.

## Qualification

- **FAIL (parent)** — The actual desktop HUD kept Count 9 in X/One body and Y/Separate bodies. Both Apply actions produced four placements including the original, with 32 distinct native corners and 768 mm³ total volume. The baseline driver reproduced both cases.
- **PASS** — Current desktop Studio refuses Count 9 on both X and Y and keeps Count 9 when switching back to Z. A held successful Z Worker reply and queued Enter cannot commit a candidate after switching axis and result. The refusal retains the accepted document, selected source face, source body, history controls and dirty state. Cancel removes the draft. Counts 5 and 2.5 are refused. Count 4 recovers and survives a switch to Z.
- **PASS** — X/One body commits one Model output containing four disjoint native solids. Y/Separate bodies commits four outputs with one solid each. Each piece follows the independently computed signed permutation of the original eight corners. The source and each separate output measure 192 mm³. The native oracle matches all 32 corners and 768 mm³ for each committed and reopened document with absolute tolerances of `1e-9 mm` and `1e-7 mm³`. First Undo and Redo, local-project Save, Close, reload and Open pass in both modes. The eight current desktop states retained all 791 frozen source files through cleanup. The run had zero browser downloads and console errors. Fixture SHA-256 `1a6ee8e46d96e174177d10ca852aa302260904c04a308a9a9f3a15c021b70842`.
- **PASS** — Model 19/19, Studio 87/87, both type-checks, affected lint, driver syntax, production build and diff check. Model covers both axes and result modes for Count 2/3/4, the invalid count matrix, signed and large Z spread with pivot, and native Count 1 and 4 file round-trips. Sol High reviewed the native output ownership and independent quarter-turn oracle. The first Model type-check failed with TS2339 in the new test fixture. The final check passes after the fixture uses the existing command values type.
- **NOT_RUN** — Full suites and mobile.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D740_SOURCE_FROZEN=1 node apps/cad-studio/test/circular-pattern-count-browser.mjs "$EVIDENCE/baseline" --baseline
D740_SOURCE_FROZEN=1 node apps/cad-studio/test/circular-pattern-count-browser.mjs "$EVIDENCE/studio-final"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test circular-pattern editFields fields.test
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test command preview pattern project-open-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/app/commands.ts packages/barocss-cad-model/test/circular-pattern-{span,count}.test.ts
node --check apps/cad-studio/test/circular-pattern-count-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D741 verifies named refusal for cyclic STEP curve wrappers on existing import paths. [#2360](https://github.com/barocss/barocss/issues/2360). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
