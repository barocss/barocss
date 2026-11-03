# Independent R1 Gram SAT reference

Status: AUTHOR_SOURCE_ONLY_NOT_EXECUTED. Root approved the fixed9-pair plan.
This author does not read/import the new Gram candidate implementation and
makes no numerical/helper, materializer, model, reference, auditor, compiler
or World call. Only source/data, AST/JSON structure and hashes are checked.
All prior sources/banks/checkers, math results, cost failures and revoked
retained-graph measurements remain immutable. No old timing or baseline rerun.

## Fixed literal authority and scope

bank-spec.json materializes the EXACT9 pairs in the approved independent
physics-p4-gram-reference-design-2276/REVIEW.md. The cases are coincident
identity, exact face touch, separated unequal extents/nonzero centers, exact
cyclic rotation, half turn, raw nonorthogonal A, both raw nonorthogonal, a
nonzero near-parallel edge and exact body/order reversal of the both-skew case.
The last case retains original body IDs while reversing order. The descriptor
grammar is frozen small rationals, powers2^-42/2^-50 and bounded add/subtract.
No new case, precision, refusal expectation or threshold after execution.

All9 are valid admitted Float64 boxes under the unchanged old prepare rules.
There is no expected resource rejection. A failure is first NO_GO. Arbitrary
integer-basis overflow outside the native admitted-body profile remains
NOT_RUN; this bank does not add an input hook or claim that branch qualified.
Raw bases are not treated as orthogonal. For epsilon2^-42, physical columns
A0/da,A1/da have dot−epsilon(1+epsilon); INTEGER AA01 is this value times da².
The tiny-rotation case keeps nonzero near-parallel axes eligible, not pruned.

## M3 separate generation

Root runs the existing pinned Python:

`python3.13 -B materialize.py FRESH_DIRECTORY`

M3 has its own170s internal/180s external guard before generated-bank seal.
The directory must not exist; every output uses exclusive creation. M3 does
not import/call a candidate or regenerate any original full geometry/position,
GCD, radix or radical bank. It does not run a new cold solve or baseline.

Exact Fraction dyadics are converted to native binary64 and checked back with
Fraction.from_float equality before use. All inputs are therefore exactly
represented as declared, with no decimal approximation or trig seed. Separate
little-endian Float64 word lists authenticate those native input fields.

Generated requests.json is exactly:

```
{format:"p4-gram-sat-requests-v1",requests:[nine ordered {a,b} requests]}
body={id,kind:"dynamic",shape:{kind:"box",halfExtentsM:[3 native Float64]},
      positionM:[3 native Float64],orientation:[4 native Float64]}
```

Candidate receives ONLY each bare{a,b}; no case ID, descriptor, expected table,
word pin, oracle path, axis, precision override or witness enters that call.
The literal body IDs a,b (and their final reversed order) are geometry inputs.

oracle.json has format p4-independent-gram-oracle-v1, specPin, requestPin and
cases[{index,id,inputF64leWords,expected:{raw,normalized}}]. Expected model
snapshots use the exact agreed result shape below. IDs and expected values
remain in this separate oracle file. The input word lists cover positionM,
orientation and halfExtentsM for both bodies; they are not candidate seeds.

manifest.json has format p4-independent-gram-manifest-v1, caseCount9,
candidateConventions18,candidateAxisSlots270,gramCoefficients378,
faceCenterCoefficients108,signedMixedCoefficients486,
oracleDirectCapturedModels18,oracleOldSourceCrossChecks18,oracleOnlyMeterStats,
candidateInput/oracleOnly filenames,specPin,sourcePins,request/oracle file pins,
candidateCalls0,coldQpCalls0,WorldCalls0. Root freezes these exact bytes before
R1. No answer fitting or regeneration to match a failed candidate is permitted.

## Distinct old DIRECT oracle

The old immutable integer_sat.py is authenticated and loaded in the Root-only
M3 process. Its represented Float64 preparation/Hamilton geometry is reused as
an AUTHENTICATED_GEOMETRY_COMPONENT, not a newly independent native geometry
oracle. No candidate/new factorization source is used to derive expected data.

