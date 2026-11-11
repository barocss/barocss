# D716 — Protect hidden construction from direct sketch cuts

P0, rows 09 and 16. FEATURE qualification for sketch editing and identity. Parent `3eb0e91931a83a68fa9c1cb2862a92e80b51dea6`. [#2312](https://github.com/barocss/barocss/issues/2312).

## Reproduction and decision

On the parent, use Hide construction and click the previous position of each hidden shape. Actual Studio showed a preview for all three tools. Trim deleted the hidden circle with ID `e4`. Extend moved the hidden line from `[3,0]` to `[5,0]`. Split replaced the hidden circle with a two-arc loop from `[6,0]` to `[2,0]`. The other construction remained available when shown.

Hover and click now use the same ordered sketch shapes and protected set. Hidden finished construction remains a geometric boundary for visible edits. A protected shape cannot become the direct target or join or donate its IDs during the edit. Finishing while hidden keeps those shapes with their original records. The preview belongs to the exact sketch state that produced it, so hide, show, tool changes, and document changes retire stale previews.

The first baseline driver reused a camera state across cases and missed one viewport. Fresh contexts reproduced all three cases. An expanded control first entered the tool while its adjacent construction was still visible. The final preservation case hides those shapes before switching tools and holds them hidden through Finish.

## Qualification

- **PASS** — Desktop Chrome WebGPU recorded 30 snapshots across ten authored cases and a fresh native reopen. Trim and Split refused hidden circles and lines. Extend refused hidden lines and arcs. Show restored the original geometry, and all three tools edited visible construction. Split chose a visible rectangle edge next to a closer hidden circle. The hidden geometry, IDs, construction roles, touching line pair and stored length constraint persisted exactly through Finish, Undo/Redo, Studio project Save, fresh Open and Edit sketch. The native file SHA-256 is `d166f323e1cb5623a54f083dda3c8e238b39417d09618cadc71c0006fd402992`.
- **PASS** — Hide/show retired the old preview. Tool switch, Escape and another Open with reused local IDs preserved the current document and retired the old highlight. All 791 frozen inputs matched through cleanup. No downloads or page or console errors. The affected D715 desktop replay passed its 16 states on the new source.
- **PASS** — Studio 13/13 and Model 51/51 focused tests. The scope test checks hidden boundary use, retained IDs, order and original object identity for visible edits. Model and Studio TypeScript, affected lint, Studio production build, driver syntax and diff checks passed.
- **FAIL** — The parent permitted direct editing of hidden shapes through each of the three tools. Fixed in the current branch.
- **NOT_RUN** — Full suites, mobile, new layer semantics, and general construction visibility outside these tools.

Run from the repository root with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. Use the baseline switch only with the parent production source.

```sh
D716_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-cut-visibility-browser.mjs "$EVIDENCE/studio"
D715_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-extend-first-hit-browser.mjs "$EVIDENCE/d715-extend"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test sketch-cut-visibility trim sketchIds
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test construction sketch-reopen-parameters sketch-reopen-side-ids sketch-reopen-main-role
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
```

Next D717 checks whether confirming an unchanged sketch dimension writes the displayed rounded number into the model. [#2293](https://github.com/barocss/barocss/issues/2293). This protects the existing radius edit before the proposed diameter input in [#2397](https://github.com/barocss/barocss/issues/2397). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
