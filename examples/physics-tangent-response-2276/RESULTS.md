---
work_id: physics-tangent-response-2276
artifact_type: verification
status: done
owner_role: independent Physics Work
source_request: Continue engine implementation with desktop rendering proof
last_updated: 2026-11-03
---

# G2 finite discrete tangent response: bounded PASS

## Preserved failures

1. Original sphere boundary: Source1World/1step at the original
   `nextDown(1.75)` tangent speed. Physical radius/momentum predict static
   impulse≈1Ns; actual0.25Ns, residual≈0.75Ns vs1e-10. The final projected
   center0.49999999999999994 shortened the coordinate-derived friction arm.
   `physics-material-boundaries-2276/evidence/api-01` retains raw inputs/output,
   reference, original manifest and exact executed runner. Native NOT_RUN on
   first failure. No physical input or threshold changed for repair.
2. Cuboid: old actual compiled1World/1step. Independent expected
   v=(3/8,0,3/5), omega=(6/5,0,-3/4), Jt=(-5/8,0,-2/5), E=39/80J.
   Actual geometric slip=(9/41,0,-9/41), norm0.31043712344775254m/s vs1e-10.
   `evidence/baseline-01` includes full old provider/source and public states.
3. First repaired API attempt stops after13 Source Worlds/steps at coefficient
   muStatic4, refused by existing[0,2] admission. This is a test-profile error,
   not a solver physical failure. Original `cases.mjs`, contract, api-01 raw
   failure and exact executed files remain. `INPUT-CORRECTION-02.md` freezes
   explicit rejection of that same input plus a separate valid coefficient2
   case. The current result names `cases-02.mjs`; no admission/gate was relaxed.
4. First repaired original contact regression: two Source tests refuse
   NUMERIC_LIMIT at a zero perpendicular basis, before Native runs. A normal
   of1.0000000000000002 left a spurious purely normal tangent under the old
   unit-length projection expression. Original tests and gates were unchanged.
   `evidence/regression-01` retains the actual bundle, inputs and failure.
   Repaired-v1 provider/source snapshot remains under `evidence/repair-01-*`.

## Source changes

- `collision.ts`: geometric sphere/static-box radius arms for tangential
  velocity/mass/torque; non-unit-length orthogonal tangent projection; invoke
  the full static tangent solve and retain dynamic ray/clamp branch.
- `contact-tangent.ts`: bounded2×2 symmetric tangent response, pivoted LDL,
  positive/finite guards without epsilon/fallback. Exact uncoupled branch keeps
  original scalar arithmetic. Constant-size vectors, no iteration/heap growth.
- `provider-manifest.generated.ts`: current provider regenerated.

Restitution, geometric-mean mixing, public profiles/model/options, iteration
counts and normal/detector/contact-point semantics stay. Persistent normal/
friction solver is unchanged. No parallel engine, compatibility path, new
dependency, download or settings change.

## Actual final evidence

| Campaign | Source | Actual emitted root/replay | Outcome |
| --- | --- | --- | --- |
| Cuboid API02/cases02 |27Worlds/31steps |27Worlds/31steps | PASS |
| Original sphere material table03 |22Worlds/22steps |22Worlds/22steps | PASS |
| Independent constraint audit |20cuboid impacts |20cuboid impacts |40PASS; no World/candidate calls |
| Original support/sliding regression02 |2tests/3240steps |2tests/3240steps | PASS |

Cuboid campaign includes three dt values, coordinate cycles, reversed tangent
axes, isotropic control, material and order controls, no-normal/zero tangent,
repeat, actual recorder restore/continuation, known/unknown failure state/log
retention and clean retry. Each graph additionally refuses one invalid creation.
Later recorder frames establish reproducibility, not new physical trajectory
accuracy for tilted/off-center contacts.

The original sphere table22cases includes static just below/at/above boundary,
unequal geometric-mean friction, reversed/zero tangent, material/input/ID order,
zero friction and no-normal controls, plus strict restitution threshold
neighbors. Final table03 uses provider pins03; prior repaired-v1 table02 PASS
and original table01 FAIL remain separate and must not be combined as one run.

