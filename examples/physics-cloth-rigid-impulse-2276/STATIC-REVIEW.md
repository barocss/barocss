---
work_id: physics-cloth-rigid-impulse-2276
artifact_type: frozen-source-static-review
status: STATIC_NO_GO_ORACLE_WORKING_BOUND_UNPROVED
owner_role: independent-physics-algorithm-review
source_request: inspect candidate, independent oracle, physical comparison gates, and owned-data bound without execution
last_updated: 2026-11-02
---

# Decision and boundary

Candidate mathematical structure and ownership paths: STATIC_PASS for the
frozen finite CASES population. Independent reference construction:
STATIC_PASS. Proposed validator inequalities below: APPROVED_STATIC_SPEC.
Campaign execution: STATIC_NO_GO until the oracle working-data accounting
finding is resolved and reviewed under a new source freeze. No numerical PASS
is claimed. No candidate, oracle, contract, case or existing provider was edited.

This review read source and JSON and verified SHA256 values. Oracle/candidate
module evaluations, fixture conversions, Fraction/Decimal calculations,
factorizations, candidate calls and World calls were all0. No additional case,
precision, tolerance, retry or solver budget is proposed.

# Reviewed immutable authority

All paths in this table are within this example directory.

| File | SHA256 |
| --- | --- |
| CONTRACT.md | 7e11f247a8287d5713bdba8f18a3a36fba2abf3602a39cfcd5663461974a05a6 |
| CASES.json | f2de2962270fc9fc4910844325d52eb7a2b373f9c3ac884455a53340b4d87d90 |
| AUTHORING-FREEZE-01.json | 77631e8fadcf0ab61e3f57e810ad81e14a029cad69a8961c683cc9ff546615f7 |
| candidate.ts | 7901dc4240098da03bb2dea3f353be37c8d8e34c7d31303f19c8950813721106 |
| CANDIDATE-AUTHOR-READY.json | 0fffa89d9226087d724a558473da69fde49f9aec6697fd7b567b850e31e48a05 |
| oracle.py | 4115ab96c46e662942f38b90395c20de69fad6dcd49bf2cb07efd065dc04244e |
| ORACLE-AUTHOR-READY.json | abdb2cdc8e929603c489ae7a44a7e324ec4b284a2b6066c2e2e46fc41509e1e4 |

# Actionable execution blocker

**R1: The reported reference working-data peak is a partial root sum, not a
proved upper bound on simultaneous owned data.** `oracle.py:98` traverses only
the roots supplied to `Accounting.working()`, then adds262144 bytes without a
source-level allocation proof for the omitted objects. Specific omissions:

- At `oracle.py:334`, exact elimination counts its augmented matrix and work
  matrix. The caller still retains raw/state, the9x9 mass matrix,3x9 constraint,
  initial velocity and other outer-frame objects (`oracle.py:661`). The
  condition inverse and Decimal calls also run while the full exact result is
  retained. During Decimal120, the Decimal80 result remains live; the nested
  measurements at `oracle.py:511` and `oracle.py:578` do not include it.
- The final audit at `oracle.py:682` omits retained mass/constraint, solution,
  columns and residual locals. At the next request, the preceding `result`,
  `reply`, `raw`, `state` and byte snapshot can remain live while a new result is
  built. Assignment and the fact that the old reply is already on disk do not
  release every such reference.
- `encode_numbers(result)` at `oracle.py:777` creates an encoded tree while the
  complete Fraction/Decimal result remains live. The audit at `oracle.py:787`
  counts raw/reply, but not that unencoded result or the retained recipes,
  summary, provenance and zero-solution data together.
- `json_bytes()` at `oracle.py:71` can retain JSON encoder chunks, the joined
  ASCII string, the newline-appended string and encoded bytes concurrently.
  The artifact1MiB limit in `write()` (`oracle.py:735`) is checked only after
  these allocations. Its limit on stored bytes is not a working-memory bound.

The source establishes neither that actual memory exceeds8MiB nor that it
stays below8MiB. The label
`peakConservativeAllocationSumPlusReserveBytes` (`oracle.py:806`) is therefore
not justified as a whole-reference upper bound. An observed small partial sum
would not resolve this finding.

Minimum repair proposal, subject to parent authorization:

