# D744 — Preserve unchecked interference pairs

P0, rows 15 and 16. FEATURE qualification. Parent `90b1374fb8fdeed2aa5f1e0e03ae311d5ed95511`. [#2348](https://github.com/barocss/barocss/issues/2348).

The existing volume-only Worker request identifies its terminal intersection. The Model reports an empty intersection only when the native snapshot confirms that feature ran and it emitted no output. The Studio consumes this proof separately from a missing key, unavailable volume and failure. It retains each unchecked pair and its error, displays a failed or incomplete check, and keeps any confirmed clash. The current pair scope and `1e-6` bounds and volume thresholds retain their existing behavior.

## Qualification

- **FAIL (parent)** — Actual Studio displayed “No bodies overlap.” for a genuine cylindrical-wrap CAPABILITY refusal from probe `n5`. The same false clear appeared for a controlled error and a controlled null volume on a 500 mm³ native overlap. Five baseline states. The two controlled replies were substitutions after the real Worker calculated its normal result.
- **PASS** — Actual desktop shows the genuine refusal and the affected pair. Controlled error, null, missing target, NaN, Infinity, negative volume and stopped replies each show one unchecked pair with its reason. The same-name body rows distinguish keys `b1` and `b3` and select those bodies. A held successful reply displays Checking and then reports 500 mm³ after release. A controlled numeric zero and a separated pair retain the clear state.
- **PASS** — Two triangular prisms have overlapping bounds in all three axes and independently separated regions `x+y≤4` and `x+y≥5`. The Worker confirms empty `b6` while returning unrelated `b5` at 999.9999999999999 mm³. The true empty result displays clear. The Model also confirms that an unspecified, nonterminal, suppressed or nonintersection node cannot produce the marker.
- **PASS** — A real mixed scan retains CAPABILITY for the cylindrical-wrap pair and reports the independently expected `1×3×2=6 mm³` for the two boxes. The row selects only those boxes. The same result survives local-project Save, Close, reload and Open with the exact authored document. A controlled mixed scan retains 500 mm³ and one failure. Selecting only the second box pair produces one native probe and 300 mm³. The authored Doc, body summaries, dirty state and history controls are preserved.
- **PASS** — Desktop Studio captured 23 states over 791 frozen sources. Zero page errors, console errors and downloads. Saved native document SHA-256 `258fa3ba73cc792f420b7b37e213d661a35d2588579fa5177de26f630d3147a1`. Model 20/20 and Studio 26/26 focused tests, both type-checks, affected lint, driver syntax, production build and diff check passed. Sol High reviewed the native empty and refusal contracts and checked the fixture geometry and volume with an independent oracle.
- **NOT_RUN** — Full suites, mobile, general collision accuracy and overlapping asynchronous inspection ownership. [#2350](https://github.com/barocss/barocss/issues/2350) owns results that arrive after Close, input changes or document replacement.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D744_SOURCE_FROZEN=1 node apps/cad-studio/test/interference-result-browser.mjs "$EVIDENCE/baseline" --baseline
D744_SOURCE_FROZEN=1 node apps/cad-studio/test/interference-result-browser.mjs "$EVIDENCE/studio-final"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test interference-volume meshWire bead-ownership-policy cylindrical-wrap
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test interference-result engine-client-lifecycle quantity-text
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint apps/cad-studio/src/{App.tsx,app/checkInterference.ts,ui/MeasurementInspector.tsx,engine/client.ts,engine/engine.worker.ts} apps/cad-studio/test/interference-result.test.ts packages/barocss-cad-model/src/engine/evaluate.ts packages/barocss-cad-model/test/interference-volume.test.ts
node --check apps/cad-studio/test/interference-result-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist-final"
git diff --check
```

Next D745 verifies interference inspection ownership across Close, document and input changes, and new runs. [#2350](https://github.com/barocss/barocss/issues/2350). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