The independent cuboid reference solves physical scalar principal-axis no-slip
and linear/angular momentum constraints. Static values use exact Fraction;
the clear dynamic-ray case uses fixed80/120-digit algebra, max precision
discrepancy1.050e-81 vs predeclared1e-60. It imports no contact/Jacobian/LDL code.

| Final cuboid API maximum | Value | Unchanged gate |
| --- | --- | --- |
| velocity |1.111e-16m/s |1e-10 |
| spin |2.221e-16rad/s |1e-10 |
| impulse/momentum/angular impulse |5.552e-17SI |1e-10 |
| surface slip |2.221e-16m/s |1e-10 |
| geometry |5.552e-17m |1e-10 |
| energy residual |5.552e-17J |1e-10 |
| impulse work residual |2.221e-16J |1e-10 |
| tangent-plane impulse |0Ns |1e-12 |

Independent exact audit maxima are separately recorded in
`evidence/api-02/independent-reference.json`: velocity1.333e-16, spin1.777e-16,
impulse7.772e-17 and work9.993e-17SI. Original sphere table03 maximum momentum
residual1.111e-16 and energy2.221e-16SI, zero measured slip for sticking cases.

Original regression02 support gap0, max support impulse error5.552e-17Ns and
cumulative2.558e-12Ns vs original1e-8. Sliding work error1.648e-16J, no energy
growth, final speed0.7142857142857144m/s and spin-3.5714285714285725rad/s.
Position error0.0008175m remains below its original0.001m gate; this result is
not a new1e-10 trajectory-position claim. The original persistent-box probe
also passes on repaired-v1. Final projection affects its discrete fallback,
so that narrower v1 receipt remains labelled at its actual provider.

Strict NodeNext root/replay build/declarations, canonical root, source bundle
and positive/negative public TypeScript consumer pass. Full CAD/published
browser SDK build and hardware alignment are NOT_RUN.

## Actual desktop rendering

Chrome156.0.8078.80 passes9checks/four presets at1280/1440/1920. Checks use
actual public World/recorder, native Viewer GPU pixels for sphere/cuboid/floor,
accepted positions converted once to mm, unchanged XYZW, physical readings,
camera/resize, motion, keyboard, pause/reset/clock and512-frame cap. Original
binary64 sphere model inputs are checked in the browser. Cuboid is physically
audited only at its centered first step; playback/cap use sphere controls.
Zero page/console errors, local requests only, isolated browser closed.
Screenshots establish presentation, never accuracy. No mobile or deployment.
Local preview is http://127.0.0.1:52940.

## Commands and remaining gates

Guarded with existing heavy gate, installed Node22/Python3.13 and180s wrapper:

```sh
node examples/physics-tangent-response-2276/baseline.mjs baseline-01
node examples/physics-tangent-response-2276/build/build.mjs
node examples/physics-tangent-response-2276/api-run.mjs api-02 cases-02.mjs
python3 -B examples/physics-tangent-response-2276/reference.py examples/physics-tangent-response-2276/evidence/api-02
node examples/physics-material-boundaries-2276/api-run.mjs api-03 examples/physics-material-boundaries-2276/PROVIDER-PINS-03.json
node examples/physics-tangent-response-2276/regression.mjs regression-02
PLAYWRIGHT_CLI=<installed> node examples/physics-tangent-response-2276/browser-run.mjs render-01 http://127.0.0.1:52940
```

Build01/02, API01/02 and regression01/02 remain separate receipts. Generated
source and native graphs contain current owned code. Evidence archive includes
both physical first failures, invalid input, first candidate regression and
their actual snapshots. Raw states preserve signed/adjacent binary64 words.

G2 remains open for persistent friction cache/frame transitions, unequal-mass
sphere-pair overlap arm semantics, coupled normal/tangent/off-center/multi-pair
impacts, projection work, near-tie/extreme-scale CCD and remaining-time flow.
Original P4 eight-box settling stays NO_GO/public limit4. New restitution and
discrete tangent fixes do not repair the unchanged original32-point persistent
normal equilibrium/reference budget. Next P4 work must first establish a
bounded independent-reference strategy under the old180s/tolerance budget.
P6/P7 and whole-roadmap develop acceptance remain incomplete. Studio,
manufacturing/equipment and old-worker HOLDs remain. No push/deploy/release.
