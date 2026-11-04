# Persistent friction cone design 01

This is the next private P03 input design, not an API qualification. The author does not execute a reference, build, geometry helper, or World. Root must finish the queued replay and Native prerequisites before freezing and executing this design. All earlier inputs, successful receipts, first failures, providers, tolerances, and solver iteration counts remain unchanged.

## Three frozen inputs

Use one fresh World and one step for each factor `f = 1-2^-20`, `1`, and `1+2^-20`. There are exactly three cases; no retry, parameter tuning, cache injection, or extra control World. The profile, private provider, and dispatch remain explicit prerequisites rather than an assumed public path. Gravity, initial angular velocity, restitution, and commanded forces are zero. The time step is the binary64 word of `1/120`. Both materials use static friction 1 and dynamic friction the binary64 word of 0.7. The uniform dynamic cube has mass 1, half extents `[0.5,0.5,0.5]`, and physical COM inertia `I=(1/6) Identity`.

The static floor has center `[0,-1/8,0]`, half extents `[1/4,1/8,1/16]`, and identity orientation. Its intended unique contact corner is `p=[-1/4,0,1/16]`. The intended cube contact pose is `C=[0,1/2,3/8]`.

Define one quaternion scalar `a` by stable 80/120-decimal-digit calculation followed by nearest-even binary64 conversion of `1/sqrt(258)`. Store `[a,0,a,16*a]`, with the power-of-two product exact. Normalized Hamilton geometry has exact cube axes:

- `t=(128,16,1)/129` (local X),
- `n=(-16,127,16)/129` (local Y),
- `s=(1,-16,128)/129` (local Z).

The source parser divides every quaternion component by one common magnitude. Correct binary64 rounding commutes with multiplication by 16 in this finite normal range, so it preserves `qx=qz` and `qw=16*qx`. Native Hamilton axes therefore do not depend on the resulting scalar. This argument does not authorize assuming actual admitted quaternion words: the runner must verify both ratios from actual state before claiming geometry or cone coverage. Zero initial angular velocity preserves orientation during the pre-contact drift in the inspected source.

Let `r=C-p=(1/4,1/2,5/16)`. Then `dot(n,r)=1/2`, `dot(t,r)=5/16`, and `dot(s,r)=1/4`. The floor corner lies strictly inside the finite cube bottom face. The signs of n make it the unique floor support corner. Native geometry is exact touching at the target pose, not a deliberately inflated penetration. The independent reference enumerates all native box corners and all 15 support directions; the selected local-Y plane has zero gap and every other nonzero direction has strict positive overlap. It does not call the candidate SAT or clipper.

## Physical impulse model and branch definition

For one contact at p, the exact physical contact-velocity response is

`K = Identity + 6*((r dot r)*Identity - r*r^T)`

`  = [[395,-96,-60],[-96,251,-120],[-60,-120,368]]/128`.

This follows from mass and isotropic inertia, not an engine solver formula. Set `N=129/1024`, `tau=N*f`, `J*=N*n+tau*t`, and initial translational velocity `v=-K*J*`. All three desired impulses and velocities are exact representable dyadics. At f=1, `J*=[112,143,17]/1024` and `v=[-7373/32768,-23101/131072,2203/16384]`. Construct these quantities with Fraction arithmetic first. Do not multiply rounded displayed n/t components to generate them.

Before World execution, independently solve `K*Jstick=-vStored` from the actual stored velocity words. Extract `Nstick=dot(Jstick,n)` and `Tstick=Jstick-Nstick*n`. Exact `||Tstick||^2-(muStatic*Nstick)^2` must be negative, zero, and positive for the three cases, respectively. This defines a frozen impulsive constitutive rule: choose the unique sticking solution when it is inside or on the static cone; otherwise require the dynamic branch. It is not a promise that the existing finite sequential solver chooses or converges to that rule.

