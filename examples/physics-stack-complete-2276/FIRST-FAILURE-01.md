# First complete-path archive failure (preserved)

The first actual combined-prefix campaign stopped at ALIGNED step2 with
`ArchiveStop: JSON_WORD_CAPACITY`. Last contiguous archived acceptance is1.
Two step preparations passed every independent phase gate; the second could
not commit its record. Three normal KKT checks passed, four preparations
returned, and later speculative replies were not counted as physical passes.
OFFSET/YAW and full1200 were NOT_RUN. Public World/API remain unchanged.

The original runner checks `wire(record, 2MiB)` and exact run09 whole JSON,
body and point parity before archive admission. Its oldRecordsCompared=3
therefore covers initial +steps1/2. Read-only inspection of the original matched
ALIGNED step2 authority gives483481 JSON-line bytes,70736 numeric-word bytes,
16893 graph occurrences, depth8. The archive's conservative capacity is2446850
bytes, above2097152. Its6-byte string/key and32-byte numeric prices reject an
actual wire already below the unchanged2MiB cap. This is an observed archive
admission failure; it is not an observed physical residual failure.

The immutable original campaign is `evidence/prefix-01/`. Its final campaign
aggregate reports0 completed-scene acceptances; the actual failed scene's
`ALIGNED/host/result.json` records contiguous1 separately. Do not change either
receipt or relabel the failed campaign PASS.

`baseline/prefix-01-source.tar.gz` preserves every source, pin, seal and Root
preflight/binding present before revision. SHA256:
`296c43e2d7dfc6c3a891420cc35d2f246abaa62fae816aa0b136894a4a1ab539`.
`baseline/prefix-01-preserved.json` records every retained failure-file hash.
All636 external inputs remain immutable pinned authorities.

Next candidate: independent exact JSON encoded-byte admission and explicit
scratch guard in a distinct stream component. Keep wire2MiB, old implied numeric
population, pending8MiB/four appends, scratch16MiB and shared280MiB unchanged.
Qualify the unchanged18 fixed cases plus native-serializer/failed-record tests,
then a new same-source3×16 campaign before any original1200 execution. Preserve
all old physical tolerances, NO_GOs, HOLDs and original first failures.
