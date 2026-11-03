# Bounded lossless stream archive prerequisite

Status: SOURCE_READY_AUTHOR_NOT_RUN. This is a test-only archive component. It does not run physics, replace an original archive, admit a full1200 campaign or expose an application recording/decoder API. Old evidence is immutable. Author imports, math, compiler and test calls are zero. Root reviews these sources and runs the fixed18 groups once:

`STREAM_TEST_OUT=FRESH_ABSOLUTE_DIRECTORY PINNED_NODE22 --test archive.test.mjs`

The test output root must not already exist. Each group uses its own new archive directory. Tests retain their output, including stop receipts; no cleanup deletes evidence.

## Fixed format and bounds

One built-in gzip stream contains sequential frames. A frame has a 16-byte prefix: ASCII S227, big-endian uint32 header length, payload length and CRC32. Its UTF8 JSON header is at most 2048 bytes and has only the fixed channel fields. Header plus payload CRC uses the standard reflected polynomial edb88320. The header includes the sequential index, payload byte length and payload SHA256. A final empty end frame and a valid gzip trailer are both required for ARCHIVE_VERIFIED.

Channels are rpc, packet, record and end. RPC preserves the exact request or reply bytes, including spacing, escapes and newline. Packet preserves the exact bytes and its separately supplied alias fingerprint. These payloads are at most 2MiB each. Scenes are ALIGNED, OFFSET, YAW and synthetic TEST; steps are integers0..1200. RPC ops are contacts, world, step-ledger, quality and synthetic control. No step-count execution option exists. The archive has at most40000 data frames; this is only a storage bound.

A record is ONE atomic frame containing four uint32 lengths, then record JSON, original binary64 words in big-endian order, raw body F64LE and raw point F64LE. JSON uses the existing `JSON.stringify(record)+'\n'` policy. JSON and word sidecar each have a 2MiB bound; the combined two raw fields have a 2MiB bound and each has an eight-byte multiple length. Maximum frame payload is6MiB+16 bytes. No half record group is delivered to a verifier callback.

Before JSON encoding the writer admits only finite, dense plain data, no cycles, sparse arrays, accessors, hidden/symbol properties, unsupported values or prototypes. Depth is at most64 and visited value occurrences at most262144. It computes a conservative UTF16-escaping JSON capacity and number count before full encoding. Number capacity is32 bytes each, strings/keys at most6 bytes per UTF16 code unit plus punctuation. Each shared child is visited in each JSON occurrence; aliases are not silently restored as identity. Alias identity remains the separate supplied fingerprint metadata, not a JSON guarantee.

The reader uses Object.keys and dense array order to replace EVERY parsed numeric leaf with its original finite binary64 word. It requires each recovered word to agree with the JSON number except that either zero sign may restore JSON zero. It verifies exact word count. Thus -0, subnormal values and finite extrema are recovered, not merely hashed. It returns the exact stored JSON, word bytes and raw body/point bytes. Record JSON/word/raw digests are accumulated incrementally in original order for later comparison with the old decoded physical digests. New compressedBytes is CONTINUOUS_GZIP_NOT_OLD_PER_RECORD_GZIP; it must never be compared as the old per-piece gzip storage count.

## Ownership, backpressure and IO boundary

An append makes its own payload snapshot synchronously before the caller can mutate it. At most four accepted append tasks and8MiB of pending frame bytes including conservative header allowance exist. A record preflights its conservative construction size against available pending capacity BEFORE allocating its complete encoding. A caller that exceeds the current count or bytes receives typed ARCHIVE_BACKPRESSURE without changing the archive index. The caller awaits accepted append promises before retrying. The component holds no unbounded waiter list or completed reply list.

The pending snapshot cap, temporary JSON/word encoding and fixed64KiB stream chunks stay within the existing16MiB explicit scratch model. The preflight number-price bound additionally limits live staged word bytes to512KiB. This is a bounded semantic buffer/string model. It is not a complete JavaScript/native allocator, DATA or RSS proof. Stream internals, parsed object graphs, GC timing and caller-retained values do not become a fabricated precise heap claim.

