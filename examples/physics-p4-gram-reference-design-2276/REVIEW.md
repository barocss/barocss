# Independent Gram and mixed-determinant review

Status: READ_ONLY_MATHEMATICAL_DESIGN. No new candidate implementation was
read. No numerical/model/helper/reference/audit/compiler/World call was made.
No implementation or bank-generation source is authored here. Existing sources,
banks, full V3 math PASS, revoked graph measurements and ended cost results
remain unchanged. Root alone can authorize later source and actual checks.

Reviewed specification: physics-p4-gram-design-2276/DESIGN.md,
SHA2560dee0daef07512b6425af6fd99efb3cc6e786da90876f266c7b1b3caf76761ec.

## Mathematical result

The proposed factorization is valid for arbitrary integer vectors, including
raw nonorthogonal bases. It does not require a unit quaternion, orthogonal
columns or unit column norms. Approval is conditional on exactly preserving
the old represented-body preparation, coordinate lifting and operation guards.

For one pair and one convention, write the integer columns A0,A1,A2 and
B0,B1,B2 with original positive denominators da,db. Common-lift extents are
hA,hB and center difference is delta=CB−CA, with coordinate denominator2^t.
Define AAij=Ai·Aj, BBij=Bi·Bj, ABij=Ai·Bj, Q=da·db and D=2^tQ.

For a face Ai:

```
S = AAii
supportA = Σk hA[k]|AAki|
supportB = Σk hB[k]|ABik|
center = |delta·Ai|
```

For a face Bj:

```
S = BBjj
supportA = Σk hA[k]|ABkj|
supportB = Σk hB[k]|BBkj|
center = |delta·Bj|
```

For a cross axis Uij=Ai×Bj, Lagrange's identity gives
S=AAii·BBjj−ABij²=Uij·Uij≥0. No raw orthogonality enters this identity.
The same integer numerator in all15 slots is

```
N = supportA·db + supportB·da − center·Q,
physical margin = N/(D√S).
```

These are EXACT N,D,S identities, not equality after a homogeneous rescaling.
Do not divide columns/axes/coefficients by a GCD, normalize them or simplify D.
The original axis order is A0,A1,A2,B0,B1,B2, then Ai×Bj with i outer/j inner.
Near-parallel axis denominators remain da,db,Q respectively.

## Signed mixed coefficients

Let EA=(A1×A2,A2×A0,A0×A1), EB=(B1×B2,B2×B0,B0×B1).
Define TA[r,j]=EA[r]·Bj, TB[i,r]=Ai·EB[r],
TC[i,j]=(delta×Ai)·Bj. There are9+9+9=27 signed mixed values.

The A-support projections Ak·Uij over k are:

|i|k0,k1,k2|
|---|---|
|0|0,−TA[2,j],+TA[1,j]|
|1|+TA[2,j],0,−TA[0,j]|
|2|−TA[1,j],+TA[0,j],0|

The B-support projections Bk·Uij over k are:

|j|k0,k1,k2|
|---|---|
|0|0,+TB[i,2],−TB[i,1]|
|1|−TB[i,2],0,+TB[i,0]|
|2|+TB[i,1],−TB[i,0],0|

All signs in the proposed cyclic tables are correct. The crucial identities
are Ak·(Ai×Bj)=(Ak×Ai)·Bj and
Bk·(Ai×Bj)=Ai·(Bj×Bk), not Ai·(Bk×Bj). Center projection is
delta·(Ai×Bj)=(delta×Ai)·Bj with the OLD delta=CB−CA orientation.

All support and center projections later enter absolute values. Therefore
matching final N,D,S alone cannot detect some wrong global determinant signs.
The R1 gate must compare signed27 coefficients and signed face-center6 before
abs, plus Gram21 and every original axis result/report.

## Independent oracle boundary

The OLD DIRECT algorithm is a suitable distinct algebra oracle: explicitly
construct each of the nine Ai×Bj vectors, then directly dot each with Ak,Bk
and delta. It does not use the new A-pair/B-pair/delta-cross factorization or
the Lagrange determinant as its sole source of S. Direct S is Uij·Uij.

To obtain the signed oracle TA without copying the new factorization, select
the corresponding direct projection Ak·Uij for(k,i)=(1,2),(2,0),(0,1).
For TB use Bk·Uij for(j,k)=(1,2),(2,0),(0,1). TC is the direct delta·Uij.
Faces and Gram entries use ordinary exact direct component dot products.
All15 direct supports, unchanged extent weights, N,D,S and axis denominators
then come from the old direct equations. The selected first minimum, exact
ties, zero/near/sign reports must also match the unchanged old solve_model.

