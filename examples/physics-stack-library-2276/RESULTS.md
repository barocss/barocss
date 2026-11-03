---
work_id: physics-stack-library-2276
artifact_type: implementation-and-validation-result
status: bounded_prefix_pass_runtime_cost_no_go
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

Next: change only equal-denominator rational addition in the measured hotspot,
with a separate predeclared exact arithmetic/resource contract. Preserve exact
witness outputs, existing Boolean boundaries, prices/caps and independent gates
before fresh prefix and runtime checks. Full1200/API/desktop adoption remains blocked;
no deployment, release, mobile, Studio, manufacturing or equipment work ran.
