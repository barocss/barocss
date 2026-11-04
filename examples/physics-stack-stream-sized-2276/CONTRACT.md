# Exact-size admission candidate

Status: SOURCE_READY_AUTHOR_NOT_RUN. This is a distinct archive admission candidate. The original stream18 component, complete prefix01 source, all first-failure receipts and frozen inputs remain unchanged. No physics, numerical helper, test or compiler was imported/executed by this author.

The actual complete prefix01 first failure was ALIGNED step2, archive JSON_WORD_CAPACITY, last contiguous accepted1; later scenes were NOT_RUN. Its original physical record JSON is483481 bytes and its8842 numeric leaves require70736 word bytes. The old conservative estimate was2446850 bytes, above2097152. Actual physical JSON/word/body identity checks had passed before archive admission. This is an archive preflight refusal, not a physical or numerical failure. It does not promote prefix01.

## Bounded source change

Keep the original fixed channels, frame format, CRC/SHA/index checks, gzip completion, ownership copy, backpressure and kernel-write acknowledgement, final close/fsync, recovery semantics, output caps and failure-prefix handling. The candidate imports no physics and adds no dependency. The original18 tests are copied BYTE EXACT, with their existing relative candidate import. Only the new directory changes the imported module.

Replace the old conservative6-times-string/32-times-number JSON capacity price with an exact preflight of the existing `JSON.stringify(value)+'\n'` encoding. Finite number lexemes use scalar JSON.stringify only; their individual allocation is bounded. Strings and keys are scanned without encoding the complete JSON: quotes, backslash and short escapes; six-byte other controls/lone surrogates; four-byte paired surrogates; ordinary one/two/three-byte UTF8. Check commas, colons, brackets and exactly one final LF. A necessary UTF16 length lower bound rejects an oversized string before scanning, and the local byte count stops above the2MiB wire limit. The encoded Buffer length must equal the preflight result.

Preserve strict plain prototypes, own enumerable data descriptors, dense arrays, no symbols/accessors/cycles, depth64 and262144 visited occurrences. No field omission, key reorder, new numeric normalization or graph admission workaround is allowed.

Unchanged limits: encoded JSON including LF<=2MiB; RPC/packet<=2MiB; combined raw body/point bytes<=2MiB; header<=2KiB; four pending tasks and8MiB pending bytes; shared retained output<=280MiB with the original reserve. Preserve the old implied numeric population explicitly: at most65536 leaves, word sidecar<=512KiB. Decoder enforces that same word bound. The old frame payload upper bound remains unchanged; it is not a new larger admission allowance.

Before allocating a complete record encoding, require both pending admission and the combined16MiB scratch check. Let Q be existing pending bytes, J exact JSON+LF bytes, W word bytes, R combined caller raw bytes and P=16+J+W+R the new record payload. Require Q+3J+W+P+R+1MiB<=16MiB, equivalently Q+4J+2W+2R+16+1MiB. This includes the caller raw buffers in addition to the component's new payload, staging UTF8/UTF16 and word buffers. Q excludes the new P. The fixed1MiB allowance covers bounded stream/header scratch in this explicit model. These buffers are not a complete JavaScript/GC/native allocator or RSS/DATA certificate. A transient combined-scratch refusal is ARCHIVE_BACKPRESSURE; a caller may await already accepted appends before retrying. Limits do not rise.

## Fixed qualification before integration

Root runs the unchanged18 tests and five new fixed groups with fresh output roots:

`STREAM_TEST_OUT=FRESH_OLD18_OUT SIZED_TEST_OUT=FRESH_EXACT_OUT PINNED_NODE22 --test archive.test.mjs exact-size.test.mjs`

19. Native JSON.stringify byte oracle over null/bools, ±0, minimum subnormal, maximum finite, control escapes, Unicode, valid/lone surrogates and numeric-key ordering. Recover exact JSON bytes and raw buffers.
20. ASCII and escaped-string JSON exactly2MiB including LF; one additional ASCII byte must refuse before encoding.
21. Authenticated actual failedALIGNED2 whole record483481 bytes,70736 word bytes; exact native JSON byte equality, word count and raw body/point recovery. This captured JSON size test does not replace later live signed-zero/Worker qualification.
22. Exactly65536 numeric leaves/512KiB words admitted;65537 leaves refused before allocating the sidecar.
23. Literal combined-scratch boundary with Q4198432, J2097152, W0 and R1570792 is16MiB exactly. One extra eight-byte raw word must receive backpressure while that Q remains live, and succeed after the prior appends finish. Pending8MiB/four and complete recovery remain required.

No source/build/math execution by the author is permitted. Root must qualify this candidate before changing the complete runner's archive import and pins. That integration then needs a NEW combined3×16 prefix ID and same-source gate before full mode. No archived first failure is overwritten, and no prefix extrapolation or API/full1200/strict64 claim follows from these component controls. All optional strict-global64 profiles remain UNKNOWN/NOT_QUALIFIED.
