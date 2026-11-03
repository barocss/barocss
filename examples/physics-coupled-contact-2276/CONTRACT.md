# Coupled single-point static contact design 01

Status: DESIGN_ONLY_NOT_IMPLEMENTED_NOT_EXECUTED. Own this new folder only. Preserve the complete persistent-cone cone-01 baseline, frozen inputs, 108 actual applications, source, references and first NO_GO. The before case passed native geometry and every existing ledger gate, then failed sticking velocity by `0.1410596011492487 m/s` against `1e-10 m/s`. All 64 tangent calls selected dynamic friction. At/after were NOT_RUN. This is a constitutive failure, not a geometry or energy failure.

## Initial supported lane

Design a new private dispatcher for the unchanged before/at/after input words. The initial implemented lane will be a coupled **static** solution. It supports exactly one dynamic uniform unit cube, one static box, one cold native face contact, zero gravity/restitution/initial spin, one fixed contact pose, and no position correction. Both materials have static friction 1 and dynamic friction 0.7. There is one World step, with the existing 8 outer passes and 8 inner calls unchanged. No prior cache, moving frame, other point, joint, second dynamic body, external in-pass force, or general inertia is qualified.

Eligibility must follow actual body/material/shape/pose and native witness values; never a case ID or saved impulse. Require the actual qualified geometry result to have one face point, an exact unit native face normal, and an anchor equal to its native paired endpoint. Bind the target to actual host-step owner, body/collider pair, point/feature identity, actual COM/XYZW words, represented anchor, native frame, and represented query-normal words. Refuse a later mismatch before any further application. No old scalar solver or contact-detector fallback is permitted.

## Exact branch and target

Capture free point velocity once, after the ordinary drift and first admitted geometry query, **before any warm or contact application**. On this cold lane it is `uFree=vB + omegaB cross (p-CB)`; A is static. Use actual represented words as exact dyadics, including exact subtraction of represented p and C. Do not round the arm before entering exact arithmetic.

Derive physical Cartesian response from m=1 and isotropic I=1/6:

`K = Identity + 6*((r dot r)*Identity-r*r^T)`, where `r=p-CB`.

K must be symmetric positive definite by exact principal-minor checks. Solve `K*Jstar=-uFree` with bounded BigInt rational adjugate/determinant arithmetic. The private implementation must compute from inputs, not contain the fixture K or expected J constants. Exact integer intermediates stay within the existing 16384-bit bound; exhaustion yields typed UNRESOLVED. The new helper additionally permits at most4096 rational constructions and262144 cumulative Euclidean remainder steps per call. These are exact-arithmetic work bounds, not extra physical solver calls.

Take n from the exact native face frame, not the rounded public normal. Verify `dot(n,n)==1`. Let `N=dot(Jstar,n)` and `T=Jstar-N*n`. Static priority is exact: select STATIC only when `N>=0` and `dot(T,T) <= (muAStatic*muBStatic)*N*N`, with the product of represented material coefficients interpreted exactly. No sqrt, epsilon, normal perturbation, rounded factorization, partial normal load, or observed branch log participates in this classification. True equality selects STATIC.

For the frozen before and at cases, this yields the dyadic Jstar inputs already certified independently, with N=129/1024. The at case has exact zero cone margin. The after case lies outside the static cone. The initial static lane must return typed `COUPLED_DYNAMIC_REQUIRED` there before an impulse, not call the old partial-normal law. That refusal is **not** a P03 dynamic PASS or a full campaign PASS. Full P03 remains blocked until a separately frozen coupled dynamic lane passes the original physical conditions.

## Presentation and actual application

Freeze the exact branch, K, uFree, and total Jstar for the eligible point and host step. Keep them immutable across the 64 existing calls. Do not reclassify from tiny velocity residues after the first application. This is one coupled physical solve, not additional solver iterations.

The initial lane requires the target world Jstar, native N and native T components to be exactly representable binary64 values. Convert with a correctly rounded bounded rational conversion and prove exact equality back to the rational. The frozen before/at inputs satisfy this property analytically. Other inputs return `STATIC_PRESENTATION_NOT_QUALIFIED`; no nudge or truncation is allowed. A later contract can qualify nonexact presentations with explicit error certificates.

Apply the presented **world Jstar** once through the existing actual apply function and its returned producer contribution. Do not reconstruct Jstar using `N*nPublic+T`, because nPublic is rounded. Remaining63 existing solver slots call actual apply with `[0,0,0]` under the frozen static target and guard. They must not enter normal/tangent scalar updates. This fixes64 actual application records per accepted one-point static step. Target/applied bookkeeping remains candidate-local and transactional.

Cache N/T are storage for this native exact frame; they are not producer wrench authority. Record that exact native frame separately from the rounded query normal in new private provenance. Future warm reuse of this new cache is NOT_QUALIFIED by this one-step lane. Do not silently claim compatibility with the previously qualified public-normal warm cache law. The actual step pair wrench still comes only from actual apply returns, while the independent trace remains a separate observer source.

## Gates and execution boundary

Keep every previous native surface/line, accepted-point population, normal/tangent plane, application reciprocity, momentum, COM spin, midpoint work, energy/passivity, pose projection, world-origin moment and producer wrench gate at its original 1e-9/1e-12/1e-10 limits. The independent original cone observer must pass the before/at static physical conditions. Exact branch eligibility is separate from these presentation/physical gates and receives no tolerance.

Before any future engine execution, freeze a distinct staged provider, actual target instrumentation, independent virtual-unit-impulse reference, fixed case bank and runner. Do not change the frozen current provider. First reproduce/retain this baseline and qualify the helper without World. Then execute at most the frozen three Worlds/three attempts, stopping on first real failure. Keep the existing 8192 records, 4352 applications, 72 queries, 288 points, 7776 anchor checks, 16 MiB and 180-second caps. No source/native/API/desktop/performance or production promotion follows from this design or a static-only PASS. No build, reference, helper, or World is executed by the author.
