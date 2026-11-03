# Exact dynamic construction and proof obligations

## Frame and signs

Take n along the reported A-to-B direction, derived from the actual normalized-Hamilton native cube face. Form the other two native cube axes t0,t1 in ascending local-axis index order. For the current local-Y face these are localX and localZ. Their handedness is immaterial to dot products; their order and signs remain bound to actual native metadata. All three axes are rational, exactly orthonormal, and recomputed from actual quaternion words. The rounded public normal is used only in separate presentation/old observer gates.

Let r=p-C, where p and C are converted to rationals before subtraction. Let u be the actual free contact velocity of B relative to static A before warm/application. In the world frame `K=I+6*((r dot r)*I-r*r^T)`. In frame `[n,t0,t1]`, write K as `[[k,c],[c^T,D]]` and u as `[un,ut]`. An impulse J has frame `[N,T]` and final contact velocity `u+KJ`. Thus normal closure gives `N=(-un-c*T)/k`. The Schur complement `A=D-c^T*c/k` is SPD and `b=ut-c^T*un/k`; final tangential velocity is `v=b+A*T`.

Require exact `un<0`, k>0, SPD K/A, positive sticking N, and `k^2>qD*(c dot c)`. The latter ensures `k-mu*c*e>0` for every unit tangent direction e, because mu=sqrt(qD). For any physical sliding direction, `N=-un/(k-mu*c*e)>0`. This is a feasibility guard, not a uniqueness theorem. Coulomb's normal-closure law is not the cone-constrained minimizer of the quadratic work functional; do not substitute that optimization problem.

For the fixed intended frame, the earlier independent model gives `k=251/128` and `c=(-120,-96)/128`. Because the actual positive0.7 word is less than1, `251^2=63001 > 120^2+96^2=23616 > qD*(120^2+96^2)`. Thus the intended fixture satisfies the normal-denominator guard analytically. Actual-input reconstruction must still confirm these values. This does not establish the number of dynamic roots.

## Compact root domain

The beta construction from the static design is correct: `T=-beta*v`, `v=(I+beta*A)^-1*b`, and `N=(-un+beta*c*v)/k`, beta>0. Its polynomial is `k^2*beta^2*(z dot z)-qD*(-un*d+beta*c*z)^2`, with `d=det(I+beta*A)` and `z=adj(I+beta*A)*b`. Squaring loses a sign, so all positive roots need filtering.

Use a compact parameter instead of an unbounded beta interval: `s=beta/(1+beta)`, in(0,1). Let

```
M(s)=(1-s)*I+s*A
d(s)=det(M(s))
z(s)=adj(M(s))*b
Y(s)=s*z(s)
H(s)=-un*d(s)+c*Y(s)
y(s)=Y(s)/d(s)
T(s)=-y(s)
N(s)=H(s)/(k*d(s))
v(s)=(1-s)*z(s)/d(s)
Q(s)=k^2*(Y(s) dot Y(s))-qD*H(s)^2
```

M(s) is SPD throughout[0,1], so d>0 there; prove this from exact A, not a sampled determinant. Q has degree at most4. At s0, `Q=-qD*un^2<0`. At s1, y=A^-1*b and N equals the exact sticking load. Exact static infeasibility makes Q(1)>0. Both endpoint values are nonzero in this lane. The continuous unsquared residual `k*|Y|-mu*H` is negative at0 and positive at1 when the sticking N is positive. Therefore an interior physical root exists. At such a root H>0 and Y is nonzero; if H=0 then Q=0 would force Y=0, impossible for b nonzero. Nonzero b follows from the admitted infeasible sticking target. These observations establish existence, not uniqueness.

For any s in(0,1) with Q=0, H>0 and Y nonzero, the formulas give N>0, v nonzero and `T=-(s/(1-s))*v`. Positive antiparallel sign is automatic. The squared cone equality then restores the unsquared equality because both sides are positive. Normal closure and the Schur equations hold algebraically. Conversely, any sliding solution with N>0 and v nonzero yields beta=mu*N/|v|>0 and exactly one s in(0,1). Thus the admissible polynomial roots and physical sliding solutions are in bijection. No root outside(0,1), with H<=0, or with zero slip is accepted.

