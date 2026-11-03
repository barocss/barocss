# Position witness proof pricing 01

Status: STAGE_A_REVIEW_ONLY. No implementation or numerical execution is authorized by this file. Root must approve/freeze this file and CONTRACT.md first. Pricing is fixed before implementation; a later source cannot lower a price, omit a check, move mathematical work outside the boundary, reset a counter or enlarge a limit to obtain a result.

## 1. Boundary

One proof context owns one complete NEW checker request, from represented problem/native-result admission through independent coefficient/mass preparation, witness factorization, exact global KKT, rational-to-binary64 presentation and native-result comparison. It takes raw problem/result fields, not an old F.decode model, old Fraction, solved matrix, reference answer, cached factor or expected basis. The2,000,000-unit limit applies to that entire context, including rejected work. There is no phase/root/factorization reset. Ten StageA contexts and six StageB contexts have distinct reported per-request and aggregate counters; there is no claim that an aggregate of separate requests used only one request's allowance.

The limit is a NEW checked proof-primitive bound. It does not redefine the old compact SAT meter, the old LP/QP transition counts, the coupled-contact meter or CPU time. Compact V2 keeps its existing2M TOTAL SAT-operation allowance across StageB's432 compact records; no credits transfer. No new proof context invokes the old kernel/solve_exact or borrows its already-derived coefficients.

Bounded file/JSON transport decoding and source authentication are outside the proof meter and named separately. Conversion of every transported numerical field into the checker's own represented-word/exact value, all coefficient/mass preparation, native residual arithmetic and final exact-number formatting are INSIDE. If the unchanged full-world wrapper retains legacy guarded admission or post-HYP arithmetic, report those calls/costs as `legacyOuterArithmetic`, NOT as metered proof work. It must not supply mathematical inputs to the new proof. Its independently derived problem data must agree with the new checker's data before use in the outer physical audit. Those legacy costs remain inside StageB's common core CPU boundary. Never label this2M counter as a whole-world/whole-process arithmetic bound.

## 2. Reservation and prices

Reserve the fixed price BEFORE performing an operation. Increment `attempted` and the current phase's attempted count; if it would exceed2M, record the denied operation and halt WITHOUT performing it. Otherwise increment `performed`, phase-performed and the operation count, then execute. Successful requests have attempted=performed. On exhaustion attempted may exceed2M by the single denied price; performed never exceeds2M. No further proof arithmetic or formatting runs after refusal; bounded failure metadata uses its separate reserved output space.

These are prices per actual invocation, including invocations used only for prechecks. A comparison is not a free side effect of an arithmetic wrapper.

| Operation tag | Price | Meaning |
|---|---:|---|
| READ_FIELD |1| Read/validate a numerical scalar or witness index from the transported record. Repeated reads count if repeated. |
| READ_CHAR / WRITE_CHAR |1 per character| Parse exact decimal digits/emit exact rational decimal text; no uncounted int/string conversion. Bounded ID/schema text scanning is also counted when performed by checker admission. |
| READ_BYTE |1 per byte| Read each of the8 authoritative IEEE bytes during own word decoding. |
| ADD / SUB / MUL / NEG |1| One signed integer operation; required checks are additional charged operations. |
| CMP |1| One integer comparison, including zero/sign/limit/pivot/remainder checks; a three-way comparison takes the actual one or two comparisons performed. |
| BIT_LENGTH |1| One native integer magnitude bit-length inspection, including pre/post checks. |
| SHL / SHR / AND / OR |1| One nonnegative integer bit operation. Every variable left shift has a pre-allocation bound. |
| QUOT / REM |1| One integer quotient or remainder. No zero divisor. |
| DIVMOD |2| One paired quotient/remainder call; price2 is reserved atomically before either result is computed. |
| F64_CAST / F64_PACK |1| One finite native-number-to-binary64 conversion or fixed8-byte packing operation. Large exact rational conversion does NOT use this shortcut. |
| F64_FROM_SMALL_INT / F64_SCALE_POW2 |1| Final exactly bounded significand conversion (at most53 significant bits) or power-of-two scaling after integer RNE has already decided the significand. |
| F64_FINITE / F64_CMP / F64_ABS / F64_SUB |1| Each actually used finite check, comparison, absolute value or subtraction in original admission/comparison semantics. |
| F64_HYPOT3 |1| One fixed3-component native norm used solely by the unchanged normal/translation admission check; it is not an exact KKT operation. Its original physical cutoff is retained. |

