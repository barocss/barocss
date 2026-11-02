---
work_id: physics-cloth-rigid-impulse-2276
artifact_type: whole-campaign-frozen-source-review
status: NO_GO_STATIC_REPAIRS_REQUIRED_NO_EXECUTION
owner_role: independent-physics-algorithm-review
source_request: inspect final cross-file protocol, physical gates, counters, source closure and owned-payload limits
last_updated: 2026-11-02
---

# Decision

**NO_GO. Do not create an execution approval from this review.** Three source
defects require narrow repairs and a new reviewed freeze. No candidate/oracle,
runner/validator, plan, authority or existing READY file was edited. This new
review is the only output. No module evaluation, fixture conversion, reference
calculation, candidate call, validator call, build or World call occurred.
Previously passed syntax/AST checks were acknowledged, not repeated.

Candidate formulas, exact/Decimal reference independence, whole campaign
ordering, endpoint/raw-bit semantics and declared finite population have no
additional mathematical defect identified by this source review. The three
findings below concern memory lifetime, exact gate selection and failure-prefix
accounting. They are not observed physical failures. All physical/runtime
results remain NOT_RUN.

# Required source repairs

**R1 — validator audit scratch survives checks through a recursive closure.**
`native-validate.py:55` creates `seen`, then recursive local `weight`. Recursive
references at lines73/75 make `weight` own a closure cell referring to itself;
it also captures `seen`. Returning `total` at line86 does not break this cycle.
`gate()` calls `memory.check()` for every component at line245. Thus previous
identity sets/functions can remain allocated until cyclic GC, while each new
check charges only its current explicitly supplied roots and a1MiB reserve.
This is the same lifetime issue that the repaired oracle explicitly avoids.
The peak field is therefore not a proved complete live+serialization bound.

Also, the declared50000-node audit cap permits an identity set plus identity
integer payload larger than the entire1MiB scratch reserve on this CPython
layout. A claim that the actual fixed reply graph is smaller needs an explicit
source bound, not just the50000 limit. This is an accounting defect; no actual
full-validator memory maximum has been measured. No claim of an observed8MiB
overflow is made.

Minimum repair: break recursive audit-helper ownership in `finally` and clear
temporary sets, include actual/derived audit-set/frame storage in the unchanged
8MiB budget before it is allocated, and retain a finite bound on fixed physical
temporaries. The other recursive local helpers (`gate`, `invariant`,
`rounding_walk`) must also release captured roots when validation ends, or those
roots must remain explicitly charged through output serialization. Keep
original artifacts, decoded before/after/ideal values, checks/failure detail
and packed/JSON/bytes coexistence covered. No equations, solves, tolerances or
budget increases are needed.

**R2 — report-versus-state gates use the broader invariant scale.**
The approved STATIC-REVIEW specification requires each reported impulse to
match its independently state-derived target under the component rule
`e+e*abs(target)`, where `e=1/10^12`. `native-validate.py:299` instead calls
`invariant(reportMinusStateImpulse, difference,0,idealImpulse,idealImpulse)`.
That uses `e+e*max(1,abs(idealImpulse))`. These are different rules; at a zero
target the latter permits twice the approved component error. Comparing both
quantities separately to ideal values does not imply the required stricter
report-versus-state comparison.

The same issue occurs for reported energies/dissipation at line305: a scalar
consistency comparison against independently recomputed actual energy is
replaced by a zero-residual test scaled by ideal before/after energy. That
scale belongs to work/balance identities, not the approved scalar report
consistency rule. The report-to-ideal mapping itself at lines249–262 already
uses the correct component rule.

Minimum repair: directly call the existing component `gate` with reported
impulse/energy as actual and the independently state-derived value as target.
Keep the original independent state-to-ideal and report-to-ideal gates. Leave
P/L balances, attachment-velocity residual and energy/work/objective identities
on their approved corresponding before/after invariant scales. Preserve exact
rational1/10^12 and all SI units. This narrows the erroneous checks to the
already approved rule; it does not select a new tolerance after results.

