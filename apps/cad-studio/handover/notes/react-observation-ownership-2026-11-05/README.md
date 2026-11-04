---
work_id: D529
artifact_type: bounded-public-observation-ownership
status: done
owner_role: executor
last_updated: 2026-11-05
---

# D529 — Detach owned CAD React observations

Priority P0-R09, rows04/16/32. Parent `c444797a773de216a16226c34d685506e0206678`. [Roadmap](../../roadmap.md) · [Qualification](qualification.json).

## Contract and original boundary

The original read() exposed the owned document, submitted list/entries, native centroid/bounds and stored adapter outer object; ExistingViewerHost.snapshot exposed its pixel diagnostics. The contract did not explicitly establish detachment. Original13 controlled checks produce4 PASS/9 behavioral FAIL. Root's original existing Worker/Viewer consumer separately reproduces9 aliases by deliberately mutating public read() results. For example, returned Doc height changes8→19 with unchanged fingerprint and request count2, although the JSX control and already displayed geometry remain at8. This is deliberate consumer observation mutation, not an observed organic user action or a claim that raster geometry changed.

Each read now copies the host-owned document recursively, submitted array/records, centroid/bounds tuples and adapter outer object. ExistingViewerHost copies its own pixel-diagnostic record. Values, units, null/optional fields and tuple types remain. No native mesh/raw image buffer or complete observation is cloned.

EngineAdapter-issued frozen Owner tokens retain identity across reads and current/stale guards. A caller-supplied Owner passed to ViewerHost remains caller-owned, with its original identity and mutability. adapter.error:unknown and custom sink.snapshot():unknown retain their extension identity/contracts, including uncloneable callbacks. The documentation declares these precise boundaries; it does not promise a fully immutable deep snapshot. Internal accepted documents remain private. Document copying adds work on each observation; no broad performance improvement or bound is claimed.

## Verification

Tier FULL for the public ownership contract. Implementation/tests and two independent source audits use GPT-6.1 Sol Medium. Both final audits APPROVED; one also reviewed the later mutation-runner path repair. No geometry, tolerance, schema, evaluator, Worker protocol or renderer algorithm changes.

PASS:13 new ownership checks plus39 related Host/adapter/React/Viewer/R08 checks,52 unique controlled cases,0 FAIL/0 skipped/cancelled. New cases cover nested Doc and engine input retention, submitted array and entries, centroid and both bounds, adapter corruption, pixels, shared frozen tokens/current-stale completion, older observations across later updates, uncloneable extensions and mutable external tokens. React/consumer types include the new mutable Vec3 tuple and readonly Owner guard plus examples. Lint, Studio types and final Model types pass. Final Model tsc follows the last mutation-runner edit; unchanged controlled cases are not rerun for that path-only repair. Browser/mutation syntax and diff pass.

External mutation run02 executes13 baseline checks successfully, then8 independent source overlays, each completing all13 checks. Document/submitted-array/submitted-entry/centroid/bounds-min/bounds-max/adapter/pixels regressions are killed by1/3/1/1/1/1/1/1 behavioral assertion failures respectively. Every failed mutant case is ERR_ASSERTION; no load/build error or cancellation counts as a kill. Exact target/overlay paths and source hashes are recorded. Only whitelisted Host/Viewer source is overlaid in the external test bundle; the worktree is never mutated. The normal compile helper path remains unchanged when the explicit overlay environment is absent.

Root original native repro01 qualifies3 states and9 alias traces. Root fixed01 repeats all9 public mutations and confirms isolation, unchanged accepted radius8 Doc/native diagnostics/Viewer metadata, and shared frozen owner identities. A subsequent public radius10 edit submits a new native evaluation and completes a different real Viewer frame. Fresh Studio Open/Frame of that actual returned Doc preserves exact Doc and one settled body. Root views original baseline03 and fixed03/04/Studio06 PNGs. Returned Docs are externally prewritten from accepted observations, not native Save/export results.

Each actual run pins1230 paths unchanged through cleanup; fixed run has6 states/2 contexts. Unknown page/console errors, worktree changes and downloads are zero. All owned contexts, Chrome, static HTTP and Studio Vite close. Source hashes/pixel digests establish custody/current display completion, not physical accuracy.

FAIL retained:9 original alias assertions. Mutation run01 stops before qualification because macOS /var and canonical /private/var temporary paths differ; no mutant is qualified from that run. The runner now canonicalizes its temporary directory and preserves raw external output/trace before validation. Product/helper/case source stays unchanged during that runner-only correction.

NOT_RUN: organic consumer incidence, broad document-copy timing/memory, packed/published consumer, independent numerical oracle, native Save/export, whole Studio production build, whole kernel, CI/mobile/release/develop integration and broad CAD React completeness. Documentation sample producers and examples are unchanged from D528; its185 sample PASS is eligible retained evidence, not a new R09 run. Whole CAD/core remains NOT_MEASURED. R01–R09 have bounded closeouts; R04 native collision remains UNKNOWN. Next D530/P0-R10 exposes actual native mass method and existing tessellated estimates through both public facades, without inventing method or precision from absence.

## Commands

Node22.19.0; one heavy gate at a time, release on exit. All worktree writers freeze during actual runs. Use fresh external browser outputs; the mutation evidence directory must already exist outside the worktree.

```sh
node --test --test-concurrency=1 packages/barocss-cad-react/tests/observation-ownership.test.mjs packages/barocss-cad-react/tests/settled-worker-failure.test.mjs packages/barocss-cad-react/tests/example-retry.test.mjs packages/barocss-cad-react/tests/model-host.test.mjs packages/barocss-cad-react/tests/polygon-model-host.test.mjs packages/barocss-cad-react/tests/pieces-observation.test.mjs packages/barocss-cad-react/tests/adapter.test.mjs packages/barocss-cad-react/tests/react-host.test.mjs packages/barocss-cad-react/tests/viewer-sink.test.mjs
pnpm --filter @barocss/cad-react run type-check
pnpm --filter @barocss/cad-react run test:types
pnpm --filter @barocss/cad-react run lint
pnpm --filter @barocss/cad-studio-app run type-check
node packages/barocss-cad-react/scripts/test-observation-mutations.mjs /tmp/barocss-d529-mutations02
node --check packages/barocss-cad-react/tests/observation-current-browser.mjs
node --check packages/barocss-cad-react/scripts/test-observation-mutations.mjs
pnpm --filter @barocss/cad-model run type-check
D529_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node packages/barocss-cad-react/tests/observation-current-browser.mjs /tmp/barocss-d529-observation-repro01 --expect=repro
D529_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node packages/barocss-cad-react/tests/observation-current-browser.mjs /tmp/barocss-d529-observation-fixed01 --expect=fixed
git diff --check
```

Repro mode belongs to the original parent product, not the fixed source. Raw logs, traces, source overlays, bundles, Docs and PNGs remain outside Git. The related epics remain open; this owned-observation contract does not complete their broader capability requirements.
