# D322 focused unit receipt

Base commit: `a386c8705beda2c72d215da61a55fd6119351ca2`.
Runtime: Node `v22.19.0`. Heavy gate used serially and released after each bundle.

## Implementation boundary

- App invalidates a separate Save token on every document state dispatch, including direct history, Stop and system setters. A no-op dispatch conservatively invalidates earlier receipts. Evaluation start/end does not invalidate it. Functional updates are passed unchanged to React; synchronous direct-document updates preserve `docNow` behavior.
- Each rendered Save closure captures its render's token and saved document. Clean/recovery completion additionally requires current document identity and filename equality. Document identity alone would miss ABA; call-time token capture would let an old render borrow a new token.
- Project Save uses a session/path owner and monotonically ordered successful receipt. A successful current-file write advances its tag even after a document edit. Older success cannot move the tag backwards. Store use, close, detach (including an initially null part/log), and openPart invalidate earlier receipt ownership.
- Save checks ownership before applying write metadata and again after versions read and parts refresh. Current completion is checked immediately before its synchronous callback. Stale errors do not replace current errors or metadata.
- Save no longer physically removes autosave. Existing byte equality in `readAutosave` hides a checkpoint equal to the saved file; a newer checkpoint remains readable. Explicit discard remains unchanged. No schema, dependency, global queue, Model API, or generalized Open change.

## Commands and exits

Working directory: `apps/cad-studio` in the assigned worktree.

1. `node scripts/test.mjs late-save-ownership`: exit 1. All 9 assertions passed, but the first harness imported React `server.browser`, whose MessageChannel prevented Node exit. Only its own test PID 89877 was terminated with SIGTERM. The runner consequently reported one file-level failure (9 pass / 1 fail including that failed file). This is a harness lifetime failure, not a product assertion failure. Raw output: `first-focused-harness-lifetime.log`.
2. `node ../../node_modules/typescript/bin/tsc --noEmit`: exit 0. Raw output: `types.log` (empty).
3. `node ../../node_modules/eslint/bin/eslint.js src/App.tsx src/storage/useProject.ts src/state/saveOwnership.ts test/late-save-ownership.test.ts`: exit 0. Raw output: `changed-lint.log` (empty).
4. Test-only import correction: React `server.edge` exports the same `renderToString` without the browser renderer's persistent MessageChannel. No production source changed.
5. `node scripts/test.mjs late-save-ownership`: exit 0, **9 pass / 0 fail / 0 skipped**, normal process exit, 91.8 ms. Raw output: `focused-final.log`. Production types and changed lint from steps 2–3 were reused; the correction changes only the typed renderer import path.

Unique tests: **9**. The second run repeats the same 9 cases; do not count 18 unique passes. No product assertion failure occurred in either run.

## Proof scope

Two pure decision tests cover document ABA, mismatched document with matching token, old render token, filename changes, unchanged completion, and ordered receipt tag assignment.

Seven tests initialize the real `useProject` hook using React server rendering, then call its public actions through the real directory-handle adapter backed by an in-memory directory stand-in. Its synchronous live ref makes action state observable without a React view rerender. Cases cover newer recovery retention, next-Save tag progression, saved-equal checkpoint hiding without remove, close/detach/store switch/openPart, stale versions errors, and stale parts-refresh completion. Await pauses occur in actual adapter read/list paths. Follow-up real saves and reads verify path/tag behavior.

This does **not** prove App setter wiring, React UI rendering, native OPFS scheduling, or the three real browser acceptance flows. Those remain separate consumer evidence. Native baseline reproduction and its initial browser setup failure are preserved by the parent/consumer; this unit receipt does not replace them. No whole Studio, Model, or Kernel suite was run here.

Production and final test hashes are in `source-sha256.txt`. No commits or pushes were made by this worker. Other workers' files were preserved.
