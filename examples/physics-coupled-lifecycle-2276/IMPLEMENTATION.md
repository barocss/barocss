# Frozen lifecycle implementation and root sequence

Status: AUTHOR_ONLY_NOT_EXECUTED. Root first reviews this source set, then uses fresh IDs and the existing whole-command guard. Do not repeat the old failed transaction or pure kernel/reference generation. The proposed lifecycle provider is distinct; the previous failure remains historical NO_GO.

The typed capture helper has four fixed slots and reserves4KiB of bounded failure metadata. Before clone-returning getters, a shallow view of actual live accepted storage is walked with8192-cell/depth64/string4096 limits and conservative data-byte accounting. Capture/intermediate copies reserve four times the bounded view size. Read APIs return at most16 bounded copies and charge those copies to the same original diagnostic byte cap as phase records. This is a serialized-data/cell bound, not a process RSS certificate. The fixed two-box/one-interval profiles fit the admitted view; other observation inputs yield UNRESOLVED without changing cleanup.

The wrapper invokes actual world.getState(), world.getModel(), phasePrivateSnapshot and an actual owner read only while live and nonrunning. Observation exceptions, limits and unsupported views are caught. No observer error replaces a serializer exception; original guarded disposal still runs. Already-disposed calls return before capturing. Existing reentrant disposal goes directly to the original guard. Captures are internal immutable clones, separate from producer authority; the new reader returns independent clones.

Allowed ancestor changes are entry.ts, physics/src/world.ts (imports and dispose wrapper only), private-phase.ts (shared observation-byte reserve only), and provider-manifest.generated.ts. lifecycle-capture.ts is the only new runtime file. The builder authenticates every other ancestor file, including physics, geometry, persistent target implementation, producer and replay/codec. It also requires identical emitted C/candidate.js bytes, carrying forward only the existing pure-kernel proof. There is no cast, added nocheck, compiler switch, dependency install or tool fallback.

The three-case static driver copies the original actual runner and adds capture verification after disposal. Its numerical observers are byte-identical copies. Recorder disposal happens first in this static campaign; absence of an attached owner is explicitly NOT_APPLICABLE. Captured public/private data must equal the actual accepted snapshot saved before disposal. Afterward the original storage must actually be cleared; accepted diagnostic metadata remains intact. Dispose is called again to verify idempotence and the real public getter must return DISPOSED. Caller mutation of returned capture copies must leave stored data unchanged.

The transaction driver copies the original failed protocol into this new folder. Fresh new-provider static controls replace old-provider controls before any transaction call. Hidden B/C compare their genuine pre-dispose public state and complete private.world to live A, plus accepted actualCache/cursor/stepIndex and actual owner recording. Their current disposed storage must remain cleared. D stays live for its original physical/cone/target audits and one-frame raw restore comparisons. At final A/D disposal, the World is disposed before recorder detach so actual owner recording is present and captured. Full same-World private snapshot equality is required. Across-World cacheFrames/query provenance remains NOT_PROVEN with no ID normalization. The first-cold-interval dynamic and second-interval restrictions remain unchanged.

Success-path capture view reads are5 in each static campaign and6 in each transaction campaign, within the16-read cap. Stats/idempotence calls do not return snapshot data. Capture produces no extra Worlds, steps, queries, applications or phase records. Static census is3/3/2 accepted and128 applications; transaction census is4 Worlds/6 phase attempts/4 accepted and257 applications, including the real failed nonzero application. All original numerical/evidence/time caps remain.

Actual root command sequence, stop on first unexpected failure:

```sh
node examples/physics-coupled-lifecycle-2276/build.mjs build-01
node examples/physics-coupled-lifecycle-2276/static-run.mjs build-01 static-source-01 source
node examples/physics-coupled-lifecycle-2276/static-run.mjs build-01 static-native-01 native
python3 -B examples/physics-coupled-lifecycle-2276/static-parity.py static-source-01 static-native-01 static-parity-01
node examples/physics-coupled-lifecycle-2276/transaction-freeze.mjs build-01 transaction-freeze-01
node examples/physics-coupled-lifecycle-2276/transaction-run.mjs transaction-freeze-01 transaction-source-01 source
node examples/physics-coupled-lifecycle-2276/transaction-run.mjs transaction-freeze-01 transaction-native-01 native
python3 -B examples/physics-coupled-lifecycle-2276/transaction-parity.py transaction-source-01 transaction-native-01 transaction-parity-01
```

No browser, production integration, performance, dynamic solution, warm or second successful interval is qualified. Source/Native packet parity uses the exact same new identity, with no provider normalization. Author checks are syntax, immutable source anchors, copied-observer equality and file hashes only.
