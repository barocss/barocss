---
work_id: physics-world-p4-support-radius-cache-2276
artifact_type: bounded-reference-memoization-contract
status: draft_for_parent_review_no_implementation
owner_role: independent-physics-algorithm-work
source_request: reduce measured independent SAT preparation cost without changing original formulas, raw replies or physical gates
last_updated: 2026-11-02
---

# Selected minimum scope

Wrap only the original
`physics-rigid-feature-penetration-diagnostic/geometry-reference.py:support_radius`.
Keep every old file byte identical. No whole-body, pair, pose, SAT-result,
QP-result, contact or cross-request memo is selected. No basis, axis, norm,
native-number or output conversion function is replaced in this first slice.

The measured position profiles passed both CURRENT raw-response comparisons.
For ALIGNED16/YAW16, `compact_pair` used195.995/197.869ms and the exact QP used
136.968/131.978ms under cProfile. Within SAT, `support_radius` ran8640times and
used62.428/61.806ms cumulatively; quaternion-basis preparation used about3ms.
These inclusive times are not additive across nested functions. Profiling
overhead is present. They justify selecting this function, not a speed claim.

The original function depends on extents, bases, direction and Decimal context.
It does not read body center or identity. PRE/HYP body positions differ, while
the observed quaternion bits are held. Thus argument reuse is possible even
when full-pose or whole-pair memoization would miss. Actual hits and cost remain
unmeasured. Exact key construction may cost more than the saved arithmetic.

# Core API for the new reference-only helper

The proposed helper interface is:

```python
memo = SupportRadiusCache(original_support_radius, bounds)
memo.clear()
sat_module.support_radius = memo.call
try:
    reply = original_position_reference.evaluate(captured_request)
finally:
    sat_module.support_radius = original_support_radius
    report = memo.stats()
    memo.clear()
```

`call(*args, **kwargs)` forwards to the original function on a miss or ineligible
call. `clear()` releases all entries and resets the per-request counters.
`stats()` returns detached actual statistics before the final clear. The parent
records that snapshot and leaves no cross-request state. Restoration occurs
even after an exception.
This is an isolated reference harness interface, not a Physics API, plugin,
second solver, shipping option or alternative physical law.

# Exact dependencies and context

Cache only exact builtin tuple arguments with the original3/3×3/3 structure,
whose leaves are exact finite `decimal.Decimal` objects, under an exact builtin
Decimal Context at precision80 or120. Other calls, kwargs, malformed arguments,
subclasses and nonfinite values bypass the cache and call the original function
unchanged. Bypass does not invent or intercept an original validation error.

Use a collision-free, typed, length-delimited bytes key. Encode all argument
structure and every Decimal `as_tuple()` sign, digit sequence and exponent.
Keep +0/-0 and equivalent numeric values with different exponents distinct.
Do not float-convert, quantize, normalize, average, sort axes or use numeric
Decimal equality as a substitute for representation equality. A hash alone is
not a key. Equal bytes must identify complete equal dependency representations.

The key also contains function/source identity and these active Context values:
precision, rounding, Emin, Emax, capitals, clamp, every trap setting and every
incoming sticky flag. Include signal identities in a fixed order. No key omits
raw/normalized convention effects: the actual bases and direction arguments
already contain those computations and must be encoded in full.

# Original calls, flags, results and exceptions

On a miss, snapshot the actual incoming flags, call the ORIGINAL function once
in the SAME active Context, and capture its actual post-call flags. Cache only
a successful immutable Decimal result and its complete post-flag vector.
Do not clear flags, enter a substitute Context, calculate a second answer or
infer flag effects from the returned number.

A hit is eligible only for the identical full key, including incoming flags
and traps. Return the stored immutable Decimal and set the active flags to the
recorded post-call vector. Do not change Context settings or traps. Existing
flags must not be cleared merely to obtain a hit. The wrapper's accounting and
key encoding must perform no Decimal arithmetic or change flags themselves.

Never cache exceptions. If the original raises, keep its actual flag effects
and propagate that same exception object. Do not translate, replace or restore
the old flags. A test-only recording delegate may observe the exact object
emitted by the original function to check identity; it adds no arithmetic call.
Immutable tuples/Decimal inputs remain untouched and successful return values
are immutable. No caller-owned mutable object is stored as a cache key/result.

# Fixed resources and normal cache-full behavior

| Resource per full reference request | Bound |
|---|---:|
| Retained cache entries | 8192 |
| One encoded key | 16KiB |
| All retained encoded keys | 16MiB |
| Owned cache memory, including dictionary, keys, results, post-flags and entry bookkeeping | 64MiB |
| Logical support-radius invocations | at most8640 |
| Full original `evaluate` calls in the gate | 6 total |

Account actual owned key/result/post-flag/entry/dictionary storage. Reserve a
conservative dictionary-growth allowance before insertion; verify the retained
size afterward. Do not count serialized bytes alone as Python owned memory.
Bound temporary key construction before retaining it. No unbounded input-identity
table or auxiliary memo is selected.