1. Preserve this provider and its review; freeze the repaired provider
   separately. Keep all equations, arithmetic order, matrices, populations,
   error criteria, factorization counts,8MiB reference ceiling and64MiB
   campaign ceiling unchanged.
2. Give every active phase an explicit set of retained roots. Include outer
   caller state, recipes/provenance/summary and previous-result ownership while
   a nested solve runs. Release previous-case numerical/encoded values before
   the next fixture. Include both the original result and its encoded tree
   until their lifetimes end. Shared-object double counting is acceptable;
   omission is not. Bound the audit's own traversal stack and counter objects.
3. Preflight serialization scratch before allocating it. A small bounded
   incremental JSON encoder/sink can charge its chunk, encoding buffer,
   container capacity and final bytes, and stop before exceeding the unchanged
   work/artifact ceilings. Alternatively prove a conservative serialization
   envelope from the frozen maximum node/leaf lengths and actual encoder
   allocation behavior, and reserve that envelope before encoding. Checking
   only the final1MiB byte length is insufficient. Include Fraction/Decimal
   string-conversion temporaries and failure/progress receipts.
4. Label measured reachable allocation sums separately from derived bounds on
   temporaries. Retain a documented finite proof for any fixed reserve; do not
   call an unexplained constant measured memory or RSS. Run only source/DATA
   accounting checks before the parent authorizes the existing single math
   campaign. A resource refusal remains a first failure.

# Candidate source findings

`candidate.ts:111` validates own ordinary data, dense arrays, exact endpoint
kinds and bounded identities before numerical preparation. The frozen refusal
precedence is preserved: schema, finite numbers, owner/index/pin, mass/inertia
and component ranges, physical principal-moment inequalities, proper rotation,
then anchor coincidence. All10 declared refusals have the required reason
path before the only solve call. Metadata/schema integer checks before the
finite-state stage agree with exact-schema precedence. The rotation and
coincidence guards at `candidate.ts:145` use the authored64*2^-52 limits;
there is no matrix/position repair, pivot epsilon or range widening.

`candidate.ts:159` constructs world inverse inertia as R diag(1/I) R-transpose.
The arm at `candidate.ts:207` is R times the local anchor. Angular velocity and
torque remain in world coordinates. For a proper rotation, the rotational
effective term at `candidate.ts:214` is `(Iworld^-1*(r cross e)) cross r`, hence
`-[r]x Iworld^-1 [r]x`. Its quadratic form is nonnegative; the positive
`(1/mp+1/mb)I` term makes the ideal matrix positive definite. The RHS is minus
point-minus-anchor velocity. Point impulse is J; rigid impulse is -J; rigid
angular impulse is r cross (-J). These signs agree with the full KKT plant.

There is exactly one `solve3x3` call at `candidate.ts:218`, reached by every
accepted/fault case, including compatible/zero velocity. It uses deterministic
maximum-absolute partial pivots with first tie, fixed elimination and no
fallback or retry. The frozen ledger is15 condensed solves per graph,30 total;
the10 refusals per graph do not enter it. This is a source path conclusion,
not a measured call-count result.

The point candidate is complete before `IMPULSE_FIRST_SIDE_PREPARED`; the
rigid candidate and report are complete before `IMPULSE_PAIR_PREPARED`. An
injected throw at either comment can propagate unchanged because no catch
wraps it. Source contains no write to the input and returns only after both
candidates exist. Pose, mass, inertia, IDs and pin metadata are copied using
scalar assignment and fresh arrays. Point/rigid/report endpoint arrays and
rotation rows are separate allocations. No output field intentionally shares
an input/output array. These paths support the planned marker-identity and
pair-preservation tests; only the future runtime tests can prove the actual
instrumented graph.

`candidate.ts:197` computes rotational energy from body angular components
R-transpose*omega and principal inertia. `candidate.ts:233` computes before and
after energy, and `candidate.ts:240` reports their direct difference. There is
no energy/dissipation clamp. The report is not allowed to certify its own
momentum or work. The planned validator must reconstruct those from states.

# Reference independence and exactness boundary

`oracle.py:297` builds full physical9-coordinate mass and3-coordinate
constraint blocks, deriving Jacobian columns from basis velocities and cross
products. `oracle.py:316` solves the12x12 KKT system with first nonzero exact
pivots. Expected impulses at `oracle.py:368` come from M times the returned
velocity change. The3x3 inverse at `oracle.py:338` is separately counted and
used for conditioning only. It does not supply the expected solution.