**R3 — a killed oracle's known durable reference prefix is discarded.**
`impulse-run.mjs:231` recovers only `oracleOut/summary.json` after a child
failure. The oracle writes `progress.json` before each request and after each
completed reply. SIGTERM/SIGKILL or a child-pipe failure can end the process
before its summary exists. The catch then silently leaves
`counts.referenceRequests=0` and `oracleObservedPrefix=null`, even when the
preserved progress records attempted references. No later candidate call runs,
but the final aggregate can incorrectly display zero rather than its known
prefix/unknown in-flight boundary.

Minimum repair: retain the original summary when available; otherwise capture
and hash the original bounded progress file, report its exact durable prefix
and an explicit in-flight/unknown boundary. Do not infer completion or invent
zero when evidence is absent. Preserve child command/PID/EOF/close and first
failure. No oracle rerun or extra request is needed.

# Cross-file protocol that is source-consistent

The runner requires exactly `--run-id FRESH --freeze ABS --token SHA256
--authorize-impulse-campaign`, Node22, matching fresh freeze runId,
PARENT_AUTHORIZED_IMPULSE_CAMPAIGN, runtimeAuthorized/p5Closed true,
validationRequestLimit26 and a pinned approved High review. It authenticates
source/tool pins and the actual P5 completion status before build or numerical
conversion. The current P5 completion record has the exact expected
P5_DONE_BOUNDED_LOCALSELECTED_WITH_RENDERING_SDK_BOUNDARY status.

The derived oracle freeze uses the oracle's exact required CLI and
PARENT_AUTHORIZED_IMPULSE_ORACLE_EXECUTION status, current source/READY and
immutable CONTRACT/CASES/AUTHORING pins. The oracle requires all four base
inputs and permits the READY pin. The validator CLI and pass status match the
runner. Each validation request pins actual raw input/output, saved full oracle
reply and summary plus parent freeze token. Full saved reply authority is
checked against the saved oracle summary; no candidate formula supplies an
expected reference value.

`preflightLiteralMetadata()` reads the actual `baseAcceptedCase` field, which
exists on both frozen fault rows and names03-off-com-transverse. It validates
13 accepted,10 refusal and2 fault rows plus existing patch paths without
building fixtures. No metadata field rename or extra case is required.

The exact order is: authenticate; isolated source/native builds; one complete
23-request reference batch; authenticate all23 reply artifacts;23 global
native conversions; source13 accepted with an immediate validator after each;
source10 refusals and2 faults; only then the same native sequence. Each
immediate validation must PASS before the next candidate call. Source failure
prevents native calls. Builds occur before all reference/fixture/candidate
math, so compiler errors consume0 mathematical calls.

The four unique source overlays count actual entry, direct solve, first-side
preparation and full-pair preparation. Source and emitted providers derive
from the same effective TS. Each accepted/fault case has exactly one solve,
including zero relative velocity; refusals have none. Per-graph counters are
25 attempts/13 returns/10 refusals/2 marker throws/15 solves/15 first-side
visits/14 pair visits/13 validators. Final totals are50 attempts/30 solves/
26 returns/20 refusals/4 faults/23 native fixture conversions/26 physical
audits. Direct child starts are1 native esbuild+1 TypeScript+1 oracle+26
validators=29. No recovery, warmup or retry exists in these paths.

# Physical and raw-data audit boundary

The validator independently decodes each finite binary64 word to Fraction.
It uses actual masses, positions, R, principal inertia and velocities, and
forms world inertia as R diag(I) R-transpose. It computes point/body momentum,
orbital angular momentum about origin0, rigid spin, kinetic energy, relative
anchor velocity, actual state-derived impulses, average-velocity work and the
mass-metric objective. There is no matrix solve/inverse, candidate helper,
oracle import or shared coefficient builder. The input-rounding report compares
actual F64 rationals with original ideal literals separately. Ideal3/5 is never
relabelled as exact native storage.