Append resolves only after its complete frame has reached gzip Z_SYNC_FLUSH and all corresponding sink write callbacks have completed. The sink charges output BEFORE writing and handles partial writes. This is the kernel-write completion boundary used by the original writeFileSync helpers. There is NO per-record fsync and NO per-record power-loss durability guarantee. Successful close waits for queued appends, writes the end frame, ends gzip, waits for both owned streams to finish and performs ONE final fsync before closing its file descriptor. Failed close destroys and joins both owned streams before closing the descriptor. No processes are started by this module.

One shared retainedBudget instance must cover all archive streams, metadata and emergency output in an eventual caller. Default cap remains280MiB, including a default1MiB emergency reserve. A smaller synthetic cap is permitted; no cap above280MiB is accepted. Emergency reserve is at least4096 bytes. Ordinary gzip output cannot spend that reserve. The caller charges every other retained output through this same budget. A failure's bounded stop.json is charged against the emergency reserve. Charging may conservatively retain unused credit after a failed partial write; it must never undercount actual output. Files are exclusively created, never overwritten.

IO/cap failure retains the first writer error, rejects accepted queued tasks and produces a typed ARCHIVE_STOPPED receipt at close. `kernelWrittenCompleteFrames` counts complete acknowledged frames, possibly including an end frame written before a later trailer failure; it is not a physical-step acceptance count. Prior acknowledged prefix bytes stay in place. A hard external kill may leave no stop receipt and no gzip trailer; no success is inferred from its presence or absence.

## Streaming verification and fixed controls

The internal verifier rejects compressed input above280MiB. It reads64KiB chunks. Before allocating a payload, it checks the fixed prefix/header bound, parses the bounded header, admits its fixed channel and length, and checks the next index/entry bound. It holds only one bounded frame. It checks CRC, payload SHA, record lengths and word reconstruction before the sequential callback. It can also require an expected compressed SHA. It never loads the complete archive or retains completed entries. The callback must follow the caller's own retention bound. Close/error paths join both reader streams.

Missing end frame, gzip truncation, bad gzip CRC, bad frame CRC/SHA/index/length, or inconsistent numeric words returns ARCHIVE_INCOMPLETE with the number of complete callback entries and typed reason. The complete prefix remains inspectable. No truncated container can return ARCHIVE_VERIFIED. A new append or close after close is refused.

Fixed18 test groups are declared before Root execution:

1. Literal CRC32 check vector123456789→cbf43926.
2. Independent literal words for ±0, ±minimum subnormal, ±maximum finite, ±1 and minimum normal; exact JSON/word digests.
3. Unicode, NUL, lone surrogate and Object.keys order.
4. Caller buffer and record mutation after append invocation.
5. Aliased source child snapshot; separate fingerprint and explicit absence of JSON identity restoration.
6. Exact2MiB wire admission and one-byte excess rejection without an index gap.
7. Nonfinite, sparse, cyclic, deep, unsupported-prototype and accessor input refusal.
8. Four accepted queued tasks, fifth-task backpressure and later successful retry.
9. Pending byte cap before another2MiB copy.
10. An acknowledged kernel-written frame is readable as an incomplete prefix before close.
11. Exact compressed cap success and one-byte-below cap stop, with reserved stop receipt.
12. Frame payload corruption with a valid outer gzip container fails CRC.
13. Oversized header and RPC payload length fail before payload allocation.
14. Truncated gzip, truncated header and bad gzip trailer never pass.
15. SHA/index mismatches with recomputed valid frame CRC, wrong expected compressed SHA and inconsistent numeric word all fail.
16. Later cap failure preserves the first complete kernel-written prefix and stop count.
17. Exact raw body/point words and original RPC whitespace/Unicode bytes, including aggregate raw digest.
18. Close joins owned streams; append and another close are refused.

No physical test, full1200 storage sufficiency, timing forecast, hardware guarantee, API, complete64MiB DATA/RSS or resource qualification is claimed. All strict64 profiles stay UNKNOWN. This component must pass its bounded tests before any future physical archive integration.
