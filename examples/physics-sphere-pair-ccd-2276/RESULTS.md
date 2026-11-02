---
work_id: physics-sphere-pair-ccd-2276
artifact_type: verification
status: done
owner_role: independent Physics Work
source_request: Continue engine roadmap with desktop rendering tests
last_updated: 2026-11-03
---

# G2 C06 sphere-pair CCD: bounded PASS

## First physical failure preserved

Actual old compiled public World1/step1 with two1kg spheres of radius1e-4m,
marked start(5,0.00020000001,0), velocity(-600,0,0), other start(-5,0,0),
velocity(600,0,0), dt1/60, zero gravity/material friction/restitution.
Each displacement10m is within unchanged admission.

Independent exact represented geometry: closest time1/2, positive gap
368934881/36893488147419103232=9.999999987147026e-12m, greater than the
unchanged1e-12m contact-distance gate. True squared-chord discriminant is
negative. Old arithmetic rounds C to100 and discriminant to0; public World
reports HIT at0.5 with normal(0,1,0). This is
**PHYSICAL_NO_GO_SPHERE_PAIR_FALSE_GRAZE**, not a capture PASS.
`evidence/baseline-01` retains original model/options, states, source/provider.

## Implementation and finite limits

- `ccd-sphere-pair-exact.ts`: consume14 represented endpoint/radius words
  before subtraction or radius addition; exact dyadic initial/zero-travel/
  closing/discriminant/closed-endpoint predicates. One quadratic, no loops over
  iterative approximations, case whitelist, fallback or epsilon.
- `ccd-pair.ts`: call the helper, interpolate accepted hit centers and apply
  unchanged5e-10m inward bias to each body. API IDs, initial discrete ownership,
  profile admission and remaining-time discard are preserved.
- `provider-manifest.generated.ts`: actual new source closure regenerated.

Stable q entry and exact projected normal numerators avoid catastrophic
cancellation. Final floating values retain finite/domain/unit checks; failure
refuses NUMERIC_LIMIT before accepted state/log mutation. Strict endpoint hits
emit1 exactly. This is a private geometry helper, not a public new World or
factory/subpath.

Static binary64 bound proof:14words/3axes, no search/refinement; common-scale
words<=2098bits, p/radius<=2099, travel<=2100, coefficients<=4202 and all
intermediates<8410bits. This is below16384 analytically. Corpus integer
operations were NOT metered; no measured2M-op claim is made. Binary64 output
accuracy outside the finite bank remains separate from exact classification.

## Actual source, compile and independent results

| Campaign | Source | Genuine NodeNext/canonical Native |
| --- | --- | --- |
| Public root/replay |29Worlds/33accepted steps |29Worlds/33accepted steps |
| Direct private helper |22calls |22calls |
| Known/unknown refusals |1/1 |1/1 |
| Restore |1 |1 |

The22controls include original head-on, false graze, genuine graze, just-inside,
exact zero relative travel, initial touching/overlap, separating, endpoint entry,
beyond endpoint, endpoint graze, marker/input order, dyadic translation,
admissible scale and unequal radius operands. Zero-relative uses exactly
representable equal0.25m increments and asserts its actual relative travel0.
The false-graze mathematical inputs are unchanged; public bank uses independent
test IDs, while browser original preset also preserves original IDs/revision.

Exact Fraction classification bank passed BEFORE repaired build/API execution.
Its closest-approach/chord construction imports no candidate quadratic.
Fixed80/120-digit entry/normal agreement is checked at1e-60. No ODE or reference
precision retries. Post-run exact/rational high-precision audit checks88actual
helper/public results, including unbiassed witnesses from original endpoint
words and returned TOI. It uses no producer bias or contact point as truth.

| Independent maximum residual | Measured | Unchanged gate |
| --- | --- | --- |
| TOI fraction |3.906e-17 |1e-12 |
| Normal component |4.207e-17 |1e-12 |
| Squared normal length |8.414e-17 |1e-12 |
| Unbiased distance |1.607e-16m |1e-12m |

Raw accepted state/recording parity holds after provider identity normalization.
Repeat, actual recorder restore/continuation and known/unknown refusal retention
plus clean retry pass. The unknown injected error reaches the new exact helper
and retains its object identity. Later recorder frames prove reproducibility,
not a broader physical impact trajectory. The original unchanged
`physics-scene/ccd-pair-probe.mjs` passes. Strict compile, public declarations,
canonical root/replay and positive/negative TypeScript consumer pass. Full CAD
and published browser SDK builds are NOT_RUN.

## Real desktop rendering and its first failure

Actual desktop Chrome156.0.8078.80 passes8checks/four presets at1280/1440/1920.
Public World/recorder drive real Viewer sphere pixels, accepted centers/XYZW,
clock, hit/miss/TOI/normal/gap readings, camera, input and512record cap. Original
min miss has zero contacts and complete travel. Tiny radii are explicitly
displayed at1000× with original physical inputs and accepted poses; real graze
can occlude a proxy. Ordinary radii display1×. No mobile. Zero page/console
errors; local requests only; isolated proof browser closes. Preview52960 stays.

First render01 failed after1initialcheck: driver parsed visible JSON from a
closed contact-state details panel. World already produced correct MISS;
page/console errors were0. Original driver/report/scene/screenshot remain in
`evidence/render-first-failure-01`. Revised driver clicks the actual summary
before parsing visible data. Same numerical/pixel criteria and preview bundle;
render02 passes. No physics input, engine, gate or output was changed for it.
Screenshots are presentation evidence only.

## Commands and remaining dependencies

Existing heavy gate plus180s command wrapper; installed Node22/Python3.13 and
pinned existing esbuild/tsc/Playwright only:

```sh
node examples/physics-sphere-pair-ccd-2276/baseline.mjs baseline-01
node examples/physics-sphere-pair-ccd-2276/bank.mjs
python3 -B examples/physics-sphere-pair-ccd-2276/reference.py --bank examples/physics-sphere-pair-ccd-2276/BANK-INPUT-01.json examples/physics-sphere-pair-ccd-2276/BANK-01.json
node examples/physics-sphere-pair-ccd-2276/build/build.mjs
node examples/physics-sphere-pair-ccd-2276/api-run.mjs api-01
python3 -B examples/physics-sphere-pair-ccd-2276/reference.py examples/physics-sphere-pair-ccd-2276/evidence/api-01 examples/physics-sphere-pair-ccd-2276/BANK-01.json
node examples/physics-scene/ccd-pair-probe.mjs
PLAYWRIGHT_CLI=<installed> node examples/physics-sphere-pair-ccd-2276/browser-run.mjs render-02 http://127.0.0.1:52960
```

Original NO_GO and first renderer failure, scripts, graphs/providers, raw
states/logs, bank, numeric maxima and command receipts are hash-preserved.

This closes a finite C06 boundary bank, not every CCD scale/precision regime.
Remaining-time advancement, rotating non-sphere CCD, friction-coupled impact,
unequal-sphere finite-overlap friction arms, general normal/tangent coupling,
persistent friction/frame caches, P4original eight-box and P6/P7 stay open.
Public limits and all HOLDs remain. No deployment, release, real-machine
prediction or whole-roadmap completion.
