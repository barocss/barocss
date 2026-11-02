---
work_id: physics-world-p3-2276
artifact_type: bounded-public-hinge-qualification-report
status: p3_selected_public_api_pass
owner_role: independent-physics-algorithm-work
source_request: qualify the original disjoint-hinge case under the common World contract
last_updated: 2026-11-02
---

# P3 disjoint hinges

The common World now admits the exact disjoint-hinge profile. The staged
candidate passes the original 1,200-step case in observed source, ordinary
source repeat and actual emitted native ESM. Variant, refusal, lifecycle,
recorder and hardened current API gates also pass. Their proof boundaries
remain separate. Connected mechanisms and whole-engine acceptance remain NO_GO.

Base: `2e270d3b2d452e684ca6abe333ee761f1247c10e`.
Branch: `codex/physics-world-p3-2276`.
Runtime changes are `src/world.ts`, `src/model-admission.ts` and new
`src/disjoint-hinge/admission.ts` / `stage.ts` in the Physics package. Package
README/roadmap, site profiles/verification and the docs sample also change.
`CONTRACT.md`, `GATES.md`, `control-plan.md` and `CONTROLS-ADDENDUM.md` define
the fixed profile, exact comparisons, physical criteria and call ceilings.

## Profile and implementation

Four 1 kg spheres of radius 0.1 m form two disjoint directed hinge pairs, in planes
Z0 and Z1. Both use axis+Z, limits±.8rad, motor speed.5rad/s,
motor impulse.0001Nms and reaction cap.01Nms. Gravity is zero; dt is1/120s.
Only empty commands are supported. Source bindings and caller array order follow
P0. Connected joints, shared bodies, arbitrary transforms/materials/gravity,
interacting contacts and nonempty control commands remain unsupported.

The four-file candidate patch reuses existing projection/report mathematics.
It adds narrow admission and canonical phase orchestration. It does not add
an engine, activation flag, compatibility factory or alternate public World.
The current-public source/emitted baselines both reproduce the original
`INVALID_CONFIG` refusal before this staged implementation is built.

## Independent evidence

The authenticated f401 bank supplies original 80/120-digit independent results.
Archive size/hash and complete decoded stream/EOF/raw chains are authenticated
before new World calls. An old certificate is reused only after exact input,
six actual phases, full projection objects, reports, corrections, caps and raw
416-byte body correspondence pass, including signed zero. The unchanged
independent physical gates must also pass. No new cold-reference solve is
reported. Deterministic output parity and physical-reference evidence are
separate claims.

| New execution | Accepted / qualified | Proof boundary |
|---|---:|---|
| `source-trial-01` |1200/1200 | Actual six-phase and projection observation; all original gates. |
| `repeat-trial-01` |1200/1200 | Ordinary public output bits match the qualified source; internals unobserved. |
| `emitted-trial-01` |1200/1200 | Actual compiled root closure, no source fallback; public output parity. |

`main-data-audit-01` reads these saved results without new physical calls.
All three raw body streams have SHA256
`c12fb7d41b0cefcbc3f6963665b78daafc1732e8c31d6587f76132690f581551`.
Observed SOURCE maximum COM drift, plane drift, anchor gap and axis deviation
are zero; measured momentum residual components are zero. Motor impulse stays
within.0001Nms. Maximum angular correction is.0010000000000000002Nms,
below the unchanged.01Nms cap. First reported limit is step197; motor first
becomes zero at step198. Both final angles are.8rad at step1200.

These measurements belong to this literal fixture on Node22.19.0/macOS ARM64.
They do not establish a time-step convergence order, general mechanism law,
all-runtime equality or equipment agreement.

## Preserved first failures

Historical public candidate7178434 stopped at step77 with a one-ULP report
difference despite equal final body bytes. Its original intermediate operands
are still unavailable. The new observed step77 matches the saved bank and
records all eight actual atan2 calls. This does not explain the old failure or
convert that historical run to PASS. Original HOLDs, two-hinge and eight-box
NO_GO, error criteria and first failures remain unchanged.

Three DATA loader attempts failed before the completed `bank-auth-04` pass:
protocol-control line parsing, a missing per-line locator hash and a trailing
byte assumption. Their original receipts remain. They made no World or
reference calls. `data-controls-01` passes four selected DATA controls.

## Commands and next gates

Use the installed Node22 path. Each heavy execution acquires the repository
heavy gate and releases it from the same shell. Each run uses a fresh ID and
the frozen inputs beside this report. Exact commands, streams, hashes,
elapsed times and graph closures are retained under `evidence/`.

```sh
NODE22=/Users/user/.volta/tools/image/node/22.19.0/bin/node
$NODE22 examples/physics-world-p3-2276/build.mjs candidate-build-01 examples/physics-world-p3-2276/build-freeze-01.json
$NODE22 examples/physics-world-p3-2276/trial.mjs source-trial-01 candidate-build-01 sourceObserved examples/physics-world-p3-2276/execution-source-01.json
$NODE22 examples/physics-world-p3-2276/trial.mjs repeat-trial-01 candidate-build-01 sourceRepeat examples/physics-world-p3-2276/execution-repeat-01.json source-trial-01
$NODE22 examples/physics-world-p3-2276/trial.mjs emitted-trial-01 candidate-build-01 emittedNative examples/physics-world-p3-2276/execution-emitted-01.json source-trial-01
```

