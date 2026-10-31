# D381 — Row 20 ⑦: a click goes through a notice to the face under it

Tier: **feature**, because it changes click behaviour (one independent audit and one actual run). Owner order "Go to 20/21", 2026-10-31. [Qualification](qualification.json), [audit](review/independent-audit.md).

- **Before ([run02](before-run02/receipt.json)).** A "can't run here" notice lay over the box's face. A click on the notice's title picked nothing.
- **Change.** The notice text no longer takes clicks. The notice's buttons, links, fields and expandable detail still do. The notices stay beside the tool rail.
- **After ([run03](after-run03/receipt.json)).** The same click reaches the canvas and picks the face under the notice: the fillet. The notice's close button still works, and there were no page or console errors.
- **Audit: ACCEPT,** with two low findings:
  - the notice text can no longer be selected;
  - a click in the gap between a question's buttons reaches the viewport. This is harmless, because the question keeps what was picked when it was asked.
- **Retained failure.** run01 was a driver error: it zoomed into empty space and lost the model.
- **Limits.** Notices still sit over the viewport. CI and release NOT_RUN.
