# D703 — Keep Model shortcuts out of shortcut help

P0 R17, rows 16 and 21. Parent `372ea79c638967dde62a4c13de08ac5123a14026`. SMALL private Studio repair. The separate Sol Medium usability lane traced the issue and prepared the patch. The root ran the actual baseline, fixed desktop flow and regressions in the active checkout.

## Baseline and decision

**FAIL.** In 1440 × 900 Chrome WebGPU, apply a 32 × 32 × 16 mm Box, select it from the Browser and open **Keyboard and mouse** with `?`. The Close button has focus. Trusted Delete and Backspace each remove the selected body. Trusted Cmd+Z undoes Box creation. The dialog stays open. The body count becomes zero and history changes in each case. The Window dispatcher canceled the default for all three keys. Parent receipt SHA-256 `003847e787dd0db1bdee9df37df36935728e5ce953723b374ebf7156e9ee6f24`.

The first runner found the dialog in HTML but waited for a different accessible name. The title supplied by `aria-labelledby` takes precedence over `aria-label`. The revised runner identifies the open help dialog and verifies its focused Close button before dispatch. First receipt SHA-256 `7c71abd17cf5a2eeaeb13b24bdd8394ad7937ac25976e67d3800352562eed031`.

The App Window dispatcher returns while shortcut help is open. The dialog keeps its existing focus and dismissal handlers. Ordinary focused controls and workspace dispatch retain their existing rules.

## Verification

- **PASS.** In actual Studio, Delete, Backspace and Cmd+Z leave the complete accepted document, selected Box, evaluated body, visible history, Undo/Redo availability and dirty state intact. Focus remains on Close. Escape and `?` each dismiss the dialog. From the Browser after dismissal, Delete removes the Box, first Undo restores it, the next Undo reaches the original empty part, and Redo restores the Box. Eight snapshots and three trusted-event comparisons pass. Final receipt SHA-256 `480098b4058a83c9d4fc5ae2ab68a6c14143952880ea89d86b461936af7e0f89`.
- **PASS.** The D684 desktop regression verifies native filename Undo/Redo, canvas Undo/Redo and the palette, and Space on focused New part. Five snapshots pass. Receipt SHA-256 `ef7e202453abfa3aa5efecbb3e58bd288aceb27d8e59fd3ff967453162a25e7c`. Both fixed runs preserve all 321 frozen files through cleanup. Downloads, page and console errors, and watched changes are zero.
- **PASS.** Use Node 22.19.0 and the existing Chrome and Playwright under `gate.sh`. From Studio run `D703_SOURCE_FROZEN=1 node test/studio-shortcut-focus-browser.mjs "$EVIDENCE" --modal-fixed`. The `--modal-baseline` mode deliberately reports the original loss after observing all three changes. For D684 run `D684_SOURCE_FROZEN=1 node test/studio-shortcut-focus-browser.mjs "$EVIDENCE" --fixed` in its own fresh output directory.
- **PASS.** `TEST_CONCURRENCY=2 pnpm --filter @barocss/cad-studio-app test palette document-file stop-work-ownership` gives 26/26. Studio and Model types, scoped ESLint, driver syntax and Git whitespace pass.
- **NOT_RUN.** Other operating systems, other modal shortcuts and independent workspace listeners, full suites and production build for this private guard. Drawing has its own listener and the ordinary shortcut help entry is in Model. Broader [#2287](https://github.com/barocss/barocss/issues/2287) remains open.

Next D704 requalifies the original H12 Section/Detail and Auto-dimension profile on current producers. Keep its exact source, native limits and independent actual SVG read. B06 stays at 5/7 qualified groups with the PDF hold. [B06-01](../../roadmap-tracks/14-b06-evidence-ledger.md)
