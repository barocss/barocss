# Invariant GCD independent audit addendum

Status: AUTHOR_ONLY_NOT_EXECUTED. Root alone runs the fresh G0 protocol. This
folder changes no original bank, reference, witness checker, evidence or limit.
The author reads contracts and saved data only, not candidate/native code.
Author checks are AST, JSON structure and hashes; no arithmetic/helper run.

## Exact authority

Use the existing executed bank, byte for byte:

`../physics-p4-gcd-reference-2276/evidence/bank-01/`

The three files are requests.json, oracle.json and manifest.json. PINS.json in
this folder pins each original file and all independent source dependencies.
The harness can copy these files only if bytes/SHA remain exact. Do not run
math.gcd or the old materializer again. Candidate input remains ONLY the exact
requests.json `{op:"gcd-bank",cases:[{a,b}]}` with32 canonical signed decimal
pairs. Oracle IDs, expected gcd and signed Bézout coefficients never enter the
candidate. No arithmetic expected value or case is changed after a failure.

The old32-pair specification, source/tool pins, digit/bit bounds, independent
greatestness proof and resource limits remain the reference authority. The old
oracle's accelerationCoverage label is preserved historical data; it is not a
requirement that this new algorithm accelerates or implements a Lehmer block.
Earlier actual Lehmer G0 PASS and physical ALIGNED16 2M refusal are retained.
This audit cannot erase them or authorize StageB after a failed StageA.

## New algorithm admission

This is an explicitly NEW guard policy, not an unchanged-guard claim. The
candidate GUARD-POLICY.md separately overrides only the old repeated GCD REM
operand/result bit-inspection clause. Entry checks bound nonnegative a,b. When
b>0, the mathematical Euclidean remainder satisfies0≤r=a%b<b. Replacing the
pair with (b,r) preserves the initial magnitude bound and nonnegative values;
each nonterminal step strictly decreases the divisor. No larger remainder is
allocated by this operation. This induction applies only to the declared
GCD-loop remainder path. It does not remove checks for other REM operations,
products, shifts, rational normalization, input conversion or output formatting.

Root must review and freeze the actual guard policy/source closure before the
call. An output counter alone cannot prove the actual code's induction premises,
guard placement, primitive pricing or absence of an unmetered path. This
independent audit checks output arithmetic and reported census consistency;
Root source/harness authentication is separate required evidence.

## Interface and exact checks

CLI with the existing pinned Python:

`python3.13 -B audit.py REQUESTS ORACLE CANDIDATE_REPLY FRESH_OUTPUT`

All output files use exclusive creation. All binary authentication is streamed
in64KiB chunks, including the110MB Node binary. This folder has no generator.
The data-only `literals.py` is an exact source copy of the frozen literal
expansion function, used by Root's auditor solely to authenticate request
identity. It neither invokes a GCD solver nor creates a new oracle.

Expected reply has exactly the same seven top-level fields:
protocol, status, reason, gcds, failedCaseIndex, proofCounters, privateStats.
New protocol is `p4-invariant-gcd-bank-v1`. Success status remains
`EXACT_GCD_BANK_CERTIFIED`, reason and failedCaseIndex null, and32 gcd strings.
UNRESOLVED is first NO_GO, with no partial-bank PASS.

Private stats are exactly `{guardedGcdEntries,invariantRemainders}`. A complete
direct32-pair bank must report guardedGcdEntries exactly32. Require
invariantRemainders>0 and invariantRemainders=proofCounters.gcdRemainders;
gcdRemainders must remain a subset of operationCounts.REM. There is no
acceleratedBlocks field or acceleration requirement. Counts are actual source
observations, not a fixed expected performance workload or credits.

All original independent arithmetic checks remain: exact oracle string equality,
canonical nonnegative gcd/zero, exact input divisibility, magnitude bounds,
one-zero semantics, bounded canonical signed u,v and exact u·a+v·b=gcd. Both-zero
requires gcd=u=v=0. The identity plus divisibility proves greatestness without
the auditor solving a GCD. Identity products are checked BEFORE allocation,
bit sums≤16385; the final addition uses max product bits+1≤16385. Input/result
magnitudes≤8192bits and2467digits. Literal cases/ordering are unchanged.

The auditor reconciles the unchanged price identifier, complete operation and
phase keys, weighted priced sum (DIVMOD2, other original primitives1), phase
sums, attempted=performed≤2000000, denied null, resetCount0, fixed zero
non-GCD dimensions and prepare/kkt/compare phases. Input/reduced bit peaks≤8192,
intermediate≤16385. Reported counters do not establish source wiring by
themselves. Guard-policy changes are named separately from unchanged prices.

PASS output status is `EXECUTED_PASS_EXACT_GCD_BANK`. Failure status is
`EXECUTED_NO_GO_GCD_BANK` with firstFailure and nonzero exit. Audit output
protocol is `p4-independent-invariant-gcd-audit-v1`. Other result fields match
the previous independent audit, with new privateStats and coverage text.

## Fixed execution boundary

Fresh G0 is one32-pair context with ONE global2M meter and no reset. Only a
complete G0 PASS permits fresh separate StageA10; only a complete StageA PASS
permits separate StageB6. No World/API/baseline/mobile/deploy calls. This is
neither a complete runtime-cost PASS nor a forecast for1200 steps.

Bounds remain170s internal for the entire G0 protocol,180s external,2MiB per
file,16MiB new evidence,64MiB explicit retained data. A helper's local170s alarm
does not restart the parent's clock. Harness clamps every child to remaining
time and owns aggregate evidence/retention accounting. JSON depth≤16 and4096
lexical container/separator tokens are inspected before allocation. Metadata
integer tokens≤16characters. The old retained-data reservation remains32MiB
bank/serialization,8MiB arithmetic/container scratch,16MiB evidence ownership,
8MiB terminal/IO reserve; this is not a process-RSS claim. Literal expansion has
≤32768 Fibonacci iterations across64 operands; verification has≤64 remainder
checks,64 certificate products and32 sums. No new gcd invocation, search,
precision tuning, limit increase or candidate rerun is added by this folder.

PINS.json authenticates the original bank and old reference sources, the new
audit/literal/support/contract bytes, and strict existing Python3.13.5 and
Node22.19.0 bytes. Root's enclosing freeze must pin PINS.json itself plus the
candidate's completed GUARD-POLICY.md, source and harness. The latter are not
read by this independent author. All actual statuses remain NOT_RUN here.
