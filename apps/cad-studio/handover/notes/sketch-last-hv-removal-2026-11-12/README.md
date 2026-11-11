# D747 — Preserve deletion of the last horizontal or vertical constraint

P0, rows 09 and 16. FEATURE qualification for the ordinary main outline. Parent `6cdac1de43a07d805bbf5eee5c88195df28905ea`. [#2320](https://github.com/barocss/barocss/issues/2320).

The sketch node keeps an explicitly empty H/V recipe. Reopen uses that recipe and continues to infer aligned edges for legacy outlines with an omitted recipe. The compact Rectangle-tool representation retains its existing dimension policy. The saved profile, solver equations and tolerances keep their existing contracts.

## Qualification

- **FAIL (parent)** — Actual desktop Studio removed the only Horizontal relation and reported rank 2 and 6 degrees of freedom. Finish omitted the empty recipe. Edit sketch restored Horizontal on edge 1 and reported rank 3 and 5 degrees of freedom. The independent rank check uses eight scalar coordinates, two anchor equations and one independent H equation. The desktop baseline recorded four states. Four of six new Model cases also failed on the parent.
- **PASS** — Studio kept the deleted relation absent on Edit sketch after Finish, first Redo and local-project Save, Close, reload and Open. Undo restored the original relation. The same four vertices, side IDs, plane, downstream Extrude and exact document fields were checked. The unchanged profile has independent shoelace area `802.5 mm²` and extrudes 8 mm to `6420 mm³`. The saved native file hash is `d03720b27b0aac5d30541469198dd340827f3c726b97bd9fcddf2a184efb439c`.
- **PASS** — Studio applied Horizontal to the same edge again. Removing it and changing point 2 X from 40 to 44 mm kept six degrees of freedom and produced `6756.000000000002 mm³` against an independent `6756 mm³` prism. Cancel kept the accepted document. Seven current desktop states across 794 frozen source inputs. No downloads, page errors or console errors. Reviewed the reopened and reapplied views.
- **PASS** — Model 61/61 and Studio 85/85 focused tests. The Model cases cover a sole V, two relations removed in succession, a retained dimension and fixed point, new unaligned outlines, legacy omission and compact rectangles. Both type-checks, affected lint, driver syntax, production build and diff checks passed.
- **FAIL (initial Studio focused run)** — A historical rectangle assertion expected no outline after a typed width. An in-memory bundle of the parent `loops.ts` produced the same failure. The assertion now checks the compact rectangle and its existing stored width and H/V relations from `f40a2c3a1`.
- **NOT_RUN** — Full suites, mobile, and separate recipes for secondary regions and holes. Arc relation inference and linked/band editing retain their existing scope.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory. Source fixture SHA-256 `8e6d7e21efbbb2386a130cfe2c8097a1a86517544da2dbe1b5feaa96f135e246`.

```sh
D747_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-last-hv-browser.mjs "$EVIDENCE/baseline" --baseline
D747_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-last-hv-browser.mjs "$EVIDENCE/studio"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test sketch-last-hv outline reopen
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test constraints sketch-edit-identity project-open-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/sketch/loops.ts packages/barocss-cad-model/test/sketch-last-hv.test.ts apps/cad-studio/test/constraints.test.ts
node --check apps/cad-studio/test/sketch-last-hv-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D748 checks whether Finish silently discards authored open lines and arcs when a closed profile exists. [#2295](https://github.com/barocss/barocss/issues/2295). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
