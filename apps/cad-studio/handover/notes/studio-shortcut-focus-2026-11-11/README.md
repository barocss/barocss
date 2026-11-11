# D684 — Give focused controls their keyboard shortcuts

P0 R17, rows 16 and 21. Baseline `0010ecf9882152ab04140cd3c14c7c70fbde36a5`. The independent desktop audit reported both failures. Root reproduced them in Chrome WebGPU at 1440 × 900 with trusted key events.

**FAIL before repair.** With one committed Box, the filename was `UntitledX`. Cmd+Z removed the 16,384 mm³ Box and enabled CAD Redo. The filename stayed `UntitledX`. After restoring the Box, Space on focused New part opened the command palette and left the Box in the document. Studio canceled the default action for both events. Baseline receipt SHA-256 `02bf435e2eb84a926ba7068a7d1a4d7396d5fea1493a9a0d8e75f93e1d2c0733`.

The Window listener respects events already handled by the focused control. It lets the browser handle Undo and Redo while a form or editable text control has focus. It also leaves Space to the focused button or summary. The central check covers the Browser buttons and replaces the former Browser-only Space handler.

## Actual desktop Studio

- **PASS.** File-name Undo removes X and Redo restores it. The Box, selection, dirty state, visible history and toolbar history state stay identical. Focus stays in the field. The browser receives the default action.
- **PASS.** From the canvas, CAD Undo removes the Box and CAD Redo restores the exact document. Space opens the palette with its search field focused. Escape closes the palette.
- **PASS.** Space on focused New part opens an empty document. The palette stays closed. Toolbar Undo then restores the prior Box and its name.
- **PASS.** The D667 Browser-row flow keeps Space and Enter selection, Escape focus and palette selection retention. The D569 flow keeps text Copy/Paste local and preserves subsequent CAD Paste and history.

The main fixed receipt SHA-256 is `afea39de280cae29286711f5e1421385d4eb48b0a95308571731a3d102773267`. Browser-row regression receipt SHA-256 is `e62c6adda511c862df095eb74e29124af50cf759dc3d4129b9c7b16cfa8e9cfa`. Text Clipboard regression receipt SHA-256 is `fc626dfce4fd9f044f36a01d4a72dd621571c03e07ab17f3ceedd1abe28e85b9`. Reviewed the baseline palette and fixed Undo and New part screenshots. Each run reports zero downloads, page errors, console errors and worktree changes.

## Verification

SMALL private Studio repair. Use Node 22.19.0 and one heavy job at a time under `gate.sh acquire heavy 180 <label>`. From Studio with local `PW_DIR` and `CHROME`, run `D684_SOURCE_FROZEN=1 node test/studio-shortcut-focus-browser.mjs "$EVIDENCE" --fixed`. Use the original source with `--baseline` to reproduce both failures.

- `D667_SOURCE_FROZEN=1 node test/browser-row-keyboard-browser.mjs "$ROW_EVIDENCE" --fixed` and `D569_SOURCE_FROZEN=1 node test/body-clipboard-text-focus-browser.mjs "$CLIPBOARD_EVIDENCE"` passed. Give the Clipboard runner a path that does not yet exist.
- `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test palette document-file stop-work-ownership` passed 26/26. Studio and Model type checks, scoped ESLint, driver syntax and Git whitespace checks passed.

The first baseline attempt used an exact accessible filename label that differed after the document became dirty. The second read focus after the palette had already moved it. The corrected observer records focus before dispatch reaches Studio and reads default prevention afterward. A Clipboard regression attempt supplied an existing output directory and stopped before launch. The successful retry used a new child directory.

**NOT_RUN.** Other OS native key bindings, whole Studio suite and broader [#2287](https://github.com/barocss/barocss/issues/2287) acceptance. The issue remains open. The next owner-selected desktop item is the top toolbar overflow at the two reported sizes.
