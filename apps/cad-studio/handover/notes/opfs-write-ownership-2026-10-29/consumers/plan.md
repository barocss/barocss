# D320 actual native OPFS consumer plan

Plan recorded before execution. Final scoped PASS and the first formatter failure are recorded in README.md and
validation.json. The producer and parent approved source freeze and the heavy slot before execution. Ownership is the new `test/handle-store-opfs-browser.test.mjs` and this consumer folder.

Bundle the specified worktree's actual `src/storage/handleStore.ts` with esbuild. Record the bundle metafile and every
real source path/SHA-256; reject product inputs outside this worktree. Serve on secure loopback127.0.0.1 and create
an ephemeral new Chrome context. Require actual native `navigator.storage.getDirectory()`; no silent skip. Acquire
only the named `d320-native-write-ownership` OPFS namespace. Wrappers call native handle and stream methods with
their native receiver. `createWritable()` receives zero arguments. They alter scheduling, not I/O outcomes.

The primary schedule holds only A's first resolved native stream before returning it to production. Start B with
the same original expected tag without waiting for B admission. A write on another path must finish while A is
held; read sees the original uncommitted bytes. Release A, require A success/B STORAGE_CHANGED and directly read
native final A bytes/tag. A's length differs from the seed, so size alone guarantees a changed tag; the existing
size/time same-length collision limitation remains. The primary stream-count check includes one seed stream and
one A stream; B must not open a native stream while A owns the path.

Five grouped low-cost checks are selected:

1. Same-path stale overlap plus different-path independence and read-while-uncommitted behavior.
2. Fresh-tag follow-up and serial stale refusal preserving native bytes.
3. Two expect:null creators: only the first succeeds.
4. Unconditional B is excluded while A's post-close returned-tag native getFile is held. Direct native snapshots
   show each returned tag belongs to its own successful write; final bytes are B's ordered write.
5. A genuinely native stream is deliberately aborted before production write, making native write reject. A later
   same-path write succeeds. This is real native-state fault injection, not fake I/O or a substituted error.

Finally release every owned barrier, settle owned operations and remove only the named test namespace. Verify its
absence. Close the owned context/browser/server. Retain a raw receipt/events/native snapshots, browser errors,
cleanup, actual test dashboard PNG (explicitly not Studio UI), source identity and first failure logs. No user file,
external folder, separate adapter instance, second tab or external process is touched. No cross-process CAS, actual
Studio UI overlap, physical user-file loss, exact content hash tag, performance or full-suite result is claimed.

Execution uses Node22.19.0 and the serial heavy gate, with existing CHROME/PW_DIR and no dependency installation:

```sh
CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
OPFS_D320_ARTIFACT_DIR=/tmp/d320-opfs-first \
node --test test/handle-store-opfs-browser.test.mjs
```

The original `.omx/research` artifacts and the earlier OPFS intake remain read-only. No commit or push is made by
this consumer lane.
