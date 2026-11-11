# D681 — Refuse STL triangles that collapse in Float32

P2 B07, rows 13 and 16. [#2425](https://github.com/barocss/barocss/issues/2425) reports a serializer boundary. The accepted native witness is a 2 × 2 × 1/4096 mm prism at Z 9999 mm beside an ordinary body. Studio's native evaluation reports volume 1/1024 mm³ and two distinct Z levels. The independently read baseline STL contains 12 triangles, of which eight have zero recorded area and unit source normals. Automatic and Fine 32 both exhibited the defect. The baseline test's PASS means it observed that defect.

## Repair

The binary writer validates the coordinates it will write. It rejects a nonfinite encoded coordinate with `STL_FLOAT32_RANGE`. For a changed Float32 triangle, a conservative binary64 cross-product filter establishes clear nonzero area. Otherwise exact dyadic arithmetic determines encoded collinearity and, if needed, original collinearity. The writer refuses newly collapsed triangles with `STL_FLOAT32_COLLAPSE`. It preserves finite facets that were degenerate in the source, original triangle order and coordinate rounding.

The Model propagates these two errors through the existing Worker response and preserves `null` for an unavailable tessellation. Split STL now validates the original coordinates and uses the same rounded-coordinate normals as the previous split writer. Direct STL keeps its source-normal policy. The CLI prepares its STL set and source record before writing any of them. Its regression verifies that refusal on the second body leaves an existing first STL untouched and writes no partial set.

## Actual Studio

**FAIL before repair.** Both quality modes emitted the degenerate STL, the first body's STL and the source record. The independent Python reader checked the Float32 fields and cross products. Baseline receipt SHA-256 `250323f2c53a5e300461394189ee40cdd2b32f2522cef2f50c74375fd3b5fa8e`.

**PASS after repair.** Both quality modes refused the late body. Opening the alert's Details showed `STL_FLOAT32_COLLAPSE`. Neither STL nor the source record reached the local download boundary. The near-origin control produced both valid STLs and the same source-record bytes as the baseline. Native project Save and fresh Open restored the exact authored nodes, positions and volumes. The first fixed runner confirmed both export refusals and then tried to read the OPFS file before the asynchronous Save completed. The final driver waits for its committed bytes. Final receipt SHA-256 `9e762d4af9dc8027a4f7dadff62b004d3171b64327ac5981ed54c32ab85dac7b`. Reviewed the Automatic refusal and fresh Open screenshots. All 325 frozen source hashes matched after cleanup.

No browser download or external dependency was used. The Studio test intercepts actual generated Blobs at the download boundary. It independently checks the positive files' triangle count, heights and winding. This is a check of newly collapsed triangles in this writer. Upstream quantization and noncollapsed orientation changes stay outside it.

## Verification

FULL tier for the serializer and public refusal contract. Sol High reviewed exactness and split precision. A separate integration review checked API, Worker, Studio, CLI and documentation. Use Node 22.19.0 and one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`.

- From Studio, set local `PW_DIR` and `CHROME`. Run `D681_SOURCE_FROZEN=1 node test/stl-float32-collapse-browser.mjs "$EVIDENCE" --baseline` or `--fixed` on the corresponding source state. Use separate external evidence directories.
- From `packages/barocss-cad`, run `node scripts/tool.mjs build:fast` and `node --test --test-concurrency=2 test/stl-float32-encoding.test.mjs test/error-codes.test.mjs test/part-model.test.mjs test/api-part.test.mjs`. CAD 60/60.
- From the root, `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test stl-export-quality.test lumps.test o9-source.test` passed 11/11. `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test cad-external three-mf-export-ownership step-export-preparation` passed 36/36. An initial CLI test used the Box tool's height field below its admitted 1 mm. The final CLI test opens the native fixture directly.
- The encoder suite exercises six axis/sign cases, a retained exact boundary, distinct collinear rounded vertices, subnormal input, binary32 overflow, legacy degeneracy and unchanged split normals. An external esbuild runner replaces one encoder branch at a time, then runs the five cases with `node --test`. Removing the collapse guard, finite guard, exact encoded fallback, legacy exception and split normal policy produced 2, 1, 1, 1 and 1 failed cases respectively. The unmodified control passed 5/5. Each variant reached the tests. The legacy-exception variant failed with the unexpected typed refusal.
- CAD, Model and Studio type checks, scoped ESLint, the browser driver syntax check and the refusal reference check passed. The seven updated public API exposure rows match the generated inventory. The whole inventory comparison fails because its checked-in snapshot has 6,472 exposures and current generation has 6,584. The update includes only D681 rows.

**NOT_RUN.** Whole suites, live browser download, Robot export consumers and a delayed STL reply after Cancel or document replacement. [#2425](https://github.com/barocss/barocss/issues/2425) remains open. D682 covers the outstanding Studio cancellation and stale-reply boundary without starting a download.
