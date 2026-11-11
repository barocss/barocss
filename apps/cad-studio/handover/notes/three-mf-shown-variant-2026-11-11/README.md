# D688 — Verify 3MF export from the shown assembly variant

P2 B07, rows 10 and 13. Parent `5cee6c53a45d5eb60f3b34520be53c2d79c70f6e`. [D523](../three-mf-current-assembly-2026-11-05/README.md) qualified current assembly export after a placement or source edit. This SMALL verification-only change covers a named variant with a root parameter, a distance mate and a hidden occurrence. Product code is unchanged.

## Actual desktop Studio

**PASS.** Open the fixture in Chrome WebGPU at 1440 × 900. Use the Model rail to open Variants, export Master, select Tall and return to Master. The authored parameters, mate, placements and looks stay unchanged. The active marker is the only document difference while Tall is shown. The restored master equals the original document.

Hold the real placed Worker replies FIFO on their shared mesh slot. Root evaluation and mass replies follow native delivery. With the Tall base fresh at 3,240 mm³ and both Z=14 mm placed replies pending, click Export 3MF. Studio reports “Not written yet” and writes zero new Blobs. Release original events 7 and 9 to the actual client callback. Export Tall and the restored Master through the same control.

Capture three files at the actual local Blob boundary. Each file has a valid ZIP CRC, Core XML in millimetres, and two build items with matching model objects. The world-space coordinates need no build transform. The hidden decoy is absent. The independent Python standard-library reader checks all eight corners to 1e-6 mm, twelve triangles per object, paired directed edges, and signed volume to 1e-6 mm³.

| Shown state | Base dimensions in mm | Cap minimum → maximum in mm | Base / cap volume in mm³ | Source revision |
| --- | --- | --- | --- | --- |
| Master | 30 × 12 × 6 | [10, 2, 8] → [14, 5, 12] | 2160 / 48 | `d6714167d75938f3` |
| Tall | 30 × 12 × 9 | [10, 2, 14] → [14, 5, 18] | 3240 / 48 | `ba144981414c3ddf` |
| Restored Master | 30 × 12 × 6 | [10, 2, 8] → [14, 5, 12] | 2160 / 48 | `d6714167d75938f3` |

All three files retain Aluminium 6061 / `#357AC4` on the root and the occurrence override Steel (mild) / `#D08036` on the cap. Studio describes the output as the on-screen mesh, as modelled. The observed 3MF carries placed mesh objects and appearance. Editable geometry, mates, variant definitions and the source history remain in the Studio document.

## Verification

Use Node 22.19.0 and the existing `PW_DIR` and `CHROME`. Run one job at a time through `gate.sh acquire heavy 180 <label>`.

- **PASS.** From Studio run `D688_SOURCE_FROZEN=1 node test/three-mf-variant-browser.mjs "$EVIDENCE"`. Receipt SHA-256 `3b3894bac2dc7500959c1eb4be2e3a192e421b2cbc38c9b58f704488e4d84db5`. Reviewed four screenshots. All 326 frozen paths matched through cleanup. Browser downloads, page errors, console errors and worktree changes were zero.
- **PASS.** `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test three-mf-export-ownership assembly-linked-faces` passed 23/23. `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test threemf printing o11-variability instance-looks` passed 45/45. Node syntax, scoped ESLint, Studio and final Model type checks, and Git whitespace passed.
- **FAIL (runner).** First attempt held root evaluation and mass events as well as placed events. The batched release left the root mass pending in the test, so the readiness wait timed out. Receipt SHA-256 `d035a56bc4b2b7fae8cbca077222865adb48403d911d533786d35971be937a72`. The second attempt held one placed reply. A second request for the same Tall placement could complete, so the refusal assertion timed out after Studio wrote a file. Receipt SHA-256 `86c06faf2ca7ac7022c31f26fede839a326616a5190d77d1fbd622224cee1401`. The final runner holds the complete placed slot only.
- **NOT_RUN.** Browser-managed download, third-party slicer, other 3MF profiles, whole suites, and B07 acceptance. Studio has no supported 3MF Open. [#539](https://github.com/barocss/barocss/issues/539) and [#2425](https://github.com/barocss/barocss/issues/2425) remain open.

Next D689 freezes the B07 exchange cases and compares the current Studio loss notices with the selected STEP, STL and 3MF outputs. The genuine STL unavailable-family case in #2425 still needs an eligible fixture.
