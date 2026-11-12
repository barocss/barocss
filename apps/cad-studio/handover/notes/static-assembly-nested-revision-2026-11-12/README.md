# D761 — Verify the nested mate through a linked revision

P3 B05-05, rows 10, 12 and 16. SMALL qualification. Parent `8a668a49c1258a76267721eaf5f4e37dd1e11689`. [B05 v1 evidence ledger](../../roadmap-tracks/15-b05-evidence-ledger.md).

## Qualification

- **PASS** — The actual outliner selects `sub1/p2`. The nested card shows Sub › Block B, volume 1000 mm³ and position [20, 0, 0] mm on revision A. The existing Studio face-picker dev hook supplies the native face to the real mate flow. The stored Coincident endpoint is `sub1/p2:n1.top` and the pin's bottom is `pin:n1.bottom`.
- **PASS** — Keep Rev A preserves the accepted occurrences, mate and pin Z10. Offering B again leaves those values current until acceptance. Accept Rev B moves Block B to [20, 0, 5] and the pin to Z15. The selected card and stored path stay bound to Block B when the folded face name changes from `n3.top` to `n4.top`. Coincident constrains the planes in Z and leaves in-plane movement free.
- **PASS** — First Undo restores the exact A document with B waiting. Redo restores B. Project Save, Close, reload and Open restore the exact B document, and the nested card and pin bounds agree. Saved SHA-256 `6d8bc3ae42a535ac2637eb52e47ce689ee1845e1b6ec49d98b8be2b451169aa0`.
- **PASS** — Seven independent Python checks bind the stored endpoint to the native face table, volumes, solved Z and current viewport pin bounds. Coordinate and relative volume limits are 1e-9. Eight desktop states, 798 frozen source files and zero page errors, console errors or downloads. Fixture hashes A `5183253b725fdb627f3e9270cfa49dcd246c272455ce0b2d0cbf9993d0f61708`, B `c39368c6094086fc1b35dade254fe4ee9ed93552e1166727f01c7ef762ff4cf9`.
- **PASS** — Model 44/44 across mates, definitions and nested references. Studio 27/27. Driver syntax and diff check.
- **FAIL (driver only)** — The first run stopped before browser launch because the fixture pins used absolute paths. The helper expects repository-relative keys. The replay uses relative pins.
- **NOT_RUN** — Canvas-coordinate face picking, full suites, builds and type checks, mobile, nested mate contacts, Motion and Physics. No product source changed.

```sh
NESTED_MATE_SOURCE_FROZEN=1 node apps/cad-studio/test/nested-mate-browser.mjs "$EVIDENCE/studio-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test mates.test definitions.test
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test nested-references.test
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test nested-selection.test assembly-linked-faces.test storage.test
node --check apps/cad-studio/test/nested-mate-browser.mjs
git diff --check
```

B05 is pending at 5/7 current groups. Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**. [#538](https://github.com/barocss/barocss/issues/538) remains open. D762 verifies patterned material and the BOM across a skip and project reopen.
