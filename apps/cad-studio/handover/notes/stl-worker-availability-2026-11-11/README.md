# D693 — Measure STL availability and verify the real Worker refusal

P2 B07, row 13. Parent `f6de9babf28147ad3641290ba5876520c33921b7`. SMALL verification-only change for [#2425](https://github.com/barocss/barocss/issues/2425). [D681](../stl-float32-collapse-2026-11-11/README.md) introduced the Float32 refusal. [D682](../stl-late-reply-2026-11-11/README.md) verified the fallback after a controlled unavailable reply. This run seeks a valid, same-body unavailable result and records the real Worker response for the precision case.

## Candidate measurement

**PASS for the bounded source scan.** Read the 28 checked-in desktop `.bcad` fixtures through the Model file reader. Add seven supported documents covering a cylinder, concentric and offset holes, partial and full toroidal revolves, and the thin prism at the origin and at Z=9999 mm. Use the Model's evaluated document projection and the default Automatic exporter with each evaluated root body's actual key.

| Outcome | Count |
| --- | ---: |
| Documents that evaluate with root bodies | 33 |
| Documents with no root body | 2 |
| Evaluated root bodies | 35 |
| Bodies with native STL bytes | 34 |
| Bodies with a typed Float32 refusal | 1 |
| Bodies with a genuine unavailable result | 0 |

The single refusal is the fresh 2 × 2 × 1/4096 mm prism at Z=9999 mm. Its display mesh has 12 triangles. The corresponding near-origin prism exports. Neither empty root documents nor deliberately missing keys supply a fallback witness.

The independent Sol High source review confirms that display and native STL tessellate the same snapshot B-rep at 8 and 16 segments per quarter by default. There is no STL family filter in the native exporter. A closed faceted tetrahedron, a curved band sheet and the [D270 trimmed Boolean corpus case](../../../../../packages/barocss-cad/robustness/corpus/fuzz/fuzz-20261023-110.json) also produce native STL bytes in the reviewer's separate Model probes. The tessellator can throw on a sampling-sensitive trim or loop. An eligible witness needs a fresh, nonempty display mesh, a confirmed non-precision tessellation refusal at Automatic quality for the same body, and a genuine Worker reply with null bytes and no error. The catch in `stlFor` also covers other failures. The existing touching-lump branch chooses the display split before the native request and uses the shared Float32 encoder for the triangles it writes.

## Actual desktop Studio

**PASS.** In Chrome WebGPU at 1440 × 900, observe real STL requests and replies without changing or delaying them. Automatic on the ordinary two-body control returns two 684-byte files. Both exact Worker byte streams equal the corresponding local Blobs. The independent reader confirms 12 nondegenerate triangles and the expected corners and winding in each. The source record names both files.

Open the actual far thin part. Automatic and Fine 32 each receive bytes for the first body and the typed `STL_FLOAT32_COLLAPSE` error with null bytes for the second. Studio shows the error and publishes zero STL or source Blobs in both cases. The accepted document stays exact and passes the existing browser project Save and fresh native Open check.

**NOT_RUN.** A genuine unavailable-result fallback in Studio. The source scan found no eligible case. D682's controlled null retains its downstream-only scope. The measured ordinary and precision cases do not close #2425 or whole B07.

## Verification

Use Node 22.19.0 and the existing `PW_DIR` and `CHROME`. Run one heavy job at a time through `gate.sh acquire heavy 180 <label>`.

- **PASS.** From Studio run `node test/stl-availability-scan.mjs "$SCAN_EVIDENCE"`. Report SHA-256 `de0fcd0e92338f8fe53dd94aa57c45c4a05a47992b63a5e93dfc3da9b681cb25`.
- **PASS.** From Studio run `D693_SOURCE_FROZEN=1 node test/stl-float32-collapse-browser.mjs "$EVIDENCE" --fixed --observe-worker`. Receipt SHA-256 `1f2bb74af93c3912937975c3337fa4aad50ddc768e149e6367fc8fb5f607c79c`. Reviewed the ordinary export, both refusal details and the fresh Open. All 325 frozen paths matched through cleanup. Browser downloads, page errors, console errors and watched source changes were zero.
- **PASS.** `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test mesh-import-ownership step-export-preparation three-mf-export-ownership` passed 42/42. `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test stl-export-quality.test` passed 3/3. Driver syntax, scoped ESLint, Studio and final Model type checks, and Git whitespace passed.
- **FAIL.** None in the selected checks. **NOT_RUN.** Genuine fallback, third-party slicer, broader geometry, full suites and whole B07 acceptance.

Next D694 verifies an asymmetric rotated occurrence in actual Studio 3MF output and checks world coordinates with the independent ZIP/XML reader. [#539](https://github.com/barocss/barocss/issues/539) and #2425 remain open.
