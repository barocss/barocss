# Fixed-binding evidence reference codec candidate

Status: SOURCE_READY_AUTHOR_NOT_RUN. One distinct private candidate only. No author imports, tests, codecs, data replay, numerical calls or compiler calls occurred. Production OPT07, package, complete runner, original gzip, ended q1/q2 and every first failure remain unchanged. No q3, window tuning, cap raise or generic subtree search is authorized.

## Measured basis and fixed scope

Root's one ALIGNED2 inspection measured412568 duplicated disjoint JSON bytes out of483481:68407 exact raw spans and344161 canonical-projection-only bytes. The fixed16-reference accounting predicts72089 JSON-program bytes with1176 bytes overhead. Selected unique canonical views occupy399015 bytes versus447943 raw wire bytes. Those are captured-case byte counts, not a compressed-size forecast or universal trajectory footprint. This candidate retains only those selected canonical views; ALL original raw RPC bytes are stored first and unchanged.

The sixteen target/source bindings are exactly the frozen inspector bank, in `views.mjs:BINDINGS`. Four reply roots map to contactGeometry/positionCheck/ledgerCheck/quality. Request mappings cover positionAttempt problem/rowSources/result/pre/hyp, ledger phase bodies/points, before.bodies and after. No other field is eligible. Canonical views are NativeJSON encodings of the actual persisted RPC subtrees, not raw-wire byte spans. Python whitespace/number spelling is preserved in the separate raw RPC frames. Before referencing a view its bytes MUST equal the actual original record target span exactly. No rounding, substitution, expected physics or oracle-to-engine input exists.

Use fixed quality2/LGWIN20/64KiB/per-frame FLUSH and native chained CRC from the prior candidate. The q2 path is general ring/hasher, not q1 fragment history. Native history1MiB is not total memory: the ring main area can be2MiB plus tail and other allocations. Heap/DATA/RSS and optional strict64 remain NOT_QUALIFIED.

## Physical versus logical bytes

The whole original logical S227 prefix/header/payload MUST reconstruct byte-exactly. Logical CRC/SHA/index, JSON bytes, ALL numeric binary64 words, body raw and point raw remain unchanged. Reference encoding affects only the logical record JSON portion. Numeric-word sidecar/body/point bytes stay literal, including signed zero. Alias identity stays its original separate logical-header fingerprint; JSON identity is not invented.

New private physical frame R227 has a24-byte prefix: magic, mode(uint32:0 literal/1 reference), logical-header length, logical-payload length, stored-payload length and CRC32. It is followed by the original16-byte S227 prefix, exact original header bytes and stored payload. Outer CRC covers its first20 bytes and all three following parts. Header<=2048, logical payload uses the original limits, stored length<=logical length, mode closed. Before allocating stored/logical payloads, validate these lengths and the bounded logical header/channel/index. Verify physical CRC, reconstruct, then verify the unchanged logical CRC/SHA. End frame, native end-of-stream and consumed compressed length are mandatory. No ignored suffix/member or truncation may pass.

Mode0 stores the entire original logical payload. Synthetic TEST and initial step0 records use normal literal mode. Actual positive-step records validate all sixteen fixed mappings first; use mode1 only when the fully encoded stored payload is strictly smaller. A missing/wrong dictionary is NEVER replaced with literal mode. Ordinary literal representation does not omit data or relax physical gates.

Mode1 stored payload has five uint32 lengths: original JSON J, words W, body B, point R, program N. Then program, original word bytes, original body bytes and original point bytes. Original logical payload is its unchanged four-length header plus reconstructed JSON and the literal sidecars.

Program P227 has16-byte header (magic,17 literal runs,16 references,J). Each literal run has an8-byte length/tag header then exact original JSON bytes. Each intervening reference is64 bytes: tag1, binding id, reserved zero, target offset, length, source logical frame index,32-byte canonical SHA and16 zero pad bytes. Reference IDs cannot repeat. Offset/length, source identity/hash, past index and the fixed target's reconstructed structural position must match. Complete reconstructed JSON length and logical payload CRC/SHA must match. Unknown counts/tags, forward/missing/stale/evicted/other-scene/other-step/source/hash mismatches are typed failures. No generic search or compact physical-only record is reported as complete logical evidence.

## Dictionary, ownership and original bounds

Raw RPC physical frames are flushed and kernel-written BEFORE selected canonical views are installed or an append resolves. Cache keys bind scene,step,binding, actual source frame index and canonical SHA. Dedup uses SHA AND byte equality, never SHA alone. Retain at most2MiB canonical buffer bytes GLOBALLY across at most THREE uncommitted step dictionaries, not2MiB each. At most48 binding entries and three scene release cursors exist. Projection construction is one view at a time. Reject before allocating a new view if it exceeds the byte cap. A step dictionary is released only after its complete record ACK/decode; references after release fail, not stale reuse. End discards explicitly reported dangling dictionaries from an ended partial input.

