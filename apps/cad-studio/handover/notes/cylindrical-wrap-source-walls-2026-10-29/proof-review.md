# D310 formula and boundary review

This is the implementing agent's source/math review, supported by a separately implemented
arithmetic test oracle. It is not a new independent agent review or product/browser proof.

For one directed quadratic span, let H_i=(w_i*x_i,w_i*y_i,w_i). Exact dyadic alignment writes
H_i=(X_i,Y_i,W_i)/D with positive power-of-two D. Radius R=a/b>0 is exact. Define

    A_ij = (X_i*X_j + Y_i*Y_j)*b^2 - a^2*W_i*W_j.

The degree-four Bernstein coefficients of Q=Nx^2+Ny^2-R^2*W^2 have common denominator
3*b^2*D^2 and numerators

    [3*A00, 3*A01, A02+2*A11, 3*A12, 3*A22].

This follows from the generic Bernstein product factors choose(2,i)*choose(2,j)/choose(4,i+j).
Writing E for the largest absolute numerator and m for the minimum integer W_i gives

    |radius(t)-R| <= max|Q|/(R*min(weight)^2) = E/(3*b*a*m^2).

No square root approximation is needed: radius(t)+R>=R. The native linear threshold and
2*delta<R are exact rational comparisons. In particular no point is the origin. Normalizing
a point to the exact radius changes its Euclidean distance by at mostdelta, and L1 distance
by at mostsqrt(2)*delta<=2*delta.

The quadratic angular polynomial K=Nx*Ny'-Ny*Nx' has degree-two Bernstein coefficients

    [2*cross(H0,H1), cross(H0,H2), 2*cross(H1,H2)].

Their integer numerators divide by D^2. Strict positivity proves directed angular increase.
A separately chosen integer normal from(1,1),(-1,1),(-1,-1),(1,-1) must have strictly positive
dot with every homogeneous pole. Thus the complete rational span lies in one open half-plane
and its increasing argument advances less thanpi. One connected exact four-span endpoint
cycle then has winding1, not merely four local positive tests. The start vertices must be
distinct and the derived successor chain must visit all four spans and return to its start.

For each admitted original wall S(U,V)=(C(U),z0+(z1-z0)*V), the radial dot of the canonical
normal S_U cross S_V is positive height times C_x*C_y'-C_y*C_x'. Actual face sense determines
the sign. Local directed parameter t has original U scale+0.5 or-0.5; hence the certified
positive directed K implies radial outward face orientation on each span. The positive
parameter scale factor is irrelevant to the sign. Knots may retain unequal one-sided speeds.

Trust boundary: only buildCylindricalWrapWallReference creates a combined receipt, from the
actual fresh frozen D309 reference. The coefficient helper is a private continuation over
caller-owned operands and a live ledger; it proves only XY coefficients and has no producer,
B-rep topology, cap, native evaluator or mass authority. Direct deep imports are not public
package APIs. Its test context is an oracle harness, not a product aggregate budget proof.

Caps and vertical world edges are not requalified by horizontal ownership checks. A simple
source wall defines a mathematical prism with an abstract cap domain, but does not by itself
prove that each stored rounded cap pcurve has that domain, that a stored shell is exactly
watertight, or that mass from an ideal circular reference belongs to the stored wrapped body.
The wrapper's false flags preserve these distinctions.
