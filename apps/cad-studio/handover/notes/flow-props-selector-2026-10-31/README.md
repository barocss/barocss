# D386 — Fastener flow steps 94–96: a test-driver selector, not the product

Tier: **small**. Assigned by the coordinator before ②b. [Qualification](qualification.json).

## Cause

The Hole shortcut and the product were fine. The flow waited for text in "the first property card" (`.props:not([aria-label$=" panel"])`).

Commit **878f92a0d** (2026-10-26) added the *Static gravity experiment* card. It is a `.props` card and appears before the Selection card. From then on the flow read the wrong card and timed out. The failure screenshot shows STATIC GRAVITY above SELECTION · FACE.

## Fix

The fix is in `apps/cad-studio/test/browser-flow.mjs` only:
- the 30 Selection-text waits read `[aria-label="Selection"]`;
- the other 54 first-card reads skip the gravity card.

## Runs

- **Before:** step 94 failed on HEAD.
- **Run 1:** with only the Selection waits changed, 95 passed and 94 and 96 still failed.
- **Run 2:** steps 1, 94, 95 and 96 all passed.

A bisect was not needed: the screenshot and the selector identify the commit that introduced the card.

Only 94–96 were rerun, as assigned.
