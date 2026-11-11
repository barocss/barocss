# D748 — Keep open sketch geometry when Finish refuses it

P0, rows 09 and 16. FEATURE qualification. Parent `196e745ac2000acdcb619b2a529fd60d63e7a71a`. [#2295](https://github.com/barocss/barocss/issues/2295).

Studio checks ordinary sketch geometry after the existing join. A line or arc chain that remains open stops Finish before assigning IDs, dispatching evaluation or changing the document. A closing arc still being placed receives a distinct prompt. An existing sketch panel alert names both ends in local millimetres and belongs to the current draft generation. Completing or trimming the chain retires that alert. Construction, Bézier, band and Make curves follow their existing paths. The Model profile builder and the join tolerance stay as before.

## Qualification

- **FAIL (parent)** — In actual desktop Studio, Enter saved a rectangle and dropped the current line from `(30, 0)` to `(40, 0) mm`. The Finish button saved a rectangle and dropped the parked centre arc from `(40, 18)` to `(35, 23) mm`. After one Trim, Finish saved only the circle at `(20, 5) mm` with radius 4 mm. Six baseline states reproduce the three losses.
- **PASS** — The same Enter and button inputs retain the active or parked geometry, accepted document, feature history, dirty state, selection and displayed bodies. The inline alert gives the open ends, including `(20, 9)` and `(20, 1) mm` after one Trim. Closing the active line makes a separate triangular region. The second Trim makes one line-and-arc profile, then 8 mm Extrude gives `1801.0619298297477 mm³` against independent `8 × (200 + 8π) mm³`.
- **PASS** — Editing the sketch of an existing Extrude refuses the new open line. Explicit Trim removes that line. Finish then keeps a newly drawn open construction line and quadratic Bézier, the original sketch and side IDs, the downstream feature and the `1600 mm³` prism. Undo and Redo restore both exact document states. Project Save, Close, reload, Open and Edit sketch restore the construction line and Bézier. Thirteen current desktop states over 794 frozen files. No browser downloads, page errors or console errors. Native fixture hash `853ff7b55551a52d5ccf05a27a9213b937e0c10569f12c07ec304b29d328aeb7`. Saved file hash `a7bc49a20ceb00f3623e69412422c3549699c226f2682a6fe468aa671c98be95`.
- **PASS** — Model 56/56 and Studio 86/86 focused tests. The actual Finish hook retains its draft and does not call the Worker or commit for an open-only sketch, multiple open chains, a pending closing arc and an in-place edit. A `0.00005 mm` gap uses the existing join, and a `0.00011 mm` gap is refused. A one-point gesture retains its previous policy. Both type-checks, affected lint, driver syntax, production build and diff checks passed.
- **FAIL (initial harness runs)** — The driver initially assumed a blank starter, moved the arc to Select (which keeps it current), and waited for an Open action on the active project document. The final driver starts a new part, parks the arc with Rectangle and waits for the saved project row. An initial hook assertion also counted the selection reset from entering Edit sketch. It now compares the selection-write count immediately before Finish.
- **NOT_RUN** — Full suites, mobile and any new editor for open profiles or global gap inspection. The focused tests cover the pending closing arc and join tolerance. Those two cases were not separately exercised in the desktop run.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D748_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-open-chain-finish-browser.mjs "$EVIDENCE/baseline-final" --baseline
D748_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-open-chain-finish-browser.mjs "$EVIDENCE/studio-final"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test outline reopen construction
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test sketch-edit-identity constraints trim sketch-band-studio sketch-bezier-studio sketch-ellipse-studio
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint apps/cad-studio/src/{App.tsx,sketch/useSketchActions.ts} apps/cad-studio/test/sketch-edit-identity.test.ts
node --check apps/cad-studio/test/sketch-open-chain-finish-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D749 checks whether a current regeneration refusal identifies the original failed feature in Studio. [#2323](https://github.com/barocss/barocss/issues/2323). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
