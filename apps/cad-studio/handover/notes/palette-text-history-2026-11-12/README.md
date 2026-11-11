# D751 — Verify native Undo and Redo in command search

P0, rows 16 and 21. SMALL desktop qualification. Parent `3fb72fc6b87c00ffb500270755a994e72a345956`. [#2301](https://github.com/barocss/barocss/issues/2301).

[D684](../studio-shortcut-focus-2026-11-11/README.md), commit `9b8ab79e2`, places editable input ownership before CAD document Undo/Redo. D751 adds a direct desktop regression for the command search and its accepted model history.

## Qualification

- **PASS** — Chrome WebGPU sends 21 trusted keyboard events across an empty CAD history, an available CAD Undo, and available CAD Undo and Redo. Cmd+Z changes search text from `x` to empty, Shift+Cmd+Z restores `x`, and a repeated Undo on an empty search leaves it empty. The search keeps focus and the keyboard events retain their native default. The accepted document, body, selection, dirty state, rollback marker and next history actions remain exact. Search sends no evaluate or preview requests.
- **PASS** — With the palette closed, the same keys restore the exact 20 mm and 24 mm Extrude states, with independent `24000` and `28800 mm³` volumes. Up/Down moves the selected command and returns to the original row. Search displays the reason for an unavailable command. Enter opens one Box command, and Cancel keeps the accepted model.
- **PASS** — Local-project Save, Close, reload and Open read the exact accepted 24 mm edit. Nine desktop states across 795 frozen files. No downloads, page errors or console errors. Fixture SHA-256 `1dfa3615d16043c1ebfe4da25546d284e39b52dcf39dc5b64d73599e0c08c674`. Saved SHA-256 `28a340fe34519856d431e2ffcccf8a33583ebb31a38bb38e7e9b6ea625a6bafb`.
- **PASS** — Studio 28/28 focused tests, Studio type-check, driver syntax and diff checks.
- **FAIL (first driver only)** — The initial navigation assertion read an absent input attribute. The corrected check uses the selected command option. Both original text-history paths had already passed in that run.
- **NOT_RUN** — Historical pre-D684 reproduction for this field, full suites, mobile, other OS shortcuts and a native IME session. D684 retains its separate filename, Browser-row and text clipboard proofs.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D751_SOURCE_FROZEN=1 node apps/cad-studio/test/palette-text-history-browser.mjs "$EVIDENCE/studio-final"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test palette document-file stop-work-ownership
pnpm --dir apps/cad-studio type-check
node --check apps/cad-studio/test/palette-text-history-browser.mjs
git diff --check
```

Next D752 resumes D576 for delayed drawing changes across sheets and workspaces, native Save/Open and SVG readback. [#2359](https://github.com/barocss/barocss/issues/2359). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
