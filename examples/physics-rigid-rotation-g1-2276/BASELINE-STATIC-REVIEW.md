---
work_id: physics-rigid-rotation-g1a-2276
artifact_type: frozen-baseline-source-review
status: APPROVED_FOR_BASELINE
owner_role: independent-physics-algorithm-review
source_request: verify the paired public baseline and independent saved-data classifier without execution
last_updated: 2026-11-02
---

# Decision

**APPROVED_FOR_BASELINE**, limited to the frozen paired2World/2step
BASELINE_CHARACTERIZATION_ONLY contract and the pre-execution identity
clarification. Parent must still create the fresh complete execution freeze.
No gyro implementation, future analytic qualification or public activation is
approved. No physical PASS/NO_GO result is assumed before the measurement.

This review reads the frozen four author files, authority/identity records,
actual public root/map and hashes. Successful syntax/AST and integration-audit
checks were acknowledged and not repeated. No module evaluation, conversion,
reference arithmetic, build, classifier or World call occurred. Only this new
review document was written; all providers/authority remained untouched.

# Public providers and exact identity clarification

The driver checks current package exports: source `./src/index.ts` and publish
`./dist/index.js`. Source is bundled once from that actual public root; every
actual source-metafile input must be frozen Physics src and every output has
zero external imports. Native imports the unchanged actual published entry
and authenticates its literal JS dependency closure inside dist. The current
dist/index.js contains the bundled World implementation; types.js is its
external public dependency. It is not a wrapper selecting an alternative or
source World. No native package rebuild, fallback or private constructor is
used. All actual source/native/package/tool pins remain a pre-import gate.

PROVIDER-IDENTITY-CLARIFICATION-01 is an explicit parent-approved pre-execution
correction to the old providerDigest-equality sentence only. The driver pins
that record, each unchanged current manifest and the named prior actual P5
receipt. Source expects exactly
sha256:2038bba8526717b52b44a57d13d4e3b7951dcfad6e0305179bfedd7e740b663d;
native expects exactly
sha256:13873c119e48b3519a5c7469af03c2b31956e14eba1c6c9ba86cbaf33097a801.

`stateGuard()` checks the own-mode digest before/after. `comparePair()` keeps
both original public strings, requires their declared inequality and compares
every other identity and complete public field/raw number word exactly.
No public field is dropped, replaced or normalized. This is provenance
mapping, with no physical law, gate or state comparison weakened.

# Acquisition, disposal and first-failure boundary

The unique literal model/options pair is converted once by schema-directed
paths, then detached for each graph. All numerical inputs/metadata and returned
states are saved with F64LE words. No reference physical law is evaluated
during capture.

Source executes createPhysicsWorld, getState, step([]), dispose once each.
Native follows only after source API/finite/schema/ownership guards complete,
then performs the same four calls. Constructors returning a World followed
by a wrapper-guard failure still leave the owned handle available to finally.
Disposal failure/constructor-internal allocation uncertainty remains explicit.
An early capture failure prevents the later graph and the classifier.

Before classification, all eight attempted/returned API counters must each
equal2; no query/getModel/recorder call exists. Both disposals returned, World
handles are nulled, raw parity is checked and an exclusive closed-capture
receipt is written. Only then is classificationStarted set and the separate
Python process invoked. No World API or disposal path remains afterward.

Capture failures stop acquisition. Physical classification is the separately
approved paired observation: source first, then native already-saved bytes.
A source physical failure remains the firstPhysicalFailure while the native
assessment advances no World. It is not a SourcePASS-to-Native qualification
or a physical-gate waiver. There is no future repair call in the driver.

# Independent invariant mathematics

The classifier imports stdlib only and consumes authenticated raw files after
the closed ledger. It does not import a producer inertia/rotation helper.

`integral_certificate()` computes nine one-axis moments by polynomial
antiderivatives over each native half extent, derives volume/density, then
integrates mass, COM and every entry of
rho*integral((r dot r)*delta_ij-r_i*r_j)dV. The diagonal subtracts the own-axis
second moment; off-diagonals have the required minus sign. It verifies mass,
zero COM/off-diagonals, symmetry, positive moments and equal axes1/2. This is
the homogeneous cuboid integral, independently assembled from the geometry,
not the production principal-moment shortcut.

`proper_rotation()` uses exact native q components and denominator s=q dot q
to form the physical proper rotation represented by normalized q, without
sqrt/trig or changing producer state. Its off-diagonal signs match XYZW
local-to-world convention. R-transposeR and determinant+1 are checked exactly;
the cyclic determinant expansion has the correct cofactor signs. Raw q and
its independent squared-norm defect remain in the evidence.

`observed_audit()` forms R*I*R-transpose, world L=I_world*omega and
T=omega dot L/2, plus linear momentum and COM. Source/native each compare after
against their own saved initial state. `assessment()` uses the exact frozen
e+e*max(1,abs(before),abs(after)) component/energy bound and the separate
absolute e quaternion-squared-norm/COM/linear gates, e=1/10^12. No clamp,
trig, sqrt, ODE, solve or finer-run truth is introduced. Energy is reported
alongside L and cannot substitute for angular-momentum conservation.