Reuse of the exact OLD Float64 decoder/Hamilton body preparation is explicitly
AUTHENTICATED_GEOMETRY_COMPONENT_REUSE, not a newly independent native geometry
oracle. The old direct equation sequence is different from the new pair-local
factorization even when both use the same exact-integer primitives. This R1
test proves a bounded algebra substitution; it does not replace the immutable
independent cold full physical words, scalar/selection/KKT and later full6 test.
Candidate snapshots must be actual values from its production Gram function,
not values recomputed by the direct oracle inside a test adapter.

## Zero, parallel and bound conditions

S must be nonnegative. A negative determinant is a typed error, never clamped.
S0 retains the old omitted-zero-axis semantics and report; no fake zero margin
or radical call with S0 is introduced. A near-parallel axis with S>0 remains
visited and eligible under the existing exact S·10^24<axisDen² test. The scalar
Float64 selector remains separate and unchanged. No exact winner seeds it.

AAii·BBjj and ABij² can each exceed16384bits while the direct cross cancellation
would fit. Precheck each operation and preserve typed refusal. Do not compute
first or fall back to the direct algorithm. The mixed determinant factorization
can also change peak operand sizes and eager work on zero-axis cases. A final
identity does not prove that every admitted input completes under2M or16384bits.

The tables are coefficients local to ONE pair and ONE convention, discarded
before the next. Fresh extent weights are applied per axis. No saved radius,
cross-pair/frame cache, Float64 basis assumption, axis pruning, altered Meter,
extra precision, Node SAT port or per-pair IPC is authorized by this design.
Static operation counts are not CPU or speedup evidence. A future full result
still needs one fresh complete physical/independent bank and the fixed cost
decision; the ended794129000ns result is not resumed or retimed.

## Fixed R1 bank proposal: nine represented box pairs

This is a pre-execution proposal for Root approval, not generated input bytes.
All values below are exact dyadic numbers. No trigonometric seed or computed
decimal approximation is used. epsilon=2^-42. Identity q=(0,0,0,1).
Default extents are(1/4,1/4,1/4), default center0 and both kinds dynamic.
Body IDs are literal a,b. The swapped final case keeps the actual IDs of the
bodies and reverses their order. No case ID or expected label enters candidate.

|Index|Case|A state|B state|
|---|---|---|---|
|0|coincident identity|defaults|defaults|
|1|exact face touch|defaults|center(1/2,0,0)|
|2|separated/unequal weights|center(−1/8,1/4,−1/2), extents(1/4,1/2,1/8)|center(7/8,0,−3/8), extents(1/2,1/4,1/4)|
|3|exact cyclic rotation|extents(1/4,1/2,1/8)|center(1/8,−1/4,1/2), extents(1/2,1/4,3/8), q(1/2,1/2,1/2,1/2)|
|4|half turn/signed center|center(−1/4,1/8,−1/8), extents(1/4,3/8,1/2)|center(−3/8,1/2,−3/8), extents(1/2,1/4,1/8), q(0,0,1,0)|
|5|raw nonorthogonal A|extents(1/4,1/2,1/8), q(1/2,1/2,1/2,1/2+epsilon)|center(1/8,−3/8,1/4), extents(1/2,1/4,3/8)|
|6|both raw bases nonorthogonal|center(−1/8,1/4,−3/8), extents(1/4,1/2,1/8), q(1/2,1/2,1/2,1/2+epsilon)|center(−3/8,3/8,0), extents(1/2,1/4,3/8), q(1/2,−1/2,1/2,1/2−epsilon)|
|7|near-parallel but nonzero|extents(1/4,1/2,1/8)|center(1/8,3/8,−1/4), extents(1/2,1/4,3/8), q(0,0,2^-50,1)|
|8|body/order reversal|EXACT body B from case6, ID b|EXACT body A from case6, ID a|

Each raw/normalized convention is required separately. For the raw skew
quaternion above, physical raw columns A0/da=(0,1+epsilon,−epsilon) and
A1/da=(−epsilon,0,1+epsilon) have dot product−epsilon(1+epsilon).
Thus the actual INTEGER Gram entry is AA01=−da²epsilon(1+epsilon)≠0. Treating raw Gram
as identity is therefore detected. Its norm²=1+epsilon+epsilon² stays within
the unchanged1e-9 quaternion admission; the negative-epsilon variant similarly
has norm²=1−epsilon+epsilon². These statements do not normalize engine inputs.

