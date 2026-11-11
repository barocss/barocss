# D682 — Cancel pending STL on document replacement

P2 B07, rows 13 and 16. Baseline `84b67ea2238a97fe51863a54b55b06897ee34add`. [D681](../stl-float32-collapse-2026-11-11/README.md) established the precision refusal and the native retention check for [#2425](https://github.com/barocss/barocss/issues/2425).

**FAIL before repair.** Studio staged a 684-byte STL for body b1 and held the real 684-byte Worker reply for b3. Opening a native part with the same filename and b1 key left the previous Preparing dialog visible. Delivering b3 closed the dialog and displayed a stale failure on the new part. No STL or source record was generated. The old and new parts contained two and one bodies respectively. The baseline runner retained this observation, then failed its touching-piece oracle because the first emitted lump belonged to the second cube in the authored graph. Baseline receipt SHA-256 `f8410725582d7cdf8ad456dac03b446e9ecc9b70f6c043a1bd73f65d8cf37705`.

An accepted replacement and a history transition across a document boundary now use the existing STL Cancel action. It advances the generation, clears pending state and closes the dialog. The existing per-body and pre-output checks discard the old reply. Open selection and parsing can finish before replacement is accepted. Normal same-document edits still use the existing freshness check.

## Actual desktop Studio

| Case | Result |
| --- | --- |
| Cancel after b1 is prepared, start Fine 32, release the old b3 first | PASS. The retry stays pending and the old reply creates zero files or alerts. Only the retry exports both solids and its source record. |
| Open the same name with b1 changing from height 6 to 9 mm | PASS. The previous dialog closes at replacement. The late b3 reply creates zero files or alerts. Export of the new part yields one 30 × 12 × 9 mm STL and its source record. The accepted native volume is 3,240 mm³. |
| Redo across the New part history boundary | PASS. Redo restores Untitled, dismisses the prior STL dialog and ignores the held real reply. |
| Import the actual 9 mm export as facets | PASS. Fine 32 refuses before a Worker request. Automatic produces a valid STL and record from the real Worker. One separate controlled unavailable reply exercises the display-mesh fallback and its notice. |
| Two 10 mm cubes sharing one edge | PASS. Fine 32 refuses. Automatic exports two valid STL files and a source record without an STL Worker request. The native volume is 2,000 mm³. |

Five independent Python reads checked seven STL payloads. Each contains twelve nondegenerate triangles with finite coordinates, the expected eight world-space corners and consistent normals and winding. All five source records list the corresponding STL filenames. The final run had zero browser downloads, page errors, console errors and source changes. All 323 frozen hashes matched after owned contexts, browser and server closed. Compared the baseline and fixed replacement screenshots and reviewed the controlled fallback notice. Final receipt SHA-256 `09bdbc03d2a8217c6caf7d7737144c6be49993a90eb17ea9c607d13d08a44ac7`.

## Verification

SMALL private Studio fix. Root used the existing browser runner and a Python byte reader. Use Node 22.19.0. From Studio with local `PW_DIR` and `CHROME`, run `D682_SOURCE_FROZEN=1 node test/stl-late-reply-browser.mjs "$EVIDENCE" --fixed` under `gate.sh acquire heavy 180 d682-studio`. Use the pre-repair source and `--baseline` to reproduce the inherited dialog. The runner intercepts actual generated Blobs before clicking the download target. It holds message delivery for real Worker requests and runs the unavailable-result control separately.

`pnpm --dir apps/cad-studio type-check` passed. `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test document-file project-open-ownership stop-work-ownership step-export-preparation three-mf-export-ownership` passed 87/87. Scoped ESLint, driver syntax and Git whitespace checks passed.

**NOT_RUN.** Full suites, browser download and a supported family whose genuine Worker returns an unavailable result. The controlled null proves the downstream fallback and preserves the distinction from D681's typed refusal. [#2425](https://github.com/barocss/barocss/issues/2425) stays open at that acceptance boundary. Whole B07 remains unadjudicated.
