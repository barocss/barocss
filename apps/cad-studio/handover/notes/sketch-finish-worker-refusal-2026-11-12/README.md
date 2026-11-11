# D735 — Verify actual refused sketch Finish responses

P0, rows 09 and 16. SMALL verification. Parent `46b4e7ea317907262b2b3dd5f59e5a23bdc0a069`. [#2364](https://github.com/barocss/barocss/issues/2364).

D574 covered stale errors in a controlled hook. D734 covered actual Worker successes. This decision uses an unmodified native failure in desktop Studio. A Ø4 mm through-hole centered at (34, 10) fits the accepted 40×20×10 mm part. A 30 mm sketch width leaves its closest point at x=32, beyond the candidate's x=30 end. A direct Model preflight returned `SELECTION` at hole `n2` for widths 30 and 20 and evaluated widths 40 and 50. Production code required no change. [D574](../sketch-finish-ownership-2026-11-10/README.md), [D734](../sketch-finish-workspace-replies-2026-11-12/README.md).

## Qualification

- **PASS** — The browser observer held the original Worker error event in three real Studio contexts. Request 4 and revision 4 match the response. After Escape, releasing the error kept the panel closed. After editing width to 50 mm with the refused request still pending, releasing the error kept the new draft open. Both stale cases preserved the original document, selection, history, dirty state and notices. The retained native volume was 7874.336293856412 mm³.
- **PASS** — The current 30 mm request displayed “The hole misses the body” and kept the editable 30 mm draft. Accepted geometry, document, selection, history and dirty state stayed exact. A current retry at 50 mm committed once, with the same hole and volume 9874.336293856411 mm³. First Undo and Redo restored the exact documents. Browser-project Save and fresh Open preserved the 50 mm document and hole. Five independent Python checks use `(width×20−4π)×10` with an absolute tolerance of `1e-9 mm³`.
- **PASS** — Seven D735 desktop states over 327 frozen inputs. D734 and D574 replays passed thirteen and five states. Zero page errors, console errors and browser downloads. Focused Studio 40/40, driver syntax and diff check passed. The native fixture SHA-256 is `323e517c11ea0c195cce75527786668db3580764f7f856f1e03e5036a0a70b9f`. Saved bytes total 1,249 with SHA-256 `7705e2c9efa51ec2f52b5ae1eae36a3fedd06dad48d7433bc278e7323965d744`.
- **FAIL** — None in the selected current cases. The three expected native refusals are inputs to the ownership checks.
- **NOT_RUN** — Linked and association-detached pending Finish, full suites and mobile. #2364 remains open.

Use Node 22.19.0, existing Chrome and Playwright and the serial heavy gate. Keep evidence outside Git. The preflight creates `rectanglePart(width, 20, 10)`, appends the literal hole above and calls `evaluatePart(doc, 1)` for each width.

```sh
D735_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-finish-ownership-browser.mjs "$EVIDENCE/studio" --expect=refusal
D734_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-finish-ownership-browser.mjs "$EVIDENCE/d734-replay" --expect=transitions
D574_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-finish-ownership-browser.mjs "$EVIDENCE/d574-replay" --expect=fixed
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test named-sketch-guards sketch-edit-identity stop-work-ownership
node --check apps/cad-studio/test/sketch-finish-ownership-browser.mjs
git diff --check
```

Next D736 checks pending Finish for linked and association-detached sketch profiles in desktop Studio. [#2364](https://github.com/barocss/barocss/issues/2364). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
