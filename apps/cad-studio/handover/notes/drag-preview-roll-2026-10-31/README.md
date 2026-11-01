# D377 — Row 20 ①: later features stay visible while a handle is dragged

Tier: **feature** (one independent audit and one actual run). Owner order "Go to 20/21", 2026-10-31. [Qualification](qualification.json), [audit](review/independent-audit.md).

## Measured first

The part was a box with two holes and two fillets after it ([fixture](../../../test/fixtures/drag-preview-timing.bcad)). Its box width arrow was dragged with real pointer events ([driver](../../../test/drag-preview-timing-browser.mjs)).

| | Kernel only (node) | Studio round trip |
| --- | --- | --- |
| Whole part | median 23.4 ms | ~20 ms |
| Box alone (rolled) | median 1.1 ms | ~1.2 ms |

Before the change, every drag preview was the box alone ([run01](run01/receipt.json)). The holes and fillets vanished while moving and came back after the pause.

Frames ran every 16.7 ms (max 33 ms). Row 20 ③, the stutter, does not reproduce on this part.

## Change

`useCommandPreview` rolls back to the dragged feature only when a whole-part preview on this document took longer than `ROLL_AFTER_MS` (120 ms). Until that is measured, it uses the App's last whole-document evaluation time. A slow part rolls back exactly as before.

## Audit

The independent audit returned CHANGES_REQUIRED.
- **F1 (medium), fixed.** The cost was keyed by the command object. An idle handle starts a new edit command each time, so a slow part waited one whole evaluation before its first frame. The cost is now keyed by the document and seeded from the evaluation time.
- **F2 (low), fixed.** A misplaced comment.
- **Other checks held.** The D368 wall and bisect rules still hold.

## Verification

- **Drag-wall tests:** 24/24, 4 of them new (quick or slow part × palette or idle start).
- **Mutations:** 3/3 killed.
- **Studio unit:** 563/563. **tsc:** PASS.
- **Actual [run03](run03/receipt.json)** (final source):
  - 2 drags, 12 previews each;
  - every preview is the whole part, none the box alone;
  - whole part median 17.5 ms;
  - frames median 16.7 ms, none over 50 ms;
  - holes and fillets visible while moving (screenshots reviewed by the root);
  - Escape leaves the document unchanged.
- [run02](run02/receipt.json) passed before the audit fixes.

## Limits

- Headless Chrome frame times are not a display's vsync.
- One part was measured, and the 120 ms threshold was not tuned.
- ③ needs a part slower than 120 ms to measure.
- CI and release NOT_RUN.
