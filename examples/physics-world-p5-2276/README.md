# P5 common World domain transition

Current status: **P5_DONE_BOUNDED_LOCALSELECTED**, with explicit native rendering
SDK externals. Public source/native runtime, source/native strict consumers,
127logical compile checks, selected4World source documentation examples and
site structure/build/link checks pass. Native rendering SDK implementation and
product execution are NOT_RUN. Existing HOLD, original8-box NO_GO, original
hinge failure, tolerances and first receipts remain. This is not whole-roadmap
completion or develop integration; see `completion-results.json`.

The sections below retain the chronological baseline and intermediate status.

`SCOPE-CONTRACT.md` and `MIGRATION-PLAN.json` define the proposed direct cutover
of21 active leaf callers. No compatibility factory, second clock or hidden
Domain World is part of the target. Source inspection confirms Float64Array
storage in both current kernels; preserve it and their arithmetic order.

The parent froze `BASELINE-CONTRACT.md`, `BASELINE-PROVIDERS.json` and the runner
before runtime. An incorrect child-dispatch name was found and repaired during
static review before the freeze or any numerical call. The parent freeze records
that boundary. All1376 listed provider/authority files were authenticated.

Commands ran with installed Node22 under the existing heavy gate, in order:

```sh
$NODE22 examples/physics-world-p5-2276/baseline.mjs --run-id baseline-source-01 --graph source --authorize-baseline
$NODE22 examples/physics-world-p5-2276/baseline.mjs --run-id baseline-emitted-01 --graph emitted --authorize-baseline
```

Both runs reproduce five known post-commit preparation failures: cloth, plain
fluid, XSPH fluid, CAD inner-fluid copy and CAD outer return-copy. Each exact
synthetic Error escapes after cursor0 becomes1. The accepted state equals an
unfailed control's step1, and continuation equals its step2. This is evidence
of an atomicity gap, **not** successful rollback, real OOM or new physical accuracy.
All five complete case records match across source/native graphs exactly,
including recorded raw little-endian Float64 bytes and diagnostics.

Per graph:14 actual constructors (2cloth,8fluid,4CAD wrappers),28 actual step
method entries,20 numerical commits (4cloth solver and16PBF calls),20 public
step attempts/15returns,5 known throws and10 successful top-level cleanups.
Combined:28 constructors,56 method entries,40 commits,10 known failures. Four
common-profile create attempts per graph also refuse before domain-shape parsing.
Those outer-only inputs do not prove validity of a complete future domain model.
`baseline-results.json` contains receipt hashes and actual counters.

Both groups closed with pipe EOF and no remaining owned process group. No
runtime deadline, output limit, tolerance or physical bound was raised. The
source graph is an isolated test overlay; native execution uses copied actual
unbundled dist files and a native CAD resolver, without source fallback. Captured
old providers under evidence are historical test operands, not a product
compatibility path. Production sources remain unchanged at this checkpoint.

Next: extract clock-free candidate kernels, compare their outputs against these
captured states, prove candidate ownership and measure canonical model sizes.
Then perform one public World/API/caller/export/docs cutover. Domain recording
requires its unchanged128KiB model/1MiB record limits and closure gate or explicit
tested profile refusal. P4/P6/P7 remain separate dependencies. Develop merge waits
for the whole required roadmap. No push, deployment, release or equipment claim.

## Input precision and native static-operand checkpoint

Before candidate execution, source review found that the original fluid
smoothing radius is `1.8 * 0.05`, whose binary64 value is0.09000000000000001.
The authored recipe's literal0.09 differs by one bit. The frozen recipe stays;
`KERNEL-CLARIFICATION-01.json` explicitly selects the unchanged original exported
constant for new fixture data. No kernel, physical tolerance or field-normalizing
compatibility path changes. Candidate/model construction was still NOT_RUN at
this finding. Future public admission/docs must use the selected exact value.

A suspected shelf rounding difference was checked independently. The original
adapter subtracts integer millimetres before conversion, so both300mm half-spans
produce the literal0.15m. `KERNEL-CLARIFICATION-02.json` records the source proof.
A separate, pre-frozen native operand run then made exactly one public
`admitCadSurfaceProxy` call using captured unbundled native providers. It passed
exact source bounds[200,200,100]..[500,200,400]mm, center[0.35,0.2,0.25]m and
half-extents[0.15,0.01,0.15]m, including captured F64LE bits. It made zero World
or candidate calls. Its nested compiler call follows from the frozen admission
source; only the public admission attempts/returns were directly counted.

