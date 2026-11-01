---
work_id: physics-world-p4-2276
artifact_type: independent-reference-cost-and-stack-exit-report
status: observable_cost_census_pass_raw_reply_sign_unknown
owner_role: independent-physics-algorithm-work
source_request: continue the roadmap with fixed gates and preserved original failures
last_updated: 2026-11-02
---

# P4 reference cost study

Base P3 commit: `4338d7141237be2b62265f9cd19c0304f0a89a4c`.
Branch: `codex/physics-world-p4-2276`.
This slice owns only `examples/physics-world-p4-2276/` at preparation.
The current Physics package and all earlier evidence remain unchanged.

The original eight-box full-duration exit remains NO_GO. The strict repaired
geometry passes 192 selected rows. The original source/emitted stack studies
pass matched 16-step prefixes; a separate ALIGNED run reached 308 accepted
steps before the unchanged 180-second limit. These are historical boundaries,
not a new full-stack pass. See the preserved boundary report and its first
failures in `examples/physics-contact-boundary-2276/`.

## First finite measurement

Measure the existing independent reference work before selecting an
optimization. Original results record about 0.16 seconds for 192 geometry
rows, and about 27 seconds for 48 World steps with all reference work and I/O.
There is no per-operation timing in those records. A geometry cache alone
has no established ability to make a 1,200-step run fit the fixed limit.

The first gate selects original saved steps 1 and 16 from ALIGNED, OFFSET and
YAW. It authenticates the complete original compressed, decoded and raw
streams, all selected 32-point operands and the original reference closure
before any fixture or reference calculation. It then makes exactly 24 selected
reference IPC requests: contact, full-pair position, step ledger and quality
for each frame. This runs no World, producer or production solver. Position
reference requests do perform independent reference solves; their actual
counters remain separate from the zero production-call claim.

Each full reply must match its archived authority. No tolerance, row count,
solver iteration limit or physical input changes. Producer raw signed-zero
authority and the older JSON wire's missing zero-sign information are separate.
Unknown archived reply signs cannot be filled in to force a pass. Stop at the
first mismatch, unknown result or resource failure and retain the actual prefix.

The original 180-second external limit stays. The new measurement also has a
170-second internal deadline and bounded cleanup. Module setup is recorded separately from operation compute. Do not call
all remaining time pure IPC overhead. The original functions and math remain
unchanged; test-only timing wraps their actual calls once.

`CONTRACT.md` fixes the detailed authority, population, wire, timing, storage and
stop rules. `cost-census.py` is the offline harness. `fixture-data.mjs` calls
the unchanged original fixture builder and counts its trigonometric seeds.
`run.mjs` provides the outer owned-process guard and fresh-ID execution receipt.
No new runtime or dependency is installed.

## Next dependency

After a successful cost census, select the measured expensive operation.
Any optimized independent reference must first pass exact saved-frame
equivalence under its own fixed scope. Only then consider a fresh original
full-duration stack run. This preparation enables neither a public nine-body
profile nor stable stacking, coupling, hardware prediction or manufacturing
approval. All HOLDs, original NO_GO and first failures remain. The conditional
develop merge waits for the entire required roadmap; no push or deployment.

## First executed result and preserved boundary

`guard-01` / `cost-census-01` stopped after two actual reference requests in
about 0.86 s. The contact reply matched. The ALIGNED step1 position reply first
differed at `/reference/prePairs/7/selection/normal/0`: the archived JSON number
is positive zero and the fresh raw Python response is negative zero. No later
request ran. Both reference children were terminated and complete pipe EOF was
recorded. World, production and production-solver calls remained zero.

The strict census remains **FAIL / archived Python reply zero sign UNKNOWN**.
The original 180-second guard was not reached. Observed child compute times
were 9.01 ms for contacts and 112.58 ms for position-world. This one-frame
prefix is not a complete cost census or a full-stack result.

`reply-audit-01` performs no new reference, fixture, World, solver or trig call.
It authenticates both raw responses and the complete original ALIGNED archive.
The whole position reply has 32 differences, all zero signs; nonzero numeric,
string, key and structure differences are zero. Actual Node JSON parse →
stringify → parse gives a separate complete tree match to the archived reply.
The contact reply also passes this separate observation audit. Decimal strings,
including any signed zero in a string, remain exact. Raw responses are retained.

This is DATA observation classification, not a replacement physical output or
a relaxed physical tolerance. It cannot recover an unrecorded historical sign.
A separate `OBSERVABLE-CONTRACT.md` may reuse the two actual calls and their
measured times, then admit only the remaining 22 calls. It must preserve fresh
raw responses before the separate JSON observation projection. The original
strict census is never resumed or relabelled PASS. No cache or new trajectory
has run.

```sh
NODE22=/Users/user/.volta/tools/image/node/22.19.0/bin/node
$NODE22 examples/physics-world-p4-2276/run.mjs guard-01 cost-census-01
$NODE22 examples/physics-world-p4-2276/reply-observation-audit.mjs reply-audit-01
```

These IDs identify preserved results. New execution requires fresh IDs and the
applicable frozen contract. Existing physical error gates and all original
HOLD/NO_GO/first-failure records remain unchanged.

## Separate observable cost census

`observable-guard-01` / `observable-census-01` passes in about 3.14 s outer
wall time. It reuses two prior actual replies and makes 22 new reference calls.
All 24 complete Node JSON observations match their archived authority. The
22 new DATA projection processes take about 723 ms in total and are recorded
separately from reference compute. No new fixture, trig or World runs occur.
Both reference children exit cleanly with complete EOF. The original raw-reply
census stays FAIL; historical Python zero signs remain UNKNOWN.

`cost-profile.json` reads the saved results with zero new reference calls.
The table combines six frames across two sessions; it is not one uninterrupted
24-request timing benchmark or a 1,200-step prediction.

| Reference operation | Six-sample total compute | Mean | Maximum |
|---|---:|---:|---:|
| Contacts | 68.095 ms | 11.349 ms | 13.534 ms |
| Full-pair position | 886.494 ms | 147.749 ms | 177.701 ms |
| Step ledger | 89.583 ms | 14.930 ms | 17.304 ms |
| Quality | 129.545 ms | 21.591 ms | 27.191 ms |

Position reference work accounts for about 76% of the measured reference
compute. Contact-only caching would target a small fraction. The next bounded
measurement profiles ALIGNED16 and YAW16 position calls internally to separate
geometry from exact optimization work. Those are two additional reference calls
under a separate contract, not new World steps or an old census retry. No
performance optimization or full-duration stack run has been executed yet.

```sh
$NODE22 examples/physics-world-p4-2276/observable-run.mjs observable-guard-01 observable-census-01
```
