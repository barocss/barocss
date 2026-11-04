---
work_id: physics-stack-library-2276
artifact_type: implementation-and-validation-result
status: bounded_prefix_pass_three_scene_runtime_complete_full_p4_open
owner_role: independent-physics-algorithm-work
source_request: prioritize the actual Physics library and resolve original eight-box1200 NO_GO
last_updated: 2026-11-04
---

# Actual package-owned stack engine

The package now contains the strict feature/witness geometry, one global
normal-contact solve and one full-pair position solve under `src/stack/`.
`prepareStackStep` accepts current internal Body objects, prepares detached
candidate bodies and phase diagnostics, and leaves accepted input unchanged.
There are no example runtime imports, global observers, warm seeds, public
profile changes or fallback into the pairwise World solver. Historical code
is source provenance and evidence; it is not a compatibility path.

The initial23 runtime/declaration sources and their origins are recorded in
`src/stack/PROVENANCE.json`. The five JavaScript position modules retain their
original bytes. An explicit NodeNext declaration boundary and exact build
copies preserve real emitted-module execution. TypeScript compilation checks
the typed callers and declaration boundary; it does not typecheck JavaScript
internals. No new runtime dependency was added.

Support is the original8 unit-mass half-.25m cubes, isotropic inverse inertia24I,
one fixed original floor, dt1/120 and material1/.7/e0. The engine refuses
unsupported loaded tangential motion above the existing1e-10 gate. General
friction, forces/commands, joints, CCD and public World ownership are not
qualified by this internal entry. Original public persistent cap4 and8x8
constants remain unchanged. Cold QR/outer64 is the previously separate
algorithm budget, not an increase to those sweeps.

## Actual Source and emitted checks

Root ran explicit installed Node22 with the existing heavy lane gate:

```sh
NODE22=/Users/user/.volta/tools/image/node/22.19.0/bin/node
$NODE22 examples/physics-stack-library-2276/run.mjs run-01
$NODE22 examples/physics-stack-library-2276/run.mjs run-02
$NODE22 examples/physics-stack-library-2276/run.mjs run-03
$NODE22 examples/physics-stack-library-2276/run.mjs run-04
```

The runner owns one170s inner/180s outer process group. Run01 compiled and
passed the saved32-point Fraction equilibrium comparison and three typed
unchanged-input refusal controls. It then stopped on missing test-state
contacts; an incorrect JSON short-escape size also prevented its final inner
receipt. Both actual failures remain in raw evidence. Run02 passed every
Source physical prefix, then stopped on a build/output directory collision.
Run03 again passed Source, then stopped on incorrect emitted package metadata
that treated the independent CommonJS verifier as ESM. These were harness
failures; package mathematics and all tolerances remained unchanged.

Run04 is **PASS_BOUNDED_CURRENT_PACKAGE_INTERNAL_STACK_PHASE**:

| Actual boundary | Result |
| --- | --- |
| IO boundary controls and strict NodeNext emission | PASS |
| Original32-point independent equilibrium | PASS Source and Native |
| Wrong dt/material/nonfinite input, accepted input retained | PASS Source and Native |
| Deterministic repeated first step | PASS Source and Native |
| ALIGNED/OFFSET/YAW one-step then fresh16 | PASS Source and Native |
| Normal KKT, strict contact lines,36-row position, phase ledger, quality | PASS for these prefixes |
| All physical record numeric words and raw body/point words | Exact Source/Native parity |

Each graph independently accepts51 phase steps: three one-step cases and
three16-step cases, plus a separate deterministic first-step repeat. These
are internal phase acceptances, not public World acceptances. Each graph
checks453231 record numeric leaves as binary64 words, including signed zero.
Each has108 geometry/quality and102 position/ledger requests and replies,
with both independent child processes exiting0, no stderr or trailing output.