```sh
$NODE22 examples/physics-world-p5-2276/static-input-run.mjs static-input-guard-01 static-input-01
```

`static-input-results.json` pins that actual receipt. This is operand provenance;
it does not qualify active contact response. The captured first two fluid steps
have zero obstacle hits and cannot supply that proof. Original later active-hit
receipts remain historical authority, not new common-World observations.

`kernel-implementation-freeze-01.json` freezes private-stage recipes before
implementation. New domain stages remain unexported and public admission remains
pending P5b. The author's early `tsc --noEmit` exited0 without the required heavy
gate. It is reported as ungated compile-only evidence, not a gated verification;
no emission, model construction or kernel call ran in that check. Later actual
source/native campaigns require the normal guard and frozen provider graph.

`baseline-review.json` also records the whole-baseline whitespace-check failure:
a preserved native CAD declaration has inherited trailing whitespace. Its bytes
are exact old provider operands and were retained. Authored-scope whitespace
checks pass; the inherited failure is not relabeled.

## P5a private extraction verified in source and native paths

`kernel-source-01` and `kernel-emitted-01` both PASS the frozen four-fixture
campaign. Per graph:4 initializations,32 prepare attempts,20 returns,12 exact
synthetic throws,8 nominal outputs and12 recoveries. Actual helper counts match
the frozen recipe, including175393 cloth distance projections and24 fresh PBF
solver calls per graph. No World factory/step, recorder or restore ran.

Nominal output arrays at captured steps1/2 and each recovery match the old raw
F64LE authority exactly: measured position/velocity differences are zero. Source
and native nominal/size receipts are byte-identical. Every injected mid-kernel,
diagnostic and output-copy failure retains accepted buffers/model/definition;
next preparation equals the never-failed candidate/output control. Poisoning
returned arrays/diagnostics does not change candidates or accepted buffers.
Historical diagnostic JSON cannot supply unknown old zero signs; this limit is
separate from array-bit and new-state fingerprint checks.

Three private production additions live in `src/domain/{types,cloth,fluid}.ts`.
They own candidate buffers and fresh solver scratch; they have no World, clock,
reset or recording owner. All1376 original provider/authority files remain
byte-identical. Native `tsc` emitted to a fresh evidence directory, exit0, then
actual emitted private modules ran unbundled. Current production dist was not
rewritten. Guards closed normally with pipe EOF/group absence and no timeout.

The source-only overlay anchor failure is retained in `kernel-source-check-01`.
A whitespace-only matching repair passed text/compile inspection in02 before any
candidate execution. This is distinct from the previously disclosed ungated
`tsc --noEmit`. Actual native emission and candidate execution were gated.

Commands used parent-frozen source hashes and argv-supplied freeze digest:

```sh
$NODE22 examples/physics-world-p5-2276/kernel-run.mjs --run-id kernel-source-01 --graph source --freeze examples/physics-world-p5-2276/kernel-source-execution-freeze-01.json --freeze-sha256 "$SOURCE_FREEZE_SHA256" --authorize-kernel
$NODE22 examples/physics-world-p5-2276/kernel-run.mjs --run-id kernel-emitted-01 --graph emitted --freeze examples/physics-world-p5-2276/kernel-emitted-execution-freeze-01.json --freeze-sha256 "$EMITTED_FREEZE_SHA256" --authorize-kernel
```

Measured canonical model bytes:cloth222324; plain fluid17732; XSPH17757;
static-box18376. Cloth exceeds recorder's unchanged131072-byte model cap.
Fluid sizes fit that cap but do not qualify recording closure. Actual public
record support/refusal tests remain P5b work. The private initializers' checks
are trusted internal checks, not complete public profile admission: P5b must
validate exact cloth topology/rest/mass data, full schema/IDs/static geometry/
material/filter roles before runtime allocation.

`kernel-results.json` pins results and proof boundaries. This is two-step
transfer/ownership proof only. Public common-World admission, one shared host
transaction,21 caller removal, package exports, recorder decisions, full declared
horizons, active contact and fresh-scratch cost are pending. P5b must make one
atomic public cutover without compatibility aliases. All prior HOLD/NO_GO,
tolerances and first receipts remain. Whole-roadmap merge/deployment did not run.

## P5b implementation scope frozen; public qualification NOT_RUN

