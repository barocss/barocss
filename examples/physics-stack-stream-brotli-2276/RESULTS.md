# Fast-fragment codec: NO_GO

Root actually passes all24 fixed component groups, outer1685.365916ms, with
source/input pins checked before and after. `ROOT-CONTROLS-RESULT.json` binds
that result to seal
`93ea41c0b6c82dc1fdb62486f47152a23e8e52be51a053039bf25b9204bde474`.
This includes the original23 control properties and native CRC equality against
the independent old JavaScript CRC and literal/chunk vectors.

Root then executes the single frozen preserved-archive screen. Actual result:
**SCREEN_NO_GO**, primary writer refusal **RETAINED_CAP**. The candidate reaches
its fixed83886080-byte compressed-output ceiling after4120 of10034 source data
entries. Full replay/recovery does not complete. The old input remains exactly
206516742 bytes with its original hash and first-failure metadata untouched.
The source reader's later ERR_STREAM_DESTROYED is secondary to the writer cap;
it is not the primary failure or a physical residual failure.

Node reports5.034672s to its final receipt preparation. The exact OS wait/EOF
sample remains in `evidence/screen-01/summary.json`, but clean successful-leaf
qualification does not complete, so the parent retains CPUUNKNOWN rather than
a successful complete-CPU claim. Neither the45s nor30s screen is promoted from
this incomplete replay. No physics, World or independent-reference call occurs.

This candidate is **ENDED**. Quality1, window20,64KiB chunks, per-frame flush and
all fixed screens remain unchanged. Its component correctness PASS is separate
from failed size/cost qualification. No complete-runner import change or original
full campaign follows from it. Keep its failed archive and all source/receipts.

Read-only tracing in the pinned Node22.19 source explains the next dependency.
The quality1 path clears its match table for each fragment and searches only
the current input. Its advertised window does not establish cross-write history.
The general encoder uses a ring buffer and previous-block hasher. These are
different encoder paths; the finding is not a measured performance result.
See [fragment contract](https://github.com/nodejs/node/blob/v22.19.0/deps/brotli/c/enc/compress_fragment_two_pass.h#L39-L50),
[dispatch and table handling](https://github.com/nodejs/node/blob/v22.19.0/deps/brotli/c/enc/encode.c),
and [quality definitions](https://github.com/nodejs/node/blob/v22.19.0/deps/brotli/c/enc/quality.h).

A distinct stateful-path candidate must retain the same size/time/CPU screens
and physical/wire/scratch/output bounds, add an across-FLUSH history control,
and qualify independently. The ended quality1 candidate is not retried or
relabeled. Native heap/RSS and optional strict64 remain NOT_QUALIFIED; all HOLDs,
old numerical tolerances and first failures stay in force.