The actual ALIGNED first normal problem also exactly matches the immutable
original32-point input: IDs, order, structure and363 binary64 numeric words,
zero mismatches. `compare-original-first32.py run-04 same32-reproduced.json`
reproduces that captured-data comparison without calling physics or generating
a fixture.

Selected measured maxima across these Source/Native prefixes:

| Measurement | Maximum |
| --- | --- |
| Original32 oracle linear velocity error | 1.8041124150158794e-16m/s |
| Original32 oracle angular velocity error | 4.996003610813204e-16rad/s |
| Original32 impulse-work error | 3.469446951953614e-18J |
| Strict point-to-line midpoint distance | 4.199718506419049e-17m |
| Strict local slab violation | 8.326535781947098e-17m |
| Strict contact80/120 difference | 4.099102413421543e-79m |
| Position translation difference | 2.528755444048625e-36m |
| Position reported margin difference | 1.1102230246251565e-16m |
| Final raw/normalized HYP depth | 5.650540078265928e-17m |
| Velocity-phase linear momentum residual | 4.926614671774132e-16kg m/s |
| Velocity-phase angular momentum residual | 1.2009902281302028e-16kg m2/s |

Original distinct geometry/position/phase gates remain unchanged. In particular,
strict contact80/120 agreement uses1e-60; the separate historical signed-position
precision gate is1e-25 (actual prefix maximum4.242876545952403e-60m), with its
physical closure/comparison gates1e-12. No broader precision gate is inferred.
The complete-path CPU/memory/output qualification remains NOT_QUALIFIED.

## Actual library build

The first two `build:library` calls selected Volta TypeScript5.1.3 and stopped
on unrelated CAD source type errors. Their original receipts remain. The
workspace compiler used by the qualified strict runs is5.9.3. The package now
resolves that installed compiler with `build-types.mjs` using the current Node
executable, instead of relying on a global tsc command. CAD sources and HOLDs
were untouched. Root's `stack-library-build-03` actual package build passed:
source provider generation, typed emission, root bundle, exact stack-core
copies and emitted provider generation; outer exit0,11222.382333ms.

## Runtime frontier, not complete P4 qualification

After High source review, Root ran the separately frozen emitted-only runtime
diagnostic:

```sh
$NODE22 examples/physics-stack-library-2276/runtime-diagnostic.mjs runtime-01
```

It starts from original initialization, chains actual candidate bodies and
checks independent normal KKT at every local acceptance. It runs no Python
contact/position/ledger/quality audit, so it cannot qualify settling or P4.

ALIGNED returned543 prepared candidates;542 passed local acceptance and normal
KKT. The unchanged170s deadline stopped step543 after preparation, before KKT.
OFFSET/YAW were NOT_RUN after this first failure. Full independently accepted
steps remain0. This is a NEW actual-library runtime cost NO_GO; the old308-step
complete-path timeout and all earlier physical/cost failures remain unchanged.

Whole scene wall was170.020379334s. Whole-function preparation wall attribution
was168.611802125s, versus0.062158524s for independent normal KKT. Preparation
dominates this observed runtime, so another offline proof micro-variant would
not resolve this failure. These nested measurements are not summed or compared
to the old saved six-frame CPU cost gate.

The accepted stream has543 complete936-byte frames,508248 bytes, no trailing
bytes; child and independent parent-after-reap hashes both equal
`e4a9c14bf488b42501c111df7a30d2b952fbfa2c22d9345d68d1bbae504033e4`.
Reached step543 diagnostics and prior accepted bodies are retained. All37
emitted inputs remain authenticated. No unsupported physics is relabeled PASS.

Root then ran `stack-library-profile-01` with Node CPU sampling on exactly16
emitted ALIGNED preparations. All16 normal KKT checks and17 raw body frames
match the qualified run04 words. Profile artifact SHA256 is
`48ca5d2edb7e60a55136c5aa0e8835fed38ddecbe517e471b455ab4d228ba06f`.
Of4383 samples, strict-line ancestry accounts for5070918/5459750us sample
weight (92.88%); `Arithmetic.make` alone accounts for4621212us (84.64%).
Sampling includes setup/hash/IO and is a location diagnostic, not a benchmark
or speed ratio. `profile-01/analysis.json` preserves the full attribution.

