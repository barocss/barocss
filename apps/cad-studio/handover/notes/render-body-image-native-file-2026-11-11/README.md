# D710 — Verify per-body Render images and their native file

P0, rows 06 and 16. SMALL qualification. Parent `bf9d99b265d486c59f99d9cac9b7c1c8b1e0525c`. The product keeps the existing D577 and D709 guards. [#2419](https://github.com/barocss/barocss/issues/2419).

## Actual body and image ownership

Open a two-body model with Target `b1` and Sibling `b3`. Hold the browser's genuine Texture decode on Target. Select Sibling and release the successful decode. Neither body receives the old image. For a held malformed file, switch away from Target and then back before release. The old failure makes no notice or edit. Delete Target with another successful decode held. The obsolete result leaves the surviving body, exact document, history, dirty state and selection unchanged. First Undo restores both source bodies.

A fresh transparent PNG applies only to Target. Changing repeat to 16 mm and replacing the Texture with a 1280 × 80 RGBA PNG retains that repeat and caps the image at 1024 × 64. The decoded result retains transparency. The default appearance and Sibling receive no Texture. The scene accepts an Environment image, then replaces it with a 2304 × 288 JPEG after the user sets intensity to 4. The replacement remains JPEG at 2048 × 256 and retains intensity. Texture and Environment replacement each preserve the prior document except for the corresponding image and each has one Undo/Redo step. Six successful controlled bitmaps close exactly once.

## Native persistence

Studio saves to a browser project. Close the project, reload the page, reopen the native file and verify the Target and Environment thumbnails against the accepted RGBA digests. The Sibling shows no Texture thumbnail. Root reviewed the actual Render captures with the textured Target and untextured Sibling. An isolated browser context then opens the exact 10,056-byte native file through the Studio file input. It retains the accepted model and image data, and the file stays byte-identical. The Python reader checks the saved document, payload types, image dimensions, PNG alpha channel and exact image digests.

- Native file SHA-256 `3c4079a4a443a57dd9563a46f43c6a2d43d255e3d3ddbb17d75716909f6cf363`.
- Texture payload SHA-256 `56b8efd050a0ec214239fc34ad642971893b19a3e5477db01c03105e64e5f2db`.
- Environment payload SHA-256 `1fb69bfd759c28c7eaad244ef576a72d8e063c7265427cb8c9b58fcf0ea4a366`.

## Qualification

- **PASS** — Desktop Chrome WebGPU, 12 snapshots, 326 frozen inputs through cleanup, browser project Save and two Open paths, independent saved-file verification, no browser downloads and no page or console errors. The existing D577 desktop controls pass with the shared test helper. Focused Studio tests 67/67, Model TypeScript, driver syntax and Git whitespace checks pass.
- **FAIL** — The initial driver waited for identical JSON property order after isolated native Open. The reader puts the Render camera key in a different position. Parsed values and both image URLs were identical. The corrected driver compares the parsed document and verifies file bytes separately. No product defect was observed in these cases.
- **NOT_RUN** — Reverse and three-file delivery, Drawing exit and remount, pending modeling work, wider renderer memory/performance, full suites and mobile.

From the repository root use Node 22.19.0, existing Playwright and Chrome, and the heavy gate. Run `D710_SOURCE_FROZEN=1 node apps/cad-studio/test/render-image-body-file-browser.mjs "$EVIDENCE/body-file"` and `D577_SOURCE_FROZEN=1 node apps/cad-studio/test/render-image-ownership-browser.mjs "$EVIDENCE/retained-controls" --expect=fixed`. Focused tests use `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test render-shadow-consumer render-focus stop-work-ownership project-open-ownership nested-selection`. Keep raw files and captures outside Git.

[#2419](https://github.com/barocss/barocss/issues/2419) stays open for D711's remaining delivery and lifecycle cases. Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
