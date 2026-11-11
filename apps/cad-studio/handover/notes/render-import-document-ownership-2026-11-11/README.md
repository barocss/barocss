# D709 — Keep Render image import errors with their document

P0, rows 06 and 16. SMALL private Studio repair. Parent `1cc3e21cf7b14efc3eb11aa0e48d1cd812d94a30`. [#2419](https://github.com/barocss/barocss/issues/2419).

## First failure and decision

The retained D577 guards suppress the pending Texture and Environment outcomes after Undo and Redo. A different failure reproduces after a user opens a new native file. The source document's current failed PNG shows its expected error. Open accepts a different document with the same feature keys and a 9 mm extrusion. The prior document's “Could not use that image” notice remains visible over the newly opened model.

Studio binds image import errors to the document that received the request. The error callback checks the currently accepted document. When the document changes, Studio omits the old notice immediately and clears the stored notice, so an Undo cannot revive it. The existing BOM notice continues to use both document and file name. D577 retains ownership of pending inputs, bitmap cleanup and the accepted Render edit.

## Actual Studio and verification

- **PASS** — In desktop Chrome WebGPU, hold and release genuine bitmap successes and failures around Undo, Redo, Open and New part. The same Render panel remains mounted in all four cases. Texture succeeds pending Undo/Open and Environment succeeds pending Redo/New. The other input fails in each case. After each boundary, neither obsolete continuation changes the accepted document, bodies, selection, visible history, dirty state or notices. Each decoded stale bitmap closes once. Eleven snapshots and 323 frozen source files match the recorded run through cleanup.
- **PASS** — A current malformed input still reports its error. Open and New part remove the previous error. Undo back across New part leaves it gone. The new document accepts a fresh Texture whose decoded RGBA matches the fixture, retains the 9 mm geometry, and returns to the exact opened document on first Undo.
- **PASS** — Current D577 desktop latest-selection, error and exit controls and the D707 BOM notice control pass. Studio focused tests 65/65, Model and Studio type checks, scoped ESLint, driver syntax and Studio build pass.
- **FAIL** — The original code shows the prior image import error after successful Open. The current code passes the corresponding assertion.
- **NOT_RUN** — Per-body target replacement, controlled pending modeling work, three-file and reverse delivery, Drawing exit, JPEG and image size cases, native image Save/Open, full suites and mobile. The desktop driver holds actual browser decode outcomes and forwards their original results.

From the repository root use Node 22.19.0 and existing Playwright and Chrome under the heavy gate. Run `D709_SOURCE_FROZEN=1 node apps/cad-studio/test/render-image-ownership-browser.mjs "$EVIDENCE/boundaries" --expect=document-boundary`. Recheck `D577_SOURCE_FROZEN=1 node apps/cad-studio/test/render-image-ownership-browser.mjs "$EVIDENCE/render-controls" --expect=fixed` and `D707_SOURCE_FROZEN=1 node apps/cad-studio/test/bom-nested-currentness-browser.mjs "$EVIDENCE/bom-control"`. The focused command is `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test render-shadow-consumer render-focus stop-work-ownership project-open-ownership bom-linked-ui`. Keep raw captures and logs outside Git.

[#2419](https://github.com/barocss/barocss/issues/2419) stays open for the remaining acceptance. D710 checks per-body ownership and native persistence. Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
