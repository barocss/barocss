# D320 actual native OPFS consumer evidence

The second selected browser execution passes: 1 test / 5 groups, 0 failures, 0 skips. Node22.19.0 and actual
Chrome156.0.8078.48 use a fresh ephemeral context and secure127.0.0.1 loopback OPFS. Total runner duration is
6444.795041 ms (test5153.519417 ms). Post-run syntax and changed-harness lint pass. Browser errors are empty.

## Source and native I/O boundary

The harness bundles this worktree's actual `src/storage/handleStore.ts` with esbuild, without product replacement
or fake I/O.156 input real paths and hashes are retained; no product source resolves outside the worktree. The
handleStore hash is `73e879642071ec3db0597189946edb952804c523fc4159c0d7b584263b46c2a5`.
Real `navigator.storage.getDirectory()` acquires the private filesystem. Only the named test namespace is created.
Plain adapter wrappers forward native directory/file/write/close/abort methods with native receivers intact.
Every11 admitted native streams used literal zero-argument `createWritable()`. Their constructor is
`FileSystemWritableFileStream`; observed `mode` is `siloed` in this Chrome run, not a portable default claim.

## Queue-aware actual schedule and controls

The first A native writable resolves and is held before returning to production. B is called with the same
original expected tag before A is released. The harness does not wait for B admission: correct exclusion prevents
it. Another path finishes while A is held; read on the pending path still sees original `seed` bytes. Only seed
and A streams have been admitted. After release, A succeeds, B receives `STORAGE_CHANGED`, and direct native
readback contains `writer-A-is-longer`. A's returned tag equals that native file's tag. Seed length4 and A length18
ensure a changed tag without depending on timestamp resolution. The size/time collision limitation is unchanged.

The remaining selected groups prove:

- Fresh-tag follow-up succeeds; a serial stale write refuses and preserves those native bytes.
- Two expect:null requests admit one creator and refuse the other.
- A post-close returned-tag `getFile` is held before its native snapshot. Unconditional B must remain excluded
  through that read, while another path still progresses. Each successful returned tag matches its own directly
  observed native snapshot; ordered final bytes are B's `unconditional-B-is-longer`.
- A genuine native stream is deliberately aborted before production write. Native write rejects with `undefined`
  in this Chrome run. The next same-path native write succeeds with `after-native-error`. This is real native-state
  fault injection, not a substituted error or public caller-cancellation API proof.

Raw checks, admission/write/close events, all native snapshot tags and browser errors remain in `receipt.json`.
The actual dashboard PNG was inspected and is explicitly labelled **not Studio UI**. Evidence is native I/O and
source-backed assertions; the PNG is a readable report of those results, not a user-facing save-flow claim.

## First failure and cleanup

The first full browser test fails in its test-only outcome formatter after four groups were recorded. The native
aborted write rejects with undefined, but the formatter attempted `error.code`. Exact `TypeError` output and the
full first receipt remain. Only the formatter was changed to preserve non-object/undefined rejection information;
native I/O, rejection value, production code and assertions are unchanged. The first full test is FAIL, not an
aggregate PASS. The second run completes all five groups.

Both runs release their owned barriers and settle their owned operations, remove only
`d320-native-write-ownership`, and verify that directory is absent. Context/browser/server cleanup receipts record
CLOSED; the serial heavy gate is returned. No caller/user file or external folder was touched. Original audit
native baseline result/receipt/cleanup/source verification are copied unchanged for provenance. The original
`.omx/research` files remain read-only. The old schedule waited for two admissions; this queue-aware regression
intentionally does not repeat that incompatible schedule.

This proves one adapter instance's validated exact-path write ownership only. Separate instances, tabs,
external-program conflicts, cross-process CAS, actual Studio UI concurrent saves, public cancellation, same-size/
same-time collision repair and user-file loss are NOT_RUN. No full suite, dependency installation, commit, push or
release was made by this consumer lane. `validation.json` and `artifact-manifest.json` preserve scope and hashes.
