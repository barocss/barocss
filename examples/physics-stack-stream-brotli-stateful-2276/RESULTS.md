# Stateful codec: correctness controls pass, size screen NO_GO

Root's first control invocation failed because the output parent directory was
not created. Its4 reported groups comprise1 native CRC PASS and3 ENOENT failures.
`ROOT-ENV-FIRST-FAILURE.json` preserves that guard and the unchanged source seal.
Root creates only the missing parent, then uses fresh02 output names. No source,
test expectation, physical tolerance or resource threshold changes.

The second invocation actually passes **25/25**, outer731.427583ms. All original
24 control files are byte-identical to the preceding candidate. The new fixed
history bank recovers two identical131072-byte high-entropy payloads exactly.
The first acknowledged compressed span is131266 bytes; the second is48 bytes,
below the predeclared32768-byte ceiling. This confirms the selected history
behavior across acknowledged frame FLUSH; it is not physical accuracy or a
whole-dataset size/CPU forecast. `ROOT-CONTROLS-RESULT.json` binds the result to
seal `2ec99c55237d33be0097906b3b17e9c56471a835e7be22abf88155ae6bf4bc96`.

The single frozen whole-input screen then ends **SCREEN_NO_GO**, primary
**RETAINED_CAP** at83886080 compressed bytes, after5137 of10034 source entries.
Full replay and recovery remain NOT_RUN. The later source-reader stream-destroyed
error is secondary to the writer cap. Node's observed span before its final
receipt is7.0552595s; successful complete-CPU qualification is not claimed.
Actual source, output prefix, closure/error receipts and OS samples remain under
`evidence/screen-01/`.

This candidate is ENDED under its unchanged quality2/window20/64KiB settings and
80MiB/45s/30CPU screens. No quality3, window sweep, cap increase or complete-runner
adoption follows. Both codec candidates retain their actual control PASS and
distinct screen NO_GO. The original206516742-byte input and original Physics
failures remain unchanged. No physics, World, oracle, mobile or deployment call
occurs in these tests.

Next work first measures exact duplicated JSON byte spans against fixed original
RPC-derived values, including raw-wire versus canonical-projection distinctions.
A smaller representation must reconstruct every logical frame byte, numeric
word, raw body/point value and request/reply before it can qualify. Its byte
benefit and bounded dictionary/scratch costs must be established before a new
codec is implemented. Native heap/RSS/strict64 remain NOT_QUALIFIED.
