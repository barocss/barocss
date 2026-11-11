# D736 — Verify linked and detached sketch Finish replies

P0, rows 09 and 16. SMALL verification. Parent `1711b5c72d92562f3f684c5a88f6aa890d386f53`. [#2364](https://github.com/barocss/barocss/issues/2364).

This extends D734 and D735 to the actual Studio association paths. A real pointer selects the top face of a 40×20×10 mm part. Studio creates a linked 2 mm face outline and inset. After reopening the linked sketch, editing the first edge from 20 to 20.5 mm takes the existing association-detached path. The browser holds and delivers original successful Worker events. Production code required no change. [D734](../sketch-finish-workspace-replies-2026-11-12/README.md), [D735](../sketch-finish-worker-refusal-2026-11-12/README.md).

## Qualification

- **PASS** — Cancelling a newly linked draft before its successful response retains the exact two-feature source. The current linked Finish commits one sketch with source `n1.top`, 2 mm inset and the expected plane at z=10 mm. Undo and Redo restore exact documents. Browser-project Save and fresh Open retain the association. Reopening the unchanged linked sketch and clicking Finish leaves the document exact without issuing an evaluation.
- **PASS** — A geometry edit detaches the reopened association. Cancelling before its successful response retains the original linked sketch and leaves the panel closed. Current detached Finish retains sketch ID `n2`, face body reference, plane and edited 20.5 mm edge. It records the edited snapshot without an association. First Undo restores the linked source and first Redo restores the detached result. Save and fresh Open preserve the exact detached document.
- **PASS** — Five Python checks verify source identity, planar geometry and the base solid's 8,000 mm³ volume within `1e-9 mm³`. Independent shoelace checks on the actual saved sketch states yield outer areas of 800 and 820 mm² and the same 576 mm² hole, giving 224 and 244 mm² ring areas. Seven D736 states over 328 frozen inputs. D735 and D734 replays passed seven and thirteen states. Model 16/16, Studio 40/40, driver syntax and diff check passed. No page errors, console errors or browser downloads in the final runs.
- **FAIL** — None in the current selected behavior. The first browser attempt used a history attribute available on solid features only. The final driver uses the standalone sketch's accessible history button.
- **NOT_RUN** — Replacing the document or switching to another sketch while a Finish reply is pending. Full suites and mobile were not run. #2364 remains open.

The input SHA-256 is `c981eaa7122d25ac7355457d28724b46d8daea62c62ac14cd4d03e36fd376cce`. The 2,102-byte linked save has SHA-256 `9caed5158b2324455a2223860b246be20da1920e573f5c573024efca054786d0`. The 2,188-byte detached save has SHA-256 `141defcb7cb537b412ad6ce5174d79e2adc009c1a6f8e369620c02e8b54eee69`.

Use Node 22.19.0, existing Chrome and Playwright and the serial heavy gate. Keep evidence outside Git.

```sh
D736_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-finish-ownership-browser.mjs "$EVIDENCE/studio-final" --expect=associations
D735_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-finish-ownership-browser.mjs "$EVIDENCE/d735-replay" --expect=refusal
D734_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-finish-ownership-browser.mjs "$EVIDENCE/d734-replay" --expect=transitions
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test sketch-associative-inset drawing-associative-sketch
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test named-sketch-guards sketch-edit-identity stop-work-ownership
node --check apps/cad-studio/test/sketch-finish-ownership-browser.mjs
git diff --check
```

Next D737 checks whether a pending sketch Finish can affect a replacement document or a different sketch edit. [#2364](https://github.com/barocss/barocss/issues/2364). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
