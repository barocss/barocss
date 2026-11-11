# D737 — Preserve sketch Finish ownership across replacements

P0, rows 09 and 16. FEATURE qualification. Parent `407605a705b0310b7bdc585dc1cac2738e5d4fe5`. [#2364](https://github.com/barocss/barocss/issues/2364).

An unchanged asynchronous Finish has one pending evaluation per document and sketch generation. Repeated Finish during that evaluation reuses the pending operation. An edit or document replacement can submit a new candidate. The old response can clear only its own pending marker. Current error clears the marker and retains the editable draft, so the same draft can retry. The existing document, edit generation and commit checks still guard result adoption. The change covers reopened and newly linked sketches and keeps the existing synchronous new-sketch path.

## Qualification

- **FAIL (parent, controlled delivery)** — Real desktop Finish issued two evaluate requests for the same unchanged draft. The browser test held their actual success events and deliberately delivered the second before the first. The second referred to mesh 4 from the first event and Studio displayed “Evaluation lost.” The attempted width stayed 40 mm. This injection changes the order normally guaranteed by one Worker channel. It demonstrated the duplicate dispatch and the transport dependency. The repair removes the duplicate request at Finish.
- **PASS** — Actual Open replaced the document while a success or a native hole error was pending. Both old responses preserved the exact replacement document, history, selection, dirty state and notices. The replacement uses the same local feature IDs and measured 6,144 mm³. In the same-document test, cancelling the first sketch and editing the second retained the 35 mm draft after the first reply arrived. Only the second sketch committed. The first solid remained 8,000 mm³ and the second measured 2,100 mm³. First Undo and Redo restored exact documents.
- **PASS** — Two Finish clicks on the same live draft sent one evaluation. Delivering its original response committed 50 mm once at 10,000 mm³. One Undo restored the exact 40 mm source and Redo restored the accepted edit. Four independent Python checks used the actual volumes and analytic products at `1e-9 mm³`. Eight current desktop states over 327 frozen inputs, zero page errors, console errors and downloads.
- **PASS** — The real hook with controlled transport verifies current and cancelled refusal in linked and detached reopen, suppression of a second evaluation, and retry after a current error. Existing named-sketch, side identity, binding and construction tests remain green. Studio 42/42. D736, D735, D734 and D663 desktop replays passed seven, seven, thirteen and six states. D663 includes normal new-sketch Finish. Studio type-check, affected lint, driver syntax, build and diff check passed.
- **NOT_RUN** — Natural linked and detached error replies in desktop Studio. D735 provides actual ordinary errors and D736 actual association successes. Full suites and mobile were not run.

Native replacement fixture SHA-256 `97b1b0b6e568f861f746ef0674dd7923d7a75a2010014e1d661ec7e318cb0219`. Two-sketch fixture SHA-256 `fc0aba4ce71b8ee7c392d8e1932cddc302202059914f3e16a119b80e1554f756`. The rectangle and drilled inputs are pinned in D734 and D735. [D734](../sketch-finish-workspace-replies-2026-11-12/README.md), [D735](../sketch-finish-worker-refusal-2026-11-12/README.md), [D736](../sketch-finish-association-replies-2026-11-12/README.md).

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D737_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-finish-ownership-browser.mjs "$EVIDENCE/studio-final" --expect=replacements
D736_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-finish-ownership-browser.mjs "$EVIDENCE/d736-replay" --expect=associations
D735_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-finish-ownership-browser.mjs "$EVIDENCE/d735-replay" --expect=refusal
D734_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-finish-ownership-browser.mjs "$EVIDENCE/d734-replay" --expect=transitions
D663_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-mode-exit-browser.mjs "$EVIDENCE/d663-replay" --fixed
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test named-sketch-guards sketch-edit-identity stop-work-ownership
pnpm --dir apps/cad-studio type-check
pnpm exec eslint apps/cad-studio/src/sketch/useSketchActions.ts apps/cad-studio/test/sketch-edit-identity.test.ts
node --check apps/cad-studio/test/sketch-finish-ownership-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D738 reproduces a parameter Rename that can adopt or overwrite an older configuration value. [#2357](https://github.com/barocss/barocss/issues/2357). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
