# D758 — Verify repeated placement and linked definition updates

P3 B05, rows 10, 12 and 16. SMALL qualification. Parent `4c12048926c09a8c7559f1cacb817c9019cc57ed`. [B05 v1 evidence ledger](../../roadmap-tracks/15-b05-evidence-ledger.md).

Freeze seven bounded B05 groups. This run qualifies the first two groups with an ordinary 30 × 12 mm box saved in a browser project. It uses the existing Project Insert, Duplicate, Position, Feature Editor, revision and native file actions.

## Qualification

- **PASS — B05-01.** Studio inserts `bracket.bcad`, then Duplicate gives `inst1` and `inst2` one shared Rev A definition and link `./bracket.bcad`. Setting the second X position to 75 mm leaves the first at [20, 0, 0]. The second is at [75, 20, 0]. The first occurrence and both source documents remain exact.
- **PASS — B05-02.** The public Feature Editor changes the linked extrusion from 6 to 8 mm. Reopening the assembly shows Rev B waiting while both accepted copies remain at 6 mm. Accept updates both copies to Rev B, with both positions and occurrence IDs retained. The first Undo restores exact Rev A plus the waiting offer. Redo restores exact Rev B. Local-project Save, Close, reload and Open retain Rev B. Moving the second occurrence to X90 mm after Open retains the first placement and both Rev B definitions.
- **PASS — Physical and viewport checks.** Six independent Python checks compare native local volumes of 2160 or 2880 mm³ and local centroids [15, 6, 3] or [15, 6, 4] mm to the rectangular source. Relative volume and absolute centroid limits are 1e-9. Separate current viewport bounds match the explicit translations and source size within 1e-9 mm. Seven WebGPU desktop states across 797 frozen files. Zero page errors, console errors or downloads. The Rev B screenshot shows the selected occurrence volume and definition. The initial file-offer toast is still visible in that screenshot after acceptance. The Instance panel and document already show Rev B. Toast expiry timing was not measured.
- **PASS** — Model 6/6 and Studio 61/61 focused tests. Driver syntax and diff checks pass.
- **FAIL (driver only)** — The initial run saved the source and reached New part. Its exact accessible-name lookup did not find the filename input. The replay uses the existing document input and passes.
- **NOT_RUN** — B05 groups 03–07 in this run, full suites, builds and type checks, mobile, Motion and Physics. Product code is unchanged.

Input fixture SHA-256 `36b79a5ceb65f46d72a51cfb05c9e0db83e416ecec57d5b5221e9469919dcb3f`.

| File state | SHA-256 |
| --- | --- |
| Source A | `cd562ed1a41cbde73be56212da2b9335aec9221d8b530aa4fa8d99e63a5660af` |
| Assembly A | `5f9d47d844bdd37e0ea0d9bca99f265c6894ce22937def3529bbec5519147370` |
| Source B | `753dabe982fbfecc84a75f4790507dbda578112d3391ec1a284afc707912373e` |
| Assembly B | `e092ed7fd0529e1000782df151fa64829e1f94ace7a465a1465e21256090b22d` |

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D758_SOURCE_FROZEN=1 node apps/cad-studio/test/static-assembly-linked-placement-browser.mjs "$EVIDENCE/studio-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test definitions.test
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test storage.test assembly-linked-faces bom-linked-ui project-open-ownership
node --check apps/cad-studio/test/static-assembly-linked-placement-browser.mjs
git diff --check
```

B05 v1 is pending at 2/7 current groups. Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**. [#538](https://github.com/barocss/barocss/issues/538) remains open. Next D759 qualifies the current three-plane static mate, its conflict refusal and its linked-source update.