Report-to-ideal scalar/vector gates use the approved component inequality.
P/L balance, relative-velocity residual, work-minus-kinetic-change and
objective-plus-kinetic-change use the approved invariant before/after scales.
There is no energy clamp. R2 must be repaired for the separate report/state
consistency gates. Extra reaction/torque consistency checks do not replace
state-derived physical audits.

The runner preserves numeric words with explicit F64LE encoding, including
negative zero and the declared nonfinite refusal input. Writable detached
input clones are snapshotted after every call, including refusals and unknown
faults. Output/input and output/output alias checks traverse actual object
identities. Endpoint, pose, mass, inertia and pin/context fields are checked
without numerical tolerance. The two markers must propagate by object
identity and return no half pair. Complete accepted source/native outputs are
compared as exact raw-number-word structures. Fraction does not certify a
computed zero sign.

# Resource and process scope

The repaired oracle explicitly registers durable owners, audits all bounded
live oracle caller locals, charges original plus encoded results concurrently,
releases previous-case/traceback ownership, and breaks recursive helper cycles.
Its exact-size ASCII writer precharges buffers/chunks and avoids full JSON
str plus UTF8 coexistence. The source proof separates reachable allocation
sums, owned-layout allowances, between-audit numeric growth, scalar temporary
and serialization bounds. The25 numerical definitions were already checked
byte/AST identical; that successful check was not repeated. This source review
accepts the repaired accounting mechanism as the bounded proposal to be tested;
it is not a measured full-reference maximum or a numerical PASS.

Runner resource envelopes are8MiB candidate/validator payload,16MiB isolated
source/build,8MiB combined oracle+runner evidence, and24MiB fixed reserve
within64MiB. Captured child logs are capped4MiB cumulatively; retained chunks,
concatenation and write copies are charged in the reserve. Candidate payload
charge includes all23 fixture inputs,13 source raw outputs and all29 command
records, plus current copies/metrics/metadata through the documented fixed
charge. Build/source buffers and files have the separate16MiB envelope.
Actual final artifact trees are checked before PASS. These are finite logical
owned-payload/serialization charges; installed compiler/esbuild/internal
interpreter heap, OS pages, tool caches and process RSS are explicitly not
claimed measured or bounded by64MiB. R1 prevents approval of the validator's
current claimed complete working charge.

The unchanged parent command-run gives the runner its own detached process
group. All29 direct children inherit it. The whole-campaign checks use170s;
the external group guard uses180s plus bounded TERM/KILL cleanup. Internal
child timers send TERM then KILL after500ms and reject missing close/EOF after
1500ms. Oracle work has170s and bounded4s receipt cleanup; runner's stricter
100s oracle phase can stop it earlier. Validator child timer includes its
final serialization. A missing EOF/nonzero/timeout is never PASS. Current
candidate progress and child/PID counters are durably written before calls;
R3 must preserve the oracle's durable prefix when its summary is missing.

Current filesystem preparation is also explicit: this example's `evidence`
base directory is absent, while `impulse-run.mjs:92` creates only its fresh
child with recursive:false before its try block. Parent must create the base
directory as DATA preparation, or authorize a narrow parent-directory repair,
before a future frozen run. Do not spend a campaign attempt to discover it.

# Tool-source closure

Read-only file inspection confirms the root
`node_modules/esbuild/bin/esbuild` is the actual Mach-O arm64 executable.
`node_modules/typescript/lib/tsc.js` explicitly loads `./_tsc.js`; `_tsc.js`
must therefore be pinned in the parent tool closure as well as the CLI shim.
It is not a declaration input reported by --listFiles. The configured ES2022
library references es2021 and the es2022 array/error/intl/object/regexp/string
leaves; the compiler's complete actual declaration list is checked against
frozen toolFiles before any reference math. No compiler execution was needed
for this source inspection. The final execution freeze has not yet been
created, so its actual Node/Python/lib-file pin population is not claimed
reviewed here. The required exact provider/lib pins remain a pre-math gate.

