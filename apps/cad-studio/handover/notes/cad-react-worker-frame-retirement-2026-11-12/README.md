# D776 — Verify CAD React failure recovery and frame retirement

P4 B10-07, rows 04, 05, 16 and 32. SMALL qualification. Parent `a620544a61b72468e6e7df149cb980eb2d885e5a`. [B10 v1 evidence ledger](../../roadmap-tracks/17-b10-evidence-ledger.md) · [D528 Worker failure](../react-settled-worker-recovery-2026-11-05/README.md).

- **PASS** — The native Worker reports the injected settled protocol error on the 8 mm Profile. React shows Error and Retry, keeps the exact document and marks native evidence stale. Retry starts a new real Worker, keeps the same declaration and restores the original Viewer frame at host epoch 2, evaluation 3.
- **PASS** — The scheduler holds the real completed GPU readback for radius 9 at evaluation 4. The host is pending until the current evaluation 5 for radius 10 finishes. Releasing evaluation 4 records one ignored completion and keeps the exact current Viewer frame, owner and document.
- **PASS** — A second held real readback completes after React unmount. Both owned Workers are terminated. The host and Viewer stay disposed, native evidence and frame owners stay empty, and the ready indicator stays absent. Both held buffers contain 2,800,000 bytes. The scheduler forwards original GPU bytes after each delay.
- **PASS** — Desktop Studio opens and frames the exact accepted 10 mm-radius document. SHA-256 is `2353178f7b68c53a99765a537b75fdb38cbd0bbbb9e927d8546b1c6167c1bb43`. The D528 regression also passes. There are 12 current states and six regression states, 1,293 frozen files per run, and zero page errors, console errors or downloads. Each run observes one deliberate native Worker error. Reviewed Error and the current frame after releasing the obsolete receipt.
- **PASS** — React 29/29 focused tests, React package and Model type checks, driver syntax and diff check.
- **FAIL, first driver only** — The disposed status label was absent as expected, but the first runner compared an omitted text value with null. The replay normalizes the absent label and completes Studio Open.
- **NOT_RUN** — Organic Worker or hardware faults, other devices, VRAM, full suites, production builds and mobile.

```sh
D776_SOURCE_FROZEN=1 node packages/barocss-cad-react/tests/engine-failure-current-browser.mjs "$EVIDENCE/failure-retirement-replay" --frame-retirement
D528_SOURCE_FROZEN=1 node packages/barocss-cad-react/tests/engine-failure-current-browser.mjs "$EVIDENCE/settled-failure-regression" --expect=fixed
pnpm --dir packages/barocss-cad-react exec node --test tests/settled-worker-failure.test.mjs tests/adapter.test.mjs tests/model-host.test.mjs tests/viewer-sink.test.mjs tests/example-retry.test.mjs
pnpm --dir packages/barocss-cad-react type-check
pnpm --dir packages/barocss-cad-model type-check
node --check packages/barocss-cad-react/tests/engine-failure-current-browser.mjs
git diff --check
```

B10 v1 is accepted at 7/7 for its declared desktop consumers. Initial scenarios reach 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. B03's positive tapped data and B06's PDF group remain held. [#541](https://github.com/barocss/barocss/issues/541) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open at their broader scopes. D777 extends the existing local task workflow to a supported rectangle depth edit.
