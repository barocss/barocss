---
work_id: physics-world-p4-cost-census-2276
artifact_type: frozen-offline-reference-cost-contract
status: authored_not_run
owner_role: independent-physics-algorithm-work
source_request: measure unchanged P4 reference costs on authenticated saved frames before selecting any optimization
last_updated: 2026-11-02
---

# Scope and start condition

Parent base is P3 commit `4338d7141237be2b62265f9cd19c0304f0a89a4c`.
The owned branch is `codex/physics-world-p4-2276`. Own only this new directory.
Keep old source, archives, HOLDs and failures unchanged. This slice measures
reference cost. It does not implement a cache, change a solver, create a World,
advance a trajectory, activate public nine-body support or qualify P4 physics.

The original strict192-row geometry proof and matched16-step source/emitted
prefixes remain their original evidence. The separate ALIGNED308-step attempt
is incomplete at its180s guard. The original ALIGNED/OFFSET/YAW1200-step exit,
8–10s settling tests, public persistent-box limit4 and historical failures remain.

Parent must finish the P3 public-adoption checkpoint, freeze this source and
the actual installed executable paths, and hold the repository heavy lane before
execution. This authored contract alone is not an execution result or approval.

# Fixed saved population and authentication

Use only steps1 and16 in each of ALIGNED, OFFSET and YAW, in that order:
six saved frames. Authority is
`examples/physics-contact-boundary-2276/evidence/world-source-03/`.
The original manifest has73147bytes and SHA256
`824cde0637a1cf033f77f673b1b4e12caf478c6b0aea6dbe9fc185b8a3f653c3`.

Before mathematical calls:

1. Authenticate that manifest and its `source.json` entry. The source receipt
   supplies the twelve original Python reference-provider hashes and original
   `physics-rigid-contact-reference/fixtures.mjs` hash. Check every current byte.
2. Authenticate all three `*-result.json` files and six compressed JSONL/raw
   archives against the manifest. All selected original outcomes must be the
   qualified16-step prefix, with no failure and no full1200-step GO.
3. Decode each complete17-record JSONL stream and full raw stream. Check the
   decoded JSON hash and raw hash from the authenticated outcome record, complete
   EOF, initial record, steps1..16, all eight raw frames per step and all32 point
   operand layouts. Retain only selected frames after full authentication.
4. Authenticate body JSON against each936-byte raw13 frame and point/normal
   values against each1536-byte operand block. Numeric zeros may compare equal
   across JSON/raw, but retain the exact original signed bytes separately.

The JSONL initial record contains `state` and `quality`. Each step record contains
`before`, `event`, `pointOperandF64leHex`, `stages`, `positionAttempt`, four saved
reference replies, `after` and outcomes. `free-ready`, `velocity-ready` and
`closure-ready` ledgers provide the exact original request data. The raw stream
has936 initial bytes and8×936bytes per step. The controller verifies the layout
from actual nonnull stage arrays instead of trusting an offset formula alone.

# Original input and output zero-sign authority

Producer body and point operand signs are authenticated and retained as F64LE
bytes. The old observer used `JSON.stringify`: its ordinary numeric arrays did
not carry negative-zero signs. Contact and quality requests must therefore use
the saved original JSON values. Position-world and phase-ledger requests retain
their original explicit raw-hex fields, which the unchanged reference restores.
Do not inject reconstructed negative zeros into a different old request wire.
No numeric value is rounded, clamped or averaged by this controller.

The archived replies were also written through `JSON.stringify`. A prearchive
Python reply zero sign can therefore be unobserved. Default comparison remains
strict: compare archived numeric values and fresh values by binary64 bits,
including zero signs; compare every key, boolean, null, string and array entry.
Do not normalize either side to make a reply pass. A zero-sign discrepancy stops
the census as `ARCHIVED_REPLY_ZERO_SIGN_UNOBSERVED`, retaining both actual bits
and the first difference. It does not establish a new physical failure or erase
an old one. No cache or trajectory run follows an unresolved census.

# Fixed operations and provenance

For each selected frame, send these four requests exactly once:

