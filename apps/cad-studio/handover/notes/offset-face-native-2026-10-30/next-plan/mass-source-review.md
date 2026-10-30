# D342 mass boundary: independent source analysis

Scope: source and supplied evidence only in the fixed D342 checkout. No runtime, build, test, browser or repository edit. Kernel changes are not authorized in this review. This note proposes a later roadmap16 slice; it does not start that work.

## Confirmed source cause

`packages/barocss-cad/src/brep/solid-mass.ts:54` computes the longitudinal raw integrals as `(b*b-a*a)/2` and `(b**3-a**3)/3`. For nearby nonzero a,b, the rounded products/powers lose the small difference before division. `solidMassFromIntegrals` at lines41-43 then divides those raw first moments by volume and subtracts large raw second moments to obtain central inertia.

The supplied box failure uses actual levels a=.3456789, b=.34567890000000023, separated by2.220446049250313e-16. Its Model normal centroid .34375 lies outside [a,b]. The exact intended and stored gap are equal; this is not a cap-addition rounding failure. Root separately reports a native-strict-valid circle with the same mass failure, so strict geometry validity alone does not resolve this mass boundary. Reviewer did not execute either case.

Actual upright Model output uses `massPropertiesOf` in `part/part-model.ts:4548` → `prismaticMassProperties(part.solid.solid,density)`. Upright Boolean retains actual slab levels at `part-model.ts:2621` and `features/prismatic-solid.ts:125-131`; no automatic recentering protects those integrals. Other axes can take native BRep Boolean/mass paths instead. A prospective cyclic-axis witness is not a proof that every actual result has the identical mass provider.

## Current D342 guard source

Read `nativeOffsetFace.ts:342-392` after the new witness/cache and mass additions. The full remaining witness uses lo=min(opposite,next), hi=max(opposite,next), calls the native producer, and binds every native vertex to those exact levels after the cardinal permutation. It requires one native solid/closed shell and existing strict checkBrep validity. The mass check evaluates the SAME absolute lo/hi prism, not a zero-based interval later translated. It requires finite positive volume, finite normal centroid within [lo,hi], and exact binary64 midpoint error under the unchanged1e-7 policy. This catches the supplied cancellation without inventing a thickness floor or changing integration.

The private TargetWitness stores one last actual next value and either its success or a cloned typed refusal. It belongs to the source/content/body/face-qualified cache entry and is shared by fresh deeply frozen owned profile copies. Exact requested distance, positive intended/stored gap and joint footprint/normal rounding checks precede the cache lookup. A later drag value replaces the previous one. No unbounded position map or duplicate whole-document evaluation was added here.

This is a bounded prospective admission guard. It does not certify all later Boolean topology, all centroid coordinates, every inertia component or each actual mass-provider path. Actual command output checks and ordinary signed controls remain required. No immediate source defect was found in these new guard/cache lines. Final freeze/hash and owner runtime evidence remain pending.

## Useful next urgent roadmap16 slice

The smallest useful repair is to stabilize the longitudinal polynomial integrals in `prismaticMassProperties` while retaining its API, units, density policy, method and native integral bookkeeping:

- h=b-a; first longitudinal integral h*(a/2+b/2).
- second longitudinal integral h*(a*a+a*b+b*b)/3.

These identities remove the close-power subtraction and apply to every existing prismatic slab, including translated thin ordinary circles and polygons. The modeling coordinate bounds make overflow irrelevant to this reported case, but a public Kernel function needs its own admitted-range analysis. Do not extend the D342 scope to implement it now.

This small raw-integral repair is NOT a globally stable mass/inertia solution. The central-inertia subtraction at solid-mass.ts:42-43 remains cancellation prone; regionMoments at curved-arrangement.ts:686-703 also accumulates world-coordinate Green moments. Thin slabs, large translations, multiple slabs/holes and curved section quadrature can expose those independent boundaries. Claim only the specific repaired longitudinal-integral behavior unless further evidence proves more.

An independent acceptance oracle should decode stored binary64 a,b exactly with BigInt rational arithmetic; compute h, midpoint and polynomial integrals from exact rationals, and compare to actual public massPropertiesOf/evaluateDoc results. Include the preserved box/circle cases, positive and negative translated intervals, ordinary thin controls, normal-width sweeps, and unequal-area multiple slabs with exact rational rectangles. Check finite positive volume, centroid containment, translation behavior and expected tensor entries; do not accept volume alone. A circle can use symmetry for its normal centroid independently of pi/area accuracy. Keep first failures and the native-strict classification separate. Check recipe/file semantic equality and unmodified inputs, while distinguishing producer correction from any future relaxation of the D342 guard.