The common tensor is evaluated once; four saved states produce four proper-R
and invariant audits. Exact native geometry is distinguished from intended
rational literals by separate rounding values. Fraction arithmetic retains
the10000-operation,4096 stored-bit and8192-product prechecks; first resource/
reference error stops further audits. No numerical operation was executed by
this source review.

# Evidence, statuses and resource boundary

The source assessment is written immutably before native audits. Its first
physical failure and artifact pin remain in the final or emergency result if
a later reference/resource error occurs. Complete classification returns
CHARACTERIZED_PHYSICAL_NO_GO or CHARACTERIZED_NO_FAILURE_OBSERVED. The driver
sets physicalPASS=false; command exit0 means completed characterization, not
physical qualification. Unknown/reference/resource failure is separate from
that first physical finding and yields a failed command. Missing final output
uses original bounded progress as a durable lower bound with actual/in-flight
work UNKNOWN. No missing work becomes invented0 or an unfinished PASS.

The fixed data scope is one native pair, four saved one-body states, one tensor
and four audits. Driver graphs have node/depth and64KiB raw input/state bounds;
only one World is live at a time. Classifier owners retain original inputs,
decoded states, geometry, assessments and encoding roots together. Its global
recursive helpers create no per-audit closure cycle; each audit identity set
is cleared in finally. Measured reachable data is separated from the2MiB
derived traversal/operation allowance and precharged packed/ASCII/UTF8 overlap.
The8MiB reference/World logical work,16MiB build,2MiB baseline evidence and
64MiB total declared envelope are unchanged. A budget failure stops and keeps
bounded emergency evidence; no reserve is reported as measured memory.

The existing180s detached-group guard owns driver/build/classifier children.
Driver/classifier work uses the170s bound; child cleanup sends TERM/KILL with
the existing1500ms close ceiling. Source build and classifier are the only
two direct child starts, native build count0. Compiler/interpreter/tool heap,
OS pages and process RSS are explicitly unmeasured; this is the declared finite
logical payload/artifact envelope, not a process-memory theorem. Actual runtime
costs, maxima, counts and physics remain NOT_RUN until parent execution.

# Reviewed hash closure

Paths use this example directory unless qualified. Complete actual producer
and installed tool closure must also be carried into the parent freeze.

| File | SHA256 |
| --- | --- |
| baseline.mjs |04e41b02d0ce8fd16a42b4cd21a5943187d2857629dfdd0f53644929f32bc977|
| baseline-classify.py |5f5eee9ac2cd8b654eab134823a619254fd0b7c4ab8791419d077a71413a09eb|
| BASELINE-PLAN.json |c06c94ea57b30703045d61a90e5f3b7c1cd01c897cf9e3b1f7b49543be95e7e9|
| BASELINE-AUTHOR-READY.json |ec0847904d42d259266629afa78c6161f7b2785e13dae3281c1c403d7129b47a|
| PROVIDER-IDENTITY-CLARIFICATION-01.json |faf2748ea04728d993e5c0a5d251fb309b17ea45bf8b608fedef25609763862d|
| CONTRACT.md |29feb5a2d8b9baf1f9508bd13fa5837af61a25c960f400b59aefd6014b914b95|
| CASES.json |2ce857f257ddfabd5feab1f98e78577efe0b4b3ff1b5a77f6288e503a9c8777b|
| AUTHORING-FREEZE-01.json |22abcb5d7a5cf7750db460d8084f6ebcbca5b3a5e6eef9da47e80f924edede79|
| INTEGRATION-AUDIT.md |4c6a793080dd8339cc38638bfbd5ae30a5defd6d370e025c98d1402ffbbd1645|
| ../../packages/barocss-physics/package.json |4e33b9e01af5adc8191ed491fc66b489350eb3e4d8404f35404db42a7735d18f|
| ../../packages/barocss-physics/dist/index.js |eb0303e4393102ebf5554b02d3fd20f048fecc368337ceb26c5b266b929c70cf|
| ../../packages/barocss-physics/dist/types.js |65a4905c6bda0d4e7a5fc7ea105a1362c8cae1345070b5d17fd524a8790e1f8b|
| ../../packages/barocss-physics/src/provider-manifest.generated.ts |464a69f41b0e3006bdc246e3c6d6d1bf91f679b0aec9616e917f02edd0d8f1df|
| ../../packages/barocss-physics/dist/provider-manifest.generated.js |41a7c51c4d725a8aea2a5e54628f28a43811c027870dd3361187f27c66e273df|

# Scope after approval

Run this baseline once only after the complete parent freeze; preserve whatever
it measures. It adds no trajectory/analytic/gyro repair, torque/contact/joint
qualification or current-provider change. Future G1a and triaxial G1b remain
separately gated. Old P3/P4 isotropic contracts, completed instantaneous P6
PASS, public-coupling limits, all first failures/HOLDs and whole-roadmap merge
condition stay unchanged. Source review and completed acquisition are distinct
from a physical PASS.