These IDs are preserved results, not reusable output locations. The additional
completed gates are recorded below. Documentation checks use the separate receipts listed below.
P4 original full-stack exit, P5 domain migration, P6 coupling and P7 connected
mechanisms remain roadmap dependencies. The user's develop-merge instruction
applies after the entire required roadmap passes. No push, deployment, release,
HOLD release or real-machine/manufacturing approval has occurred.


## Completed public gates and transfer

`controls-01` passes in 3,395 ms: 47 constructor attempts (including the two
original refusal baselines), 4,180 step attempts, 4,128 accepted, 52 refused,
18 queries, 4 explicit disposals and 31 cleanup disposals. Cap guards cover
12 entry cases / 14 actual scalar calls. All selected first-step variants and
two RENAME recovery steps qualify; no full-duration variant is claimed.

`recorder-01` passes in 2,857 ms, with a separate budget: four constructors,
20 accepted steps and six refused step entries. Eight restore steps and two
restore constructors are source-bound internal counts, explicitly separated
from directly counted calls. Both graphs restore S4 and agree at S5; public
state and recordings remain exact after each selected refusal and copy mutation.

Source review found that the original staged admission accepted a scaled raw
quaternion after normalization. The reviewed `admission-hardening.patch` only
adds an exact raw initial quaternion check. `source-transfer.json` verifies
92 nongenerated source files; this admission restriction is the sole difference
from the qualified staged provider. Physical calculation bytes are unchanged.
The original candidate/patch and all its receipts remain unchanged.

`adoption-build-01` compiles the actual current package and strict emitted
declaration consumer. `adoption-01` passes in 2,693 ms: source/native total
14 constructor attempts, 10 expected quaternion refusals, six accepted steps
and four cleanup disposals. Four P3 steps match the authenticated original
bank and qualified SOURCE. Two free-sphere steps verify existing acceptance.
No fresh 1,200-step execution at the hardened current source hash is claimed.

```sh
$NODE22 examples/physics-world-p3-2276/controls-run.mjs build controls-build-01 examples/physics-world-p3-2276/controls-build-freeze-01.json
$NODE22 examples/physics-world-p3-2276/controls-run.mjs run controls-01 examples/physics-world-p3-2276/controls-execution-freeze-01.json controls-build-01
$NODE22 examples/physics-world-p3-2276/recorder-integration.mjs build recorder-build-01 examples/physics-world-p3-2276/recorder-build-freeze-01.json
$NODE22 examples/physics-world-p3-2276/recorder-integration.mjs run recorder-01 examples/physics-world-p3-2276/recorder-execution-freeze-01.json recorder-build-01
$NODE22 examples/physics-world-p3-2276/adoption.mjs build adoption-build-01 examples/physics-world-p3-2276/adoption-build-freeze-01.json
$NODE22 examples/physics-world-p3-2276/adoption.mjs run adoption-01 examples/physics-world-p3-2276/adoption-execution-freeze-01.json adoption-build-01
```

## Documentation verification

The current site samples pass 175/175 in `docs-samples-01`, including the new
two-empty-step disjoint-hinge usage example. This is a source example result,
not independent physical qualification or a new 1,200-step execution.
`docs-check-01`, `docs-build-03`, `docs-links-02` and `docs-p3-assets-01` retain
the actual structural, build, rendered-link/snippet and byte-copy exit records.
`lint-01` retains the source lint result. Inspect each receipt separately.

```sh
$NODE22 examples/physics-world-p3-2276/checks.mjs docs-samples-01 apps/library-docs samples/run.mjs
$NODE22 examples/physics-world-p3-2276/checks.mjs docs-check-01 apps/library-docs scripts/check-docs.mjs
$NODE22 examples/physics-world-p3-2276/checks.mjs docs-build-03 apps/library-docs node_modules/vitepress/bin/vitepress.js build docs
$NODE22 examples/physics-world-p3-2276/checks.mjs docs-links-02 . examples/physics-motion-docs-2276/check-site.mjs
$NODE22 examples/physics-world-p3-2276/checks.mjs docs-p3-assets-01 . examples/physics-world-p3-2276/site-assets.mjs
$NODE22 examples/physics-world-p3-2276/checks.mjs lint-01 . node_modules/eslint/bin/eslint.js packages/barocss-physics/src --ignore-pattern '**/provider-manifest.generated.ts'
```

No site was deployed. `results.json` and the final audit separate actual
execution, public transfer, immutable history and remaining roadmap gates.

The first `docs-build-01` invocation failed before VitePress started because
the command named an absent root tool path. Its original streams remain.
`docs-build-02` used the correct executable but omitted `build docs` and
started the default dev mode. That owned child was stopped. Its exit0 is not
build evidence. The following links attempt failed against stale output and
is retained as `docs-links-01`. `docs-build-03` explicitly supplies `build docs`;
no tool was installed.
