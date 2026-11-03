# Buffered exact packet transcript

Frozen before Root execution. Reuse the unchanged qualified packet admission.
Allocate at most its conservative2MiB bound, fill exactly the prefix protocol's
canonical type/key/UTF16/binary64/alias transcript, and hash only the written
prefix once. No float normalization, JSON roundtrip, approximation, input change
or new cache. Return exactly the old fingerprint fields.

Capacity proof: object10 bytes and array14 bytes fit their64-byte container
charge; key5+2n and string5+2n fit32+4n; number9 and alias5 fit16; boolean/null1
fit16. Root admits no additional types. The seen Map visits each admitted own
object once. Original depth/container/edge/capacity limits stay unchanged.

Fixed6 controls use independent literal transcript hex for negative zero and
Unicode; independent finite IEEE words; alias/mutation/prototype admission;
all48 captured prepared graphs against the old implementation; and early
invalid/oversized/cyclic refusal. Captured JSON alone is not live -0 authority.
Root runs explicit Node22 --test. No physics/reference/compiler call.

Only transport equivalence may PASS. Fresh actual3×16 Worker/stream-archive
physical validation is required before full1200. No speed, heap/RSS, strict64,
public API, whole-P4 or hardware claim follows. Old protocol and receipts remain.
