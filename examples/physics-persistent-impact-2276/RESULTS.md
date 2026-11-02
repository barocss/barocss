---
work_id: physics-persistent-impact-2276
artifact_type: verification
status: done
owner_role: independent Physics Work
source_request: Continue engine implementation and desktop rendering checks
last_updated: 2026-11-03
---

# G2 persistent restitution: bounded PASS

## First failure preserved

One old compiled public World/step, mass2kg, incoming speed2m/s,
body restitution0.8 and floor0.25. Independent outgoing speed0.5m/s,
normal impulse5Ns, kinetic energy0.25J. Actual outgoing speed0m/s;
**PHYSICAL_NO_GO_RESTITUTION_IGNORED**, velocity error0.5m/s vs1e-10.
`evidence/baseline-01/result.json` preserves model/options, state, hashes,
old production source and emitted provider. A successful capture command
does not turn this physical failure into PASS.

## Implementation and bounds

- `packages/barocss-physics/src/world.ts`: once-per-step per-point normal
  targets, all captured before this pair's warm start, reused through passes.
- `packages/barocss-physics/src/persistent-box-contact.ts`: required target
  argument; zero targets keep the old arithmetic expression exactly.
- 16 live private diagnostic/reference callers: explicit zero target for their
  inelastic study. Their evidence and archived source are untouched.
- `provider-manifest.generated.ts`: regenerated for actual source closure.

PointImpulse retains only normal/tangent impulses. Targets live in the candidate
step map and are not accepted persistent cache or recording data. At most
6pairs×8passes×4points=192 target entries under current four-body bounds.
The existing8 outer passes and8 inner iterations are unchanged. Material
restitution uses the minimum and applies only when closing speed is strictly
greater than0.5m/s. No tolerance, admission, public factory/type or runtime
dependency was added. There is no optional old-solver argument.

## Actual numerical results

| Campaign | Source | Genuine NodeNext/canonical Native | Result |
| --- | --- | --- | --- |
| Main finite/API |28Worlds/287accepted steps |28Worlds/287accepted steps | PASS |
| Warm-cache/restore/fault |3Worlds/9accepted steps |3Worlds/9accepted steps | PASS |
| Independent exact rational input/output audit |20finite impacts |20finite impacts |40PASS; zero World/candidate calls |

Main includes20 impacts, repeat determinism,256-step separate e0 support,
actual recorder restore/continue, one known and one unknown refusal per graph.
Warm includes real positive support cache before a nonzero-restitution impact,
replayed support, restored impact/flight and unknown failure after a normal
impulse. Accepted state/log remain identical on failure and retry matches
clean control. Provider identity is normalized only for Source/Native parity.
Main and warm are separate frozen populations with separate counts.

Maximum residuals across Source/Native main and warm:

| Quantity | Maximum | Unchanged gate |
| --- | --- | --- |
| velocity |2.221e-16m/s |1e-10 |
| angular velocity |2.776e-16rad/s |1e-10 |
| normal impulse |8.882e-16Ns |1e-10 |
| linear momentum |8.882e-16kg m/s |1e-10 |
| angular momentum |9.252e-17kg m²/s |1e-10 |
| gap |5.899e-17m |1e-10 |
| energy balance |8.882e-16J |1e-10 |
| tangent impulse |0Ns |1e-12 |

The separate Fraction reference measures maximum gap5.552e-17m; other finite
residuals match the main rounded measurements. Source/Native raw accepted
states/logs agree after identity normalization. Strict positive/zero bounce
branches are checked separately from approximate residual gates.

## Compile, regressions and rendering

Strict NodeNext root/replay declarations, canonical root build, public source
bundle and positive/negative TypeScript consumer all PASS. Full CAD SDK and
published browser SDK are NOT_RUN. Only current owned source is bundled.

Original unchanged `persistent-box-probe.mjs` PASS: centered and0.05m offset
two-box480-step cases, repeat, invalid-step/cache retention, actual recorder
and rotated-contact finite smoke. Original penetration0.005m and position/
speed gates remain unchanged; measured max penetration0.0007101430414964693m.
This is not a new eight-box or1e-10 stack certificate.

Actual desktop Chrome156.0.8078.80 passes11 checks, six presets,
1280/1440/1920: real blue/orange GPU pixels, exact accepted transforms/clock,
displayed outgoing velocity/impulse/energy, subsequent upward travel, camera,
keyboard, play/pause/reset and512-frame cap. Zero page/console errors. Local
requests only; isolated proof browser closed. Mobile NOT_RUN by owner request.
Screenshots prove display, not physics. Local preview52920 remains available.

## Commands and evidence

All executed with installed Node22, pinned existing esbuild/tsc or Python3.13,
the existing heavy gate and `physics-world-p5-2276/command-run.mjs`180s guard:

- `node examples/physics-persistent-impact-2276/baseline.mjs baseline-01`
- `node examples/physics-persistent-impact-2276/build/build.mjs`
- `node examples/physics-persistent-impact-2276/api-run.mjs api-01`
- `python3 -B examples/physics-persistent-impact-2276/reference.py examples/physics-persistent-impact-2276/evidence/api-01`
- `node examples/physics-persistent-impact-2276/warm-run.mjs warm-01`
- `node examples/physics-scene/persistent-box-probe.mjs`
- `node examples/physics-persistent-impact-2276/scene/server.mjs --build`
- `PLAYWRIGHT_CLI=<installed> node examples/physics-persistent-impact-2276/browser-run.mjs render-01 http://127.0.0.1:52920`

Command receipts, raw states/logs, compiled provider, source bundle/closure and
desktop proof are archived with hashes. Contracts/inputs were frozen before
their respective executions; first baseline remains a separate failed result.

## Remaining dependencies and NO_GO

This qualifies centered principal-axis zero-friction impacts. It does not
establish arbitrary tilted/off-center/multi-pair restitution or general
friction/cache changes. Point targets are captured at first pair visit, not a
global simultaneous-impact solve. Projection removes initial penetration and
does not integrate the impact-time remainder. Initial geometry, boundary and
projection work still require their separate G2 evidence.

Next is the missing finite friction mixing/stick-slip coverage, then only
corresponding qualified API scope. A source-derived anisotropic cuboid sticking
candidate must first become an actual independently checked failure; it is not
yet a measured NO_GO. Original P4 eight-box settling stays NO_GO/public limit4.
P6/P7 coupling/control and whole-engine completion remain open. All HOLDs,
original thresholds/failures and no-deployment policy remain.