For qB=(0,0,2^-50,1), cross axes A0×B0 and A1×B1 are nonzero and their squared
physical length is of order2^-98, below1e-24. They must retain a near-parallel
label and remain eligible. An exact parallel axis is still present on z. The
coincident/touch/separated cases distinguish zero center, zero N and zero S.

All9 pairs are normal admitted-body cases. No resource refusal is an expected
PASS for this bank. A future artificial large-integer boundary test would need
its own separately approved algebra-only scope; this proposal adds no such hook.
Conservative coefficient bounds for these literals are far below16384bits:
old preparation uses quaternion lift exponent≤50; taking every basis integer
and denominator below2^104 gives Gram products below about2^421, mixed/weighted
numerators below2^425 and signed-margin comparison products below2^1700.
This is a symbolic size estimate, not an executed counter or a general-profile
completion guarantee. Every actual guard and global2M Meter still applies.

## Proposed closed wire/result schema before source authoring

Root-only future materialization uses exact dyadic descriptors, emits canonical
native JSON Float64 body numbers and separately pins every input Float64 word.
No numeric conversion is performed by this author. Candidate receives only:

```
{op:"gram-bank", cases:[{a:<body>,b:<body>}, ... nine ordered pairs]}
body = {id,kind:"dynamic",shape:{kind:"box",halfExtentsM:[3 Float64]},
        positionM:[3 Float64],orientation:[4 Float64]}
```

Body IDs are actual geometry IDs, not oracle case labels. Oracle IDs, expected
snapshots and input word pins remain in a separate file. The private adapter
must invoke the SAME actual production Gram function, with ONE original Meter
shared across all9 pairs/both conventions, limit2M and no reset. Complete
census is18 convention problems and270 original axis slots. Transport/string
formatting remains explicitly scoped under the old Meter meaning and total
CPU/time bounds; no unmetered mathematical work can be hidden in serialization.

Proposed per-convention snapshot has closed keys:

```
{gramAA:[6],gramBB:[6],gramAB:[9],faceCenterA:[3],faceCenterB:[3],
 mixedTA:[9],mixedTB:[9],mixedTC:[9],axisResults:[15],report:<old report>}
```

All table numbers are canonical signed integer decimal strings. Packed Gram
order is00,01,02,11,12,22; AB,TA,TB,TC use row-major order under the definitions
above. Each axisResult has {axis,axisDen,margin}; axisDen is the unchanged
canonical positive integer string. margin is null for an exact-zero axis,
otherwise {N,D,S} with canonical signed N and positive D,S. Report contains the
unchanged firstExactMinimum,exactTiedMinima and15 ordered classifications.
Source review must prove these are actual computed table/axis values.

Complete totals are378 Gram coefficients,108 signed face-center projections,
486 signed mixed coefficients,270 axis slots and18 complete reports. Every
reached value compares exactly against the separate old DIRECT oracle before
the next case. An unexpected refusal, sign/table/denominator mismatch, dropped
axis or report difference is first NO_GO. Candidate never receives expected
values. Exact reply protocol/CLI/status strings remain a Root/High interface
freeze item; this design does not silently finalize an unagreed executable API.

Future oracle generation and candidate+immediate audit are separate bounded
protocols, each170s internal/180s external,2MiB per file,16MiB evidence and the
unchanged64MiB combined ownership plan. No bank is generated and no test/core
implementation is authorized by this document alone.

## Separate retained-walker prerequisite

The frozen ended V3 validator is not edited or retimed. A NEW validator version
must use actual key/value references rather than temporary entry tuples in an
ID-deduplicated walk, and include Fraction numerator/denominator ownership or
an explicit bound. Meaningful ownership fixtures should cover distinct nested
dictionaries, shared references counted once, equal-but-distinct objects,
Fraction integers, dataclass storage and a predeclared auxiliary/node refusal.
Expected ownership must come from an independently enumerated strong-reference
fixture list and pinned object sizes, not a second copy of the same walker.
Walker auxiliary data and raw buffers must be reserved before growth/read.
These are separate new-source resource tests, not geometry/model calls or a
reason to inherit an old B PASS. Parent24+audit32+transport8 remains64MiB.
