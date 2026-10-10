# Public upright capsule query consumer

Physics-owned [#1062](https://github.com/barocss/barocss/issues/1062) delivery, frozen in [the reviewed contract](https://github.com/barocss/barocss/wiki/Physics-Upright-Capsule-Query) before code. Uses the actual public @barocss/physics root, ordinary source defaults or an explicit full published compiled graph. No candidate library import from examples and no source aliases.

The fixed upright capsule has radius0.15m, centreline half-length0.35m and world Y. A query returns no hit or a copied source ID, fraction, dimensionless box-to-capsule normal and metre witnesses. It does not move a world. This example's browser is a numerical table, not a Viewer/controller scene.

## Modules and evidence

- `fixture.mjs`: original22 plus distinct9 frozen profiles, unchanged inputs.
- `public-snapshot.mjs`: actual public factory and explicit numeric field adapter for original independent observations. No private query import.
- `campaign.mjs`: original independent reference/analytic/geometry equations,31cases and one-warmup three100-query cost trials for28accepted cases. Public admission, sweep, returned copies and field adapter are timed.
- `controls.mjs`: actual source/compiled canonical errors,34caller refusals, descriptor/getter/Proxy precedence, source/output retention, signed zero/original quaternion, global-minimum ties, exclusion, independent objects and dispose/fresh flow. Numeric/cap64 public failures are not fabricated.
- `verification.mjs`: two complete repeats and full numerical/control/cost gates.
- `probe.mjs`: provenance, six existing published export/type maps, root declarations, source/dist audit and original LE files/native bytes.
- `decode.mjs`: imports only independent reference/codec plus Node IO; checks all31named original inputs/outputs and public error mapping, full consumption and exact native data. No candidate or fixture import.
- `source-contract.ts` and `compiled-contract.ts`: real source public type consumer and explicitly labelled emitted-declaration consumer. Runtime compiled package-name resolution is tested separately through complete published maps.
- `browser-entry.mjs`, `browser.html`, `browser-driver.mjs`: actual public browser flows in two separately loaded provider graphs, original Node data comparisons, console/clock/resource cleanup. Own server/browser only.

Use Node22. No dependency download/root registration is needed. setup creates only the two declared local example workspace links, as in existing examples.

```sh
pnpm --filter @barocss/physics build:library
node examples/physics-capsule-query-scene/setup.mjs
pnpm exec tsc --noEmit --strict --skipLibCheck --module NodeNext --target ES2022 examples/physics-capsule-query-scene/source-contract.ts
pnpm exec tsc --noEmit --strict --skipLibCheck --module NodeNext --target ES2022 examples/physics-capsule-query-scene/compiled-contract.ts
node examples/physics-capsule-query-scene/probe.mjs source /tmp/capsule-public-source
node examples/physics-capsule-query-scene/probe.mjs compiled /tmp/capsule-public-compiled
node examples/physics-capsule-query-scene/decode.mjs /tmp/capsule-public-source/manifest.json
node examples/physics-capsule-query-scene/decode.mjs /tmp/capsule-public-compiled/manifest.json
```

Stop other numerical campaigns before measuring. Only after BOTH canonical Node reports have candidateGOtrue:

```sh
node examples/physics-capsule-query-scene/browser-driver.mjs /tmp/capsule-public-browser /tmp/capsule-public-source /tmp/capsule-public-compiled /path/to/playwright/index.mjs
node examples/physics-capsule-query-scene/decode.mjs /tmp/capsule-public-browser/source/manifest.json
node examples/physics-capsule-query-scene/decode.mjs /tmp/capsule-public-browser/compiled/manifest.json
```

The Playwright module is an external verification tool, not a product dependency. Source and compiled constructors are tested within their own graph; no cross-graph identity promise. Existing source defaults and full publishConfig maps remain unchanged. Actual package publication/pack/archive or integrated Viewer validation is separate.

## First failures

Evidence/first retains original prototype build output, metadata-edit syntax failure/repair, actual complete compiled invalid-factory identity failure and first source control failure. Initial nested runtime error imports produced a duplicate compiled PhysicsError. A pre-code scope addendum introduced one tiny internal root error bridge, keeping the original build command and maps unchanged. Source reflection errors were separated from internal validator/semantic errors. The first near-unit control incorrectly used w>1; the declared component bound correctly rejected it. Repair that control to an admitted near-unit value without changing any primary31scene, numeric algorithm, tolerance, cap or target. Final clean source/native/browser receipts follow in evidence/receipt.json.