## OPT01 exact face-local reuse

OPT01 changes only strict-line context reuse: two lazy local-direction vectors
and one copied, dense finite binary64 midpoint key with lazy local coordinates
and slab intervals. The key distinguishes signed zero and rejects missing/extra
components before a cache hit. Cache results cannot bypass exhausted arithmetic
bounds. There is no reuse across faces or steps, approximation, point/axis drop,
new tolerance or raised price/cap. Original `PROVENANCE.json` and baseline source
remain; `OPTIMIZATION-01.json` identifies this separate source change.

Root's `stack-library-boundary-01` passed19 Source and19 genuine Native tests:
the12 original geometric/RNE boundaries and7 cache alias/interleave/signed-zero/
invalid-input/exhaustion/baseline-witness cases. Run05 then passed the complete
fresh Source/Native prefix campaign. All six physical reports, first32 results,
453231 record numeric words per graph and every raw point/body hash are exactly
equal to run04, with zero metadata exceptions, normalization or subtree omission.
Actual canonical `stack-library-build-04` passed, exit0/8266.122625ms.

Root ran `runtime-opt01.mjs runtime-opt01-01` on a byte-exact snapshot of that
actual canonical build (28 runtime modules plus its package metadata, provider
digest9c80796679ec27df92f594360a8a78c6b7d3d8ffc2e388a2c35fc4fc3ecf4faa).
ALIGNED returned1051 candidates and accepted1050 locally/normal KKT before
step1051 hit the unchanged170s deadline after preparation. Whole scene wall was
170.079634959s; preparation attribution168.606820737s, normal KKT0.109994399s.
This remains **RUNTIME_COST_NO_GO**. OFFSET/YAW were NOT_RUN. The1051 complete
raw frames contain983736 bytes; both child and parent-after-reap SHA256 equal
`44f102abd72da49ceff7db138cd010fa0e5612b57644cc8533576d90f44ca434`.
All input snapshots remain authenticated. Both old runtime failures remain.
No speed ratio or full-reference comparison follows from these separate runs.

## OPT02 equal-denominator addition

OPT02 retains the initial rational-operation guard and uses the common
denominator directly when both operands have the same denominator. The old
fallback is unchanged. Root's arithmetic-01 passed16 Source and16 Native
literal exact/RNE/resource cases; boundary-02 passed19 per graph. Run06 passed
all physical prefixes, and all six reports/raw words/453231 numeric words per
graph remain exactly equal to run04. Canonical build-05 passed, exit0.

Avoiding an unnecessary denominator product changes resource admission in one
predeclared large-denominator case; both paths still use the unchanged16384-bit
ceiling. This is not universal parity of old resource refusals. A raw16385-bit
sum still refuses before reduction. No arithmetic price or physical gate rose.

The actual canonical runtime-opt02-01 still stopped on ALIGNED:1066 candidates
returned,1065 locally/normal-KKT accepted, then the same170s deadline after
preparation. Whole wall170.708499s; prepare168.670948886s; normal KKT0.113170738s.
All1066 frames/997776 bytes are retained, SHA256
`e239184a2a02482b919642c29fa633a359514bb7d3e32fc7196bd3365e7f0b95`.
OFFSET/YAW remain NOT_RUN and full independently accepted steps remain0.
This is another preserved cost NO_GO; no speed ratio or complete P4 claim.

## OPT03 and OPT04 exact denominator cancellation