## Exact root count and finite isolation

Clear rational coefficient denominators once with checked integer products and primitive-content removal. Preserve the polynomial sign. Trim genuine leading zeros; do not assume degree4. Compute gcd(Q,Q') exactly. A nonconstant gcd is an explicit MULTIPLE_ROOT_UNQUALIFIED refusal for this first algorithm, not a reason to divide away multiplicity and claim robustness. Use an exact signed polynomial remainder/Sturm chain with verified recurrence. It has at most5 members. Never change a chain member's sign merely to make its leading coefficient positive; only positive rescaling preserves the sign-variation sequence.

Count every root in(0,1) by exact endpoint sign variations, ignoring zero chain values in the standard variation count. Q endpoint zeros already refuse. Split dyadic intervals left first. All exact integer Horner work counts toward the global meter. At a dyadic split with Q=0, retain that exact rational root and isolate the remaining open sides using exact one-sided sign limits; do not silently move the endpoint by one ulp. Root intervals must be disjoint, each count1, and the root counts must sum to the original count. At most4 root intervals are possible. Apply H-sign and nonzero-slip interval predicates to every interval. Refine only within the fixed global budget. Exactly one admissible root is required. Multiple admissible roots return AMBIGUOUS_DYNAMIC_ROOT even if one looks closest to the static target. No assertion of general friction uniqueness or of this input's actual root count is made before root executes independent generation.

## Presentation certificate

For the unique admissible root, maintain a rational closed interval inside(0,1). Outward rational interval arithmetic encloses d,H,z,ideal N,T,v and world J=N*n+T0*t0+T1*t1. Prove every divisor excludes zero. Refine until each finite binary64 result has one proved nearest-even rounding cell. Decode predecessor/current/successor words exactly; binade and subnormal cell widths must be handled correctly. An interval strictly inside a cell proves RNE. A boundary tie needs exact algebraic equality and the even significand; absent such proof return PRESENTATION_AMBIGUOUS. A component identically zero may return canonical+0 with exact polynomial identity proof. No forced zero, inward offset or selected neighboring word is allowed.

Independently present native N and world-native T for the private cache, but apply only the presented world J. Cache presentations need not reconstruct J through the rounded public normal. Enclose each presentation error against its ideal algebraic value. With the exact represented J, compute exact physical `uRep=u+K*JRep`, `NRep=dot(JRep,n)` and `TRep=JRep-NRep*n`. Bound square roots by rational lower/upper intervals whose endpoint squares prove containment. Certify old normal-speed, dynamic magnitude and antiparallel-slip gates from these represented values. Require the slip lower bound to exceed1e-10; denominators cannot be inferred from approximate slip. Also certify represented-cache T dot represented-public n within1e-12, and cache/J agreement within the existing impulse gates. Enclose work `u dot JRep+(JRep dot K*JRep)/2` and require nonpositive, without changing the old passivity gate.

This is a pre-application certificate for the physical matrix and the represented impulse. It is not a claim that the engine's quaternion-based inverse-inertia arithmetic is exact: the current apply path rotates to local coordinates, scales and rotates back even for an isotropic cube. The unchanged independent event ledger checks actual rounded body response, COM spin, work and final contact velocity after the real application. A failed actual check is preserved as physical NO_GO. No observer-derived producer wrench or second corrective impulse is permitted.

For the ideal solution, `J dot uFinal=T dot v=-mu*N*|v|<0`. Since `uFinal=u+KJ`, the ideal kinetic-energy change is `J dot uFinal-(J dot KJ)/2<0`. This gives a useful independent passivity identity. It does not replace actual midpoint-work accounting.

## Host seam

Extend a new private copy of the already qualified typed static stage. Keep the original static source/provider unchanged. The new target union is static or certified dynamic; both use one step-local target and the same actual-input binding, actual apply return and final-query guard. Dynamic cache fields contain the separately certified native N/T. Preserve64 slots and actual zero calls, all phase/producer events and rollback state. Do not use root isolation as a solver loop or rerun it from updated velocities. Future cache/warm/multipoint adoption remains unsupported. No implementation or execution is authorized by this design file alone.
