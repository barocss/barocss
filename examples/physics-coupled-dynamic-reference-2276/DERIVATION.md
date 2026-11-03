# Physical proof and author handoff

Status: SOURCE_ONLY_NOT_EXECUTED. The only author checks are Python AST parsing and input-byte SHA256 authentication. Numerical reference qualification, candidate qualification, Source/Native World runs and browser dynamic proof remain NOT_RUN.

## Contact response

For a unit-mass uniform unit cube, the actual primitive moments are `m*(hy^2+hz^2)/3=1/6` and the two cyclic equivalents. All three are equal. The script verifies mass, shape, moments and inertia frame before using inverse inertia 6. A world impulse j gives `deltaV=j` and `deltaOmega=6*(r cross j)`. The contact response is `j+deltaOmega cross r`. The script evaluates this response separately for the three Cartesian unit impulses. It does not use an expanded quadratic contact-matrix formula.

The response is positive definite: `j dot response = |j|^2+6*|r cross j|^2 > 0` for any nonzero j. Its representation in any orthonormal native frame is also positive definite. The frame comes from `q*(basis,0)*conjugate(q)/(q dot q)`, using the actual stored quaternion as exact rational words. Quaternion normalization is algebraic; it does not assume that the stored quaternion norm is exactly one. The script checks all exact dot products and then checks the expected frame orientation. These checks make the normal and tangent signs explicit.

## Static priority

Two complete Gaussian solves independently obtain Cartesian and native sticking impulses. Their coordinate transforms must agree exactly. Positive normal load and the sign of `T1^2+T2^2-qStatic*N^2` select the branch. The frozen bank requires signs -1, 0 and +1. A zero sign selects static. No interval, epsilon, rounded public normal or candidate output selects this branch.

The static report derives world J, N and world tangent directly from the exact solution. Both precision runs independently certify their binary64 cells. These outputs can be compared with the old qualified targets, but no old target is used to compute them.

## Dynamic parameter and all-domain uniqueness

Write x as native impulse `[N,T1,T2]`. For interior `s`, divide the two scaled tangent rows of the system in CONTRACT.md by s. This gives

```
K*x + ((1-s)/s)*[0,T1,T2] = -u.
```

The full symmetric matrix is positive definite for every `0<s<=1`, because K is positive definite and the added tangential penalty is nonnegative. Therefore the physical solution exists uniquely at each parameter. At s=0 the undivided formulation has tangent rows T1=0 and T2=0, and normal pivot `Knn>0`. The complete undivided system is invertible and continuous on [0,1]. The code still refuses any interval pivot that does not prove nonzero; the mathematical argument cannot override an arithmetic failure.

For a root of g with positive N, `|T|=sqrt(qD)*N`. The final native normal velocity is zero from the normal row. The final tangent velocity is `-((1-s)/s)*T`. An interior root therefore has friction exactly opposite slip. Conversely, any physical solution in this supported lane with positive N and nonzero slip has T opposite slip, so a positive tangential penalty exists and maps to one interior s. The reported positive slip bound excludes s=1. The frozen endpoint checks and root enclosure exclude s=0. Thus one certified interior crossing with positive N and slip is one physical solution. No quartic root disposition or candidate certificate is needed.

Differentiate the complete linear system: `L*x'=b'-L'*x`. The script evaluates both solves with outward intervals. The exact expression `g'=2*(T1*T1'+T2*T2'-qD*N*N')` bounds the derivative over the entire cell. A sign-excluding g interval proves no root. A strict derivative sign gives monotonicity over the entire cell. Exact point Gaussian endpoint signs then prove either no root or exactly one crossing. These are interval proofs, not point-sample inferences. Sorted closed cells must cover [0,1]; an exact boundary root is a typed refusal. Exactly one crossing is required across the whole domain. Bisection then narrows this already unique root and records each exact point sign. Each step is charged to the frozen work budget.

## Outward bounds and represented application

Decimal point values alone are not certificates. Every operation in an interval expression rounds both endpoints outwards. All four endpoint products or quotients are considered. A zero-containing divisor is refused. For square roots, adjacent Decimal bounds must pass exact squared inequalities. Exact Fraction conversions make those checks independent of Decimal's rounding behavior.

The proposed binary64 word is only a candidate cell label. Exact rational midpoints to both adjacent finite binary64 words prove round-to-nearest-even membership of the entire ideal enclosure. A midpoint belongs to the proposed word only when its significand is even. A failed cell proof causes further root refinement within the same fixed budget; it never chooses a nearby word by search.

The report applies the independently rounded world impulse to the Cartesian physical map. It also computes contact velocity from direct COM linear velocity and spin, and requires exact equality between those two rational results. Rounded cache N and world T must bind to world J within 1e-12 Ns and retain the tangent-plane, cone and opposition gates. Final normal speed must be within 1e-10 m/s. Both ideal and represented midpoint impulse work must be nonpositive. The output keeps ideal enclosures and represented residuals separate. Agreement at 80 and 120 digits is required in addition to each run's independent outward proof.

## Root execution

After the root's current prerequisite passes, root can run from the owned checkout:

```
python3 examples/physics-coupled-dynamic-reference-2276/reference.py reference-01
```

Use a new ID for each authorized execution. The script creates only its new local evidence directory and a new reference.json. It authenticates all three input files and options before the first physical solve. The bank and source hashes appear in the report. Root must compare success/refusal and the first failure before calling any candidate. The author has not executed this command.

The reference has no engine imports and no execution path that creates a World or calls a candidate. Its success can support only reference qualification. Old HOLD states, tolerances, first failures, static browser receipts and whole-engine limits remain unchanged.
