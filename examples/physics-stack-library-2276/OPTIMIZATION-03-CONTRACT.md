# Divisible-denominator exact addition, candidate03

Status: SOURCE_AUTHORING_ONLY_NOT_EXECUTED. Root alone runs arithmetic,
imports, compilation, tests, physical observers and runtime diagnostics.
Preserve OPT02 source78b052 and its runtime failure at returned1066/local1065,
all raw frames and prior OPT01/original failures. No old timing is repeated or
relabeled. This is a bounded actual-library change, not an offline proof port.

Change ONLY Arithmetic.add in package stack/strict-line.ts. Keep this.op first
and the existing equal-denominator branch unchanged. For remaining positive
canonical denominators, charge one existing integer tick BEFORE each actual
remainder. Test a.d%b.d first. If zero, charge one tick BEFORE the actual
integer division k=a.d/b.d, check k's bits, then return
make(sum(a.n,multiply(b.n,k)),a.d). Otherwise test b.d%a.d; when zero, similarly
return make(sum(multiply(a.n,k),b.n),b.d), k=b.d/a.d. If neither divides, run
the original cross-product numerator/denominator fallback unchanged.
An explicit both-positive guard encloses the two new divisibility tests.
Nonpositive unsupported denominators take the original fallback; the existing
equal-denominator branch is not changed or broadened.

No zero, integer, GCD, LCM, cross-cancellation, extra cache, precision, tolerance,
iteration or resource-cap change. Each actual remainder/division has the SAME
unit tick price as existing make's Euclidean remainder/normalization division.
No phantom old multiplications or unperformed GCD work are charged. Branch tests
are fixed control work, as existing comparisons/sign/zero tests. Quotient uses
checked; scaled numerator uses multiply; raw sum uses sum, all BEFORE make.
There is no pre-reduction or fallback after a guard failure.

## Independent equivalence and limits

All internal make/from/neg outputs have canonical denominator d>0. If
da=k*db, then an/da+bn/db=(an+k*bn)/da. The converse is
(k*an+bn)/db. These are identities over signed integers; make produces the
same unique reduced rational and unchanged number/RNE result when both paths
complete. Nondivisible fallback and equal-denominator behavior are unchanged.
For positive admitted denominators, remainders are nonnegative and smaller
than the checked divisor; an extra remainder bit inspection is unnecessary.
The positive quotient is <= its checked numerator denominator and is checked
again explicitly. Multiplication and raw addition retain existing bit guards.
No public Rational input or lowered/raised test context is introduced.

Resource refusal parity is NOT universal. D=2^8193, da=D, db=D/2 gives exact
3/D from1/da+1/db. The old denominator product has16386 bits and refuses;
the new ratio2, numerator3 and denominator D fit. Declare this intended smaller
temporary calculation under the SAME16384-bit bound. Conversely, raw products
or sums exceeding that bound still refuse before normalization even if a later
GCD could reduce the answer. Resource failures are not false/positive geometry
answers. Existing rational200000/integer2000000 caps and OPT01 cache guards stay.

## Fixed25 arithmetic tests, before calls

Test actual production-context private m through a TEST-ONLY structural cast.
Use actual make/add/neg/number; no production export, synthetic result, counter
mutation, test mode or substitute algorithm. Root materializes powers only at
test execution. Each expected fraction below is independent literal algebra.
Immutable actual OPT02 canonical Native arithmetic is the differential baseline
where both complete. Old bit refusals in13/14 are deliberately different.
IEEE words below are unsigned MSB-first, separate from physical F64LE archives.

1. Equal path:2/7+3/7=5/7.
2. First divisibility path:1/8+1/2=5/8.
3. Converse path:1/2+1/8=5/8.
4. Composite denominators:1/12+1/3=5/12.
5. Reverse4:1/3+1/12=5/12.
6. Signed first path:−7/12+1/3=−1/4.
7. Reverse6:1/3−7/12=−1/4.
8. Zero through existing converse formula:0/1+3/8=3/8.
9. Reverse8:3/8+0/1=3/8.
10. Neither divides, shared factor:1/6+1/10=4/15.
11. Coprime fallback:1/2+1/3=5/6.
12. Existing equal cancellation:5/7−5/7=0/1.
13. D=2^8193:1/D+1/(D/2)=3/D, new success; old integer bit refusal.
14. Reverse13, same new result/old refusal.
15. N=2^16384−3:N/6+4/3 MUST refuse raw sum2^16384+5 before make.
    Both operands are canonical. The eventual GCD3 could reduce it, but that
    is not permission to bypass the raw guard. Old also refuses its earlier
    larger cross product. Exact refusal is StrictLineFailure/integer bit limit.
16. Reverse15, exercise the converse raw-sum guard; same bit refusal.
17. 1/2+(2^16383)/1 MUST refuse scaled product2^16384 before the sum.
18. Reverse17, same scaled-product bit refusal.
19. Q=2^16383:1/Q+1/1=(Q+1)/Q. Maximum admitted quotient fits16384 bits.
20. Reverse19, same exact result in the converse branch. No RNE call is needed.
21. Fresh context, actual neg of canonical zero until rational work refusal,
    at most200001 calls. Subsequent add(1/8,1/2) must still refuse rational work.
22. Fresh context, repeat actual add(1/178,54/89), at most200001 calls, until
    integer work refusal. Every completed sum is109/178. The new first branch
    has10 Euclidean remainders, two normalization divisions, one denominator
    remainder/division, one scaled multiply and one sum:16 integer ticks/add.
    Integer cap is reached before rational cap. Both operand orders must then
    refuse integer work. Keep actual attempted counts; never mutate/reset caps.
23. 1/1+1/2^53=(2^53+1)/2^53; RNE even-lower word3ff0000000000000.
24. 3/2^53+1/1=(2^53+3)/2^53; RNE even-upper word3ff0000000000002.
25. 1/2^1074+1/2^1073=3/2^1074; subnormal RNE word0000000000000003.

The existing19 boundary tests remain unchanged. Require fresh Source/genuine
Native all3 one-step/16-step physical checks and exact original32-point keys,
order, normals, onA/onB witnesses, all point/body words and full physical reports
against actual OPT02. Honest arithmetic work metadata may differ only at its
exact exposed paths, never as a subtree exclusion or broad numeric exception.
Root alone decides any fresh immutable canonical runtime diagnostic afterward.

Archive exact OPT02 source at baseline/strict-line-opt02.ts BEFORE edit. Leave
original PROVENANCE and OPTIMIZATION-01/02 untouched; OPTIMIZATION-03 separately
pins old/new source, this contract and actual baseline artifacts. Full independent
1200, public profile/body-cap admission and complete-path resource qualification
remain BLOCKED. No speed claim, retime, new offline framework, mobile or deploy.
