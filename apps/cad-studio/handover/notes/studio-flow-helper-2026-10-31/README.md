# D370 — Shared Studio flow helper

Status: **QUALIFIED**. Tier: **small change**, under the post-B1 retro rule: focused checks plus the proving runs, with no independent audit. Source commit `085f7cbf7`. [Qualification](qualification.json).

`apps/cad-studio/test/flow-helper.mjs` (275 lines) gathers what every actual-Studio driver re-implemented:
- Vite and one Chrome, with sequential contexts;
- the frozen-source capsule, the receipt and cleanup;
- snapshots and JSON-form document reads;
- open, save and fresh Open;
- framing and world clicks;
- the palette and tools;
- toasts and Dismiss;
- Undo and Redo;
- the feature editor, the Extrude HUD and the Parameters panel;
- the Python oracle runner and the bundled product inspector.

These are the pieces where most driver reruns failed in D357–D369.

Two drivers were ported to it: the D369 band driver (428 → 290 lines) and the D366 ellipse driver (400 → 293 lines). Their steps, assertions and receipt fields are unchanged.

## Checks

- `node --check` and eslint pass. Eslint caught 3 bugs from the port, all fixed.
- A non-browser self-test passes ([selftest.mjs](selftest.mjs)).
- Each ported driver ran once and passed on the first try. All frozen files equal the commit.
  - [band](runs/band/receipt.json): 9 oracles.
  - [ellipse](runs/ellipse/receipt.json): 6 oracles.

## Limits

- Driver-specific flows stay in the drivers, built on the shared primitives. Oracles and inspector entries also stay per driver.
- Older drivers are not ported. New drivers (B2 onward) use the helper.