For each pair/convention, the oracle explicitly builds all9 Ai×Bj vectors and
directly dots each with every Ak,Bk and center delta. S is a direct U·U, not a
Gram determinant. Supports are the OLD direct component-dot weighted absolute
sums. D=2^t da db remains the exact original integer denominator in all15 slots.
N is the old integer support/center expression. No reduction or axis rescaling.

TA is selected from the direct Ak·(Ai×Bj) projections for(k,i)=(1,2),(2,0),(0,1).
TB uses direct Bk·(Ai×Bj) for(j,k)=(1,2),(2,0),(0,1). TC is direct delta·Uij.
The oracle does NOT use the new EA/EB/delta-cross factorization as its sole
truth. All SIGNED values are retained before abs. Gram21 and face-center6 are
ordinary direct component dots. A determinant sign error can otherwise be
hidden by support absolute values despite equal final N,D,S.

The direct capture then independently cross-checks its selected N,D,S and all
reports against an actual call to the unchanged old solve_model. M3 therefore
has18 own direct model loops plus18 old-source report checks,36 total model
executions and540 axis visits in its own ONE old Meter. Those are ORACLE-ONLY
diagnostics, not the candidate's18/270 census. All actual oracle integer work
uses that old Meter2M/16384bits. No interval, sqrt, old cold LP/QP or World call.
This doubles bounded oracle geometry checks deliberately, not candidate work.

## Actual candidate wire

Agreed Python CLI is gram_sat.py kernel REQUEST REPLY. Actual function is
evaluate_request(request,meter,deadline=None). The private R1 runner invokes
the SAME production compute function once per convention, which always builds
the actual tables and axis results. Standard solve_model uses that same compute
and drops diagnostics; there is no test-mode formula or oracle reconstruction.
The runner shares ONE unchanged old Meter across all9 calls/18 conventions.
Standalone fresh-context calls do not establish that global bank bound.

Each reply has EXACT protocol/status/reason/raw/normalized/stats. Protocol is
p4-gram-sat-kernel-v1; expected status CERTIFIED_PAIR_GRAM, reason null. An
unexpected UNRESOLVED ends the bank. Each model snapshot has EXACT:

```
{tables:{AAupper:[6],BBupper:[6],AB:[9],faceCenterA:[3],faceCenterB:[3],
         TA:[9],TB:[9],TC:[9]},
 axisResults:[15 {axis,axisDen,margin:null|{N,D,S}}],
 report:{firstExactMinimum,exactTiedMinima,axes:[15 old classifications]},
 minimum:{axis,N,D,S}}
```

All table/axisDen/N/D/S values are canonical signed integer decimal strings
(axisDen,D,S positive). AA/BB order is00,01,02,11,12,22. AB uses i,j; TA uses
r,j; TB uses i,r; TC uses i,j, all row-major with the approved cyclic signs.
axis is a structural integer in original order0..14. An exact-zero axis has
margin NULL, retained actual axisDen, exactZero true,nearParallel false and
marginSign null. It is not a fake N0,D?,S0 radical. Nonzero N0 remains a real
margin and has sign0. Minimum binds the exact first chosen nonzero-axis result.
No independent scalar feature selection is replaced by this exact winner.

stats has exactly integerOperations,peakIntegerBits,axisVisits,
conventionProblems. Across reached prefix k, axes30k and conventions2k.
Operations/peak are cumulative monotone, total≤2M/peak≤16384. No reset,
fallback, larger integer, extra precision, support-radius cache, cross-frame
reuse, axis pruning, Node SAT port or per-pair IPC. Source/runtime freezing
proves actual instrumentation; output counter consistency alone does not.

## R1 immediate prefix auditor

Root runs after EACH reached candidate call, before the next:

`python3.13 -B audit.py REQUESTS ORACLE REPLIES_PREFIX FRESH_OUTPUT`

