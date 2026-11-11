# D695 — Verify late 3MF compression and accept the selected B07 cases

P2 B07, rows 10 and 13. Parent `f964c30b4c6e0b13666dbf4a327bde2d7699b643`. SMALL verification-only change. [D689](../stl-assembly-loss-2026-11-11/README.md) froze six ordinary part and static-assembly profiles. D695 verifies the remaining 3MF document-switch boundary. The product code is unchanged.

## Actual desktop Studio

**PASS.** Open the two-body assembly in Chrome WebGPU at 1440 × 900. Start 3MF Export, hold the first native deflate output chunk, and open a different document under the same file name. Both documents use root key `b1`. The replacement is a standalone plate 30 × 12 × 9 mm. The old source has a 6 mm base and a placed Cap.

| Delivery order | Result |
| --- | --- |
| Old compression succeeds after Open, before the current Export | Release the genuine compressed chunk. The response consumes 772 bytes. The old completion creates zero Blobs and zero notices. Exporting the replacement creates one file and its own notice. |
| Old compression rejects after the current Export | Hold the old stream, open the replacement and export it first. Reject the old stream at the held chunk. The response rejects with `TypeError`. The old completion creates zero Blobs and zero notices, and the current success notice stays visible. |

Both exported Blobs are the replacement file. Independent ZIP/XML reads verify one object and build item, millimetres, eight corners within 1e-6 mm, 12 triangles with paired directed edges and signed volume 3,240 mm³ within 1e-6 mm³. The package retains Aluminium 6061 and `#357AC4`. Both packages carry source revision `64e3b708ac95b2c2` and match in canonical content after excluding per-export UUIDs and ZIP timestamps. The replacement document stays exact. The two files and the two success notices account for all observed output.

## B07 v1 — Accepted 6/6 selected profiles

The six profiles and their positive boundaries are the ones declared in D689. The retained checks and D695 cover their actual Studio consumers and independent file reads. STEP and STL have fresh Open checks on their actual exported bytes. The 3MF profile uses independent package readback and has no supported Studio Open. Native geometry, placed mesh and import self-read evidence keep their original limits.

| Profile | Accepted evidence and retained boundary |
| --- | --- |
| STEP part | **PASS.** [D691](../step-standalone-roundtrip-2026-11-11/README.md) exports and reopens the 80 × 50 × 10 mm AP214 box, with independent mm, graph and vertex checks. The box exposes history loss and the PMI/datum profile limits. [D531](../public-step-loss-report-2026-11-05/README.md) separately covers applicable source-specific loss messages and earlier native-reader custody. |
| STEP static assembly | **PASS.** [D683](../step-variant-roundtrip-2026-11-11/README.md) verifies actual Tall Export and exact fresh Open. Independent checks cover two world-space solids and 16 corners, and the Studio report covers history, parameters, hierarchy and labels. The Open notice covers appearance and assembly loss. [D677](../step-preview-late-reply-2026-11-11/README.md) verifies two late-reply orders. |
| STL part | **PASS.** [D679](../stl-variant-source-2026-11-11/README.md) binds the displayed part to the independent binary mesh and source record. [D680](../stl-variant-roundtrip-2026-11-11/README.md) verifies exact fresh mm/cm Open and Cancel. [D681](../stl-float32-collapse-2026-11-11/README.md), [D682](../stl-late-reply-2026-11-11/README.md) and [D693](../stl-worker-availability-2026-11-11/README.md) verify precision refusal, late-reply isolation and the actual Worker error within the selected cases. |
| STL static assembly | **PASS.** [D689](../stl-assembly-loss-2026-11-11/README.md) fixes the reproduced missing disclosure for Automatic root-only output and verifies Fine refusal. [D692](../stl-assembly-root-open-2026-11-11/README.md) reopens the exact root mesh at 160 × 60 × 4 mm and independently matches its positions and indices. |
| 3MF part | **PASS.** [D690](../three-mf-loss-disclosure-2026-11-11/README.md) verifies actual standalone output, mm geometry, appearance and editable losses. D695 independently verifies the replacement part after both document-switch timings. |
| 3MF static assembly | **PASS.** [D523](../three-mf-current-assembly-2026-11-05/README.md), [D688](../three-mf-shown-variant-2026-11-11/README.md) and [D694](../three-mf-rotated-occurrence-2026-11-11/README.md) verify current placement, visibility, rotation, appearance and pending refusal. D690 fixes the reproduced missing editable and assembly disclosure. D695 verifies suppression of late success and error after replacement. |

The external slicer, general format support, native recovery of editing history, and the genuine kernel-unavailable STL case remain outside these six positive profiles. The unavailable case stays **NOT_RUN** under [#2425](https://github.com/barocss/barocss/issues/2425). [#539](https://github.com/barocss/barocss/issues/539) and [#2263](https://github.com/barocss/barocss/issues/2263) retain their broader acceptance. The initial scenario count is 5/10 accepted. Whole CAD and core readiness remain NOT_MEASURED.

## Verification

Use Node 22.19.0 and the existing `PW_DIR` and `CHROME`. Run one heavy job at a time through `gate.sh acquire heavy 180 <label>`.

- **FAIL (runner).** The first run expected the injected stream error text to survive Response consumption. Chrome reported a Fetch TypeError instead. Receipt SHA-256 `f5b280f324e6beb4f8de3726041a3b5db4472cba04be51efecca2d94caad7dc7`. The final runner observes the injection and the response rejection separately.
- **PASS.** From Studio run `D695_SOURCE_FROZEN=1 node test/three-mf-variant-browser.mjs "$EVIDENCE" --late-compression`. Final receipt SHA-256 `85da62000c142cd578438bcd2da41dad40c9136dbe939d2e39a526f723cc0bf6`. Reviewed all six final screenshots. The D694 `--rotated-occurrence` regression also passes. Receipt SHA-256 `d3445573dea2d9a5e946ce9868c84151c23e3c169da0294430b0fb9288f23fc7`. All 327 frozen paths matched through cleanup in both runs. Browser downloads, page errors, console errors and watched source changes were zero.
- **PASS.** `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test three-mf-export-ownership assembly-linked-faces step-export-preparation` passed 36/36. `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test threemf o11-variability instance-looks` passed 36/36. Driver syntax, scoped ESLint, Studio and final Model type checks, and Git whitespace passed.
- **NOT_RUN.** Browser-managed download, external slicer, natural compression failure, broader file profiles and full suites.

Next D696 moves to P2 B06 and reproduces loss of a user tolerance when Auto-dimension runs again. Verify the same dimension through rerun, Undo and fresh Open if the issue reproduces. [#2365](https://github.com/barocss/barocss/issues/2365)