`P5B-CONTRACT.md`, `P5B-PLAN.json`, the independent source admission review and
`p5b-implementation-freeze-01.json` define the next atomic cutover. Source/native
qualification is **NOT_RUN**. Merely defining the tests is not a PASS.

The admission path returns pure validated DomainModelData; it initializes no
kernel. The sole common World initializes once, owns clearable state/lifetime/
clock/guard and prepares output/log before one assignments-only commit. Static
owners remain actual model bodies, without a fake box-interior rigid kernel
record. Fixed cloth native values and implicit zeros use raw identity checks;
fluid keeps original strict initial bounds, admitted layout variation and old
spacing expression. New fixed-field -0 is rejected rather than normalized.

The direct cutover includes21 callers, old factory/subpath/global/DTO removal,
actual export/declaration paths, optional CAD data-only adapter, and current
docs. Shared presets are inert example data with detached copies, not another
package World factory. CAD currentness remains an explicit caller operation.
Cloth recording refuses at the unchanged byte cap; three fluid profiles refuse
unqualified recording before attachment. No new wire path or limit increase.

Planned per graph:101 factory attempts/37 returned Worlds and6334 World steps:
6281accepted,13 unknown/log synthetic failures,40 refusals. Four of those
refusals deliberately poison fresh candidates to exercise the actual typed
NUMERIC_LIMIT constructor and shared root error identity. They are validation
controls, not naturally observed physical failures. Total World-step injections
are17; a separate headless host-submit failure makes18 harness injections.
Counts include full240-step cloth and720-step fluid trials, active shelf gates,
CPU controls, headless host/shadow reset and rigid recorder ownership. Actual
browser/Studio/UI proof is NOT_RUN and is not implied by headless checks.

The full240-step independent cloth raw stream is absent from old sparse
snapshots. Its proposed one-time original research oracle has1 constructor,
240 steps and241 raw frames, reused by both current graphs at unchanged1e-12.
Preset generation separately allows original createSheet1/mass accumulation1/
canonicalEncode12, with zero Worlds/solvers. Both require effective-source
freezes before execution; neither ran during contract authoring. All64 negative
model mutations/commands/faults and actual provider graphs also need freezing.

A separate affected-document-example runtime cohort must be counted/frozen
before executing changed snippets. Compile/build/link evidence alone does not
complete the earlier user request for actual example verification. All earlier
HOLD/NO_GO, first failures, tolerances and receipts remain. P4 cache approach
ended at cost NO_GO; P4 full-stack and required P6/P7 still block develop merge.
No push, deployment, release or equipment validation is authorized by this plan.

## One-time independent cloth reference captured

`oracle-01` PASSes original research generation only:1 research constructor,
1 research topology call,240 accepted research steps/1920 inner advances,
6013440 distance projections,3840 sphere projections and241 raw frames.
Physics World factories/current kernel calls remain0. Raw position+velocity
bytes total3343152, within the frozen4MiB data cap. Raw stream SHA256:
`84afe417169896fd243ad5e0ca0913a845183b4109812cd4561a03806db3558c`.
The original research closure was authenticated, copied and imported natively;
only counter overlays changed those copies. Original source files remain intact.

The parent supplied `oracle-execution-freeze-01.json` and its calculated SHA as
argv, under the existing heavy gate:

```sh
$NODE22 examples/physics-world-p5-2276/oracle-run.mjs --run-id oracle-01 --freeze examples/physics-world-p5-2276/oracle-execution-freeze-01.json --freeze-sha256 "$ORACLE_FREEZE_SHA256" --authorize-oracle
```

The owned group closed normally, without timeout, output overflow or survivors.
`oracle-results.json` pins the actual receipt/data. Future source/native public
trials authenticate and reuse these same241frames at original1e-12 absolute
error; no second reference generation is authorized. The reference generation
is not a current public API comparison, cost PASS, browser or equipment proof.

## One-time public-model data authoring verified

`model-data-01` PASSes the separately frozen generation:original topology1,
one additional explicit vertex-mass accumulation,12 canonical encodes and16
copy-isolation checks. World/step/CAD/initializer/rest-density/solver calls are0.
Every complete model's canonical bytes/SHA matches the prior actual P5a target;
cloth stays222324bytes, fluids17732/17757/18376. Literal rendering preserves
binary64 and explicit -0; internal/reference/example containers are detached
and deeply immutable. No new Physics factory, dependency or public subpath.