# Reviewed hash closure

Paths below use the example directory unless qualified.

| File | SHA256 |
| --- | --- |
| candidate.ts |7901dc4240098da03bb2dea3f353be37c8d8e34c7d31303f19c8950813721106|
| CANDIDATE-AUTHOR-READY.json |0fffa89d9226087d724a558473da69fde49f9aec6697fd7b567b850e31e48a05|
| oracle.py |9b7d801cabad49db972b6a06f4a30f191a54c1f1ac26fc49ea73e19d409a42f5|
| ORACLE-AUTHOR-READY.json |fd13ed1d5cd316333efe07904129207121e9b2f8fdd9038aa55d16fd2c1f24ec|
| ORACLE-ACCOUNTING-REPAIR.md |19d35319954c519d26be471aa9f3125fad349ff38c8f58f263cb4eb53fa345c8|
| CONTRACT.md |7e11f247a8287d5713bdba8f18a3a36fba2abf3602a39cfcd5663461974a05a6|
| CASES.json |f2de2962270fc9fc4910844325d52eb7a2b373f9c3ac884455a53340b4d87d90|
| STATIC-REVIEW.md |e426214d90ede6b4c6f1ac606392a1b76b71af2aeca7fc476d06dd56c6a388b4|
| AUTHORING-FREEZE-01.json |77631e8fadcf0ab61e3f57e810ad81e14a029cad69a8961c683cc9ff546615f7|
| RUNNER-AUTHORING-FREEZE-01.json |d086512f537cc60db7c089737b61f5044593522b3a6be61cb5333bfce28abfc8|
| impulse-run.mjs |f999040ba6a571a0337265fa0ffb275ad4181135f6f9679ff7b815e917d15df7|
| native-validate.py |c8264b15d67563710091acf16c3adbe829de603dd8ece1de7925fafa21491237|
| RUNNER-PLAN.json |6c8ff71d777890140a583bce27815a3a1a1d21048037125aa0b1830411674747|
| RUNNER-AUTHOR-READY.json |6dcf9a259dce3c1479b39abc834c91c138b1fa6bc9d551b12698a294588f4dc8|
| ../physics-world-p5-2276/command-run.mjs |59bcc0b00e3d606e44fe04eed586a9604885eb390b53a2e90413f1a7bcc2828e|
| ../physics-world-p5-2276/completion-results.json |bdc23b59b4f9184fc8aba1a3d90272d6c19d82c73ef4b89b3b1bca44bb206ad2|
| ../../node_modules/esbuild/bin/esbuild |3e030ee2aa86ad3c33e5e95ae0e53bb03de40e0da35c9b1180a67de4a497cae5|
| ../../node_modules/typescript/lib/tsc.js |2cffde0b8c6760dfb0b5b0382bbb7e00ba6a8b2d981b9205b256a700a481d983|
| ../../node_modules/typescript/lib/_tsc.js |e8f349eabd48486bdb2bf9dc1a00c89d58297270c54b745838879e2859194419|

# Preserved limits

All campaign calls/builds remain0. No repaired provider is authorized by this
review. Preserve the frozen failed authoring records and old static NO_GO.
Any narrow source repair needs a new READY/hash review before the parent may
freeze the unchanged single campaign; no failed physical prefix is available
or permitted to repeat. An eventual operator PASS would still not qualify
public P6a mixtures, contact/full-sheet reactions, dt-refined trajectories,
P6b calibrated fluid coupling or P7 connected mechanisms. P4 NO_GO, termination
of its third cache slice and whole-roadmap integration pending remain unchanged.
