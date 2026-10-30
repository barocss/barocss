# D311 proof review

This is the implementing agent's source/mathematical review, supported by independent generic
fraction/Bernstein test arithmetic. It is not a separate agent review or product proof.

## Cap map

The checked cap affine maps have nonzero determinant plus/minus4*R^2 and exact constant Z.
The rational pcurve has positive weights and its entire hull is inside[0,1]^2. The normalized
four-span proof supplies W>0, strict directed angular progress, an open half-plane per span,
exact cycle joins and winding1. Thus both cap images are radial disks. Bottom/top transposition
and opposite uses prove their world images agree with opposite outward normals.

D310 proves the original wall cross-section is a radial graph with the same cyclic span
parameters. On each corresponding edge, actual cap lift and original world curve have the
same basis, weights and parameter domain. The prior exact affine coefficient residual bounds
their whole-curve L1 distance. Radial extensions s*P(t) and s*C(t), 0<=s<=1, are each injective
away from the identified center and cover their respective disks. Their paired map preserves
boundary parameter, orientation and adjacency; its distance is s*|P(t)-C(t)|<=the same residual.
This proves source reference closure without assuming literal stored boundary equality.

## Wrapped decomposition

Source wall coordinates(theta,z) are globally one-to-one around the identified seam. A strict
interior UV rectangle maps to one angle/Z rectangle. The material radial extent is rho(theta)
outside that rectangle and2*rho(theta) inside it. Its boundary consists of two reference caps,
the retained two source walls, one outer rectangle and four radial sides. These patches meet
only at prescribed boundaries. At source knots, outward orientation is piecewise with positive
one-sided limits; C1 seam regularity is not required.

The actual base pcurves are exact unit lines between the original rectangle endpoints. For a
side parameter(t,r), the reference side is(diag(1+r,1+r,1))*C(pcurve(t)); the stored side is the
same map applied to the actual base curve B(t). D301/D304 freshly check its actual coefficient
binding, and the base residual bounds |B-C|. Hence the side model L1 error is<=2*baseResidual.
Bottom/top sides have respectively negative/positive Z normal; right/left sides have positive/
negative angular normal. Exact UV order and actual forward face senses enforce those signs.
The outer Surface is an exact binary scaling of the original quarter; its trim is the same
rectangle. Original coefficients, identifiers, weights, senses and tolerances remain intact.

The fresh native family D0 bound covers the actual Surfaces. Add it once to each exact model
map error on the admitted face trim domain. This is a position association, not a native D1,
Math.hypot, renderer clipping or literal watertightness theorem.

## Mass transfer

The formal angle endpoints are evaluated from the same actual source quarter. The original
wall angle is strictly monotone, so the UV rectangle and formal sector cover the same angle
interval. Both use exact affine Z. Consequently the two bodies differ only by radial extent:
s*rho(theta) versus s*R, with the same s in{1,2} at every angle/Z. Since |rho-R|<=delta,

    |s*rho-s*R| <= 2*delta,
    radial integration coordinate <= 2*(R+delta),
    |z-zCenter| <= H/2.

For d=a+b, bound the absolute integrand x^a*y^b by radius^d. The polar Jacobian contributes
one more radial power. The angle range is at most2*pi, with pi<4, and Z length isH. This yields
2^(d+5)*H*delta*(R+delta)^(d+1)*(H/2)^c. Interval arithmetic propagates all ten enlarged raw
moments through density, centroid and the central inertia tensor. The final exact audit uses
the actual Number dyadic, not an ideal midpoint. A tighter arithmetic-only budget is tested
to pass the formal calculation and refuse this complete geometry audit.

The independent oracle integrates a worst outward radial shell exactly with generic rational
powers and also compares the stated monomial bound. It independently propagates rational
intervals and recomputes all eleven public Number error distances. The cap oracle uses generic
Bernstein products/derivatives and exact affine lifting, not the production integer alignment.

## Trust and budget boundary

The combined constructor accepts only ordinary Part/components/options, snapshots them, then
executes one native-source construction. All consumed source, side, D0 and residual evidence
is produced synchronously inside that request. New continuations do not consume persisted
flags or certificates from the caller. Source work is retained once in the native ledger;
formal sourceOperations=0 records that no second source call ran. Prior old entries still run
their two source checks and retain their complete outputs/counts.

Entity indices are per request over immutable actual arrays. Their construction checks unique
IDs, and both construction and lookup work are charged. Receipt fractions are exact positive-
denominator ratios; normalization is unnecessary and intentionally not promised. All primitive
integer results are sized under8192bits and charged. Accepted whole requests satisfy requested
operations<=200000 and work<=1048576. Existing bounded refusal checkpoints and legacy producer
Number-work accounting limits remain explicit.