OPT03 adds the two positive-denominator divisibility paths to addition. Root's
fixed25 arithmetic bank, prior16 arithmetic bank and19 boundary cases pass in
Source and genuine Native. Run07 retains every run04 physical record and all
453231 numeric words per graph, including signed zero. Canonical build06 passes.
Its one runtime run returned1167 ALIGNED candidates and accepted1166 locally
with normal KKT before the unchanged170s deadline after preparation. Whole wall
170.103485292s, prepare168.713944279s and normal KKT0.122132625s. All1167 frames
and1092312 bytes remain, SHA256
`1fe8315f3f5a676f1f8be4064b78b2f1c1e628fbe3360f8273a82878e6184ed1`.
OFFSET/YAW were NOT_RUN. This first cost failure remains NO_GO.

OPT04 cancels equal or divisible positive denominators in division. It retains
the initial operation guard, checks prior integer exhaustion before a fast
return, refuses zero divisors through the original path and checks each actual
scaled intermediate before reduction. Existing integer/rational caps and
physical tolerances are unchanged. Avoiding redundant intermediate products
has separately declared resource-admission differences, not universal old
refusal parity. The fixed26 division cases include analytic fractions, RNE
words, subnormal values, zero divisors and actual exhausted contexts.

Root ran arithmetic-opt04-01 (26/graph), arithmetic-opt03-02 (25/graph),
arithmetic-03 (16/graph) and boundary-04 (19/graph): all PASS. Run08 passes the
complete fresh Source/Native prefix campaign; all six reports, first32 values,
raw body/point hashes and453231 numeric words per graph equal run04 exactly.
Canonical stack-library-build-07 passes, outer exit0/8.100317708s.

```sh
$NODE22 examples/physics-stack-library-2276/arithmetic-opt04-run.mjs arithmetic-opt04-01
$NODE22 examples/physics-stack-library-2276/run.mjs run-08
$NODE22 examples/physics-stack-library-2276/runtime-opt04.mjs runtime-opt04-01
```

The actual immutable canonical OPT04 provider digest is
`4a765881cfe2aeb6bb04611baf29174035e6f58436d423c7090efdafbddc66a3`.
Its one runtime diagnostic completes all three original scenes:

| Scene | Prepared/local accepted/normal KKT | Whole child scene wall | Parent outer scene wall |
| --- | --- | --- | --- |
| ALIGNED | 1200/1200/1200 | 166.543123958s | 166.582608542s |
| OFFSET | 1200/1200/1200 | 146.164993208s | 146.358255708s |
| YAW | 1200/1200/1200 | 146.909394667s | 147.133826292s |

Each retained stream has1201 complete936-byte frames,1124136 bytes and no
trailing bytes. Child and independent parent-after-reap hashes agree:
ALIGNED `41cd4267a2ef44b20f364fbd919f42b0bac9e885ccea65e3aa7788c9d97e1e64`,
OFFSET `ab3884a1de92b70744a0ec06c569f7381d89485dd3acad7f324addd67a3ddcf6`,
YAW `25f9370d8d19dc77337c2ac5d15893ffa893f4b7b3ef6e25a662d3522816d880`.
Every child exits0; no first failure or input-integrity failure is observed.
The unchanged170s inner/180s outer deadlines apply to each scene.

This is **RUNTIME_DIAGNOSTIC_COMPLETED**, not a complete stack PASS. The full
independent contact/position/ledger/quality observer was absent. Independently
fully accepted steps remain0; public World, resource qualification, recorder,
restore/rollback and new desktop adoption remain NOT_RUN. Original308-step
complete-path timeout, earlier runtime failures and physical NO_GOs are intact.
No speed ratio or same-boundary benchmark comparison is claimed.

## Whole-path observation and next dependency

Root executed the frozen whole-path census once:

```sh
$NODE22 examples/physics-stack-wholepath-2276/census.mjs census-01
```

It uses the actual immutable OPT03 canonical provider and all original cold
references. All three fresh16-step prefixes pass. All195 physical request/reply
pairs are byte-exact to qualified run07 Native; every record/raw/numeric word
agrees, and both reference processes exit0 without stderr or trailing output.
This is an observational boundary, not a rerun of the ended799438000ns proof
microcost candidate. Its complete observed parent wall is20.931844875s.

