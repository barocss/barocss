# D337 Model source handoff

Worktree: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, branch `local/cad-dev`.

Owned changes:
- `packages/barocss-cad-model/src/engine/direct.ts`
- `packages/barocss-cad-model/test/direct-trim-guards.test.ts`
- `packages/barocss-cad-model/test/direct-trim-reverse.test.ts` (new)
- `packages/barocss-cad-model/README.md`

Trimmed Reverse routes nonempty loops through `reverseTrimmedSurfaceAxis`; native helper errors of type `TrimmedSurfaceAxisReversalError` map to existing `DIRECT_VALUE`. Other native errors propagate. New trimmed routing rejects duplicate selected object IDs with `DIRECT_PICK`. Existing untrimmed routing and other guards remain. `add` accepts optional trims; the accepted loop sidecar is copied with explicit loops before publication. Hidden originals retain their complete metadata and original source text.

New tests cover both axes and flags, nonunit fractional concave loops, public160 producer, world vertices/material probes/area, double reversal under original tolerance, source ownership and frozen inputs, native encode/read/reencode identity, retained Split/IGES guard behavior, unsupported support/loop failures and valid retry, duplicate selected ID failure. Existing D336 tests now retain five unsupported consumer guards and separate malformed Reverse refusal. Empty-trim/untrimmed reversal still receives coverage.

Checks:
- `git diff --check`: PASS.
- Focused tests: NOT_RUN (root runtime grant pending).
- Type check/build/browser: NOT_RUN.
- Undo/Redo and selection: NOT_RUN; actual application flow remains root scope.
- Commit/push: NOT_RUN.

Proposed checks, serially after Kernel readiness and root grant:
1. `/Users/user/Library/pnpm/nodejs/22.19.0/bin/node packages/barocss-cad-model/scripts/test.mjs direct-trim-reverse direct-trim-guards direct.test`
2. `/Users/user/Library/pnpm/nodejs/22.19.0/bin/node node_modules/typescript/bin/tsc --noEmit -p packages/barocss-cad-model`

Snapshot: `/tmp/d337-model/model.patch`; new test snapshot: `/tmp/d337-model/direct-trim-reverse.test.ts`.
