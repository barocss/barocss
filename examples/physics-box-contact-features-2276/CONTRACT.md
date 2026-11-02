# Private box contact feature prototype

Status: authored before candidate execution, 2026-11-03.

This is private algorithm research. No World, public API, production collision,
manifold, cache, solver, body limit, iteration count or dependency changes.
The actual public changing-plane tangent and paired-point failures remain
NO_GO. The original P4 eight-box exit remains NO_GO. This work does not resume
an old worker, full reference or trajectory.

Candidate input is two native boxes only: IDs, represented centres, XYZW
quaternions and half extents. It must not receive an expected point, normal,
feature or answer. The original 15 floating SAT axes, axis order, 1e-12 axis
skip/separation rules and strict-less tie selection are retained. The selected
axis carries face-owner/axis or edge-axis provenance. Native construction uses
the exact unit-normalized quaternion geometry, not an approximate face match.

A face winner references that face. An incident finite face is clipped against
unshifted native side planes, with the same exact sign for classification and
intersection. No tolerance inflation, extrapolation, fallback midpoint, nudge
or inward rounding repair is allowed. An edge winner uses finite support edges
and their constrained closest pair. Construction must certify both endpoints
against all six native halfspaces of each owning box. Failure returns typed
UNRESOLVED. It must not call production geometry.

The exact rational endpoints are primary native certificates. Binary64 endpoint
and midpoint words are their numerical presentation. Gates are surface/inside
1e-9 m and normal-line/midpoint residual 1e-12 m. For an overlapping integration
PRE, signed paired gap is allowed to be negative; it must match independent
native line exits. For an accepted touching pose, a successful active contact
also needs absolute paired gap <=1e-12 m. PRE construction does not certify an
accepted pose. Accepted geometry does not certify historical force moments.

Freeze at most24 box-pair cases and96 returned points per graph. Include saved
first/second accepted poses, their whole-step integration PRE poses, exact
axis-face/touch/separation/zero-cross controls, pair reversal and reflection.
The first integration PRE must select FACE, the second EDGE. Eight unaltered
ALIGNED:1 pair inputs and their32 original expected points are independent
population controls. Expected points are never candidate inputs. Do not drop
an original row to pass a check. Raw-word equality and movement are reported
separately; no movement permission is inferred from a distance gate.

All rational arithmetic has a frozen16384-bit operand/intermediate bound.
Euclidean GCD only reduces exact fractions; it performs no root/geometry
refinement. Candidate geometry has fixed face clipping and five finite-edge
closest-pair candidates; no precision retry or numerical iteration is used.
An exact-bound refusal is UNRESOLVED, not MISS. Independent Python observes
the raw case/output files without importing candidate arithmetic.

Root owns actual execution after source review and hash freeze. Source bundle
and strict NodeNext emitted graph must return identical raw outputs. Maximum
new evidence16MiB per graph, using the existing180s command guard. Every input
is written before its call and output before validation. Stop at the first
unexpected mismatch or refusal, preserving the prefix. A known edge refusal
can establish FACE_SUBSET_PASS plus EDGE_NO_GO only when frozen as such before
execution. No private PASS implies API integration, dynamics, wrench or P4 GO.
