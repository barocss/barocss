# Positive primitive-axis reduction

For g=gcd(Ux,Uy,Uz)>0, let V=U/g. Each signed center projection and each
support numerator is divided by g exactly. Thus signed margin numeratorM
becomesM/g, while U·U becomes(U·U)/g². The normalized physical margin
M/(D*sqrt(U·U)) equals (M/g)/(D*sqrt(V·V)) exactly. g is positive, so orientation,
signed classification, first minimum and exact ties are unchanged. Scalar
selection/normal/point/tie construction remains the original separate Float64
function and never sees these diagnostic integer vectors.

Near-parallel classification is NOT invariant if one drops g but retains the
old axis denominator. The original zero/near-parallel expression therefore
runs first, using originalU and denominator. Only after those labels are saved
does the new primitive method reduce nonzero axes. Existing support/minimum/
radical code then consumes V. If g<=1, the same tuple and original square are
reused. All zero axes stay counted; no GCD is needed for their unchanged path.

The standard-library three-integer GCD is charged as one primitive operation;
three exact coordinate divisions are additionally charged only on a reduction.
Operands/result remain guarded16384-bit integers. Internal GCD runtime is not
claimed to be zero or separately counted Euclidean divisions: it is bounded
by input size and measured in full CPU. The original2M primitive-operation
cap and170/180s guard remain. No cache, new precision or adaptive tuning exists.

The exact old/new integer source transfer is in integer-source-transfer.json
and .diff. Position observer/verifier are byte-identical to the qualified source;
runner changes are separately recorded. Mathematical compatibility is audited
against complete saved physical replies, not by comparing these source comments.

The sole cost target is baseline core773147000ns versus candidate core at the
same observerIncludingCompactQpCpuNs boundary. Require candidate*10<=baseline*9
using integers. Whole process setup/output/audit costs remain separate. A passed
numeric but failed cost result ends this candidate under the frozen contract.
