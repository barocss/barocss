# D679 — Bind the STL source record to the shown geometry

P2 B07, rows 13 and 16. [D678](../step-shown-variant-2026-11-11/README.md) covers current STEP preparation during a variant switch. D679 checks the separate STL source record when the user edits a Variant input without changing the authored Master.

## Reproduction and repair

**FAIL before repair.** Studio generated a 30 × 12 × 9 mm STL with a volume of 3240 mm³, while the companion record still used revision `1303e9d3a4ee406f` and the digest of the 6 mm Master. The exporter prepared geometry from the evaluated part and computed provenance from the authored document.

The STL source record now uses the shown document with the same evaluated nodes and outputs used for geometry. This retains source metadata, including the authored look, and identifies the effective parameter values. The existing in-flight identity check also verifies the captured shown document before dispatching output. The record schema and STL mesh writer stayed the same.

## Actual Studio result

**PASS after repair.** Chrome WebGPU at 1440 × 900 ran the public Open, Variants and STL export controls. The driver captured each genuine STL and JSON Blob at the browser download boundary. It intercepted the anchor click and recorded zero browser downloads.

| State | Quality | Height | STL volume | Source revision |
| --- | --- | --- | --- | --- |
| Master | Automatic | 6 mm | 2160 mm³ | `1303e9d3a4ee406f` |
| Unsaved Variant | Fine 32 | 9 mm | 3240 mm³ | `ea4bb8c281e854e5` |
| Master restored | Automatic | 6 mm | 2160 mm³ | `1303e9d3a4ee406f` |

An independent Python reader checked all 12 binary STL triangles, the exact eight corners, closed edge incidence and volume for each box. It also computed the expected canonical source digest and revision from the fixture values and checked the actual JSON record and file name. The authored document stayed equal to Master in all three states. The two Master STL Blobs and the two Master records were byte-identical. The 9 mm STL SHA-256 is `34bc8e0a7055567b8e793475a08ba62055494c9bc4458919b0056ea58b49fad1` and its source record SHA-256 is `06899a6e6ac116715ebff3586e8cf2abffd11ec603f8f8cf9a7b2ceae6116fcd`. The source digest inside that record is `2c2ef1ff51f6325e3172ee53b7904f5eb1a628ec69b8e0bdfb16c42c47d46cd9`.

The unsaved and restored screenshots were reviewed. Zero page errors, console errors and watched changes. The 324-file source capsule matched through cleanup.

## Reproduction and limits

SMALL verification covers the private STL export controller. Use Node 22.19.0 and one heavy job at a time through `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`.

- From Studio, set local `PW_DIR` and `CHROME`. Run `D679_SOURCE_FROZEN=1 node test/stl-variant-source-browser.mjs "$EVIDENCE"` with an external evidence directory. Final receipt SHA-256 `061d079afcdd89e6905ec721fc433ef1f8a694020eb0d1773b0339943c81a28a`. Baseline FAIL receipt SHA-256 `b5120ebed42585efd032f05ecf08041602388d4ce302841e80a5c25a541e783e`.
- `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test three-mf-export-ownership step-export-preparation variant-document-draft` passed 29/29.
- `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test o9-source.test stl-export-quality.test o11-variability.test` passed 11/11.
- Studio and Model type checks, ESLint for `useModelExports.ts`, `node --check apps/cad-studio/test/stl-variant-source-browser.mjs` and `git diff --check` passed.

**NOT_RUN.** Browser download, reimport, rollback and multi-body STL, full suites and whole B07. D680 reopens the exact generated 9 mm STL in Studio, checks the declared unit and the cancellation path, and checks the accepted mesh's dimensions and losses.
