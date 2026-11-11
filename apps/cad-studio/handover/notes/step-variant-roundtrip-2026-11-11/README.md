# D683 — Export and reopen the current assembly variant as STEP

P2 B07, rows 13 and 16. Baseline `8e614487ea9859929b83f7a6452ed677f3de96f3`. [D678](../step-shown-variant-2026-11-11/README.md) proved STEP preparation with the same variant. [D404](../exchange-profile-2026-11-01/README.md) checked a producer-generated flattened assembly. This run covers the missing Studio Export and fresh Open on one byte stream. No product code changed.

## Actual desktop Studio

**PASS.** Open the authored assembly in Chrome WebGPU at 1440 × 900. Show Tall. The base height is 9 mm and the placed cap starts at [10, 2, 14] mm. The STEP panel identifies AP214, B-rep geometry and millimetres. It lists four losses covering feature history, parameters and expressions, hierarchy and shared definitions, and body and occurrence labels.

Click the panel's Export. The local capture sees exactly one `step-variant.step` Blob. The 10,516 bytes equal the preview Worker payload and carry the same D678 source revision `bb4cfd6d2ca9b48c`. The authored master returns exactly to its original parameters, mate, placement and variant state. Open the captured file through the public Open control in a fresh context.

The independent Part 21 checks found 260 entities, one product, two solids, sixteen vertices, one mm length declaration and no occurrence, appearance or semantic datum entities from the checked list. All references resolve. Each solid's eight corners match the analytic prism at 1e-6 mm. The D404 graph reader also passed its original and comment/string controls and detected all five negative controls.

| Solid | World bounds in mm | Imported volume in mm³ | Imported centroid in mm |
| --- | --- | ---: | --- |
| Base | [0, 0, 0] to [30, 12, 9] | 3240 | [15, 6, 4.5] |
| Cap | [10, 2, 14] to [14, 5, 18] | 48 | [12, 3.5, 16] |

Studio retained the exact STEP text in one import node and produced two solids. It displayed 3,288 mm³, millimetres and the loss of colours, names and assembly structure. The imported document has no original parameters, mates, assembly or variant state. The volume and centroid results are Studio self-read compared with analytic values. The independent readers check the exported records and vertex coordinates.

## Verification

SMALL verification-only change. Use Node 22.19.0 and the existing `PW_DIR` and `CHROME`. Run one job at a time through `gate.sh acquire heavy 180 <label>`.

- From Studio, run `D683_SOURCE_FROZEN=1 node test/step-shown-variant-browser.mjs "$EVIDENCE" --round-trip`. Final receipt SHA-256 `dd9fee8e14aa3b35c6166dcaa874ab8d8602ebf2851f697bd8ea76fb7692c7f0`. Export and Open SHA-256 `6d39f1b835d2bc07a7b51cfe7f02b6030fec943be11968f78e137ba8356ef794`. Reviewed both screenshots. All 327 frozen paths matched through cleanup. Browser downloads, page errors, console errors and worktree changes were zero.
- The original Master → Tall → Master mode also passed with `D678_SOURCE_FROZEN=1` and no mode argument. Receipt SHA-256 `6d53d3f6b1fc163c332d2fb35d34f3b3556f5021eded72a1c14e41fbd07ac176`.
- `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test step-export-preparation step-metadata document-file assembly-linked-faces` passed 31/31. Scoped ESLint, driver syntax and Git whitespace checks passed.

**FAIL.** None in these runs. **NOT_RUN.** Browser-managed download, third-party geometric import, AP242 assembly/PMI, whole suites and whole B07. [#2263](https://github.com/barocss/barocss/issues/2263) remains open. The next P2 exchange case is actual 3MF output from a shown variant, using D523's existing controls and independent reader. Current [P0 intake](../../roadmap-tracks/01-reliability.md) takes priority.