Keep logical JSON/RPC/packet2MiB, words512KiB, combined raw2MiB, graph depth64/occurrences262144, four pending tasks/eightMiB pending bytes, explicit16MiB scratch and retained output<=280MiB. New physical metadata increases each pending header allowance by24 bytes: two2MiB RPC tasks reserve4198480 bytes. The existing combined-scratch synthetic boundary correspondingly uses raw1570768 bytes; its extra eight-byte word still refuses. These are framing-accounting fixture changes, not a larger bound or changed numerical fixture.

The old record construction guard includes live dictionary bytes. Before projection generation account pending+dictionary+raw parse/string staging+canonical projection staging+fixed1MiB. Before reference construction account pending+dictionary+TWO logical input payload allowances+stored payload+program+4J NativeJSON staging+fixed1MiB. The second logical allowance conservatively covers a borrowed replay input plus owned snapshot. Decoder guards stored+logical+dictionary and NativeJSON staging before full allocations. All guards stay<=16MiB; exhaustion is typed refusal, never cache eviction or missing-field fallback. Parsed graphs/GC/native allocator are not a precise heap certificate. Index/framing scratch is included in the fixed allowance.

Owned byte copies precede caller mutation. Queued work stays bounded. Per-frame FLUSH plus sink kernel-write callbacks define ACK; no per-record fsync/power-loss guarantee is added. Final close alone fsyncs, joins owned streams and clears views. Any resource/protocol/codec failure preserves complete prefix plus typed stop. Stop receipts separately report kernel-written complete physical frames, codec-accepted complete frames and RPC dictionary-admission completions; a raw frame can be fully written before terminal dictionary registration refuses. Terminal dictionary failure stops all later work and clears partial registrations at close; no rollback/PASS is claimed. It cannot produce ARCHIVE_VERIFIED. Existing output charging and emergency reserves remain.

## Fixed34 controls before replay

Retain all25 prior control properties. Exact-size/CRC/history sources remain their same stimuli except the explicit physical-header pending/scratch literals above. Old logical corruption fixtures are transparently packed into literal R227 wrappers; logical integrity cases are unchanged. Native Brotli truncation/end/trailing tests remain. No ended codec is rerun.

26. Captured ALIGNED2 raw eight RPCs first,399015 unique view bytes, then original483481-byte record JSON; exact JSON/word/body/point recovery and release at record ACK. Captured JSON is not independent live negative-zero proof.
27. Synthetic fixed-binding aliases, Unicode and -0: mutate caller wire buffers/aliased record after invocation; require exact raw RPCs, literal word sidecar, body/point bytes and original alias-fingerprint metadata.
28. Missing dictionary typed refusal after an acknowledged literal prefix; no substituted record, prefix retained.
29. Wrong source index/hash, forward reference, malformed count and offset all fail with complete prior RPC prefix.
30. Wrong record scene/step cannot borrow another dictionary.
31. Release/eviction after ACK prevents another reference record; first complete reference record stays recoverable.
32. Global dictionary exactly2MiB accepted; one extra unique byte typed DICT_CAP, bounded stop evidence.
33. Fourth simultaneous step dictionary typed DICT_STEPS before growth.
34. Oversized stored length refuses before allocation.

Root command, all fresh independent directories:

`STREAM_TEST_OUT=FRESH18 SIZED_TEST_OUT=FRESH5 HISTORY_TEST_OUT=FRESH1 REF_TEST_OUT=FRESH9 PINNED_NODE22 --test archive.test.mjs exact-size.test.mjs crc.test.mjs history.test.mjs references.test.mjs`

## One unchanged frozen data screen

Only after all34 PASS, Root may execute `PINNED_PYTHON -B screen.py FRESH_OUT REVIEWED_PINS_SHA`. The ONE input remains full01 ALIGNED's closed206516742-byte gzip archive,10034 non-end entries, SHA a7d9a3aa99dad8b1be00f0291765e01a38e3db33868ff2973a6359b4110d5e99. Reuse only the old qualified logical reader's legacy-gzip input path; no old q2 compression retry occurs.

Replay its exact logical frames, preserving headers and original frame boundaries. Raw RPC ACK constructs views before later record references. After close, stream-recover the ENTIRE original S227 transcript and compare uncompressed bytes/SHA, all entries/record JSON, ALL word counts/digests, body+point and body-only raw digests and complete RPC header/payload transcript. New physical/compressed metrics stay separate.

Unchanged component screens: compressed output<=80MiB, Node lifetime replay/recovery/receipt/exit/EOF<=45s wall, complete after-wait Node user+system CPU<=30s. One direct owned180s group and170s internal owner; one known Node leaf. Exact wait4/ONE RUSAGE_CHILDREN delta and source/OS identity/stream closure stay as qualified; Worker/ref/physics processes are absent. Controller SELF/RSS are separate observations, no total-heap claim. The elected81MiB component allocation remains inside280MiB:80MiB archive,256KiB prepaid normal metadata and768KiB emergency. No copies of old archives are retained.

Any refusal ends this candidate without retries, tuning or cap raise. A captured byte reduction is not a full storage forecast. Only component34 and this one data screen can inform a later Root adoption decision and fresh combined physical prefix. No complete-runner import, public API, full1200 execution, deployment or release is authorized here.