All mathematical variable-size integer operations must use these wrappers. There is no standard-library Fraction construction/operator, math.gcd, matrix package, hidden decimal solve, determinant primitive or direct large-int float/string conversion outside them. A GCD is explicit Euclidean iteration: each loop comparison, REM, sign normalization and bit check is charged. `gcdRemainders` counts performed REM operations attributable to GCD in addition to their primitive charge, not a replacement price. Normalization is a diagnostic count; its actual GCD/divisions/checks remain priced.

Fixed limits, meter counters, array indexes and loop bookkeeping use bounded structural integers. They are not recursively charged as proof arithmetic; otherwise charging itself would recurse. They cannot encode coefficients or perform solution arithmetic. Their loops/containers are bounded in section4. IDs/field layout checks are bounded, not an unbounded user program. Timing, hash, source/transport IO and JSON metadata encoding are separately measured structural work; none is presented as free CPU.

## 3. Numeric admission and pre-allocation checks

The raw native problem/result uses finite represented binary64 numbers and small indexes; no caller-supplied rational coefficient strings or arbitrary integer program is admitted. Original9-body/8-dynamic/36-row profile and observed SOLVED-result shape are checked first. Raw result.basisRows is the sole untrusted witness. It is not sorted, deduplicated, repaired or replaced; reject noninteger/out-of-range/duplicate/unsorted indexes, rank/length or DOF mismatch. Native trace/counters are bounded admission data, never solve instructions or answers.

Every required scalar is charged READ_FIELD/F64_CAST/F64_FINITE. Pack its fixed8 bytes, charge every READ_BYTE and each actual shift/mask/sign operation, and construct its exact dyadic numerator/denominator inside the context. Preserve original input words separately. Mathematical rational zero has canonical0/1; do not invent missing historical zero signs or claim raw-word equivalence without the corresponding actual authority. Required mass reciprocals, A/b/W construction and both reconstructed/native KKT use the same priced context.

Every integer operand must already be bounded. Before a nonzero product require bit_length(a)+bit_length(b)≤16385; before a left shift require bit_length(a)+shift≤16385 and a bounded nonnegative shift. Before add/sub use the conservative bound max(bit_length(a),bit_length(b))+1≤16385. Zero/identity reuse may avoid an operation only after its actual charged checks and only when that operation is not performed. Refusal of a conservatively bounded expression is allowed; computing it first is not. NEG cannot increase magnitude. Quotient/remainder prechecks charge divisor-zero/sign tests and operand bit checks; their result bounds follow from bounded operands. Bitwise operands are nonnegative and use an inspected bounded mask. Charge post-operation BIT_LENGTH and check before retaining results.

Reduced rational numerator and positive denominator must each fit8192bits after explicitly priced normalization. Raw common-denominator/Bareiss temporaries fit16385bits; they are not mislabeled as reduced rationals. Rational division normalizes sign and checks nonzero denominator; every multiplication used for cross-products or comparison is prechecked. No hidden Fraction/gcd implementation is allowed. Resource failure is typed before application; there is no application in these protocols.

Exact decimal output uses bounded radix10^9 quotient/remainder chunks through DIVMOD, then WRITE_CHAR for emitted digits/sign/slash. Each reduced numerator/denominator has at most2467 decimal digits, checked from its8192-bit bound. An implementation may not replace these priced operations with an unmetered large-int conversion. RNE computes exponent/spacing, quotient/remainder and midpoint/parity decisions with the priced integer operations, including subnormal/overflow cases. It then performs only bounded significand conversion/scaling. Exact kernel fields remain authoritative if a finite binary64 presentation cannot be certified; this finite campaign treats that as a preserved refusal, not an altered word.

## 4. Finite algorithm and storage bounds

There are at most24 translation DOF,36 inequalities and24 witness indexes. Build the complete coefficient matrix; do not erase inactive/dependent rows. The only equality factorization is the witness Gram system G=A_S W^-1 A_S^T. W is independently derived positive diagonal dynamic mass. The complete problem is exact; the observed index set provides no trusted coefficient or solution.