REPLIES_PREFIX is exactly `{format:"p4-gram-sat-results-v1",replies:[1..9 actual replies]}`.
The auditor authenticates source/tool/manifest/bank/literal/input-word pins.
It verifies actual SIGNED TA/TB/TC and face-center values BEFORE consuming
absolute supports/minima, then all Gram values, all15 N,D,S/axisDen/null slots,
every report/minimum/tie/order/classification and complete snapshot schema.
Each integer output is independently canonical/range checked, with exact string
equality to the separately frozen old DIRECT oracle. This is not a residual
tolerance or a same-code comparison to new factorization. The auditor calls
neither direct oracle nor old geometry/candidate; it only rebuilds small frozen
input literals and checks stored expected values and actual snapshots.

Prefix status EXECUTED_PASS_PREFIX_GRAM_SAT has complete false. Only all9 cases
produce EXECUTED_PASS_EXACT_GRAM_SAT_BANK,complete true,verifiedPrefix9,
verifiedConventions18,verifiedAxisSlots270,verifiedGramCoefficients378,
verifiedFaceCenterCoefficients108,verifiedSignedMixedCoefficients486.
Failure is EXECUTED_NO_GO_GRAM_SAT_BANK,nonzero exit,firstFailure{type,reason}
and active reached case. Prefix PASS is never a full-bank PASS.

Output protocol is p4-independent-gram-audit-v1. PASS also records
requestPin/oraclePin/repliesPin and finalStats. candidateCallsByAuditor,
directOracleCallsByAuditor,geometryCallsByAuditor,coldQpCalls,WorldCalls are0.
No expected values enter candidate calls. A failed prefix stops remaining cases.

R1 includes all9 calls and9 immediate audits/setup/IO/cleanup under ONE170s
internal/180s external guard. A helper's local170s alarm cannot restart the
parent clock; the runner clamps each child to remaining time. M3 is separate
before source/generated-bank seal. There is no pure-bank cost decision.

## Fixed resource boundary and later obligations

All files≤2MiB,total new evidence≤16MiB. Combined64MiB remains parent24,
reference32 including8MiB scratch,transport/encoding/hash8. Before raw read,
the reference reserves file bytes; before JSON decoding it reserves the
conservative lexical object bound. Cumulative reservations plus scratch must
fit32MiB. JSON structural separators≤16384,depth≤32,metadata integer tokens
≤16characters. Tool/source authentication streams64KiB chunks. Native JSON
nonfinite values are rejected. The old broken retained walker is not copied
or called; no observed graph/allocator/RSS peak is claimed by this reference.

M3 separately reserves8MiB for its fixed9-case oracle graph/construction and
8MiB for bounded integer/vector/encoding scratch before model work. The graph
contains972 table integers, at most1080 axis-denominator/margin integers and54
minimum integers converted to strings, plus fixed reports/word pins. Each
serialized integer has a symbolic fixed-bank bound2000bits (≤603 magnitude
digits); signs/dictionary/list/encoding space remain within the declared
reservations and2MiB output cap. There is no general arbitrary-rational input
program or security-limit change. The9 dyadic descriptors have depth≤4,small
literal numerators/denominators and bounded powers. A wrong/out-of-profile
candidate result is not granted more space or an expected-resource exemption.

The retained-walker correction/meaningful ownership fixtures are a separate
NEW source prerequisite for a future full Gram validator. Nothing here edits
or retimes the ended V3 B. All old sources/oracles and geometry32-force versus
position36-row distinctions remain. After R1, a future full6 campaign still
needs independent native/geometry/scalar/axis/tie/KKT/strict RNE/width/one-apply
checks against the immutable full bank, then its single fixed cost decision.
Exact Gram identity alone does not prove completion, CPU gain or whole1200-step
feasibility. No World/API/baseline/mobile/deploy claim follows from this bank.

PINS.json fixes this folder, the approved design/review and immutable old direct
geometry source plus existing Python3.13.5 bytes. Root's outer freeze pins
PINS itself, generated M3 files and candidate/harness closure separately.
Author AST/JSON/hash checks are not M3/R1 execution or PASS.