For48 preparations, observed prepare wall is7.184726545s;48 position-world asks
9.510570873s, strict contacts0.853779080s, phase ledger0.889276625s and51 quality
asks1.377077248s. These are measured nested attributions. Position handler wall
is9.355005752s and its self-reported handler CPU9.330061s. Worker initialization,
serialization and cleanup are outside that handler CPU field; no complete CPU
or64MiB resource claim follows. The largest observed reference operation is
position-world validation.

A single original captured ALIGNED16 request was profiled, preserving the old
physical reply bytes exactly (`profile-01`, outer0). Instrumented evaluate
cumulative time is0.363581246s:72 compact-pair calls0.199519666s,288 SAT calls
0.131542128s, and cold exact LP/QP0.137310625s. These cumulative times overlap
and must not be summed. Instrumentation is a location diagnostic, not timing
qualification. Body preparation reuse can remove repeated preparation; it
cannot claim to remove all SAT work.

Next: reduce measured redundant exact arithmetic and request-local reference
body preparation, with separately frozen contracts and complete old physical
reply parity. Then qualify the entire original1200 path, including actual
frame960 for8–10s settling, all strict contact/36-row position/ledger/quality
checks and complete resources. Only that passed scope can proceed to atomic
public World/recorder integration and desktop testing. No deployment, mobile,
Studio, manufacturing or equipment work ran.

## Saved long trajectory quality, separately executed

Root then audited the immutable OPT04 raw streams with the unchanged original
Decimal80/120 quality authority: all3603 states PASS, including241 frames per
scene at8–10s using each exact frame960 as baseline. All51 initial/first16
complete quality results equal the earlier live census results. Across scenes,
maximum pair penetration is1.98622439071868e-17m, floor intrusion
8.438665936843748e-17m, horizontal drift7.890185519243812e-14m,
8s-baseline vertical drift2.7755575615628914e-17m, linear speed
2.395448185421987e-14m/s and angular speed1.600739038489591e-14rad/s.
Outer guard passes at93.37679625s. See
`examples/physics-stack-trajectory-audit-2276/RESULTS.md` and its lossless archives.
This is saved trajectory quality only. Actual contact pairs were unavailable;
the empty-list overlap count is diagnostic. It does not fill the missing full
contact/position/ledger/live-resource/API gates or add independently full steps.

## OPT05 exact dyadic normalization

The actual package Arithmetic.make now returns a checked reduced integer for
denominator1 and uses the exact low-bit GCD for a power-of-two denominator.
Other denominators retain Euclid. Invalid input, zero denominator, canonical
zero and sign order remain, and the new integer shortcut checks already failed
contexts. No cache, approximation, dependency or physical/counter cap was added.
Nonbinary denominators pay two extra actual integer operations; resource work
can improve or regress. This is not universal old refusal parity or a speed claim.

Root actually passed fixed32 normalization, retained26/25/16 arithmetic and19
boundary cases in Source and genuine Native. Run09 passes every original first32,
invalid-input retention, repeat and three one-step/fresh16 physical gates.
`compare-prefix.py run-04 run-09` checks all117 complete payload files per graph,
all six physical reports and all453231 numeric-word digests/raw words exactly,
with no normalization, metadata exception or subtree omission. Canonical build08
passes, exit0/8.051469084s. The actual canonical provider snapshot digest is
`6c3bf494f3a53f7ac32154cb271ec05e6cf9eea3b495e73cc87e4d85c8636cf5`.

The one runtime-opt05-01 diagnostic completes all1200 local+normal-KKT steps in
each scene, with no first/integrity failure:

| Scene | Completed | Whole child scene wall |
| --- | --- | --- |
| ALIGNED | 1200 | 161.172798625s |
| OFFSET | 1200 | 143.056669083s |
| YAW | 1200 | 140.330518834s |

