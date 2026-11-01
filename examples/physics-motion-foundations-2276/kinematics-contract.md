---
work_id: physics-motion-foundations-2276
artifact_type: experiment-contract
status: implemented-validation-in-progress
owner_role: kinematics-executor
source_request: "Issue #2276: independent Physics/Motion algorithm implementation and testing"
last_updated: 2026-11-01
---

# Kinematics experiment contract — #2276

Frozen before the first test run. This file defines the oracles and acceptance
limits for `kinematics.test.ts`. Parent-run receipts record execution separately.

## Scope

Use the existing public `@barocss/cad-model/robot/*` subpaths. Do not add a
Motion package, a runtime dependency, or a second FK, IK, or trajectory solver.
The fixture is a valid open joint tree, without body geometry or Studio code.
All existing HOLD and historical NO_GO decisions remain in force.

## Independent fixture and oracles

The base pivot is `(137, -83, 29)` mm. A revolute Z joint carries an X slide.
The slide tool is 40 mm from the pivot at home. Revolute limits are -90 to
90 degrees. Slide limits are -20 to 80 mm. The analytic tool point is
`(137 + (40+s) cos(theta), -83 + (40+s) sin(theta), 29)` mm.
Its orientation is a Z rotation by `theta`. Saved motion values use degrees
and mm. FK, IK and timed paths use radians and mm.

1. At fixed angles -90, -30, 0, 30, 90 degrees and slide values -20, 0,
   25, 80 mm, compare FK with the analytic point and rotation. Check the
   inverse on the original off-origin point. Check noncommuting composition
   using a fixed quarter turn and a fixed translation with literal answers.
2. Build IK targets from the analytic transform, without FK. Use targets
   at (-60 degrees, 25 mm), (35 degrees, 60 mm), and (0 degrees, -10 mm).
   Evaluate the returned joints with the analytic point and orientation.
   Check the solver claim against those independent residuals and FK.
   A target at (30 degrees, 120 mm) is outside the slide limit. It must be
   unreached; the independent position residual is at least 39.9 mm.
3. A mixed-unit path has a repeated start, then a simultaneous 60 degree
   turn and 30 mm slide, then returns to zero. The saved default rates are
   60 units/s and 120 units/s². The slide overrides these with 15 mm/s and
   30 mm/s². The limiting normalized rates are v=0.5/s and a=1/s².
   Each nonzero segment lasts 2.5 s. The repeated segment lasts zero.
   Compare 101 evenly spaced samples per segment with the closed form
   `u=t²/2` for t<=0.5, `u=0.125+0.5(t-0.5)` for t<=2, and
   `u=1-(2.5-t)²/2` after that. Check endpoint clamping, joint limits,
   and the analytic Cartesian tool point at every sample. This is finite
   sampling evidence, not a continuous collision or dynamic safety proof.
4. Add a triangular segment: 10 mm at v=20 mm/s and a=40 mm/s².
   Its duration is 1 s; position is 20t² before 0.5 s, then
   `10-20(1-t)²`. Sample 101 points.
5. Check typed path problems for a short path, an unknown joint, an
   out-of-range endpoint, a driven mimic joint, missing rates, and an
   S-curve without jerk. These are expected refusals, not measured failures.

## Frozen numerical acceptance

- FK positions, translations, analytic trajectory positions: 1e-9 mm.
- Rotation matrix entries, unit conversion, normalized samples: 1e-12.
- Duration: 1e-12 s. Exact zero-length duration: zero.
- IK independent position acceptance: 1e-4 m (0.1 mm).
- IK independent angle acceptance: 1e-3 rad.
- IK returned joint bounds: 1e-12 rad or mm beyond the stated bound.
- Reported IK residual versus independent residual: 1e-9 m and 1e-7 rad.

These limits are selected before execution. Do not widen a limit after a
failure. Keep a first failure and any later corrected result distinct.

## Evidence boundary

Existing package tests already cover extensive random FK, 1000 reachable 6R
IK targets, singularity flags, and basic RS2 path behavior. This experiment
adds a small public-import consumer with independent mixed-unit, off-origin
RP targets and full-segment analytic trajectory samples. It does not rerun
those broad suites or establish natural-device, UI, import/export, closed-loop,
contact, collision, hardware, release, or product readiness.

## Input defect follow-up

The initial source observation was then measured by the parent runner.
`inputs-before-01/motion-input.stdout` records 25 tests, 1 pass, 24 failures,
and exit code 1. Examples include NaN waypoint acceptance, no refusal for a
nonfinite query time, and nonfinite rates reported as LIMITS_MISSING instead
of LIMITS_BAD. This is a measured defect in exported `robot/motion` functions.
It is separate from the passing valid-input kinematics experiment.

Before that baseline run, `motion-input.test.ts` froze these additional gates:

- `checkPath` returns VALUE Problems for NaN or positive/negative infinity
  in either endpoint, and for an unsupported timing profile.
- `duration` and `poseAt` throw existing typed BarocssError refusals with
  the same codes before timing or interpolation of those invalid paths.
- `poseAt` throws VALUE for NaN or positive/negative infinity query times,
  both before and after the timing cache is used for a valid query.
- Supplied nonfinite v, a, or j rates, malformed limits containers, and
  malformed joint rate objects give LIMITS_BAD. An unused supplied j is
  still validated when the selected profile is trapezoid.
- Missing or nonpositive required rates keep LIMITS_MISSING. Finite negative
  and late query times keep endpoint clamping. The finite valid fixture's
  duration stays exactly 1 second.

The surgical correction is limited to `robot/motion.ts`: validate the path
before first timing; validate query time before looking up cached timing.
The low-level `ccd.timePath`, `ccd.timeSegments`, raw profile functions,
saved-motion conversion functions, and FK/IK validation are outside this
correction. A caller that mutates a valid path after it enters the WeakMap
cache can still receive stale timing. Cache mutation is not covered or fixed.
The parent runner records corrected execution separately from the baseline.
