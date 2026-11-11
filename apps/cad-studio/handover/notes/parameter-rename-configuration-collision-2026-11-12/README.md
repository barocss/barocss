# D738 — Refuse parameter Rename collisions in stored configurations

P0, rows 12 and 16. FEATURE qualification. Parent `b59b22a242f8a91c14ea99ee4c0f6984a02cc00e`. [#2357](https://github.com/barocss/barocss/issues/2357).

The shared Model Rename checks configuration keys before replacing any parameter or reference. If a stored configuration already contains the destination name, Rename returns `PARAMETER_EXISTS` and identifies the configuration and name. The Studio field restores the accepted name and shows the same reason. The agent uses the existing atomic parameter batch. Ordinary Rename retains configuration order, the source overrides and existing bindings. Remove and configuration Apply keep their existing contracts.

## Qualification

- **FAIL (parent)** — Actual Studio saved Production with B=40 and A=10, changed the bound B to 50 and removed A. Rename B→A overwrote the configuration entry. Applying Production then set width to 10 mm and produced 2000.0000000000002 mm³. Core and agent returned the same rewritten document. A separate bundle using the immutable parent implementation measured width 10 for source-first and target-only configurations and width 40 for target-first. That confirms silent key-order dependence and orphan-value adoption.
- **PASS** — Current Model and agent refuse the collision atomically. Actual desktop Rename displays the configuration and destination name and restores the text field to B. The exact document, geometry, selection, dirty indicator, Undo and Redo state stay unchanged at 50 mm and 10,000 mm³. A normal B→Width rename keeps the feature reference and the original B=40 override in Production. First Undo and Redo restore the exact documents. Applying Production resolves Width=40 and 8000.000000000001 mm³. Five independent Python checks verify the stored parameter reference, dimensions and volume within `1e-7 mm³`.
- **PASS** — Browser-project Save, Close, same-context reload and Open restore the exact configuration and binding. The collision still refuses and a subsequent Width→FinalWidth succeeds. Eight desktop states over 985 frozen inputs, zero page errors, console errors and downloads. Fixture SHA-256 `7cb2edc2b466905369a59874053e5fac23ab3a6e1fedc9b80725ae846a53608c`. Saved SHA-256 `a5059e6f245c93a79cbcd20eb387461ed04cb26ae96c72eae65cd54fa5c63b36`.
- **PASS** — Model 69/69 covers both key orders, one or multiple configurations, destination-only entries, equal values, same-name no-op, active parameter collisions, ordinary Rename, public configuration Apply, driven binding retention and atomic agent batches. Studio 65/65, both type-checks, affected lint, driver syntax, production build and diff check passed. The first final type-check found test fixture type annotations that were too wide. The test now narrows the rectangle node and uses the Model node type for the driven fixture.
- **NOT_RUN** — Full suites, mobile and generalized parameter identity or configuration migration.

Use Node 22.19.0 and existing Chrome and Playwright under the serial heavy gate. Keep raw evidence outside Git. For the isolated parent Model matrix, bundle the unchanged caller against parent `src/engine/parameters.ts`. Add B=40 and A=10 to a width-bound 40×20×10 mm rectangle, use Production with `{B:40,A:10}`, `{A:10,B:40}` or `{A:10}`, remove A, rename B→A and apply the saved values before native evaluation.

```sh
D738_SOURCE_FROZEN=1 node apps/cad-studio/test/parameter-rename-configuration-browser.mjs "$EVIDENCE/baseline" --baseline
D738_SOURCE_FROZEN=1 node apps/cad-studio/test/parameter-rename-configuration-browser.mjs "$EVIDENCE/studio-final"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test parameters parameter-rename-configuration driven-sketch
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test named-sketch-guards sketch-edit-identity project-open-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/engine/parameters.ts packages/barocss-cad-model/test/parameter-rename-configuration.test.ts apps/cad-studio/src/ui/ParametersPanel.tsx
node --check apps/cad-studio/test/parameter-rename-configuration-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D739 reproduces sketch-plane displacement lost to display rounding for authored offsets and planar face origins. [#2363](https://github.com/barocss/barocss/issues/2363). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
