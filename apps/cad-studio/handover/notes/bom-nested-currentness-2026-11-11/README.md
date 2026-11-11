# D707 — Keep nested BOM actions and errors with their source

P0 B05, rows 10 and 16. SMALL private Studio repair. Parent `abcd8c610693b6c0986b0bebc14ec1927fa325d0`. [#2356](https://github.com/barocss/barocss/issues/2356).

## Actual replacement and first failure

Open three native ordinary assemblies by the Studio toolbar. The same BOM panel stays mounted. A, B and C each use `sub/shaft:n0` for a different shaft and `sub/spare:n0` for the protected sibling. A's bought shaft is Ø10 × 20 mm, B's is Ø11 × 22 mm, and C's is Ø12 × 25 mm. The sibling is Ø8 × 14 mm. In B, the real Worker refuses the zero-height extrusion at `base/sub/fault`, feature `n1`. The driver delays delivery of that genuine response and of C's genuine success. It forwards the original replies.

The first run verified that pending B, failed B and pending C expose no old rows, purchase controls or export. The failure remains visible in B. Direct visual review found the global B BOM notice still visible in C after its healthy BOM arrived. An assertion on pending C reproduces one stale notice where zero are expected. Studio now binds the BOM notice to its document object and name, omits it as soon as that source changes, and clears the expired state. The same current B failure still appears inline and globally. Pending C and completed C show no old BOM notice.

## Exact edits and exports

The current C purchase action adds `bought: true` only on `sub/shaft:n0`. The accepted document equals the expected whole document including the sibling. First Undo and Redo restore the exact C documents. Each blocked action preserves the document, history, selection and dirty marker. Six generated local CSV files are read by an independent Python parser using the fixture's nested feature data. It verifies the nine columns, filenames, ordered rows, sizes and quantities. C before the edit contains the sibling only. C after the edit contains both shafts, quantity one each. With made parts adds the three assembly/part rows. Undo and Redo restore the corresponding exact CSV bytes. No CSV Blob is created in the blocked states.

## Qualification and issue evidence

- **PASS** — Root-run Chrome WebGPU Studio, eight snapshots, six independent local CSV reads, and 327 frozen inputs matched through cleanup. Studio BOM tests 12/12 and Model BOM tests 37/37. Both type checks, scoped ESLint, Studio production build and driver syntax check pass. Two recorder cases verify that a late ordinary B success or failure cannot publish after same-name C replaces it. A temporary bundle mutation which relabels previous data with the new key fails its intended assertion.
- **FAIL** — The original Studio shows B's BOM toast during C's pending evaluation and after C succeeds. The corrected driver passes the new notice assertions.
- **NOT_RUN** — Mobile, browser download manager, full suites, and live/paid models. Linked transition, nested linked detection and suppression are controlled tests. The real Studio failure is the ordinary nested extrusion.

[D575](../bom-currentness-2026-11-10/README.md) provides the original wrong-export and wrong-edit reproduction, exact old-handler refusal, debounce, name-only, linked transition and close/unmount controls. [D581](../bom-evaluation-completeness-2026-11-10/README.md) provides actual native failure and recovery and the producer's successful-empty control. [D706](../bom-project-csv-readback-2026-11-11/README.md) provides native project Save, Close, reload, Open and exact saved CSV readback. D707 completes the nested same-key desktop evidence for #2356. Broader B05 acceptance remains unadjudicated.

Run from the repository root under the heavy gate with Node 22.19.0 and existing Chrome and Playwright: `D707_SOURCE_FROZEN=1 node apps/cad-studio/test/bom-nested-currentness-browser.mjs "$EVIDENCE/studio"`. Focused tests use `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test bom-linked-ui bom-nested-ui` and `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test bom`. Keep raw captures and bundles outside Git.

Initial scenarios stay 5/10. Whole CAD and core readiness remain **NOT_MEASURED**. D708 takes the external MCP stale native write boundary. [#2426](https://github.com/barocss/barocss/issues/2426).
