# D320 / #2241 retained source and receipt review

Verdict: **FIXED_AUTHOR_RECEIPTS_VERIFIED**, limited to one `handleStore` instance and one exact validated path. Independent audit runtime: **NOT_RUN**. This is source inspection and retained author receipt verification. It does not establish Studio UI, separate-store, separate-tab, remove/write, external-folder, or external-program race protection.

The reviewed Git object is `e1f2b05d62b8011412a1d8ee9c1cc73256737177`. Its parent is exactly `9916bda9f4d8b74e2d34f14cfabb6822e412b93e`. All product reads used explicit `git -C /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b` and that object. The audit root was not treated as a product checkout. Product status showed only the pre-existing untracked `.claude/` directory. This review did not change it.

## Source result

`apps/cad-studio/src/storage/handleStore.ts:53-54,68-94` creates a map inside each adapter instance. A write validates its path, captures `expect`, registers a non-rejecting completion token, and waits for the previous token before its version check. The critical section contains the expected-tag check, folder/file creation, native stream acquisition, write, close, and returned-tag `getFile` read. A stale request throws before folder/file creation or writable acquisition. It cannot change the accepted file through this path. Absent `expect` means unconditional write; it still enters this same queue. `expect:null` means the file must be absent. `checkPath` rejects invalid paths and does not normalize aliases. The queue key is the exact accepted string. Different paths have different tokens.

The `finally` block deletes the map entry only when that entry is its own token, then resolves the token. An earlier owner cannot delete a newer queued tail. Completion tokens never reject, so an operation rejection cannot poison the next request. Existing native write/close error handling attempts abort and preserves the original error even if abort rejects. The queue also releases after a final tag-read failure. Such a failure can occur after bytes commit; it is not rollback. No timeout forces an unfinished owner out of its critical section.

`storage/access.ts:32-37` constructs browser projects through `handleStore(dir, 'browser')`. `storage/useProject.ts` keeps the selected store in `view.store`/`live.current.store`; save captures that store and delegates to `writePart` with the expected tag. This source route makes the adapter repair relevant to an open project session. The native harness imports the actual adapter directly. It does not execute `browserProject`, React state, or Studio Save. A new adapter gets a new queue. `remove()` does not enter the queue. The existing size/time tag can still collide. Broad changed-elsewhere comments in `store.ts` and `useProject.ts` must not be read as newly proven inter-tab atomicity; the new public projects text explicitly limits the qualified overlap scope.

## Hash and source binding

All of these checks matched bytes from the exact reviewed commit; no mismatch was found:

- `qualification-artifacts.json`: 38 byte-length/SHA-256 bindings.
- `consumers/artifact-manifest.json`: 28 bindings. These 28 targets overlap the preceding manifest; they are not 28 additional independent artifacts. The two manifests cover 38 distinct target paths.
- `qualification.json.sourceHashes`: 3 source bindings, for the production adapter, unit fixture, and final browser harness. Both `source.sha256` entries also match those same source bytes.
- First-run and final-run `source-inputs.json`: 156 bindings each, 312 checked records. These runs use the same 156 distinct input paths and hashes; the counts must not be added as unique inputs. All resolve inside the product worktree. Each metafile has the same 156 normalized input paths and byte lengths as its corresponding source-input receipt. All input hashes match the reviewed commit, including the production adapter hash `73e879642071ec3db0597189946edb952804c523fc4159c0d7b584263b46c2a5`.
- All 5 copied historical baseline files (`result`, `receipt`, `cleanup`, `execution-summary`, `source-verification`) are byte-identical to the audit's original `runs/model-005-prepared/` files.

The metafile/source-input list binds bundled production dependencies. The final test runner itself is separately bound by its qualification source hash. The first failing runner's complete prior source is not retained as a separate object; the claim that only its outcome formatter changed is supported by the first error, retained notes, final formatter source and identical bundled product inputs, rather than an independently reproducible first-run harness diff. This does not weaken the final native operation results.

## Retained execution evidence

| Evidence | Retained result | Boundary |
|---|---|---|
| Original Model005 native OPFS overlap | Both same-tag writers fulfill; B replaces A; serial stale control PASS | Original controlled two-native-admission schedule, pre-fix adapter; not a natural UI race |
| Unchanged-production unit baseline | 9 tests, 3 PASS, 6 FAIL, 0 SKIP | Controlled interface stand-in; raw baseline failures retained |
| Final unit concurrency fixture | 10 tests, 10 PASS, 0 FAIL, 0 SKIP | Mock/interface IO; includes new three-writer tail, conditional/unconditional directions, write/close and post-commit read failure |
| Studio types and changed-file lint | Author reports exit 0; retained logs empty | Retained `unit-report.md` exit assertions; empty logs alone do not independently encode process exits |
| First native browser attempt | 1 selected test FAIL, 0 SKIP; 4 groups recorded | Formatter reads `error.code` from an undefined native rejection; exact TypeError retained |
| Final native browser attempt | 1 selected test PASS, 5 groups, 0 FAIL, 0 SKIP; browser/syntax/lint exits 0 in TSV | Actual fresh-context native OPFS adapter harness; not Studio UI |

No successful acknowledgement check was rerun. The historical baseline's uncaptured-resource-URL console 404 remains disclosed in original execution notes; `pageErrors=[]`. It is not part of the final run's empty browser error list.

The final native receipt records Chrome `156.0.8078.48`, secure loopback origin, 11 native `FileSystemWritableFileStream` admissions, literal zero-argument `createWritable()` calls, and observed `siloed` mode. That observed property is not a portable default guarantee. The wrappers call real directory/file/stream methods with native receivers and add scheduling gates only.

The queue-aware overlap holds only A after native acquisition, starts B with the same original tag, and permits another path to complete. It never waits for a second same-file admission. Read during the hold returns `seed`. A then returns tag `18-1793250663270`, matching direct native readback `writer-A-is-longer`; B refuses `STORAGE_CHANGED`. The seed is size 4 and A size 18, so this result is not ambiguous due to a same-size tag. A fresh returned tag permits progress. A serial stale request preserves the fresh bytes. Two `expect:null` creators yield one success and one refusal.

The unconditional group holds A after close and before its returned-tag native snapshot. B remains excluded while another path progresses. Returned A/B tags match their respective direct native snapshots, and final bytes belong to B. The native-error group actually aborts a real stream before production write. The resulting native rejection is `undefined`, retained without substitution; the subsequent same-path write succeeds. That proves queue release after this native failure, not a public caller-cancellation API. Unit failure controls separately cover rejected write/close, abort failure, and post-commit read failure.

Both browser cleanup receipts report the owned context/browser/server closed. Raw results report only the named test namespace removed and absence verified. Gate logs report release. These are retained author cleanup receipts; no new process or browser inspection was run. The dashboard PNG is hash-bound but was not visually re-inspected in this intake; it is a test dashboard, not UI acceptance evidence.

## Disposition

Accept the repair for the demonstrated same-adapter, exact-path overlap: expected-tag validation remains exclusive through commit and returned-tag read; stale refusal preserves the first accepted bytes; fresh-tag and post-failure progress are supported. Keep the original controlled native failure and the first repaired-harness failure in the evidence chain.

Separate instances/tabs, remove/write ordering, external folders/programs, actual Studio UI scheduling, same-size/same-time tag collision repair, public cancellation, performance, general user-file-loss prevention, remote acceptance and release remain **NOT_RUN** here. No builds, tests, browser runs, installations, Git mutations, product edits, issue edits or external messages were performed by this review. Only this audit review file was written.
