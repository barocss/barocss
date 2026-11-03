# Fixed stateful Brotli/native-CRC archive candidate

Status: SOURCE_READY_AUTHOR_NOT_RUN. This is a separate private archive candidate and data-only screen. Old gzip components, ended full01, ended q1 source/NO_GO/data and all physical sources/complete-runner files remain immutable. No q1 rerun is authorized. Author imports, codecs, tests, numerical calls and compiler calls are zero. No package, lock or runtime dependency changes exist; only built-in node:zlib is used.

## Source-established cause and distinct algorithm

The ended q1 data screen reached RETAINED_CAP80MiB at4120/10034 source entries; full recovery was NOT_RUN. Its fixed24 controls remain their actual PASS; this candidate does not change that NO_GO or any original bytes/parameters.

Pinned official Node22.19 sources establish a different encoder path, not a quality sweep:

- quality.h lines16–17 identifies qualities0/1 as the fragment fast modes. encode.c lines1520–1523 dispatches those modes to BrotliEncoderCompressStreamFast; line1373 requests a new fragment table, and lines133–164 clear that table. compress_fragment_two_pass.h lines5–9/39–50 explicitly describes input-history-independent fragments and limits references to the current fragment.
- Quality2 bypasses that dispatch. encode.c lines1531–1538 copies data into the ring, and lines995–1028 stitches/searches prior blocks. Lines1087–1089 reset its hasher only when UpdateLastProcessedPos reports position wrap (lines798–805), not at each ordinary FLUSH. hash.h lines407–469 retains/prepares and stitches the existing hasher.
- quality.h lines68–92 gives quality2 lgblock14 and ring main bits21 for LGWIN20: the ring main area can be2MiB plus its tail, before other native allocations. LGWIN20 is not a total native-memory bound. Existing explicit JS buffer guards and NOT_QUALIFIED heap/RSS labels remain.

Primary sources, read by Root and the author without local downloads:
https://github.com/nodejs/node/blob/v22.19.0/deps/brotli/c/enc/encode.c
https://github.com/nodejs/node/blob/v22.19.0/deps/brotli/c/enc/quality.h
https://github.com/nodejs/node/blob/v22.19.0/deps/brotli/c/enc/hash.h
https://github.com/nodejs/node/blob/v22.19.0/deps/brotli/c/enc/compress_fragment_two_pass.h

Freeze EXACTLY quality2, the first general ring/hasher path. No quality3 follow-up, tuning sweep, revised cap or other algorithm is authorized. Source supports the history mechanism; it does not establish a size/cost PASS for this dataset.

## Frozen changes

Use ONE continuous Brotli stream with quality2, LGWIN20, large-window mode false and64KiB chunks. No quality/window sweep, adaptive codec selection, delta cache or data omission exists. A1MiB advertised history window is NOT total native memory. JavaScript/native allocator, DATA and RSS qualification remain unclaimed; optional strict64 stays NOT_QUALIFIED. Preserve the existing explicit16MiB serialization/scratch equation,2MiB JSON/RPC/packet limits,512KiB word sidecar,2MiB combined raw,2KiB header,8MiB pending/four tasks, graph/type/depth/occurrence bounds and shared retained cap no higher than280MiB.

Replace only the frame CRC byte loop with built-in node:zlib.crc32. Header/payload CRC is exactly `crc32(payload,crc32(header))`. The independent qualified old JavaScript CRC and fixed literals/chunk vectors must agree before the data screen. Root checked the pinned Node22.19 official zlib documentation; CRC was added in22.2 and Brotli's FLUSH operation is documented. No earlier-source CRC or arithmetic qualification is retroactively changed.

The uncompressed S227 frame format, JSON bytes, ALL binary64 numeric words, raw body/point words, RPC bytes, index and SHA fields stay identical. Each append flushes with BROTLI_OPERATION_FLUSH, then waits for sink kernel-write completion. No per-record fsync or power-loss guarantee is added; successful final close alone fsyncs. The encoder context remains continuous across flushes. File name is events.br, with a separate CONTINUOUS_BROTLI_Q2_STATEFUL_LGWIN20_NOT_OLD_GZIP storage label. New storage bytes never replace old gzip metrics.

Brotli does not have gzip's outer CRC. Retain every frame CRC/SHA, exact compressed SHA where supplied, end frame and native end-of-stream validation. Require decoder-consumed compressed bytes to equal file length, so an ignored garbage suffix or second compressed member cannot pass. Truncation, malformed stream, missing end, trailing bytes and integrity failure remain ARCHIVE_INCOMPLETE with a preserved complete prefix. No unsupported codec or native-memory certificate is inferred from a decoded frame.

## Fixed25 component groups

Copy all24 q1 control source bytes unchanged: archive.test.mjs, exact-size.test.mjs and crc.test.mjs use their same relative imports, now resolving this separate candidate. Retain all23 sized-component control properties. The gzip-specific fixture adapter changes only compression/decompression helpers and events.br paths. Group14 explicitly tests truncated Brotli, invalid stream and trailing garbage/member rather than falsely claiming a Brotli outer CRC. All earlier bounds, exact JSON/word/raw/RPC tests, failure-prefix behavior, combined scratch boundary and captured failedALIGNED2 control remain. The captured JSON control is size/byte evidence; it does not replace live signed-zero proof.