Generated internal `src/domain/cloth-reference.generated.ts` has SHA
`c9ee88af8e25b533c2694433502b28f51dffdeae5cce656b53eb36a187be60bc`.
Example `examples/physics-model-data-2276/model-data.mjs` and docs public
`physics/model-data.mjs` are byte-identical, SHA
`ccd3aff04c93027a0c4561d9aab1757e6a6a6f0b7bc54ec13885ff4b4d59e604`.
They export inert physicsModelPresets plus copyPhysicsModelPreset(profile),
which returns detached plain model/options data. Preset import performs no
Physics construction or geometry/solver arithmetic. Current public API users
still call actual createPhysicsWorld themselves.

```sh
$NODE22 examples/physics-world-p5-2276/model-data-run.mjs model-data-guard-01 model-data-01
```

The parent verified19 source/tool inputs plus actual Node/esbuild executables
before the owned-group run. `model-data-results.json` pins the actual receipt
and all outputs. No timeout/overflow/group survivor occurred. Generated outputs
remain frozen, and no second generation is authorized. The generation validates
input data/ownership, not public admission, full World behavior, performance,
native declarations, documentation snippets or actual equipment. Those P5b
qualifications remain NOT_RUN while the atomic implementation is in progress.

## P5b bounded public runtime PASS; static/docs gates pending

Actual `public-source-01` and `public-native-01` both PASS the frozen full
cohort. Per graph:101 factory attempts,37 Worlds,64 rejected creates and6334
step entries:6281accepted,13 unknown/log synthetic failures and40refusals,
including4 deliberately poisoned-candidate NUMERIC_LIMIT controls. Each graph
also preserves one external headless host-submit failure. Actual constructor,
initializer, solver, accepted cursor and cleanup counts match the fixed ledger.
The two graphs use actual source and published unbundled/native package paths,
with no source fallback. Canonical PhysicsError and recorder ownership pass.

Before these trials, native-entry-01 failed at ESM linking: relative external
`./types.js` matched the internal domain/types helper and routed its functions
to root types. That exact failed bundle/types/manifest and error remain saved.
`build-root.mjs` now externalizes only three canonical resolved root source
files. It leaves domain/types in the bundle, keeps the same build target and
adds no dependency. Native-entry-02 PASSes import/error-class identity. Source
and native numerical trials ran only after this repair. All prior failures,
HOLDs and criteria remain; this was a build integration failure, not physics.

Selected numerical proof:all five240-step cloth trajectories compare to the
same one-time original241-frame reference at1e-12 absolute component error.
The exact peak difference was asserted but not saved; no zero-error claim is
made from that comparison. Old cloth checkpoint hashes/residuals also match.
Maximum sampled triangle penetration is0.0013840839157666096m (<0.002), and peak
structural extension0.05174255069177636 (<0.10). Source timed p95 values are
1.850/1.690/1.772ms; native1.828/1.866/1.947ms, each below1000/120ms.

Low-v1 density errors are0.22785881124725596 at60 (<0.25) and
0.015288410357167534 at240 (<0.05). XSPH cost ratios are1.144/1.200 source and
1.141/1.212 native (<1.5). Retained low-pair heap changes are70288/73312bytes
(<1MiB) under the frozen GC method. Exact old fluid60/240/720 hashes, raw repeats,
active shelf60/240 hashes and geometry checks pass. Shelf cumulative hits are
859/2660; relative costs0.974/0.980 (<1.5). This does not certify3600 steps,
calibrated fabric/CFD, dynamic coupling or real machinery.

Whole-step failure/control cohorts pass full accepted-state/definition/log
fingerprints and recovery. Cloth recorder attach refuses at the original
128KiB model cap; three fluid profiles refuse unqualified recording with no
owner residue. Rigid recorder log failure/recovery and the real two-World
headless host/reset seam pass. Browser/Studio/UI proof is separate NOT_RUN.

```sh
$NODE22 examples/physics-world-p5-2276/public-run.mjs --run-id public-source-01 --graph source --freeze examples/physics-world-p5-2276/public-source-execution-freeze-01.json --freeze-sha256 "$SOURCE_SHA256" --authorize-public
$NODE22 examples/physics-world-p5-2276/public-run.mjs --run-id public-native-01 --graph native --freeze examples/physics-world-p5-2276/public-native-execution-freeze-01.json --freeze-sha256 "$NATIVE_SHA256" --authorize-public
```

