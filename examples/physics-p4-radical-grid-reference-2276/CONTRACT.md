# R0 independent radical-grid reference

Status: AUTHOR_SOURCE_ONLY_NOT_EXECUTED. Own only this new folder. No candidate
implementation is read or imported by this author/reference. The author makes
only source/data reads, AST/JSON/structure/hash checks. Root alone materializes
or runs arithmetic. Candidate/helper/reference/audit/compiler/World calls by
the author are0. No original fixture, oracle, checker or prior evidence changes.

MATH.md is the independent derivation and guard review. It proves the grid
formula conditionally and records zero/domain/sign/equality/upper-overflow,
Newton64 and strict-cell boundaries. It is not runtime or cost qualification.
Existing signed-square SAT winner comparison, all15 axes under both models,
zero-axis policy, physical thresholds and all prior first failures remain.

## Frozen literal bank

bank-spec.json fixes17 ordered requests before any execution:

| Index | Class | Exact descriptor | p |
|---|---|---|---|
|0|valid zero|N0,D1,S2|64|
|1|valid exact +1/2|N3,D2,S9|128|
|2|valid exact −1/2|N−3,D2,S9|256|
|3|valid irrational positive|N1,D1,S2|512|
|4|valid irrational negative|N−1,D1,S2|1024|
|5|valid maximum table precision|N1,D3,S5|2048|
|6|valid positive nonzero q0|N1,D2^65,S2|64|
|7|valid negative nonzero q0|N−1,D2^65,S2|64|
|8|valid just below grid1|N2^64,D1,S2^128+1|64|
|9|valid just above grid1|N2^64,D1,S2^128−1|64|
|10|valid exact RNE midpoint|N2^53+1,D2^53,S1|128|
|11|valid above RNE midpoint|N(2^53+1)2^128,D2^53,S2^256−1|512|
|12|valid below RNE midpoint|N(2^53+1)2^128,D2^53,S2^256+1|512|
|13|expected invalid|N1,D0,S2|64|
|14|expected invalid|N1,D1,S0|64|
|15|expected shift prebound|N2^8191,D1,S1|64|
|16|expected upper product prebound|N2^8127,D2^4095,S2^8192|64|

Rows13/14 must give GRID_NONPOSITIVE_DENOMINATOR and GRID_NONPOSITIVE_SQUARE.
Rows15/16 must give INTEGER_SHIFT_PREBOUND and INTEGER_PRODUCT_PREBOUND.
The two resource expectations are proved symbolically in MATH.md. M2 does not
evaluate a forbidden expression to generate their answer. The upper-product
control is an exact grid point but requires upper verification before equality
return. Expected invalid/resource rows are separate typed-refusal controls,
not positive radical certifications. No case, reason, precision, threshold,
operation budget or guard changes after a refusal.

## M2 generation protocol

Root runs the pinned Python, in a separate170s internal/180s external M2 guard:

`python3.13 -B materialize.py FRESH_DIRECTORY`

The directory must not exist. Output files use exclusive creation.

- requests.json is exactly `{format:"p4-radical-grid-requests-v1",requests:[17 raw requests]}`.
  Each raw request is exactly `{numerator,denominator,square,precision}`.
  The first three values are canonical decimal strings, at most4096 characters
  including a minus sign, with magnitude≤16384bits. N is signed; D,S are
  lexically nonnegative, with zero reserved for the invalid controls. p is one
  of64,128,256,512,1024,2048. No IDs, expected roots/words or labels enter the
  candidate; the harness passes only each raw request to its actual function.
- oracle.json has format p4-independent-radical-oracle-v1, specPin,
  requestPin and cases[{index,id,kind,expected}]. A valid expected value has
  status CERTIFIED_DIRECT_GRID, reason null, interval/exact and a separate rne
  reference. Refusal expected values have UNRESOLVED, fixed reason and null
  interval/exact. rne is never an input to the candidate.
- manifest.json has format p4-independent-radical-manifest-v1, caseCount17,
  validCount13, invalidCount2, resourceCount2, candidateInput/oracleOnly,
  specPin, sourcePins, file byte/SHA pins, referenceMajorOperations,
  candidateCalls0 and WorldCalls0. Root seals exact bytes before R0.

The valid oracle uses bounded binary search of integer-square comparisons for
the largest q with q²B≤C. It does NOT use quotient followed by isqrt as its
floor oracle. Independent endpoint inequalities/equality prove minimality.
A separate IEEE-word binary search compares exact dyadic values and midpoints
to the radical through squared rational inequalities. Ties select the even
word. No candidate/native source or standard-library sqrt is imported.

The rne reference records the correct word, exact midpoint boundaries and tie
inclusions. `gridIntervalInRneCell` is STRICT containment of both endpoints;
closed even-tie containment is separately named gridIntervalInClosedRneCell.
The radical's strict interior test is also separate. Mathematical zero uses
the declared canonical+0 rule. A fixed-p correct q0 interval or exact tie can
fail strict presentation; that is explicitly recorded, not hidden or accepted
as physical presentation. Physical qualification later retains the original
strict RNE-cell and1e-25 width gates with the same fixed precision table.