Group24 adds native CRC equality against the immutable old JavaScript implementation: empty0, literal123456789→cbf43926, Unicode/control bytes, independent IEEE word bytes, a131073-byte all-byte cycle, chunk widths1/7/64/65536, and chained header/payload equality. No expected CRC is derived from the candidate native implementation.

Root command with distinct fresh output roots:

`STREAM_TEST_OUT=FRESH_18_OUT SIZED_TEST_OUT=FRESH_5_OUT HISTORY_TEST_OUT=FRESH_HISTORY_OUT PINNED_NODE22 --test archive.test.mjs exact-size.test.mjs crc.test.mjs history.test.mjs`

Group25 is a new fixed cross-FLUSH history bank. Generate exactly131072 bytes by concatenating4096 SHA256 digests of UTF8 domain `stack-brotli-stateful-history-bank-v1` followed by one NUL byte and a four-byte big-endian counter0..4095. Write the identical payload in two RPC request frames, awaiting each acknowledged frame FLUSH/kernel-write boundary. Require exact recovery of both payloads and second append's compressed-byte increment strictly below32768 (payload/4). Save actual increments, payload SHA and recovery count. This is an architectural history control, not a runtime cost forecast. Do not execute the ended q1 on this new bank.

All25 must pass before the single frozen data screen. No mathematical engine, fixture consumer, Python reference, Worker or physical campaign is imported by these sources.

## One preserved-archive size/cost screen

Input is exactly complete full01 ALIGNED's closed archive:

`examples/physics-stack-complete-2276/evidence/full-01/ALIGNED/host/events.gz`

It has206516742 compressed bytes,10034 non-end entries and SHA256 a7d9a3aa99dad8b1be00f0291765e01a38e3db33868ff2973a6359b4110d5e99. This archive is an immutable data input from an ended scene, not a new physical PASS. Do not copy, delete, rewrite or restart that campaign.

Root invokes the pinned Python with `-B screen.py FRESH_OUT REVIEWED_PINS_SHA`. One direct owner makes its own group and180s alarm, authenticates all inputs before import/spawn, then starts ONE registered Node leaf. It uses no Worker, reference or other child. That leaf reads the old gzip stream in bounded chunks, validates its original frames and copies their exact prefix/header/payload bytes into the fixed Brotli encoder. Flush at EACH original frame boundary, not just arbitrary IO chunks. The original end frame is regenerated by the unchanged fixed frame construction; the complete uncompressed frame SHA/byte count MUST remain identical. No JSON reconstruction is used to make replay frame bytes.

The private replay adapter is only fed by the bounded verified frame reader; it is not an external decoder API. One replay append is awaited before the next; source frame plus its owned copy remain bounded. The existing fixed gzip reader is used only for this immutable input; ordinary candidate verification uses Brotli.

After close, stream-decode the new archive completely. Require10034 entries, identical whole uncompressed frame bytes/SHA, record count, JSON digest, ALL numeric-word count/digest, raw-body-plus-point count/digest, separately body-only digest, and every RPC payload/header transcript. Native malformed/end/trailing checks remain active. Recovered records restore signed zero from their original sidecars; opaque RPC JSON bytes are never regenerated. Do not load the whole archive or retain completed entry graphs.

Frozen component screens are compressed archive<=80MiB, Node lifetime through replay/recovery/receipt/exit and pipe EOF<=45s wall, and complete after-wait Node user+system CPU<=30s. These are new archive-only screens, not original physics exit limits, speed ratios, microgate changes or forecasts for all three scenes. No subset extrapolation qualifies full1200 storage or lifetime.

The owner uses the qualified exact wait4 and ONE RUSAGE_CHILDREN delta after Node wait and EOF, with wait4 as cross-check only. Node is a trusted pinned leaf with no process children; its native compression threads are included once. Verify its OS-backed pid/ppid and parent-observed group, final stream closure, normal exit, exact result bytes and source integrity. Node self CPU in its receipt is observational and is not the after-wait authority. Controller SELF span is separately reported before final receipt encoding; no whole-controller lifetime or RSS certificate is claimed.

The inner controller guard remains170s and outer group alarm180s. The45s Node screen is stricter, not another restarted scene clock. It can terminate only the registered Node PID; missing/incomplete closure yields CPUUNKNOWN and owned-group cleanup. A complete known-leaf closure can retain observed after-wait CPU even if a screen fails; SCREEN_NO_GO never becomes PASS. No retry, q3 follow-up or parameter change follows a refusal.

The data screen elects a stricter81MiB total retained allocation inside the original280MiB ceiling:80MiB maximum compressed output,256KiB prepaid bounded normal metadata and768KiB emergency reserve. Node receipt<=16KiB, parent stdout<=16KiB/stderr<=4KiB, stage<=16KiB, final parent summary<=128KiB and bounded stop files fit that metadata allocation. Existing external inputs are read-only and not copied. Every compressed chunk is charged before write; stop receipts use only emergency credit. Original successful data remains recoverable; output exhaustion retains complete prefix plus typed failure and never drops fields to fit.

Only a new component25 PASS and this exact single screen PASS may be considered for later source review and fresh combined physical prefix. They do not authorize any complete-runner import change, new full trajectory, public World/API, deployment or release. All original numerical, wire, scratch, output and physical gates remain unchanged.