Use checked positive common-denominator row scaling and one integer fraction-free Bareiss elimination of the augmented Gram system. All leading coefficient pivots are examined before native-result comparison. G is positive semidefinite; a linearly independent witness makes it positive definite. Positive row scaling preserves nonzero leading minors. A zero coefficient pivot therefore reports WITNESS_BASIS_DEPENDENT FIRST, even if the augmented RHS is inconsistent; do not reinterpret it as a different algorithm or search another basis. Every nontrivial Bareiss division must have exact zero remainder or refuse. Back substitution produces explicitly reduced rationals.

Source-level loop ceilings, independent of coefficient values:

- Coefficient cells≤36×24=864; witness extraction≤24×24=576 cells.
- Full Gram construction≤24×24×24=13824 summands, each at most two rational multiplications and one addition. Symmetry/sparse-zero reuse may reduce actual work only; charge every performed check/operation.
- Row denominator preparation touches≤24×25=600 augmented entries. No LCM/product is allocated before its bound check.
- One factorization,≤24 pivots,≤24×23×25/3=4600 trailing augmented-cell updates; each has two checked products, one subtraction and an exact division check. No row/basis/active-set search or second factorization.
- Back substitution≤276 off-diagonal products and24 divisions. Reconstruction≤24×24=576 summands.
- One full reconstructed primal pass≤864 dot terms; one full stationarity pass≤864 dot terms;36 complementarity products and24 objective terms. The separate native-result residual pass uses the same fixed maxima. Rounding/comparison touches only these bounded arrays and original fixed result fields.

Each Euclidean iteration consumes charged comparison/remainder operations and strictly decreases its nonnegative divisor. Any GCD of16385-bit bounded operands is finite; the global2M guard can refuse much earlier. Structural ceilings do NOT prove that every admissible8192-bit problem completes under2M. The guarantee is completion or typed bounded refusal, never unbounded work.

Before dense allocation, reserve proof scratch within the existing64MiB explicit-owned-data limit. At most two24×25 integer tableaux, the bounded matrices/vectors above, fixed operator temporaries and bounded exact-string output may be live. There is no retained search history, extra basis, cross-request memo or persistent cache. A concrete pre-allocation accounting table for the pinned Python/runtime object representation must be included in the source freeze; no execution is authorized if it is missing. This is an ownership bound, not a process-RSS claim. Request/reply≤2MiB; total new evidence≤16MiB, including failures; retain a fixed terminal-metadata reserve before large serialization.

## 5. Required counters and phases

`proofCounters` has exactly these fields: `pricing`, `limit`, `performed`, `attempted`, `phasePerformed`, `phaseAttempted`, `operationCounts`, `gcdRemainders`, `normalizations`, `factorizationAttempts`, `pivots`, `allRows`, `dynamicDof`, `witnessRows`, `peakInputBits`, `peakReducedBits`, `peakIntermediateBits`, `denied`, `resetCount`. Pricing is `p4-position-witness-primitives-v1`; limit is2000000; resetCount is0. The6 phase keys are `parse`, `prepare`, `factor`, `kkt`, `rne`, `compare`. Operation-count keys are exactly the table's individual tags, including separate READ_CHAR/WRITE_CHAR, QUOT/REM, SHL/SHR/AND/OR and F64 tags. All keys are present even if0. `denied` is null or `{phase,operation,price,attempted}`. Operation counts count only performed calls, so their priced sum must equal performed. Phase sums must equal the corresponding totals.

FactorizationAttempts≤1 and pivots≤24 per request. allRows/dynamicDof/witnessRows are actual admitted dimensions, not canned fixture values. Peak fields distinguish decoded input, reduced rational and raw intermediate values. A bit-limit failure records the checked/proposed bound without allocating the forbidden result. Terminal counters do not require additional proof arithmetic after denial. Root/harness reports call counts, per-request counters and campaign sums separately. Neither old proof work nor failed work disappears.

The170s internal deadline covers the whole protocol including authentication/setup/all requests/audits/output, with180s external guard and bounded cleanup. It is not restarted for each frame. In-process checks occur at bounded structural checkpoints and at most1024 charged units apart. StageA fresh children are clamped to the parent's remaining deadline. No deadline, bit, primitive, memory, reply or evidence bound is raised after a refusal.