For the first two cases, actual accumulated contact impulse must give zero final contact velocity within the unchanged `1e-10 m/s` gate, nonnegative normal impulse, and static cone excess at most `1e-12 Ns`. The exact-boundary case remains mathematically on the boundary. Floating public normals may perturb the implementation's branch; a wrong finite physical outcome is a preserved NO_GO, not a reason to move the input or widen the criterion. Do not require every intermediate iteration to have the final branch.

For the third case, do not copy a scalar solver answer or reuse J* as an expected applied impulse. Evaluate the actual producer impulse against independent physical conditions: active positive normal impulse, zero final normal contact speed within `1e-10 m/s`, final tangential slip magnitude greater than `1e-10 m/s`, dynamic cone magnitude residual at most `1e-12 Ns`, and each component of `T + muDynamic*N*uT/||uT||` at most `1e-12 Ns`. Compute irrational norms independently at 80/120 decimal precision with a recorded agreement check; do not round an intermediate direction to binary64. Compute the contact velocity from physical K and also from actual final COM velocity plus omega cross the actual arm, with component agreement at `1e-10 m/s`. Preserve both checks and the actual application/wrench ledger. A general nonlinear dynamic solution is not supplied by this input reference.

This is a two-dimensional tangent problem. Although the desired sticking impulse has zero s component, the initial contact velocity has a nonzero s component because K couples the directions. A dynamic answer obtained by clamping tau along t is not an oracle. In the `[n,t,s]` frame, `Knn=251/128`, `Knt=-15/16`, and `Kns=-3/4`. The exact inequality `Knn^2 > muDynamic^2*(Knt^2+Kns^2)` keeps the active normal denominator positive for every unit slip direction. The reference records this feasibility condition and negative initial normal velocity, but does not use them as a substitute for an observed dynamic solution.

## Drift rounding certificate

For each component compute `d=RNE(vStored*dtStored)` and `C0=RNE(C-d)` exactly once. Independently certify `RNE(C0+d)==C` word for word before emitting any model. This is ordinary input construction, not a repair or search. If the certificate fails, report INPUT_REFERENCE_NO_GO and preserve it; do not change C0 or add penetration.

The important Y inverse-add case crosses the 1/2 binade boundary. At this fixed dt the rounded positive `|vY*dt|` significand modulo 512 is 34, 68, and 102 for before/at/after. Subtraction errors are therefore `-34`, `-68`, and `-102` units of the drift's `2^-62` spacing, inside the target's lower rounding half-interval of 128 such units. X cancels exact equal opposite words. Z stays within the same binade and rounds back to its even target word. The reference verifies the complete represented operations rather than relying only on this derivation.

The initial constructor is expected to be separated and cold. The first actual force query must have the exact target center and admitted quaternion ratio, and the intended single native point. Require the same actual application anchor p and fixed pose/normal frame for this one-step physical K model. A geometry refusal, different point population, unexpected pose correction, floating SAT MISS, or failure of native correspondence is a preserved result that blocks the cone claim. It must not trigger an input nudge or old detector fallback.

## Gates, resources, and proof boundary

Retain all existing independent native surface `1e-9 m`, paired-line/accepted-gap `1e-12 m`, tangent-plane `1e-12 Ns`, event/step momentum, spin, midpoint work, passivity, projection, origin moment, producer-wrench, and complete point-population checks. Record all actual static/dynamic branch decisions, requested cache magnitudes, normal loads and final slips; the branch log alone is not physical proof. Preserve the existing 8 inner iterations and 8 outer passes. General solver convergence may remain NO_GO.

Use at most three Worlds and three total step attempts. Keep the existing 8192 records, 4352 applications, 72 queries, 288 points, 7776 anchor checks, 16384 exact-integer bits, 180 seconds, and 16 MiB limits. Stop at the first actual physical failure. Unreached cases remain NOT_RUN. No extra World or partial-case tuning is authorized. Independent reference output contains inputs and exact certificates only; it is never a solver/cache seed. Native/public/desktop/performance and production promotion remain separate prerequisites and claims.
