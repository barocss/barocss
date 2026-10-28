# D305 exact native proof headroom — 2026-10-29

Runtime: 21510468ff3f267d3c55d8c146d5e0480e862866. This change reduces duplicate exact arithmetic in the private D304
fixed one-pad proof. It adds no Part/Model/API/Studio wrap or physical-solid/mass qualification.

## Arithmetic and ownership

Admitted same-bit finite coordinates have exact zero discrepancy. Native point and endpoint
residuals skip only that redundant conversion/subtraction/addition and charge comparisons.
Opposite signed zero follows the previous path. All endpoint axes equal still call q.rat once
to return an independently owned normalized fraction; a new mutation test covers that branch.

Only family output conversion changes. Every unchanged fixed128 axis/L1 error is checked
nonnegative, dyadic with denominator dividing2^128, bounded numerator and <=the original
represented1e-7 floor. Number(n)/Number(d) is nearest in the proved normal range; an exact
comparison and at most one positive IEEE successor give the same least upper Number as
generic q.bound. No result feeds back into the recurrence. All guards, integer sizing and
IEEE conversion primitives are charged. Independent review found five missing comparisons
per bound; the final candidate conservatively precharges all seven sign/dyadic/zero guards.
No operation cap, bit cap, work cap, tolerance, coefficient or public export changes.

## Prior-build differential and performance

The mandatory existing perf-bench.mjs now has one fixed native-bound-pad case: fresh actual
R10/H30 cylinder atZ=-5, U[.125,.375]xV[.25,.75], one no-hole pad, height10. It times the full
source/assembly/side/D0/binding request and returns its actual B-rep to the existing harness.

RUNS7 median: before25ms, initial candidate26ms, final guard-complete candidate25ms. The last
run follows the accounting correction, not a changed workload. These rounded local medians
establish no stable speedup or Studio-latency benefit. Fingerprint37a018051624ef8e is unchanged.
The before/after strict shapes, sorted names, counts, diagnostic stored-B-rep volume and
centroid are identical. Diagnostic mass here does not qualify physical/literal B-rep mass.

Exact operations fall197043->179287, work386199->363775, maximum bits1178 unchanged for that
benchmark. The prior D304 standard U[1/16,5/16],V[1/4,3/4],Z0 request falls196857->179831
operations, leaving20169 of the unchanged200000 cap; work362233, maximum bits1187. These
fixtures differ and their counts must not be combined. No future closed-reference/mass fit
follows from either remaining allowance.

Full native result Numbers are encoded by all64 IEEE bits, preserving signed zero. Geometry
and every proof field match the prior build except the13 explicitly listed changed ledger
fields; exact fraction text, least-upper Numbers, binding errors, source slots, tolerances
and false flags match. The six prior legacy outcomes/counters and five standalone D0
complete receipts/counters match. Actual family result excluding only counts matches.
These are result differentials, never source-checksum unit tests.

## Verification boundary

Node22.19.0 final build/lint/code-shape pass. Focused42/42 passes (503.31425ms).
Final whole kernel2143 total/2137 pass/0 fail/6 existing skips passes (246165.733042ms).
Generated tools/refusals and unchanged API six-rule SCOPED_PASS pass. Docs pass68pages/
53shots/4488KiB/852labels. The earlier full pre-accounting candidate also passed2137/0/6;
only the final guard-complete result qualifies the current source. Both timing runs are retained.

Model/Studio/types/browser are NOT RUN for D305: no consumer or public wiring changes. Latest
whole consumer suites/types remain D299 runtime901b4ce45: Model1824/1824, Studio365/365.
No push, PR or release. Next D306 validates the separate formal native-cylinder+annular-sector
mass intervals and actual returned-number audit before closed-reference/product integration.
Actual B-rep global closure, physical-solid mass transfer and general glyph wrap remain open.

Two setup failures preceded the final checks. The first shell used zsh readonly variable
status after the successful before timing, so only the remaining shape/receipts were rerun.
The first source patches were invoked from the package directory, found no file and applied
no source hunks; they were reapplied from the designated repository root. Diagnostics are
retained adjacent; neither failure was a passing test or a geometry result.