All three1201-frame raw streams are BYTE-EXACT to OPT04. Exact initial physical
metadata and actual frame960 identity permit reuse of the already executed
3603-frame saved-quality audit. `saved-quality-input-reuse.json` records old/new
provider identities separately, exact physical input equality and ZERO new
numerical reference calls. This is not a newly executed quality campaign or a
substitute for full live contacts/position/ledger/resources. Full independent
steps remain0; API and fullP4/resource qualifications remain false.

A separate16-step make-call observation preserves all physical outputs and65
old wire pairs. Nonbinary denominator calls are94950, with3786 hypothetical
four-entry raw-pair hits. This does not justify a new production cache or prove
any saved GCD/time. No cache was implemented. See
`examples/physics-stack-make-census-2276/RESULTS.md`.

## OPT06 duplicate result checks (2026-11-04)

The actual package source splits normalization after the existing checked
numerator/denominator entry. Only general add, mul and general div results that
have already passed both primitive bit checks use the private helper. BigInt
math, GCD, operation/bit limits, counter totals, failure priority and outputs
remain exact OPT05. Source delta is7 added lines and3 call-site replacements;
there is no new public API, solver option, fallback or runtime dependency.

Root actually passes the new32 independent arithmetic/counter/error cases on
Source and genuine Native. It also retains all prior32/26/25/16 arithmetic and19
boundary cases per graph. Actual run10 independently passes original first32,
input retention, repeat and three-scene one-step/fresh16; every physical report,
117 complete payload files and453231 numeric words per graph equal run04 with
zero exceptions. Canonical build09 passes9.343297625s.

A new immutable actual canonical build09 closure (28 code files +package)
then completes all three1200-step **runtime-only** diagnostics:
ALIGNED157.965913125s, OFFSET138.402241417s, YAW136.722443083s. Each has1200 local
and independent normal-KKT acceptances,1201 full raw frames and no first failure.
Closure aggregate is7acdbb4af249c7c8492aadbac94b5d107f1e73fe07d84dd018c29c2d3dd3e331.
Every raw byte and physical initial metadata field equal runtime05. Code identity
is a separate sidecar, not a physical exception. Exact physical-input identity
permits explicit reuse of the paid saved-quality audit with zero new reference
calls. This is not fresh live contact/position/ledger/quality qualification.
See evidence/runtime-opt06-01/runtime05-word-parity.json.

No speed ratio follows from these differently timed runs. Full independent
acceptance stays0/API false for the diagnostic. The original complete pipeline
still has its preserved full01 NO_GO:1114 ALIGNED steps, first observed1116
producer wait, unresolved1115 position and earliestUNKNOWN. Actual960 baseline
and155 committed settling frames do not qualify the missing1200 duration.
The separate complete-runner results and exact-size archive qualification are
under examples/physics-stack-complete-2276. The q1 archive candidate ends on
its fixed80MiB screen; a separately sourced stateful path is not yet adopted.
All old failures, numerical tolerances,8x8/public4 limits,HOLDs and deployment
restrictions remain unchanged.

## OPT07 owned sum-square (2026-11-04)

The package Arithmetic now owns normalization of a sum before squaring it.
Coprime numerator/denominator have coprime squares, so the inner strict-line
midpoint-distance square omits redundant GCD work. Generic multiplication,
input checks, checked product order,16384-bit ceiling,200000/2000000 operation
caps,16 rounding steps and all physical tolerances remain unchanged. Nonunit
integer work decreases because actual operations are removed; universal old
work-refusal/counter parity is not claimed. The frozen contract records zero,
integer and stale-bit behavior explicitly. No expected solution, cache or new
public hook exists.

Root actually passes new32 cases and retained32/32/26/25/16 arithmetic plus19
boundary cases on Source and genuine Native. Natural exhaustion tests use
actual operations and no counter mutation. New exact9/64 completes at the same
2M work cap where old redundant normalization refuses; the next tighter
prefilled case still refuses at the original product boundary.

