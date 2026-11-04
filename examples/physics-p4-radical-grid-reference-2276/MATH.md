# Independent direct radical-grid review

Status: MATHEMATICAL_SPECIFICATION_ONLY. No candidate implementation was read.
No numerical/helper, materializer, reference, compiler, audit or World code was
run. Source/runtime/cost qualification is NOT_RUN for this new architecture.

## Exact interval theorem

Let x=N/(D√S), where N is a signed integer, D>0 and S>0 are integers. At a
declared precision p, put C=|N|²2^(2p) and B=D²S>0. Then

```
(|x|2^p)² = C/B.
q = floor(sqrt(floor(C/B))) = floor(|x|2^p).
```

For every nonnegative real y and nonnegative integer k,
k²≤floor(y) iff k²≤y. Therefore flooring the quotient before taking its
integer square root does not change the final integer floor. The complete
certificate is q²B≤C<(q+1)²B. Equality q²B=C gives the exact dyadic point
q/2^p. Otherwise the unique minimal closed grid enclosure is
[q/2^p,(q+1)/2^p]. For N<0 reflect both endpoints and reverse their order:
[-q/2^p,-q/2^p] if exact, otherwise [-(q+1)/2^p,-q/2^p].

For N=0 the interval is exactly[0,0], but D,S must first be valid. S=0 cannot
define this radical; only the separate prior semantics for an omitted exact
zero SAT axis can avoid a radical call. A nonzero axis is never pruned by this
new formula. Negative S, zero/negative D and undeclared precision are invalid.
The only allowed precisions remain64,128,256,512,1024,2048. No added precision,
fallback, cache, axis selection or winner comparison is part of this theorem.

Existing SAT winner comparison already uses signed square comparisons. Its
unchanged complete15 axes under both models is a separate boundary. This new
theorem changes the interval construction only. New protocol/algorithm metadata
must be explicit; old interval-certificate byte identity is not claimed.

## Bounds must precede each allocation

The old16384-bit intermediate and2M integer-operation caps remain. Each
square/product/shift/sum has its own conservative precheck. In particular,
check |N|² and its2p-bit shift, D² and multiplication by S, q+1, both q squares
and their products by B. Division requires B>0. Quotient0 must give q0 without
calling an inherited positive-only square-root routine. A mathematical result
can fit while its conservative prebound refuses; retain that typed refusal.

C and B fitting the cap does NOT bound the upper certificate product. It can
require up to two additional bits. An exact-grid case also keeps the declared
upper verification before an equality return; there is no exception to the
frozen certificate-operation order.

The two fixed resource controls are established symbolically before execution:

1. N=2^8191,D=S=1,p64 gives C=2^(16382+128)=2^16510,
   which has16511bits. The numerator square fits; the subsequent shift must
   refuse before allocation.
2. N=2^8127,D=2^4095,S=2^8192,p64 gives C=B=2^16382,
   each with16383bits. D² has8191bits, S has8193bits; their conservative bit
   sum is16384. The shifted numerator square also fits. Here q1 is an exact
   point, and q²B fits, but(q+1)²B=2^16384 has16385bits. Its conservative
   product bound is3+16383>16384. The old product prebound must refuse;
   returning the exact point early would change this declared control.

These controls are input descriptors, not generated numerical receipts. They
do not authorize larger temporaries in candidate or reference code.

## Declared Newton iteration boundary

The implementation specification retains the old integer Newton recurrence:
for positive t, start x0=2^ceil(bit_length(t)/2), then
xnext=floor((x+floor(t/x))/2), stop when xnext≥x, and verify both square bounds.
Quotient0 bypasses this positive-only routine. This is specification review,
not a source inspection or a new isqrt implementation in the reference.

Let r=√t. The initial value satisfies r≤x0≤2r. As long as an iterate stays
above r, its relative excess after the real Newton step is at most half the
square of its prior relative excess. Integer flooring cannot increase that
upper bound. Thus after14 updates the absolute excess is less than1 for
t<2^16384, since r<2^8192 and the relative bound is2^(1−2^14).
If flooring has already crossed r, the iterate is floor(r). Otherwise it is
at most ceil(r); at most two more updates reach/recognize floor(r). Hence the
declared64-update cap is ample for this recurrence and admitted t. This does
not prove that all terminal square products pass their independent bit guards.
The cap, exact stop test and final square verification remain required.

## Independent oracle method

The reference does not compute a quotient followed by isqrt as its floor
oracle. Root's materializer searches for the largest nonnegative integer k
with k²B≤C by bounded binary search and exact integer-square comparisons.
It then independently checks both endpoint inequalities and exact equality.
The oracle refuses before a forbidden operation; resource controls have their
literal, symbolically proved expected refusal and are not evaluated past it.

The binary64 presentation oracle separately searches ordered positive finite
IEEE words using exact rational dyadics. Comparing a nonnegative rational a/b
with |x| reduces to |N|²b² compared with D²S a², with independent prechecks.
Once two adjacent words bracket the value, compare their exact midpoint by
the same square relation and use the even significand at equality. Reflect
the sign afterward. Mathematical N0 presents positive zero. The oracle checks
the exact radical against both boundaries of the chosen RNE cell, including
midpoint equality and parity. It never seeds the candidate with a word/root.

The old independent six-frame physical Float64-word bank remains required
later. A small pure radical bank is not its replacement, a complete SAT proof,
a whole runtime cost result or a forecast for1200 steps. Root alone performs
all actual generation and execution after freezing the sources and literals.

## Minimal grid and physical presentation are different gates

A correct minimal interval at a fixed p need not fit the strict binary64 RNE
cell. In particular the nonzero q0 cases at p64 enclose the radical in a much
wider interval than its Float64 cell. The oracle records that fact as false,
not as an interval error. Its exact-RNE-tie case has a correct even-word result
and a point interval on a cell boundary; it does not pass a strict interior
test. Closed tie inclusion is recorded separately from strict containment.

`gridIntervalInRneCell` means both grid endpoints are STRICTLY inside the
chosen cell; `gridIntervalInClosedRneCell` additionally permits the appropriate
even-word ties. `radicalStrictlyInside` is a separate check of the radical
itself. The exact-zero case records its declared canonical-zero rule separately.
These annotations do not relax physical acceptance. A complete backend must
still use the existing precision table, strict RNE-cell test, saved six-frame
Float64 words and1e-25 width gate, and refuse if no table entry qualifies. No
new precision, closed-cell substitution or tolerance increase is authorized.
