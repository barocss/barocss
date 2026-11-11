# D711 — Verify Render image delivery order and lifecycle

P0, rows 06 and 16. SMALL qualification. Parent `db812d47e89bafea55cebfc40fb0b6e0d1e87c02`. The existing production guards satisfy this profile. [#2419](https://github.com/barocss/barocss/issues/2419).

## Selection, decode and workspace

Exercise both Texture and Environment in actual desktop Studio. Three local inputs have distinct independently decoded RGBA digests. After selecting A and B, deliver B first and A second. The accepted B remains exact. An older failed decode stays silent when the later input succeeds. When the latest file fails, only that error appears, and the previously accepted image remains exact after the earlier valid decode arrives. With three files selected, deliver C, B and A. Only C becomes an edit. Each accepted input has one Undo/Redo step. The same file name can be selected again with different image bytes. Both inputs also accept a 32 × 16 JPEG at its original size with matching decoded pixels.

Switch from Render to Drawing with a successful input and a failed input held. Confirm the old panel is detached. Deliver one old result in Drawing and the other after Render remount and fresh selection. Exchange which outcome is delivered in Drawing in the second case. The document, bodies, selection, notices, history and dirty state stay exact through both old deliveries. The new panel accepts its own image and a subsequent exit to Drawing retains it. A Grid change while an input is pending keeps its exact new setting and the prior image when the obsolete input completes. Undo restores the original setting.

## Accepted modeling work

Delete one of two bodies through Studio with Render mounted. Let the pre-commit validation finish. Hold the original main Worker evaluation and subsequent mass messages until the driver releases them. Each held evaluation returns revision 5 and one body. The previously started Texture succeeds during work and the older Environment fails after work. Neither changes the working document or creates a notice.

In a fresh context, begin the same deletion and choose each image while the main evaluation is pending. Genuine successful decodes produce the existing pending-work refusal, with exact document, bodies, selection and history. Finish the real evaluation. The surviving body stays current, and a fresh Environment image becomes one undoable edit. Root reviewed the actual refusal and recovery captures.

## Qualification

- **PASS** — 44 snapshots across six desktop Chrome WebGPU contexts, 325 frozen inputs through cleanup, no downloads or page or console errors. The driver forwards original browser and Worker results. Scoped Studio tests 67/67, Model and Studio TypeScript, affected lint, driver syntax and Studio production build pass.
- **FAIL** — No failure in D711. The original D577 and D709 defects and their fixes remain in the linked records.
- **NOT_RUN** — Full renderer resource/performance qualification, full suites, mobile and live model execution.

[D577](../render-image-ownership-2026-11-10/README.md) covers the original failures, A-first delivery and Model exit. [D709](../render-import-document-ownership-2026-11-11/README.md) covers Undo/Redo/New/Open and old notice ownership. [D710](../render-body-image-native-file-2026-11-11/README.md) covers target change or deletion, PNG alpha, JPEG, image size caps, intensity/repeat, native Save/Open and independent image payload reads. D711 completes the remaining selection, Drawing and work-ownership cases for #2419.

From the repository root use Node 22.19.0, the existing Playwright and Chrome, and the heavy gate. Run `D711_SOURCE_FROZEN=1 node apps/cad-studio/test/render-image-delivery-browser.mjs "$EVIDENCE/delivery"`. The selected test command is `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test render-shadow-consumer render-focus stop-work-ownership project-open-ownership nested-selection`. Keep raw captures and logs outside Git.

Next D712 checks truthful agent hole-diameter verdicts in P0 B09, row 16. [#2429](https://github.com/barocss/barocss/issues/2429). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
