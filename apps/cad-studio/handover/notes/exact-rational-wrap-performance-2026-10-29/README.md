# D312 — Exact arithmetic removes the asymmetric wrap refusal

Runtime `7a1a462ca` fixes the D311 asymmetric case under the original limits. The complete
cap, closed-reference and mass request now uses 150147 operations, below 200000. Its mirrored
axial placement uses 150161. This is the same private rectangular reference profile as D311.
Literal stored B-rep closure/mass, native SI and Part/API/Model/Studio integration remain open.

## Cause

The rejected input is R10, H30, source Z[-7,23], original U[0.1,0.4], V[0.2,0.7],
height10 and density7.85. It still has nine faces and four pad edges. More faces are not the
cause. Non-dyadic decimal coordinates have long exact binary64 fractions, which make repeated
Euclidean reductions expensive. Generic 63-step float-code searches add work when converting
exact construction values to Numbers.

Before the fix, fresh native construction used 189532 operations. A separately measured
formal continuation used 29260, already totaling 218792 before the outer and closure proofs.
Those separate measurements are diagnostic; they were never counted as one accepted request.
The actual combined request refused with the original error:

    Formal pad mass: the aggregate source, rational, direct, or work limit was exceeded

The Number-candidate change alone reduced native/formal to172913/28414. The request still
refused. Exact dyadic normalization then reduced them to120515/15475, and the complete request
passed. No executed work is subtracted. All three stages are preserved in the phase records.

## Exact changes

`SectionRationalContext.rat` keeps input size, zero-denominator, sign and zero checks first.
A denominator of1 needs no reduction. For a positive power-of-two denominator, common factors
are exactly the minimum trailing powers of two of numerator and denominator. Removing those
factors by integer shifts gives the same signed reduced fraction as Euclid. Other denominators
retain the original Euclidean path. Input/output integer sizes and the new work stay counted.

`floorBits` retains the maximum-finite guard. It may propose Number(n)/Number(d), but accepts a
code only after exact rational comparisons prove equality or prove current<=value<next.
It tries at most three codes. Nonfinite operands, a nonfinite estimate or unresolved candidates
fall back to the unchanged whole-code binary search. The estimate supplies no proof authority.
`nearest` still compares exact distances and uses even-code ties; `upward` still returns the
least represented upper bound. Subnormals, signed zero and range/bit/operation limits remain.

No other production source changes. This shared helper also serves non-wrap modeling and
intersection paths, so validation includes the whole kernel and consumer suites.

## Preserved results and newly accepted cases

The original rational class from HEAD5926026c3 was saved before editing as
baseline-section-rational.mjs. Run compare-local.mjs from packages/barocss-cad to reproduce
the comparison after a full build. This archived class is diagnostic evidence only; production
and tests do not import it. A local A/B diagnostic
installed its unchanged prototype methods, ran each input, restored the new methods and ran
again in the same process. Object.is compares every Number, including negative zero. Every
changed path is recorded in equivalence.json. Only counts, phase counts, component/start counts
and actual remaining child reservations differ. All geometry, names, fractions, mass values,
error bounds, meaning flags and other result fields match for the four previously successful
complete requests. For the two former complete refusals, the separately successful native and
formal results match in all non-ledger fields. No old complete receipt exists for those inputs.

| Complete request | Before operations | After operations | After work |
|---|---:|---:|---:|
| Standard Z0 | 196425 | 137555 | 294509 |
| Centered Z-5 | 195846 | 136559 | 292153 |
| Lower axial pad | 199120 | 137149 | 293620 |
| Upper axial pad | 199168 | 137153 | 293620 |
| Asymmetric Z-7 | BUDGET | 150147 | 319917 |
| Mirrored asymmetric Z-7 | BUDGET | 150161 | 319755 |

The original 200000-operation,1048576-work,8192-bit and scalar accuracy limits are unchanged.
All six requests pass the independent cap Bernstein and raw-moment/returned-Number error
oracles. Both new inputs retain nonzero signed mixed moments. These cases do not prove that
all possible rectangles will fit the budget.

