---
work_id: physics-stack-stream-2276
artifact_type: implementation-validation-result
status: component_pass_live_composition_pending
owner_role: independent-physics-algorithm-work
source_request: retain complete original-stack evidence within its fixed output bounds
last_updated: 2026-11-04
---

# Stream archive component

Root executed the fixed bank once with Node22.19.0:

```sh
STREAM_TEST_OUT=examples/physics-stack-stream-2276/evidence/stream-01 \
  $NODE22 examples/physics-world-p5-2276/command-run.mjs \
  stack-stream-controls-01 . $NODE22 --test \
  examples/physics-stack-stream-2276/archive.test.mjs
```

Actual result: **18/18 PASS**, zero failures, outer elapsed867.339833ms,
exit0 and complete process closure. The command guard receipt is under
`examples/physics-world-p5-2276/evidence/stack-stream-controls-01/`.
The source binding receipt is `evidence/stream-01/source-binding.json`.
The declared source seal remains
`459f91af8e3c3ee6668f08c82b5566c3aada88a01d643a61711bb86d03e7a948`;
all pinned bytes were checked again after execution.

The bank checks independent CRC and binary64 vectors, signed zero, Unicode,
caller mutation, alias fingerprint metadata, exact wire and retained-byte
boundaries, malformed input, bounded pending work, complete kernel-written
prefixes, corrupted lengths/CRC/SHA/index, truncation, raw body/point words,
original RPC whitespace and joined stream closure. Failed later appends retain
the earlier complete prefix. Incomplete archives never become PASS.

Append acknowledgement covers completed kernel writes and gzip sync flush.
Final close performs one fsync. Per-record power-loss durability is not claimed.
The continuous gzip size is measured as a new storage format; it must not be
compared as though it were the old per-record gzip byte count.

This component run makes **zero physics calls**. Live producer/reference/archive
composition, original3×1200 qualification, public World/recorder integration
and desktop verification remain pending. Optional strict-global64MiB retained
data remains UNKNOWN. Existing physical tolerances, old failures, HOLDs and
deployment restrictions are unchanged.
