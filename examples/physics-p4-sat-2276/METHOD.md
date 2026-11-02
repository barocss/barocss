# Integer SAT model and remaining boundary

For represented quaternion q=Q/D, raw rotation uses denominatorD² and
diagonal numeratorD²-2(Qj²+Qk²). The normalized observer uses denominator
S=sum(Qi²) and diagonalS-2(Qj²+Qk²). Both use off-diagonal
2(QiQj±QkQw). This is algebraically the same two geometric conventions as the
old observer, not an assumption that represented q already has exact unit norm.
Original finite shape/position/quaternion bounds and1e-9 norm admission remain.
No engine quaternion is normalized or modified.

For each pair, centers and half extents share dyadic scaleC. A body's three
basis columns share its positive integer denominatorDa orDb. An axis is an
integer vectorU; its positive scale is retained for near-parallel classification
but cancels from physical support and margin. Face axes are the three columns
from each body. The remaining nine are their integer cross products.

Let SA=sum(HAi*abs(NAi·U)), SB=sum(HBi*abs(NBi·U)), and
T=abs((CB-CA)·U). The physical signed overlap is

```
M / (C*Da*Db*sqrt(U·U)),
M = SA*Db + SB*Da - T*Da*Db.
```

No Fraction/GCD or Decimal rounding occurs in that construction. Compare signs
first. For two nonnegative margins, compare squares by positive cross products;
reverse the result for two negative margins. Exact equal margins use the first
axis in the original15-axis order. Norm-zero and near-parallel classifications
are exact integer comparisons. The original observer excludes only exactly
zero axes; its1e-12 near-parallel label does NOT remove a nonzero axis. The
different Float64 fresh_query1e-12 skip policy is not substituted here.

A bounded integer Newton square root encloses sqrt(U·U) at fixed dyadic
precisions. Integer quotient/remainder then encloses the margin in dyadic units.
The returned interval is outward, not a best-effort estimate. Signed absolute
differences are enclosed from both convention intervals. Precision advances
only through the frozen table when BOTH interval endpoints do not round to the
same binary64 word. Exact nearest-even dyadic conversion handles subnormals.
The independent observer uses Fraction and adjacent binary64 words to verify
the whole interval lies inside the saved answer's rounding cell; it imports no
candidate SAT or interval formula. Wrongly narrow intervals remain a candidate
correctness risk: the saved numeric word is the independent oracle, not the
candidate's self-reported winner or arithmetic certificate.

There is no independent full15-axis Decimal authority in the compact_pair
replies. Thus exact minimum-index identity, diagnostic ties within1e-12,
Float64 selected feature, oriented normal, support midpoint, legacy80/120
precision delta and complete raw-output equality remain unqualified. They
cannot be fabricated from saved selection metadata or reported as PASS.

This micro has substantive exact support/minimum arithmetic, but is deliberately
not a production replacement. Any resource/rounding mismatch stops the corpus;
an incomplete prefix is not a speed or full-coverage result.