The same exact arithmetic also admits the former R100 source-inverse budget case at the
original0.01 tolerance. Its tests now verify original B-rep/quarter/Z preservation, owned
source separation, complete interpolation/endpoint error bounds and unchanged work caps.
The UV-only source still has no inverse authority; the full inverse runs its own proof.
Invalid source and exact-total-minus-one refusal tests remain active.

## Performance

Mandatory `scripts/perf-bench.mjs`, same machine, Node22, serial heavy gate, median of15 runs:

| Fixed workload | Before | After | Actual output |
|---|---:|---:|---|
| Asymmetric native bound pad | 27ms | 21ms | B-rep659784c1d1276574 SAME |
| Centered complete reference | 25ms | 22ms | B-rep3dc47a62fa4c37a6 SAME |
| Asymmetric standalone formal mass | 7ms | 6ms | properties4ee49b3a32aa9a46 SAME |
| Centered native bound pad | 22ms | 18ms | B-rep37a018051624ef8e SAME |

These local medians show12–22% reductions for the measured workloads. They are not Studio
latency or a hardware-independent speed guarantee. The newly accepted complete asymmetric
case has no successful pre-fix timing; its current median is24ms over15 runs, B-rep659784c1d1276574.

Two non-wrap controls used the archived baseline arithmetic and the current arithmetic in
separate processes, median7: tilted planar Boolean boxes23->21ms, fingerprint001f7199c2adf525
SAME; shaft thread583->578ms, fingerprint63f2e23cc5a7c377 SAME. The thread difference is small
and does not support a meaningful speedup claim. No generic-workload regression was observed
in these two controls. See general-perf-before.txt and general-perf-after.txt.

## Validation and review

All commands used Node22.19.0 and one heavy run at a time:

- Full kernel build (TypeScript) and lint/code-shape PASS; counts remain119/32/273/75.
- Focused arithmetic/wrap/native-D0 set185/185 PASS,0 FAIL;1923.703167ms.
- Whole kernel2185 total,2179 PASS,0 FAIL,6 existing SKIP;303930.136292ms.
- Whole Model1824/1824 PASS,0 FAIL/SKIP;256806.58325ms.
- Whole Studio365/365 PASS,0 FAIL/SKIP;23568.789167ms.
- Generated agent-tools/refusals checks PASS without regeneration. API inventory is unchanged,
  SCOPED_PASS for its six named rules. Docs PASS:68 pages,53 shots,852 labels.
- Sol Medium ran Model then Studio. No production source changed while those suites ran. The parent ran
  kernel/measurement/generated checks. All final receipts apply to the committed runtime.

Consumer type checks and browser flow were NOT RUN. No product wrap route was added. The
new accepted private closed-reference profile retains all D311 literal-B-rep/provider/product
false flags. See validation.json for commands and proof boundaries; measure.mjs reproduces the
six current construction/mass receipts from packages/barocss-cad after the full build.

The new independent arithmetic tests compare generic Euclid and a whole binary64 code search.
They cover signed dyadic/mixed fractions through8192 bits, non-dyadic and unreduced inputs,
normal/subnormal boundaries, adjacent codes and both signs of exact ties, largest finite
values, a finite estimate two codes above the floor, overflowed Number operands and exact
fallback, zero/denominator/bit/range/operation guards. No source checksum is used.

GPT-6.1 Sol High read-only source review found no P0–P2 issue. Its suggested two-code correction
case is included and passes. See review.md for the review scope and original capacity retry.
Original failed expectations, the test ID mismatch and first comparison-ledger classification
failure remain unmodified in the adjacent files. See diagnostics.txt for exact causes and fixes.

Next D313 connects this bounded reference to Part/provider/API/Model/Studio with actual
physical/trim/render admission and product validation. Broader roadmap07 work precedes08->09.
No push, PR, release, dependency, WASM, lockfile or schema change.