`oracle.py:456` independently reads raw rational inputs for the Decimal
tensor/Jacobian/KKT builder; `oracle.py:492` has separate maximum-absolute-pivot
elimination. Decimal80/120 use the frozen owned contexts and return full KKT
residuals. No candidate import, condensed solution builder or shared
Fraction/Decimal coefficient/elimination function was found. Common physical
equations and lexical/metadata helpers are disclosed. The exact physical,
work, projection-objective, reaction and conditioning assertions remain
unexecuted. The resource finding does not justify removing any assertion.

Native3/5 and4/5 inputs are rounded binary64 values. An admitted near-proper
native R is not silently substituted for the exactly proper ideal rational R.
In particular R diag(1/I) R-transpose is an exact inverse of R diag(I)
R-transpose only for an exactly proper R. The authored native-rounding error
is tested against the unchanged ideal gates; it is not an expanded physical
input domain or a reason to relax a failed result. Fraction numerical zero
does not predict a computed native zero sign.

# Approved validator gates before execution

Let e=1/10^12 as an exact rational. Decode every actual finite binary64 field
to its exact rational value; decode ideal numerator/denominator JSON directly.
Do not round the ideal reference to binary64 before comparison. Keep the
explicit candidate-to-reference mapping in CANDIDATE-AUTHOR-READY.json.

- Each velocity, angular velocity, reported impulse, relative velocity and
  energy scalar/component must satisfy `abs(actual-ideal) <= e+e*abs(ideal)`
  in that field's declared SI unit. No vector-norm replacement or averaging.
- A balance/work residual uses `abs(residual) <=
  e+e*max(1,abs(beforeIdeal),abs(afterIdeal))`, component by component, with
  before/after quantities from the corresponding invariant in the same SI
  unit. Use the ideal energy before/after scale for energy/work/projection
  identities. Use the corresponding ideal relative velocity before/after
  scale for attachment velocity residual. Do not compare a legitimately
  nonzero dissipative kinetic change directly to zero.
- Reconstruct point/rigid linear momentum, orbital angular momentum about
  the frozen world origin, world spin momentum, kinetic energy, attachment
  velocity, impulse work and the mass-metric objective from actual input and
  returned states. Use actual binary64 masses, positions, R, principal inertia
  and velocities as exact Fraction operands. Build world inertia independently
  as R diag(I) R-transpose. No candidate helper, oracle import, linear solve,
  inverse, ideal-velocity substitution or inferred reaction is permitted.
- Check P_after-P_before and L_after-L_before against zero under their balance
  gates; check actual attachment relative velocity against zero. Check
  deltaK-work and deltaK+objective against zero. The independently formed
  positive kinetic-metric objective must be nonnegative. Test dissipation
  through these identities and the declared ideal/state-derived comparisons;
  retain any negative raw value and never clamp it. No separate new
  dissipation tolerance is introduced. Compare each
  reported impulse against independently state-derived m*deltaV or
  Iworld*deltaOmega under the scalar/component rule with that derived physical
  quantity as the target. Compare report energies/dissipation both to ideal
  fields and independently derived actual-state quantities under that rule.
- Keep every endpoint/pose/nonvelocity field bit/structure exact; all required
  copies detached. Every source/native computed field must match raw IEEE754
  bits separately, including signed zero. Refusal class/code/reason, unknown
  marker identity, both-input preservation, call counts and first-failure
  stopping are exact gates. None uses the numerical allowance.

This approves the explicit validation specification, not an unreviewed runner.
The runner must publish the exact scale/reference field used for each
residual, actual-vs-ideal differences, and signed-zero/raw-bit differences.
Its DATA arithmetic is separately counted and performs no factorization.
No tolerance change is permitted after results are observed.

# Retained limits

All numerical/runtime results remain NOT_RUN. The resource blocker requires a
new parent-reviewed source freeze, not a repeated numerical prefix. Existing
23 reference requests,26 exact and26 Decimal factorizations,50 candidate
attempts/30 condensed solves,170/180s deadlines, first failure and memory
ceilings remain unchanged. P4 NO_GO/cache termination, public dynamic-mixture
refusal, full P6a/P6b/P7 gates and whole-roadmap integration pending all remain.
