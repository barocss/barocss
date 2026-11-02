---
work_id: physics-rounded-ccd-2276
artifact_type: implementation-and-verification
status: done_bounded_profile
owner_role: independent_physics_work
source_request: continue physics-engine implementation including desktop rendering
last_updated: 2026-11-03
---

# Rounded sphere/static-box CCD: actual results

**PASS for this bounded geometry/API/render profile. G2 and the whole engine
remain incomplete.** Branch `codex/physics-world-p5-2276`, base237d4b04d.
Core implementation is `packages/barocss-physics/src/ccd-rounded-box.ts`, used
directly by `ccd.ts`. No compatibility path, dependency, contact-iteration
increase, tolerance relaxation, deployment or held-worker restart occurred.

## Implemented mathematical behavior

The old sphere path entered the radius-expanded rectangular box, which is only
a conservative bound near edges/vertices. The new kernel computes the actual
Euclidean rounded-box entry. Original binary64 local coordinates are represented
as bounded dyadic integers; initial distance, at most6 plane breaks/7 intervals,
polynomial coefficients/discriminants and algebraic root-domain comparisons use
exact integer signs. Stable-q conversion emits TOI and exact projection
numerators avoid cancellation when computing the floating normal. Finite,
outward and unit guards explicitly refuse NUMERIC_LIMIT when needed.

The kernel is generic for the existing sphere/static-box profile; the16 test
fixtures are not an API whitelist. `ccd.ts` keeps box-local transforms, earliest
fixture/lexical exact ties and the existing1e-9 inward stop. Initial true touch/
overlap remains discrete-owned. Restitution/friction and8contact passes are
unchanged. CCD still discards the remaining time; no rotating-box extension.
Exact local predicates do not establish arbitrary scale/world-transform accuracy.

## Actual numerical evidence

The separately authored oracle enumerates6face patches,12finite edge cylinders
and8vertices; its feature-domain and earliest-root decisions use exact Fraction
algebra and directed Decimal80/120 enclosures, not candidate interval code.
All16 original Source cases are audited immediately, before the next call;
all16 pass before Native import/16Native calls. Source/Native raw results and
candidate fields agree. MISS/initial cases retain all fields; hits change only
candidate position via the original bias; previous and fixture bodies remain
unchanged. This geometry stage makes0World calls.

| Quantity | Maximum measured | Unchanged gate |
| --- | --- | --- |
| TOI endpoint error | 2.383771087217572e-17 | 1e-12 |
| Normal component error | 1.3877787807814457e-16 | 1e-12 |
| Squared normal-norm error | 3.6446213480830076e-16 | 1e-12 |
| Positive distance² excess above r² | 8.427903502839873e-18m² | Distance ≤r+1e-12m |

Each graph made16 candidate facade calls,8sqrt and10normal-hypot calls.
The one independent child built16certificates with86real feature-root candidates,
31,266counted Fraction operations,578Decimal operations,8interval sqrt
constructions and16endpoint Decimal sqrt operations. No ODE or iterative
precision increase. Geometry evidence434,193bytes, staged build672,356bytes
and emitted package1,002,891bytes fit the fixed1MiB/2MiB limits. The reference
checks bounded logical owned DATA plus scratch reserve; process RSS/engine heap
is not measured or claimed. Interval/BigInt counts are source bounds, not an
invented observed counter.

Actual public Source and canonical compiled root/replay each pass26Worlds and
29accepted steps, including restore reconstruction. The16 bank cases pass at
World level, followed by rectangular/cyclic/translated/length-scale controls,
earliest and duplicate-fixture tie/order cases, recording restore/actual
continuation, numerical refusal and recovery. A separate atomicity campaign
adds1World/1accepted step per graph: an injected sqrt Error is rethrown as the
same object, with state/log unchanged; retry succeeds. These are two campaigns,
not one combined27World run. Strict NodeNext root/replay declarations and the
positive/negative declaration consumer pass. The current API run is api-02;
api-01 is retained. Successful-return counters were moved after the return so
a future interrupted call cannot be misreported as accepted. No criterion changed.

