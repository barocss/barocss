# Exact compact observer protocol

New record = old compact physical/scalar payload minus precisionMaxDifferenceM,
plus satCertificateV2. Unknown old fields are an error. Reusing original scalar
function bodies retains the Float64 arithmetic contract, original1e-12 skip
and support cutoff, strict first minimum, diagnostic ties, signed zeros and
support midpoint. The new exact SAT winner never supplies scalar features.

Raw quaternion basis uses original represented q without normalization.
Normalized basis uses integerR=N/sum(Q²), as in qualified integer_sat revision02.
Exact support and signed-square winner comparisons cover all15 axes, including
counted exactly zero axes and labeled nonzero near-parallel axes. There is no
per-query cache, old Decimal geometry call, Fraction/GCD support arithmetic or
QP call. Body preparation remains scoped to the current frame stage.

Each of six consumed values has a dyadic enclosure [L,H]/2^p. A candidate word
is accepted only if BOTH endpoints round to it and the entire interval is
strictly within that word's own adjacent-word cell. Independently require
(H-L)/2^p<=1/10^25. This is an absolute error certificate in physical metres,
not merely a binary64 output-width claim. For the existing represented threshold
g=Float64(1e-12), high<=g proves a gate, low>g disproves it, and overlap is
unresolved. No gate is decided from a rounded center estimate.

The saved-word observer still checks the full interval against independent
authority. A second observer checks exact interval width and gate implication.
Every scalar selection/ties leaf must match old saved output with the same
type, layout and IEEE word; no subset filter hides unexplained differences.

The certificate records interval values, frozen precision, all-axis counts and
classification diagnostics, physical gate results and explicit removal of the
old algorithm-specific precision field. It does not claim Decimal80/120 was
executed. Exact all-axis predicates remove internal roundoff uncertainty; the
consumed radical quantities have explicit rigorous errors. Separate32-point
line geometry, physical phase/quality reference and total cost are unchanged
future checks, not covered by this compact-only protocol.
