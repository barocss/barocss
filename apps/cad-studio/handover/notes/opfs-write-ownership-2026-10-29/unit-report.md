# Same-adapter write ownership — D320 / #2241 (2026-10-29)

Baseline HEAD: `9916bda9f4d8b74e2d34f14cfabb6822e412b93e`. Node22.19.0. Heavy checks used the existing gate
serially; all slots were released. Final owned source/test hashes are in `source.sha256`.

## Scope

`handleStore` owns a write queue per adapter instance and exact validated project-relative path. Each request enters
that queue before checking its captured expected tag, and retains ownership through folder/file lookup, native stream
write/close and the final getFile used for its returned tag. Unconditional writes use the same queue. Different paths
remain independent. Completion tokens do not reject; finally releases every completed/failed owner and removes only
its own latest map tail. A queued successor cannot be bypassed when an earlier owner finishes.

The existing stream abort behavior, refusal codes and opaque size-lastModified tag format are unchanged. There is no
new feature API, telemetry, schema, dependency, writing-mode option, timeout release or global root-name key.

This is the demonstrated same-store/path scope and the active `useProject.view.store` lifetime. A second handleStore
instance, another tab, remove/write races, external programs and general filesystem CAS are outside this queue's
guarantee. Existing tag collisions remain possible when size and modification time are indistinguishable.

## Regression evidence

The test backend implements the production DirHandle/FileHandle interface with controlled stream/read boundaries.
It is a unit stand-in, not native OPFS evidence. Every held operation is released in finally. The queue-aware tests
hold only the first admission and never wait for both streams to admit.

| Run | Result | Log |
|---|---|---|
| Unchanged production baseline | 9 total / 3 pass / 6 fail / 0 skip; exit1 | `unit-baseline.log` |
| Final scoped concurrency tests | 10/10 pass, 0 fail/skip; exit0 | `unit-after.log` |
| Studio types, including the new test | exit0 | `types.log` |
| Changed production/test files lint | exit0 | `lint.log` |

Baseline failures include a second stream admitting before the first owner completes (2 admissions rather than 1),
both expected-absent creates fulfilling, and a stale successor fulfilling after a post-commit tag-read failure. Raw
assertions and stacks are preserved unchanged. The final suite adds one three-writer/latest-tail regression beyond
the original nine; the baseline was not rerun to erase or replace its original failure set. No production repair was
needed after the first queue change; focused/types/lint passed on their first after run.

Final checks cover:

- Same original expected tag: only the first writer fulfills; the second refuses with STORAGE_CHANGED and first bytes stay.
- Two expected-absent creates, serial stale refusal, a fresh returned tag and another successful subsequent write.
- Conditional/unconditional ordering in both directions, on the folder-labelled adapter as well as browser-labelled tests.
- Different-path progress while one native-interface stream is held.
- Returned tag ownership when a later unconditional write is already waiting at the tag-read boundary.
- A third writer cannot bypass the second queue owner when the first completion cleans up.
- Write/close errors abort the owned stream and release later requests. Abort failure does not replace the original write error.
- Post-commit tag-read error: the first promise rejects after bytes have committed, the stale request still refuses,
  no rollback is claimed, and a fresh read/tag allows recovery.

## Commands and limits

From `apps/cad-studio`, after prepending Node22.19.0 to PATH and acquiring the existing heavy gate:

```sh
node scripts/test.mjs handle-store-concurrency
node ../../node_modules/typescript/bin/tsc --noEmit -p .
node ../../node_modules/eslint/bin/eslint.js src/storage/handleStore.ts test/handle-store-concurrency.test.ts
```

Empty types/lint logs are preserved; the shell captured the exit codes above. `git diff --check` passes for the owned
files. Native OPFS and Studio/browser execution belong to the separate consumer run and are NOT_RUN by this worker.
Whole Studio/Model suites, separate-instance/tab coordination, remove-race qualification, external-folder/program
conflicts, performance and release were NOT_RUN. Commit and push remain with the root.