## Candidate interface and shared meter

The agreed Python standalone CLI is `radical_grid.py kernel REQUEST REPLY`.
It creates one context for a single request. R0 instead invokes the SAME actual
`evaluate_request(request,meter)` function17 times, in the fixed order, with
ONE fresh immutable old integer_sat.Meter shared across all calls. Fresh
standalone invocations cannot establish that global bank bound. No test input
can raise the meter, inject an answer, change arithmetic or select an axis.

Each actual reply has exactly protocol/status/reason/interval/exact/stats.
Protocol is p4-radical-grid-kernel-v1. Positive status is CERTIFIED_DIRECT_GRID,
reason null, interval exactly `{low,high,precision}` with canonical signed
integer endpoint strings, and exact boolean. Refusal status is UNRESOLVED,
typed reason, interval/exact null. Stats has exactly integerOperations,
peakIntegerBits,axisVisits,conventionProblems. Pure axes/models stay0.

The existing2M integer-operation cap is TOTAL across all17 calls, including
expected guard failures. Intermediate cap16384bits, square-root update cap64
and old primitive meanings remain. No reset, unpriced operation, deferred
unsafe allocation, extra precision, fallback, persistent cache or axis pruning.
All upper certificate products require their own prechecks. MATH.md explains
why fitting C and B is insufficient for the upper product.

Root's source/entry/harness freeze establishes actual shared-meter use, all
operation guards and the64 cap. Cumulative output statistics alone do not
prove implementation wiring. The independent auditor verifies monotone
integerOperations/peakIntegerBits, total≤2M, peak≤16384 and zero pure census.

## Immediate prefix audit and complete result

After each actual call, before the next call, Root runs:

`python3.13 -B audit.py REQUESTS ORACLE REPLIES_PREFIX FRESH_OUTPUT`

REPLIES_PREFIX is exactly `{format:"p4-radical-grid-results-v1",replies:[actual replies]}`
with an ordered prefix of length1..17. No future reply is fabricated. The
auditor authenticates sources/tools/manifest/bank/literal requests and every
reached reply. For valid rows it checks exact oracle agreement plus direct
minimal-grid square inequalities, sign reflection, exact flag and width. It
verifies the oracle's provided IEEE cell by exact midpoint-square comparisons;
it does not run another root or word search. Wrongly narrow intervals, wrong
signs/words, noncanonical output, wrong reason or unexpected refusal fail first.

An accepted incomplete prefix has status EXECUTED_PASS_PREFIX_RADICAL_GRID
and complete false. Only all17 accepted rows produce
EXECUTED_PASS_EXACT_RADICAL_GRID_BANK, complete true, with verifiedValid13,
verifiedExpectedInvalid2 and verifiedExpectedResource2. Failure is
EXECUTED_NO_GO_RADICAL_GRID_BANK, nonzero exit, firstFailure and reached case.
Report protocol is p4-independent-radical-audit-v1, with verifiedPrefix,
the separate census fields, requestPin/oraclePin/repliesPin, finalStats,
referenceMajorOperations and candidateCallsByAuditor0/WorldCalls0.

R0 includes all17 calls, all17 immediate prefix audits, source authentication,
IO, setup and cleanup under ONE170s internal/180s external parent deadline.
Each helper's170s local alarm is a ceiling, not a clock restart; the harness
clamps each child to remaining time. A failed prefix stops later calls. M2 is
separate, before the source/generated-bank seal. No cost decision is part of
this pure protocol. All prior bank truth/evidence remains unchanged.

## Independent work and storage bounds

Reference code has its own2M major-operation ceiling, separate from candidate
pricing. It bounds its integer products, shifts, additions and comparisons
before allocation at16384bits. This is not an assertion that every Python
metadata/checking instruction has an old SAT charge. Grid search≤4096 steps
per valid row;13×4096 is a fixed bound. Word search≤64 steps per valid row;
each IEEE reduction is bounded by its53-bit significand. Prefix audit performs
direct inequalities/cell checks only. Literal expression depth≤8, no unbounded
formula/parser program. No isqrt/float/sqrt/Decimal/GCD/elimination oracle.

Every file≤2MiB, aggregate new evidence≤16MiB, explicit retained data≤64MiB.
JSON depth≤16 and4096 lexical container/separator tokens are checked before
parse; metadata integer tokens≤16characters. Tool authentication streams64KiB
chunks. Reserve32MiB bank/raw/decoded/serialization,8MiB bounded scalar scratch,
16MiB evidence ownership and8MiB terminal/IO. This is explicit-data ownership,
not RSS. Harness enforces aggregate accounting across every prefix/result and
process receipt. There is no enlarged physical or whole-engine limit.

PINS.json fixes the existing Python3.13.5 binary, new sources and immutable old
integer_sat.py/contract/corpus authority. Root's enclosing freeze pins PINS
itself, M2 generated files, candidate and harness closure. Source hashes do not
mean execution. Original independent six-frame physical Float64-word checks,
both-model full-axis coverage and later full physical/runtime checks remain
required. Metadata changes are explicit; no old interval-certificate byte
identity is claimed. No World/API/baseline/mobile/deploy or1200-step result.