| Original function path | Request | Saved reply |
|---|---|---|
| `physics-stack-solver-2276/trajectory-reference.py` | `contacts` | `contactGeometry` |
| `physics-rigid-full-pair-position-world/reference.py` | `world` | `positionCheck` |
| Same original position reference | `step-ledger` | `ledgerCheck` |
| Same original trajectory reference | `quality` | `quality` |

Total maximum is24 reference IPC requests:12 to each of two persistent Python
children. No warm request, retry, extra precision pass or selected-case fallback
is admitted. All original Decimal80/120, Fraction, SAT, normal KKT, strict line
booleans, geometry/residual/settling thresholds and error classifications remain
unchanged. The original references are imported from their original paths.
There is no copied numerical implementation and no production reference import.

`fixture-data.mjs` imports the original immutable fixture function to obtain
the three original config DTOs. It creates no World. Its one installed Node22.19
process must match the archived Node version. Count its three fixture-function
calls and eight existing sin/eight existing cos calls separately. The wrappers
call each original native function once and add no trigonometric evaluation.
This authored DATA setup is not a new physical model or reference oracle.

# Timing and evidence

The Python children run the unchanged original `main()` protocol. Test-only
timing wrappers call its original `dispatch` or `evaluate` function exactly once
per request. Record a start marker before that call and a return/raise marker
after it. Geometry child readiness follows both original helper imports; import
time is separate from request compute time. Source files stay byte identical.

Record parent serialization, write/flush, IPC wall and decode times; record child
operation wall and CPU times. `IPC minus compute` is a measured difference, not
a claim that all remaining time is pure transport. Preserve full actual request
and reply bytes, hashes, frame/record/raw locators, classifications and first
exact difference. Preserve original full-reply provenance through its immutable
archive locator; do not copy the old archive as new evidence.

World calls, production calls and production solver calls are0. Independent
reference arithmetic is not0: the six `world` requests invoke the existing exact
reference kernel. Keep every returned reference counter tree by its path and do
not sum duplicate nested counters. IPC attempts, returned replies, reference-call
start/end markers and exactly matched replies have separate actual counts.

# Bounds and stopping

One run uses a fresh ID and exclusive output files. Internal deadline170s and
parent external deadline180s remain fixed. Parent runs the census in its own
process group. Reference and fixture children inherit that group, so its outer
timeout can terminate only the owned tree. Internal cleanup has at most4s in
total, leaving6s before the external bound for final evidence. On failure, stop
the child before closing input. Close the input descriptor without a buffered
flush. Require clean exit0/complete EOF for PASS; failures retain actual
terminate/kill status and incomplete pipes. Stop at the first
mismatch, unresolved classification, source change, unknown exception, child
failure, resource guard or exhausted population. Do not start another request.

| Resource | Bound |
|---|---|
| Selected frames / reference requests | 6 /24 |
| Persistent reference children | 2 |
| Fixture DATA process | 1; timeout10s |
| Compressed archive per file | 2MiB; exact manifest size/hash also required |
| Decoded JSON per scene / individual line | 32MiB /4MiB |
| Decoded raw per scene | exact120744bytes |
| Actual request or reply line | 2MiB |
| Reference stderr per child | 128KiB |
| Retained main evidence | 128MiB |
| Installed Node executable read | 256MiB |

Main evidence contains serialized request buffers and actual reply files; timing
and progress records remain separate. A completed write/flush is recorded. An
interrupted buffered write has unknown delivered-byte count; do not label its
whole serialized buffer as delivered stdin. First failed partial reply is
retained before parsing. Report actual
storage, exit, signal and reached prefix. Do not use compression, increase the
wall guard or reduce inspected rows to turn a failed census into PASS.

# CLI and later gate

Parent runs the following only inside its bounded external180s launcher:

```sh
python3 -B examples/physics-world-p4-2276/cost-census.py \
  --run-id cost-census-01 \
  --node /Users/user/.volta/tools/image/node/22.19.0/bin/node
```

PASS requires all24 full replies to match their archived authority, six complete
frames, complete original-input authentication, unchanged sources and clean child
EOF. It measures cost only. Select any later cache from the measured operation
costs under a new before-code contract. A possible request-local Decimal body
frame cache is not implemented or admitted here. Full original P4 qualification
and its public API adoption remain separate future work.
