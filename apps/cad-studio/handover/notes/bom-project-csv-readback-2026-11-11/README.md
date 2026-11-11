# D706 — Verify the saved purchase list after project reopen

P0 B05, rows 10 and 16. SMALL. Parent `fdc5ad16a58a93c5f766f219af5941dfdad062e5`. The existing product protection remains sufficient for this profile. The only code change extends the desktop verification driver. [#2356](https://github.com/barocss/barocss/issues/2356).

## Studio and file readback

Save ordinary shaft A at Ø10 × 20 mm and shaft B at Ø12 × 25 mm in one browser project. Both use feature ID `n0`. Mark B's shaft bought through the current BOM, then Save. Close the project, reload the same desktop Chrome context, reconnect the browser project and open A and B from its document list. BOM and Versions share a dock, so close A's BOM before using project Open for B. D575 retains the separate mounted-panel stale A-to-B proof.

On B, open BOM and hold the real successful Worker response for that BOM request. Studio shows the pending state without rows or bought/made controls. Export is disabled and creates no CSV. The exact document, displayed history controls, dirty marker, selection and both saved project files remain unchanged. Release the response and verify the saved bought override is available. Changing B to made is one undoable edit, Redo restores that edit and a second Undo restores the saved bought document. A and B's saved bytes remain unchanged.

Capture the exact CSV Blob at the Studio export action, write its bytes to local evidence files and read those files with an independent Python CSV parser. The parser checks nine columns, ordered items, quantity one, type, size and empty row/catalogue fields against the saved native shaft and the selected With made parts state. The bought-only export before and after reload is identical at 130 bytes and SHA-256 `8a36c58066c3ea47798b2114e24ede8eb8594f6d284e53fdada46f11c0705e29`. With made parts adds the B part row. The 151-byte CSV has SHA-256 `061a30a16001c49bfae1f319d341ab389c25b7476da2aa53a43c1d45df27c1d7`. B's 463-byte native file has SHA-256 `ffcecfb87504aa2ff1695ed9700387c3b58d745f549cc0917d8473d7c80fdb7b`.

## Qualification

- **PASS** — Root-run desktop Studio, six snapshots, three independent CSV file reads and 325 frozen source inputs through cleanup. No page or console errors. Studio BOM tests 10/10 and Model BOM tests 37/37. Browser driver syntax and Git whitespace checks pass. D575 provides the mounted ordinary pending and prior-handler proof. D581 provides actual native evaluation refusal and healthy recovery.
- **FAIL** — The initial driver expected Versions to be visible while BOM owned the dock. The corrected driver closes BOM before using Versions. No product defect was observed in this profile.
- **NOT_RUN** — Actual nested same-path replacement and linked-housing transitions in this checkpoint, browser download manager, full suites and mobile. The local files contain the exact generated Blob bytes. The driver intercepts the browser download.

Use Node 22.19.0 and the installed Playwright and Chrome under the heavy gate. From the repository root run `D706_SOURCE_FROZEN=1 node apps/cad-studio/test/bom-currentness-browser.mjs "$EVIDENCE/project" --expect=project`. Run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test bom-linked-ui bom-nested-ui` and `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test bom`. Keep the raw files and captures outside Git.

[#2356](https://github.com/barocss/barocss/issues/2356) stays open for the nested same-key replacement boundary. D707 takes that case. B05 remains unadjudicated, initial scenarios remain 5/10, and whole CAD remains **NOT_MEASURED**.
