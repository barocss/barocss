# Pre-execution implementation addendum

This addendum is frozen with the source/pins before any actual import or test.
CONTRACT.md/json remain the earlier unchanged design freeze. This file states
the concrete boundaries selected while implementing it; it is not an execution.

The fixed bank is controls.test.mts,32 Node tests. Cases1–10 are analytic
one-/two-body core cases including exact weights/vertex/edge/zero and static
signed-zero metadata. Cases11–22 cover unsupported graph/motion/normal/mass,
invalid IDs/accessors and the tiny-population production refusal. Case23 is
an ALGEBRAIC transfer-matrix greedy trap only: actual globally feasible
geometric/Float-coordinate trap NOT_PROVEN. Cases24–25 reject negative and
exact singular triangles. Cases26–29 use independent IEEE word literals and
actual unmutated integer/rational/bit exhaustion. Case30 uses actual asymmetric
rounded endpoint arms in a two-body core and requires exact global balance.
Cases31–32 are the unchanged authenticated actual ALIGNED32 fixture and repeated
full result determinism, plus the original independent Float verifier/oracle.
Fixture SHA da088aeff200bdcfe27927f11286e8a9f6a63f772c6f5558ae11feb2e9d769eb.

The example-only adapter computes the ORIGINAL rounded scaled-A stationarity
diagnostic without QR: same Float arm/cross, sqrt24 diagonal multiplication and
row-order sum. It exposes no fake QR stats. Candidate's own diagnostic is named
maxUnscaledMassWeightedResidualSqrtJ; it does not claim to equal old scaled-A.
Rows/certificate zeros in the adapter refer to the actually certified zero
returned state. Independent rounded-impulse reconstruction still has to pass.

Integer-operation accounting includes all arithmetic used to construct/solve/
normalize exact values (add,multiply,divide,remainder,negate,shift), including
GCD remainders and mathematical absolute value used by GCD/RNE. Bit inspection
and decimal/hex formatting are explicitly REPRESENTATION work, not counted as
extra integer arithmetic: check's sign-to-magnitude for text and number()'s
bit-length strings. They remain performed and bounded by the checked operands,
not described as absent CPU/allocation work. IEEE bitfield decoding is fixed64
bits and likewise separate, as declared in the earlier design. Counters are
candidate-specific actual-operation counters, not parity with old QR budgets.

Inert input copy is bounded8192 occurrences/depth12, arrays64, record keys12,
before dependent reads; accessors/symbols/custom prototypes refuse. The numeric
core does not accept callbacks. Unexpected thrown values propagate. A malformed
input may have copied partial input bodies in its refusal result; no refusal
result is usable or committed state. Only success supplies ratios/certificate.

Transport is explicit IEEE64LE numeric-word sidecars. For every saved
{problem,result}, Source/Native controls also emit problemWordsF64leHex and
resultWordsF64leHex in structural number-leaf order. JSON alone loses-0.
checker.restore_words(value,hex) reconstructs finite numeric leaves, rejects
every nonzero numeric mismatch, allows only zero sign restoration and requires
complete word consumption. Bounds:16384 words/depth64/262144 occurrences. It
accepts JS Number integer-valued floats for stats, never bool as a number.
The production problem has363 numeric leaves. The CLI REQUIRES both word
sidecars, restores BOTH inputs, then calls verify. The pure verify function
operates on already-restored values supplied by its caller.

checker.verify(problem,result,expected_dynamic=8) is serializable and performs
only independent coefficient-word reconstruction, Fraction global matvec,
momentum/row checks, exact ratios/RNE and metadata checks; no triangle selection
or numerical solve is copied. It validates exact sidecar/endpoint/point/stats
keys, strictly true certificate booleans, reduced ratios, canonical dynamic+0
and static/position/inertia words. Ratio decimal parsing uses short chunks and
does not change CPython's process-wide integer-string limit/security settings.
Success/valid violation is resolved:true/executionFailure:false; invalid schema,
provenance, ratio, state or unavailable success is unresolved execution failure.
Global balance violation has ok:false. Diagnostic true-lever and rounded
residuals remain separate from exact Float-J stationarity; old physical gates
remain necessary. Input ratios<=16384bits and<=32 rows bound independent
Fraction intermediates, but no new global DATA/RSS or allocation claim is made.

The full runtime owner may later piggyback this additive check on its existing
world request in the SAME prepared Python process. This module adds no process,
fifth RPC operation or alteration to the original four math operations. That
wrapper/adoption is Root/Medium owned and requires its own source freeze.

Runner ownership was explicitly transferred to Root before run.mjs creation.
Root must authenticate unit-source.ts equals the formatted production source
except type import relocation and the final single test export statement.
Node22 genuine NodeNext compile+Source bundle each run all32, then independent
Python over all saved successful core/actual receipts, Source/Native value+word
identity, complete source/tool before-after pins. Root owns run.mjs/seal later.
No actual execution by author and no bridge/public adoption is implied.