Original compiled `ccd-probe`, `ccd-pair-probe`, `rotation-probe` and
`oriented-colliders-probe` pass with unchanged inputs/criteria. Documentation
physics examples18/18, VitePress build and built-link/snippet/evidence-copy
verification pass. Full CAD SDK/all-subpath rebuild remains NOT_RUN.

## Resolved original case and preserved failures

The old compiled public World reportedTOI0.16666666666666663, with unbiased
squared distance0.0125m² and0contacts. Its new additive baseline retains
PHYSICAL_NO_GO_FALSE_EARLY_HIT; a successful capture-wrapper exit is not a
physical PASS. The original earlier source-helper failure remains untouched.

Current public Source and Native giveTOI0.18899576603592683, normal
[-0.8660254037844386,0.4999999999999997,0],1contact and outgoing velocity
[8.999999999999982,15.58845726811989,0]m/s. The reported point is on the
actual rounded boundary; no false earlier stop remains in this selected case.

The first desktop scene failed because two display packets shared surface ID
`body`. Original scene code, bundle, report and command failure are retained in
`evidence/render-first-failure-01`. Using distinct `ball` and `box` display IDs
fixed it. Physics, assertions and numerical gates were not changed to obtain
a rendering PASS. Original G1/P3/P4 failures and stack NO_GO remain immutable.

## Actual desktop rendering

Current scene: http://127.0.0.1:52900 (`scene/server.mjs`). Chrome156.0.8078.80
passes9 desktop checks covering all16 original boundary cases plus5feature
scenes: corner, face, vertex, expanded-corner MISS and cyclic rotated box. At1280/1440/1920 widths, accepted positions/
XYZW are copied into both public Viewer poses, actual blue/orange GPU pixels
change with Physics, TOI distance equals radius within1e-12m, contact markers
use physical point/normal, and camera/keyboard/play/pause/reset preserve one
World/recorder clock. There are0page/console errors and only local page requests.
Initial-owned cases are labelled separately from MISS. All16 rendering
controls actually step the public World; no shader animation substitutes for
Physics. The overlay has no depth occlusion. Display meshes approximate the shapes;
screenshots establish presentation only.

The existing Physics Lab was also rebuilt from the current corrected kernel
on a separate local port52890, preserving the prior preview. All12 desktop
checks pass, including saved-state continuation and its512-step stop. This
extra caller proof is separate from the9 new CCD-render checks. No mobile
checks ran. No unsafe GPU flags, browser/tool download or external service.

## Commands, proof boundary and next work

All command argv, exits and raw output are in existing180s guarded
`examples/physics-world-p5-2276/evidence/rounded-ccd-*` receipts. Core commands:

```sh
node examples/physics-rounded-ccd-2276/build/build.mjs
node examples/physics-rounded-ccd-2276/geometry-run.mjs geometry-01
node examples/physics-rounded-ccd-2276/api-run.mjs api-02
node examples/physics-rounded-ccd-2276/atomic-run.mjs
node examples/physics-rounded-ccd-2276/scene/server.mjs
PLAYWRIGHT_CLI=/installed/playwright-cli.js node examples/physics-rounded-ccd-2276/browser-run.mjs render-03 http://127.0.0.1:52900
```

IDs/output directories above are the actual saved runs; reproduction requires
fresh IDs, with `api-run` currently binding the preserved geometry-01 bank.
The evidence archive includes build inputs/runtime snapshots, reference bank,
case observations, original failed rendering, successful desktop reports and
raw command receipts. Never overwrite an existing failure while extracting.

Next dependencies are selected G2 restitution/friction thresholds, contact/
projection work and close-time/scale controls before broader contact claims.
Original P4eight-box settling, remaining P6/P7 coupling/control, published
browser SDK, GPU-loss recovery and real equipment are not certified here.
Existing Studio/manufacturing/equipment HOLDs, physical gates and first failures
remain. No whole-engine completion, release, deployment or machine-safety claim.