Run11 then passes original first32 equilibrium, input retention, repeat and all
three one-step/fresh16 populations. All six physical reports,117 whole payload
files and453231 numeric words per graph remain exact to run04. Canonical
build10 passes9.252183583s. The actual copied canonical28-code-file+package
closure is6a504f420b8d2db5e60cd8b73103ac0c136381d56a966cb41ee54feda4336305;
its four test helpers match prior paid bytes. The source and emitted snapshot
are frozen for the next complete campaign after storage qualification.

Cost/full1200/API/recorder/desktop qualification for this new candidate is
NOT_RUN. No extra runtime-only campaign is required by the new contract; the
next cost trial is the original complete population after all prerequisites.
Previous OPT06 runtime3603-frame equality, full01 cost NO_GO and every earlier
first failure retain their exact scopes and statuses.

## OPT08: exact bit-length encoding

Root isolated32 Source/genuine Native controls pass (guard
`stack-library-arithmetic-opt08-01`,1632.356833ms). Root then adopts only the
`checked` bit-length expression, sourceSHA
`abb2036ddd46c146a42299173d471a360afc7c30226f694f58c1515fab10f2af`.
The entire candidate equals preserved OPT07 apart from this expression and its
type-only import relocation. Literal nibble widths, analytic shift exponents
and fixed IEEE words are independent expected results; actual canonical OPT07
is secondary parity evidence. Exact counters, work admissions, checked peaks
and refusal priority are retained.

Actual production retained07/06/05/04/03/16 banks (32/32/32/26/25/16), boundary19
and run12 Source/genuine Native pass. Run04→run12 complete physical comparison
passes (guard `stack-opt08-physical-parity-01`,191.364792ms): all117 payload files
and453231 numeric words per graph, without excluded fields or normalization.
Canonical build11 passes9.206205666s. Actual28-module+metadata closure and four
unchanged emitted helpers are copied into `evidence/canonical-opt08-01`,
provider digest `09e0eaba79ac8b7ac3bfe268849cf72a0d429b54b71032ad63b9ecd8b6479c2a`.
The provenance explicitly defines its identity hash and binds the build receipt.
This is private library implementation/compilation proof; full1200 cost and
public World adoption remain unqualified.

The preceding OPT07 full02 retains1098 independently verified/archived host
steps before its original deadline. Its failed CPU owner admits no campaign
scene; campaign count0 and host count1098 are separate. Original full01 and
all storage-candidate failures remain. The actual1099 received failure packet
now survives; data-only recovery restores84 signed-zero paths and four body
frames, adding zero physical acceptance. New OPT08 requires fresh same-source
prefix/full qualification. No API cap, HOLD, tolerance, shared280MiB cap, mobile
test, release or deployment changes.

The isolated candidate NodeNext graph emits CJS, while the actual package
module is ESM; their whole emitted bytes differ. Root therefore runs the same
fixed32 test body against actual canonical ESM, adapting only its two static
module import paths. `stack-opt08-canonical-arithmetic-01` passes all32 in
265.608125ms. No test formula, expected value, cap or tolerance changes.

Actual canonical OPT08 prefix04 passes all48 steps,195 old wire pairs and
425916 recovered words. Full03 then ends on original cost limits:1153
contiguous host steps; first observed producer1155, unresolved world1154,
earliest UNKNOWN. Owner/campaign accept0; OFFSET/YAW NOT_RUN. No speed ratio
or complete1200/API claim. Original first failures remain. The failure envelope
selects actual1153 while archiving; it later commits. Pending1154 packet is
not in that envelope; reached RPCs remain in the closed partial archive.
See `../physics-stack-complete-2276/FULL-03-RESULTS.md`.

## OPT09: remove a redundant initial exact zero-add

Root isolated32 Source/NodeNext passes1696.869459ms. Only the first-present
nonzero nonunit product in a dot skips ZERO+product after actual mul has
normalized it. Zero/integer first products retain old work/guards; sparse
arrays retain native reduce order. All product bit checks remain, peaks are
unchanged and actual work can decrease at unchanged caps. See the independently
traced literal bank and `OPTIMIZATION-09-CONTRACT.md`.

