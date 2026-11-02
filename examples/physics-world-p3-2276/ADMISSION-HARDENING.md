---
work_id: physics-world-p3-admission-hardening-2276
artifact_type: postqualification-admission-hardening-contract
status: authored_not_run
owner_role: independent-physics-algorithm-review
source_request: reject raw quaternion aliases outside the exact P3 initial profile without changing qualified calculations
last_updated: 2026-11-02
---

# Decision and evidence boundary

Keep the original `candidate.patch`, its four overlay files, candidate-build01
and all original main/control evidence unchanged. This is a separate admission
guard. It changes no body calculation, projection, report, cap, clock, recorder
or shared commit. Parent owns the new build, counts and API integration trial.
This document authorizes no execution by itself. No control was run here.

The source review found one normalization alias. P0 first accepts a quaternion
whose norm differs from1 by at most1e-6. `validation.ts` then divides each
component by that norm. The original P3 admission checked this parsed result.
Thus raw `[0,0,0,0.9999999]` can become parsed `[0,0,0,1]` and pass the narrow
profile. The immutable model still contains the nonliteral input quaternion.
This finding follows from source; no constructor was called to demonstrate it.

# Separate patch

Apply `admission-hardening.patch` only after the original candidate patch. Its
single source change checks every raw model body's initial quaternion against
the exact binary64 tuple `[+0,+0,+0,1]`, before the existing parsed-body profile
loop. `Object.is` preserves the distinction between positive and negative zero.
The final profile therefore requires the original signed initial quaternion
bits as well as the original physical orientation.

The new guard uses the existing INVALID_CONFIG message:
`dynamic pair supports one joint between two dynamic spheres`.
Current P0 structural/unit-norm errors still occur first. Existing single-pair,
fixed, static, kinematic and other profiles keep their original normalization.
Only the selected four-dynamic-sphere/two-hinge branch reaches this guard.

The overlay source is
`admission-hardening/src/disjoint-hinge/admission.ts`. The original candidate
admission file is not edited. The patch modifies no generated provider file;
the actual hardened build must regenerate and freeze its own provider graph.

# Remaining parser review

Source review found no second parsed normalization that can hide a changed
physical value in this profile. Position, velocity, gravity, material, anchor,
axis, limit and motor parsers retain their finite numeric input. The new profile
already checks their selected values exactly. Primitive inertia is required;
mass, radius and resulting scalar inertia have exact selected-value gates.
Collider-local orientation already has an explicit raw identity check in P0.
These are source conclusions, not broader new input qualification results.

# Gate before activation

Parent must declare this separate gate's actual constructor/step budget before
execution. Keep its totals outside the completed original47/4182 population.
The gate must build source and genuine native emitted providers and verify
every unchanged numerical provider byte against candidate-build01. Only this
admission guard and generated provider identities may differ.

Suggested bounded negative inputs each change one raw quaternion only:

- A in the Z0 component: `[0,0,0,0.9999999]`.
- B in the Z1 component: `[0,0,0,0.9999999]`.
- A single negative-zero initial quaternion component.

The first two isolate normalization aliases. The third checks the declared
signed-bit boundary. All must refuse before a World is returned. Parent may
choose the exact cases and count them before freezing the trial. Original
literal and selected identity/order inputs must still admit, and the separately
selected short source/native public API steps must match their authenticated
original and qualified-source authority. New-profile recorder work remains a
separate explicit API gate. Do not claim old1200-step execution at the hardened
source hash, rerun a failed mathematical prefix, or erase any earlier failure.
