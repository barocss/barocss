# D734 — Verify pending sketch Finish across workspace transitions

P0, rows 09 and 16. SMALL verification. Parent `33fae7c1338415804be018235ca515b7551a6d93`. [#2364](https://github.com/barocss/barocss/issues/2364).

D574 guards the document and edit generation for an ordinary reopened sketch. D663 confirms explicit discard before leaving a live sketch. The current source still contains both guards. This decision adds desktop coverage for their interaction and for two actual replies delivered in either order. Production code required no change. [D574](../sketch-finish-ownership-2026-11-10/README.md), [D663](../studio-live-sketch-mode-exit-2026-11-11/README.md).

## Qualification

- **PASS** — Actual desktop Studio reopens a 40×20 mm sketch under a 10 mm extrude. A browser observer holds each actual Worker evaluate result and releases its original event. Discarding the live 50 mm draft to Model, Drawing or Render leaves the destination active. After releasing the held success, the accepted 40 mm document, 8,000 mm³ solid, history, dirty state, selection and notices remain exact in all three workspaces.
- **PASS** — Keep editing on the Drawing exit prompt retains the live 50 mm draft. Its current result commits once, producing 10,000 mm³. First Undo restores the exact 40 mm source. With separate 50 mm and 60 mm Finish requests, both old-first and new-first delivery commit the 60 mm draft exactly once at 12,000 mm³. First Undo and Redo restore the exact old and new documents. Browser-project Save and fresh Open preserve the 60 mm document and its body. The two original reply IDs are 4 and 5 with matching revisions 4 and 5. Seven independent Python checks use the native body volume and the literal width×20×10 expression with absolute tolerance `1e-9 mm³`.
- **PASS** — Thirteen D734 desktop states over 327 frozen inputs. D574 and D663 desktop replays passed five and six states. The three runs recorded zero page errors, console errors or downloads. Focused Studio 41/41, driver syntax and diff check passed. Native input SHA-256 `c981eaa7122d25ac7355457d28724b46d8daea62c62ac14cd4d03e36fd376cce`. Fresh-open input is 1,058 bytes with SHA-256 `04a3dd860aeaed3992c510d10ded6e4cd6076e46cc0c4e50df79f341a030dbdb`.
- **FAIL** — None in the selected current cases. D574 retains the earlier cancel and superseding-edit failure evidence.
- **NOT_RUN** — Actual desktop error-reply paths and association-linked or association-detached pending Finish. The controlled historical hook checks do not supply those desktop results. #2364 remains open. Full suites and mobile were not run.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D734_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-finish-ownership-browser.mjs "$EVIDENCE/studio" --expect=transitions
D574_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-finish-ownership-browser.mjs "$EVIDENCE/d574-replay" --expect=fixed
D663_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-mode-exit-browser.mjs "$EVIDENCE/d663-replay" --fixed
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test finish named-sketch-guards sketch-edit-identity stop-work-ownership
node --check apps/cad-studio/test/sketch-finish-ownership-browser.mjs
git diff --check
```

Next D735 tests a refused Finish in actual Studio, including cancelled and current requests. [#2364](https://github.com/barocss/barocss/issues/2364). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