Root adopts source61baf61303c5450b69329f2006883b712eee75635d7ca0d53a2100ceab1c06ed.
All production retained07/06/05/04/03/16 banks and boundary19 pass Source/genuine
Native. Run13 passes all51 phase acceptances and453231 record words per graph;
all117 payload files per graph exactly match run04, with no field exceptions
(physical-parity guard408.449584ms). Canonical build12 passes8.99330275s. Its
actual immutable closure is `evidence/canonical-opt09-01`, aggregate
5830b5e47f1c274a100c638fc790191827c17b2de27847a852310b06dadf10d5.
The same fixed32 test body also passes actual canonical ESM348.550541ms; only
two static test-module import paths change. No complete1200 cost/API claim.

Failure-window evidence separately passes all original8 and new3 tests
(997.018209ms): additional received packets survive an earlier captured packet
committing during drain. At most3 aliases, same2MiB emergency envelope, no new
success-path clone. Oversize omission remains explicit. This new helper cannot
recover the missing packet in old full03. Fresh combined-prefix/full integration
with this component and the actual OPT09 provider remains required.

Full05 actual canonical OPT09 ALIGNED1200 LIVE passes every original gate,
full10803-entry recovery, final source authentication and clean after-wait CPU
collection at169.46208579209633s. Complete1201-record JSON/word/raw hashes match
paid offline04 exactly, so its recorded maxima can be reused by byte identity
with zero new reference calls. OFFSET then stops at shared evidence capacity
after328 host commits; selected330/additional329 received packets survive.
YAW NOT_RUN; whole original three-scene exit and public World remain NO_GO.
See `../physics-stack-complete-2276/FULL-05-RESULTS.md`. Next exact local-cost
and lossless evidence representation work retain every original cap/tolerance.

## OPT10: exact common-denominator local projection

Root adopts the actual rotation-denominator LCM/dyadic-coordinate kernel after
isolated32 Source/NodeNext tests pass1650.225875ms. The new source is
eb24b03efa39b5beb4d4fe132bfa723b7273d4c30ce81d51c989dcc5d1925b53.
All retained07/06/05/04/03/16 banks and boundary19 pass in Source and genuine
Native. Run14 retains all51 phase acceptances,453231 numeric words and117
payload files per graph exactly to run04; the physical parity guard passes
472.453375ms. Counters and work/bit peaks can change; caps do not. New local
entry refuses stale failed contexts after original relative assembly, as
specified before implementation. No old failed-context resume parity claim.

Canonical build13 passes14513.908417ms. Actual immutable ESM closure
0449ad0eeaf504c416e2de9659a280797773962dd9c075c23fb5f3a05a15a7e5
changes only strict-line.js from canonical OPT09; four helpers remain exact.
The same fixed32 test body passes actual canonical ESM753.509709ms, adapting
only its two static import paths.

Fresh complete prefix07 then passes ALIGNED/OFFSET/YAW16 each:48 independent
steps,425916 recovered words,51 complete records and195 original wire pairs.
See `../physics-stack-complete-2276/PREFIX-07-RESULTS.md`. Full1200 for OPT10,
public World admission and desktop remain NOT_RUN. The original OPT09
ALIGNED1200 PASS and whole-three-scene NO_GO are preserved separately.

The distinct L227 lossless archive candidate passes33 component tests, then
ends its single80MiB screen at5707 of10803 input frames with RETAINED_CAP.
Full recovery is NOT_RUN and complete owned CPU is UNKNOWN. It is not adopted
or retried. Its first screen/source/hash receipts remain under
`../physics-stack-lexeme-archive-2276/`. Next verify a new bounded exact normal
equilibrium candidate on the same authenticated32 points before any new
trajectory or API admission. It must pass all old physical gates unchanged.