If a key or insertion would exceed a cache bound, compute the original function
normally and do not store that entry. Keep existing entries and count the
capacity bypass. This is ordinary memoization behavior, not another solver or
changed formula. Do not evict, increase limits or retry a request to seek a pass.
An actual accounting overrun is an execution failure, not permission to relabel
the overrun as a successful bypass.

Report actual lookup attempts, eligible calls, hits, misses, capacity/type/context
bypasses, original-function attempts/returns/raises, entries, key bytes and peak
owned bytes. Never infer actual calls from the8640 ceiling. Cache hits do not
count as an original arithmetic call. Every miss/bypass calls it at most once.

# Primitive gate before any full reference

Parent freezes exact recipes before implementation/execution. Select these12
primitive control groups, with no full reference, QP or World call:

1. Signed-zero argument keys remain distinct.
2. Equal numeric values with different Decimal exponents remain distinct.
3. Precision80 and120 use separate entries and match direct original results.
4. Different rounding modes use separate entries.
5. Clear and pre-set incoming sticky flags produce the original post-flags.
6. Different trap settings preserve the original return/raise behavior.
7. Unsupported argument types/structure/kwargs use original-call bypass.
8. Raised original exceptions retain object identity and actual flags.
9. Beginning a new request forces a fresh miss and releases old entries.
10. Miss/hit calls leave all input tuples and Decimal representations unchanged.
11. Reusing an immutable returned Decimal adds no mutable alias or Context leak.
12. Fixed small capacity causes a counted unstored original call; prior entries
    remain usable and memory/counters remain within the chosen bound.

Maximum primitive population:48 wrapper invocations and72 direct original
support-radius calls, including baseline/delegate calls. Record actual counts
per group. Direct baseline calls and wrapper-delegated calls are distinct.
Primitive recipes may use literal Decimal inputs and the original helper as
the oracle; they do not implement a second support-radius formula. No warm full
reference call is admitted. A primitive failure stops before the six-call gate.

# Six-call CURRENT raw equality gate

Authenticate the original manifest/archives/raw streams, all12 original Python
providers, observable-census PASS and position-profile PASS before mathematical
calls. Use the already captured six position-world stdin requests at steps1/16
in ALIGNED/OFFSET/YAW. Do not rebuild fixtures or request DTOs.

Make exactly one fresh optimized `original.evaluate` call per selected request,
with a new empty memo. Compare the COMPLETE raw response bytes and every parsed
numeric bit, including -0, against its captured CURRENT UNCACHED raw reply.
Compare all keys, strings, Decimal text, booleans, nulls, rows, classifications,
certificates and reference counters. No Node JSON projection is used. Do not
fill a missing value, skip a row or take an expected result from the producer.
The existing Decimal80/120 operations and comparison gates remain unchanged.

Fresh full-reference calls are6. Primitive helper calls are separately bounded
above. At full reach, prior study26 + fresh6 =32 actual full-reference evaluations.
No original uncached full call is repeated merely for a timing baseline. No
World, fixture, trig, producer or production solver call is admitted.

Stop the full-reference prefix on the first raw/numeric/context/counter/input
mutation mismatch, unknown exception, source change, accounting failure or
resource limit. Keep the original failure and actual reached counts. Do not
repeat a failed mathematical prefix or change a bound. Old raw historical
census FAIL and prearchive reply-sign UNKNOWN remain unchanged.

# Correctness and cost are separate exits

`NUMERIC_EQ_PASS` requires all primitive groups and all six complete CURRENT
raw replies to pass, with exact Context and ownership behavior. It does not
establish a speed improvement. A numerical failure remains its own result.

Time each optimized full request WITHOUT cProfile, including per-request memo
initialization/reset/finish bookkeeping. Compare its process CPU time with the
corresponding prior UNPROFILED `computeCpuNs` sample in the captured census.
Record all six paired CPU/wall times, hits/misses, key construction and cache
memory accounting. Do not compare optimized unprofiled time with cProfile time.

Predeclared `COST_GO` requires `NUMERIC_EQ_PASS` and a strict reduction in the
SUM of six process-CPU samples. Otherwise report `COST_NO_GO`; retain all paired
regressions explicitly. Aggregate cost is classified only after the selected
six-case numerical gate, so no additional cases or retries seek a better score.
This single old/fresh pairing is observed cost evidence, not a randomized
benchmark, per-frame nonregression guarantee or general performance result.

Keep170s internal,180s external owned-process-group and at most4s cleanup.
Use fresh run IDs and at most32MiB of gate evidence. No numerical/source/provider
or physical gate changes are permitted. Even `NUMERIC_EQ_PASS` plus `COST_GO`
does not prove the full1200-step stack fits180s. Any wider cache or trajectory
trial requires a separately frozen next scope after this bounded gate passes.
