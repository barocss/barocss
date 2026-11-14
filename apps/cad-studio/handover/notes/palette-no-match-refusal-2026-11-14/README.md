# D1251 — retain a command search after an unavailable result

2026-11-14 · SMALL · Desktop QA, rows 15 and 21 · [#2501](https://github.com/barocss/barocss/issues/2501)

- **FAIL, baseline** At 1440 × 900 and 1024 × 800 in Chrome WebGPU, an unmatched search showed a blank result area. Enter on Hole without a selected face closed the palette, lost the query and repeated the inline instruction in a toast. The document did not change.
- **PASS** An unmatched query shows one status line. Clearing the query restores the default list. Enter on unavailable Hole retains the query, input focus and one inline reason with no toast. The document, Undo and Redo availability, and active command stay unchanged.
- **PASS** Both desktops preserve the Edge, Face and Full round Fillet results, the Box shortcut label and Enter launch, and Escape. A separate actual Studio flow verifies native search Undo with empty CAD history, available CAD Undo and available CAD Redo, then saves and reopens the accepted edit.
- **PASS** 19 focused Studio tests, Studio type-check, targeted lint, driver syntax, production build, diff check and visual review. Each retained browser receipt has identical source manifests and records owned process cleanup.
- **FAIL, test setup** Two preliminary runs failed in the driver. The modal hides the background Undo control from the accessibility tree. The Edge member's command label is `Fillet`. The final driver reads the existing control's disabled flag and uses existing search terms.
- **NOT_RUN** Screen reader, full suites and mobile.

## Next priority

D1252 starts P5, rows 07 and 30, with Draft on two adjacent planar sides of a rectangular solid using one neutral plane. The current kernel refuses their shared edge. Prove the native intersection, topology and volume, then use the existing Draft command and verify edit, refusal, Undo and native file reopen. Remaining desktop QA stays queued. A reproduced P0 finding that can lose work, export stale geometry or misattribute a result still takes priority.

[Commands and receipt hashes](qualification.json).