Both owned groups close with EOF/absence proof, no timeout/overflow. Evidence
including the oracle reserve is5.44MiB source/14.03MiB native, below64MiB.
`public-runtime-results.json` pins receipts, exact counters, errors/bounds and
performance values. Strict consumers, all computed bundles, changed actual docs
examples and docs build/links remain pending; P5b is not marked wholly complete.
Old runtime factories/subpaths/DTOs are removed directly, with historical old
providers/first failures retained. P4 original8-box NO_GO and required P6/P7
still block whole-roadmap develop integration. No push/deploy/release occurred.


## P5b consumer and documentation closure

`validation-static-05` PASSes51remaining bundles and one lint invocation.
It authenticates/reuses76earlier bundle passes and both strict source/native
positive/negative consumers. All60source entries pass. Across source/native
entry pairs, generated programs and independent numeric roots there are127
logical bundle checks and130actual attempts, including3preserved build
failures. A fourth startup failure ran0bundles. No World or old numeric campaign
ran during these static checks.

The first failure was a loader-only entry incorrectly required to contain a
Physics module; exact20Physics/40zero-own-closure policies replace that single
blanket assumption. The second/third failures expose absent Viewer/CADInterop
and GPU emitted SDK files. Full source-report/manifest inventory finds10missing
published identities, including aliases; the minimal exact external frontier
has8identities across13hosts. Native Physics/CAD/replay use actual emitted
modules; no source fallback occurs. SDK implementations and browser/product
integration remain NOT_RUN. The final startup failure was missing copied-file
provenance for the already-passed packed native consumer. Exact staged/original
byte/hash equality repairs that reuse proof. All original QA files/receipts are
saved under their failed run's `author-inputs/`; criteria and Physics sources
are unchanged. Reviews02–05 describe each correction.

`docs-example-source-01` separately PASSes the exact displayed four-profile
sample:4factories/4Worlds,4accepted steps,4recorder refusals and4disposals.
It executes one filtered test per process; the other three callbacks are
skipped. No restore, broad175sample runner or new native numeric cohort runs.
The actual displayed function is unchanged; only test counters/error observers
are added to its numerical source dependencies. This is source example proof,
not native documentation-runtime or browser proof.

`docs-structure-01`/`docs-build-01` passed; `docs-links-01` failed on a stale
mutable current roadmap copy. Its original error and original copy hash are
preserved in `docs-links-first-failure.json`. After current API/status text and
that copy are corrected, `docs-structure-02`, `docs-build-02` and `docs-links-02`
PASS:73structure pages;5selected rendered pages,806link occurrences,215anchor occurrences,26snippet
regions and14byte-identical historical receipt copies. The mutable roadmap
copy matches package source. The example/public/built inert model assets also
all match SHA256 `ccd3aff04c93027a0c4561d9aab1757e6a6a6f0b7bc54ec13885ff4b4d59e604`.
No network check, deployment or publication occurs.

```sh
$NODE22 examples/physics-world-p5-2276/validation-run.mjs --run-id validation-static-05 --phase static --freeze "$FREEZE_05" --freeze-sha256 852ffe99f3c1a9374dc67dd57d404da351d9a7d6ff8eac25cb8b022209471829 --authorize-validation
$NODE22 examples/physics-world-p5-2276/validation-run.mjs --run-id docs-example-source-01 --phase docs --freeze "$FREEZE_05" --freeze-sha256 852ffe99f3c1a9374dc67dd57d404da351d9a7d6ff8eac25cb8b022209471829 --authorize-validation
$NODE22 examples/physics-world-p5-2276/command-run.mjs docs-structure-02 apps/library-docs $NODE22 scripts/check-docs.mjs
$NODE22 examples/physics-world-p5-2276/command-run.mjs docs-build-02 apps/library-docs $NODE22 node_modules/vitepress/bin/vitepress.js build docs
$NODE22 examples/physics-world-p5-2276/command-run.mjs docs-links-02 . $NODE22 examples/physics-motion-docs-2276/check-site.mjs
```

These are the actual commands, with `$NODE22` set to the installed22.19.0 and
`$FREEZE_05` the absolute `validation-execution-freeze-05.json` path. Each ran
inside the existing heavy gate and a fresh bounded owned process group.
Receipts are immutable; reruns require fresh IDs and a reviewed provider freeze.
`completion-results.json` pins final results and proof limits. P4 full original
stack, required P6/P7 and whole-roadmap merge remain pending. The next private
attachment impulse proposal is not a coupled-World or public API PASS.
