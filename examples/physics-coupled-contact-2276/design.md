# Minimal implementation boundary and proof

The saved first tangent call compares requested magnitude `0.10146605639161764` with partial normal load `0.06574878129232452`. It selects dynamic friction. The final requested magnitude is about 0.1122793, while the settled normal is about 0.0923590; the exact coupled sticking normal is 0.1259765625. The normal/tangent coupling therefore matters before the scalar cone test. More calls to that law do not establish the frozen static-priority constitutive rule.

Use one private, input-driven exact static helper and one private host-step target owner. Do not patch the generic solver first. Proposed responsibilities are:

- Exact helper: parse binary64 words into rationals; construct K from actual p/COM and physical inverse inertia; check SPD; solve with adjugate; derive native N/T; classify cone exactly; return exact certificate and exact binary64 presentations or typed refusal.
- Host owner: capture immutable pre-application free velocity once; bind the certificate to this actual single point/frame/step; apply world target once through the existing contribution return; return zero thereafter; reject frame/point/pose changes; stage cache/target state transactionally.
- Independent observer: reconstruct K by virtual unit impulses and Gaussian elimination; compare the exact branch margin and target; compare actual application sum and producer J separately; use the original physical and cone ledgers unchanged.

The helper should accept physical inputs, not an externally supplied solved K or J in the engine path. A direct matrix-bank entry may exist only as a private arithmetic test export. Suggested result tags are `STATIC_TARGET`, `COUPLED_DYNAMIC_REQUIRED`, and `UNRESOLVED`; refusals carry a specific reason. A static certificate includes exact K/uFree/Jstar/n/N/T/cone margin, canonical input words, bit-work accounting, and exactly represented world/cache values. No public Contact field or recording compatibility route is introduced.

For SPD K, `E(J)=uFree dot J + (J dot KJ)/2` is strictly convex. Its unconstrained minimizer is Jstar. If Jstar is inside/on the static cone, applying it gives exactly zero point velocity in the physical model and maximizes dissipation among all impulses. At Jstar, work is `-(Jstar dot KJstar)/2 <= 0`. These are independent exact reference identities; actual floating body changes still need the unchanged event/work checks.

For the fixture's fixed pose, K equals the previously certified matrix divided by128, but that matrix is an oracle check, not candidate source data. Quaternion parser scale does not alter the native rational face axis if the actual power-of-two ratios hold. In contrast, using the rounded query normal in the exact cone predicate can flip the at case. The helper must recompute/validate the native unit face frame from actual quaternion words and selected feature, or consume an authenticated native rational frame with independent correspondence checks.

The host must not derive a new target from post-application velocity. At current inputs Jstar and both cache components are exact dyadics. One actual world-vector application avoids a second representation error from combining rounded public normal and cache values. Subsequent zero slots preserve the existing pass population without rediscovering a dynamic branch from roundoff. None of this qualifies a changing contact frame or a later step; those need another actual phase/cache contract.

## Later coupled dynamic route, not initial implementation

There is a sound algebraic direction for the after case, but it is not an old scalar fallback. In the native tangent frame let K blocks be k=Knn, c=KnT, D=KTT. With zero final normal speed, define `A=D-c^T*c/k` and `b=uT-c^T*un/k`. A is SPD. Write dynamic tangent impulse as `T=-beta*uFinalT`, beta>0. Then `uFinalT=(Identity+beta*A)^-1*b`, and `N=(-un+beta*c*uFinalT)/k`.

Let d(beta)=det(Identity+beta*A) and z(beta)=adj(Identity+beta*A)*b. The exact dynamic magnitude condition becomes the degree-at-most-four rational polynomial

`k^2*beta^2*(z dot z) - (muADynamic*muBDynamic)*(-un*d+beta*c*z)^2 = 0`.

Every positive root must also satisfy d>0, N>0, nonzero slip, zero normal velocity, and impulse antiparallel to final slip. Static priority is resolved first, exactly. A future bounded polynomial/Sturm implementation may certify a unique admissible root and a binary64 presentation; multiple/uncertified roots must be UNRESOLVED. No isolation/refinement budget is silently added to the 8x8 solver in this contract. Freeze that algorithm and independent root oracle separately before implementing or running it. The existing dynamic cone/slip/antiparallel physical conditions remain the acceptance rule.
