# D382 — Row 21: the History bar stays, dimmed, while a command or sketch runs

Tier: **feature** (one independent audit and one actual run). Owner order "Go to 20/21", 2026-10-31. [Qualification](qualification.json), [audit](review/independent-audit.md).

## Before

During a command or an open sketch, the bar was removed from the page, so it looked as if it was gone ([run01](before-run01/receipt.json)).

## Change

The bar stays in place, dimmed, with a tooltip saying to finish or cancel first. Clicks on it stop at the bar: they reach neither its steps nor the viewport under it.

## Audit

The independent audit returned CHANGES_REQUIRED:
- **F1 (medium).** The first version used `inert`, which lets clicks fall through to the viewport. A click on the dimmed bar could place a box or add a sketch point there. Fixed.
- **F2 (medium).** The driver could not see F1. It now checks what is under each click and compares the document, HUD, sketch panel and picks.
- **F3 (low).** In narrow windows, a floating HUD overlaps the bottom view bar by about 8 px during a command. Recorded as a limit.

[run02](inert-run02/receipt.json) passed on the first version and is kept as evidence of the gap.

## Verification

- **Unit:** Studio 570/570; tsc and eslint PASS.
- **Actual [run03](after-run03/receipt.json)** (final source):
  - **During a command or a sketch:** the bar stays in the same place, dimmed. A real click and a double-click on a step change nothing.
  - **Idle again:** the bar takes clicks, and a step opens its editor.

## Limits

- Step names stay off by default.
- The F3 overlap remains.
- There is no timeline redesign.
- CI and release NOT_RUN.
