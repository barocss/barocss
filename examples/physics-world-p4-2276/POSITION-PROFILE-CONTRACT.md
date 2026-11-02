---
work_id: physics-world-p4-position-profile-2276
artifact_type: two-call-unchanged-position-reference-profile
status: authored_not_run
owner_role: independent-physics-algorithm-work
source_request: distinguish SAT geometry cost from exact QP cost before selecting any reference cache
last_updated: 2026-11-02
---

# Purpose and unchanged authority

The separate observable census passed all24 archived observations, using22 new
reference calls and2 reused calls. Its DATA cost extraction attributes75.5% of
the six-frame reference time to position-world. It does not identify which
nested position operation dominates. Do not select a cache from that aggregate.

This gate makes exactly two fresh direct `reference.evaluate` calls under
Python's standard-library cProfile: ALIGNED16, then YAW16. It imports the original
reference implementation after input authentication. There is no new arithmetic,
cache, solver, DTO reconstruction, World, fixture invocation, trig evaluation,
Node projection, IPC request or Python child. The study's actual reference count
becomes24+2=26 at full reach. These are purposeful profiling calls, not retries
of the old failed raw-census comparison.

The original census remains FAIL and its historical prearchive Python reply
zero signs remain UNKNOWN. This gate uses the captured CURRENT uncached raw
replies, including -0. It makes no archived-wire projection and changes no
physical gate, source reference, producer raw body value or tolerance.

# Fixed inputs and authentication

Current authority is `evidence/observable-census-01/summary.json`:59236bytes,
SHA256 `be2317e3160da6ac961b7e4ec7e0bbddd20133947bc536c3de955691d9df80cb`.
Require its complete PASS, two reused calls,22 fresh calls and24 exact archived
observations. Reuse unchanged original census DATA authentication to verify the
manifest, all original compressed/decoded/raw streams and twelve Python
reference providers before importing a mathematical reference.

Use the captured `ALIGNED-16-position-world.stdin.jsonl` and
`YAW-16-position-world.stdin.jsonl` exactly as authenticated by their saved
locators. Verify each source hash/size and its pre/hyp raw frames against the
full saved archive. Do not reconstruct the DTO or regenerate a fixture.

| Scene | Request SHA256 | Current raw reply SHA256 |
|---|---|---|
| ALIGNED16 | `c5014cbd7b6948642ff43cced4cbd0a5d216ac90302f21857f20848c5d8fa2e1` | `8d521cedc061fe03b2802809dc1290ad2a4762eb17431d265966c529fa0fd56e` |
| YAW16 | `e1567a963b0a8bc416e7ce027bbcce41710112575d5ce9380dc82d2eb0a150c3` | `d31c63158d50c3d1c41e983a0ae70d7f958115f96a76b457a0a36c5ae027b22b` |

Both captured reference outcomes must be SOLVED/ok/resolved, executionFailure
false and violations empty. Source helpers and the current authority are
rechecked after profiling. Earlier raw/observable proofs keep their exact source
and execution identities.

# Instrumentation and equality

Call original `physics-rigid-full-pair-position-world/reference.py:evaluate`
once per input. Enable cProfile only around that call. Retain partial profiler
data if the call raises or the deadline interrupts it. Save native pstats and
all function/caller call counts, self times and cumulative times as JSON.
No function's result or implementation is replaced.

The disjoint root categories are
`physics-rigid-signed-closure-world/reference.py:compact_pair` for PRE/HYP SAT
geometry and `full-pair-reference.py:solve_exact` for the exact QP. Also report
position `kernel`, `world` and `evaluate` roots. Those other inclusive times
overlap; do not sum them as separate total costs. Retain the complete function
table so a hot subroutine can be identified without another mathematical call.

Serialize the returned value with the original position protocol's compact
Python JSON encoding. Require the entire response bytes and parsed tree to equal
the captured CURRENT raw response, including signed-zero bits, exact strings,
keys, booleans, nulls, arrays, classifications and counters. There is no zero
normalization or tolerance fallback. Preserve the first mismatch and stop before
the second call if the first call fails.

cProfile adds overhead. Its times support attribution on these two inputs;
they are not a new six-frame speed benchmark or proof of full1200-step cost.
The prior uncached census timings remain separately identified.

# Bounds, execution and exit

Parent freezes this contract, script and input identities before running a fresh
ID through its180s external process-group guard. The script keeps a170s internal
alarm. There are no child processes to drain; final local evidence cleanup must
remain inside the reserved4s window, leaving time before the external bound.
Keep at most16MiB of profile artifacts; captured request/reply lines are at most
2MiB and source metadata at most1MiB. Do not increase a guard or add a sample.

```sh
python3 -B examples/physics-world-p4-2276/position-profile.py \
  --run-id position-profile-01
```

The fixed source folder defaults to `evidence/observable-census-01`; an optional
`--source` must resolve to that same authority. The success status is
`PASS_POSITION_REFERENCE_PROFILE`. PASS requires both direct calls to return, both full CURRENT raw replies to
match, complete profiler tables and unchanged source/input authorities. A
missing root, unknown exception, source change, mismatch or resource failure
stops the prefix. Actual attempted/returned/matched counts remain separate.
Only after this gate passes can parent select a separately bounded optimization
contract. No cache or trajectory execution is admitted by this profile gate.
