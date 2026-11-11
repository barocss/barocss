# D677 — Keep STEP preparation with the current document

P2 B07, rows 13 and 16. [D407](../step-export-preview-2026-11-01/README.md) covers preview, cancellation and synchronous invalidation in Studio. Its controller tests inject late replies. [D531](../public-step-loss-report-2026-11-05/README.md) covers the Model report API and the existing Studio preview. D677 checks two delivery orders with real desktop Worker replies.

## Studio result

**PASS, two timing orders.** Chrome WebGPU at 1440 × 900 opened two parts with the same file name and feature IDs. The old part was a 30 × 12 × 6 mm block with a user body name and colour. The new part was a 30 × 12 × 9 mm block with default appearance. Both STEP requests ran in the same Worker within each run. The driver held delivery of the original MessageEvents and released them through the registered handler.

| Old reply arrives | Observed result |
| --- | --- |
| After Open, with the new preview closed | The panel remains absent. A new request prepares the new part. |
| After the new request, with its reply held | The new panel stays in Preparing with Export disabled. Only the new reply makes it ready. |

The four actual Worker responses pass the independent Part 21 reader for these rectangular fixtures. It checks the AP214 declaration, millimetre units, product name, one solid record and the eight expected vertex coordinates. The old response contains the feature history, label and appearance loss entries. The current panel shows only the current response's feature-history loss. Source revisions are `37772d67a8082634` and `59963a9c492c49a9` in both runs. The accepted current document and volume 3240 mm³ stay unchanged. The closed and ready screenshots were reviewed. Zero downloads, page errors, console errors and watched changes. The 323-file source capsule matched through cleanup.

**First reader FAIL.** The initial assertion expected an unqualified AP214 schema name. The actual header carries the AP214 edition identifier in the schema string. The reader now checks that full declaration. Product source stayed unchanged.

## Reproduction and limits

Use Node 22.19.0 and run one heavy job at a time through `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`.

- From Studio, set local `PW_DIR` and `CHROME`. Run `D677_SOURCE_FROZEN=1 node test/step-preview-late-reply-browser.mjs "$EVIDENCE"` with an external evidence directory. Final receipt SHA-256 `b66347e1ecded86771e5f04843e47a389e727596152365bf7965c3035c893a1e`. First receipt SHA-256 `eb34b3c23ae88559ab86d8d485aa9a5a33e85d2c61836f2e111bcc827169ed1e`.
- `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test step-export-preparation step-metadata three-mf-export-ownership` passed 31/31. `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test api-step-report.test` passed 19/19.
- `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm --dir packages/barocss-cad-model run type-check`, `node --check apps/cad-studio/test/step-preview-late-reply-browser.mjs` and `git diff --check` passed.

**NOT_RUN.** Final Export action, file Open round trip, external native reader and broader B07 acceptance. [#2263](https://github.com/barocss/barocss/issues/2263) remains open. D678 checks whether real STEP preparation follows the shown variant and returns to the master geometry after the user switches back.
