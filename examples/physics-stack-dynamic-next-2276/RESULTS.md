---
work_id: physics-stack-dynamic-next-2276
artifact_type: verification
status: done_bounded_numerical_and_desktop
owner_role: independent-physics-algorithm-work
source_request: verify dynamics and actual desktop motion together
last_updated: 2026-11-04
---

# Small dynamic trajectories

Actual `api-01` reports `DYNAMIC_NEXT_NUMERICAL_SOURCE_NATIVE_CONFIRMED`.
Installed Node22 and the existing180s guard complete in3314.552709ms.
Each graph has11Worlds/1018accepted steps, including four actual replayed
restore steps, one known and one unknown refusal. All input/provider source
hashes remain unchanged. Complete model/options/states match between the
qualified strict NodeNext Source graph and current actual Native root/replay;
only providerDigest is normalized, and every numeric word compares exactly.

No new solver or public profile is needed for these existing persistent-box
inputs. The same Native desktop stage also passes below. The stationary8 profile and
its before-motion refusals are unchanged. All historical failures and HOLDs
remain; general moving8 is not qualified. No mobile or deployment.

## Inputs and actual results

All dynamic cubes have mass2kg, half extents0.5m, primitive COM inertia,
initial identity rotation/zero spin and zero friction. Existing loops/caps and
SI/contact1e-10, tangent1e-12, free-velocity1e-11 gates are unchanged.

| Case | Actual steps per graph | Independent result |
| --- | --- | --- |
| Gravity fall from Y0.75m to floor top0 |256 | First contact27, then230 contact samples through256. Maximum momentum residual4.168e-16Ns, normal impulse error3.081e-17Ns and supported speed1.111e-16m/s. |
| Two equal cubes, initial surface gap0.125m, incoming2m/s, g0, material min e0.25 |256 | First and only contact8, then relative separation. Maximum momentum/kinetic-loss residual8.882e-16 SI; subsequent linear-position residual1.049e-14m. |
| Isolated gravity flight from Y10m to1second, dt1/60,1/120,1/240 |60+120+240 | Continuous-position errors0.08175000000000146 /0.04087500000000702 /0.020437499999993804m. Ratios1.9999999999996925 /2.0000000000009495 pass original[1.99,2.01]. |

Primary trajectories total932steps per graph. Additional86accepted controls
cover actual record/restore/continue, repeat, failure rollback and clean retry.
Known large-impulse refusal and an actual unknown throw in solvePersistentPoint
preserve full state/model/log/clock. Both retries match an actual clean control.
Persisted evidence uses1507310 /1506963bytes per graph, below original16MiB;
each independent oracle request remains within2MiB. No process-memory claim.

The independent Fraction reference imports no candidate or package. It checks
continuous ballistic motion and separate closed-form kick-then-drift error,
Newton restitution, reduced-mass loss, gravity/contact momentum, angular
momentum, geometry gap and post-impact motion from actual full public states.
Full numeric-word transport restores signed zero before calculations.

## Accuracy limits are measured

The existing first-order integrator does not conserve mechanical energy in
free gravity flight. Actual signed1second energy defects are
-1.6039349999998518 /-0.8019674999999259 /-0.400983750000294J for the same
three time steps. Error ratios are2 /1.9999999999983487. Agreement with the
independent first-order defect is within2.941e-13J. Convergence is not exact
continuous dynamics or a high-precision engineering qualification.

The fall's continuous contact time is0.22576182049286544s; its actual discrete
first sample is0.225s. This is an end-step collision with integration bias,
not exact TOI or remaining-time integration. Projection potential-work
diagnostics include unobserved free-position rounding and are not a certificate
of energy conservation. The original continuous-position gate remains<0.083m;
no millimeter accuracy is claimed by that gate.

## Independent observer controls

`dynamic-next-oracle-controls-01` passes in545.623917ms. Root rechecks the five
paid actual packets, rejects eight physical/input mutations and four malformed
numeric-word controls, and verifies signed-zero restoration. Original paid data
remain unchanged. No additional World, solver or trajectory calls occur; these
are observer controls, not additional physical cases.

## Desktop and next dependency

`dynamic-next-desktop-03` passes in13222.737541ms: three formal Worlds including
one zero-step reset,512accepted steps total,257actual states per scene. Both
complete public-state packets and every numeric word match paid Native packets
exactly, without provider normalization. Both capture results are CAPTURE_EQUAL.
WebGPU RGBA readback observes3149changed pixels for the falling case and1554
for the delayed pair; the unchanged gate is>10 after camera/viewport changes
have stopped. Initial GPU cube pixels exceed the original100-pixel gate.
Actual contact27/8, outgoing separation/e0support, accepted-pose submissions,
independent quaternion/marker geometry, separate kinetic/potential readings,
step/play/pause/reset/markers/camera and1280/1440/1920 desktop widths pass.
No page/console/network errors; final input authentication passes and the owned
proof browser closes. Whole proof before final receipt is2309719bytes under16MiB.
Preview: http://127.0.0.1:53045/.

The first desktop01 fails before any accepted step: 2D drawImage of a WebGPU
canvas returns transparent pixels despite an actual screenshot of the blue cube.
Original source, proof and a separate zero-step diagnostic are preserved.
The revised observer renders the same buffers/matrix/pipelines into a fixed
640x360 GPU target and copies921600bytes within one encoder. It does not
compute physics or change pixel thresholds. Desktop02 then passes full falling
capture but fails during scene reset: snapshot energy briefly sees the new
scenario with old body IDs. That source/snapshot/screenshot is also preserved.
The fix commits the new display scenario and Worker state together after reset
returns. Physics is unchanged. Both first failures remain in baseline/ and
the immutable desktop01/02 proof directories; they are not relabelled PASS.

Later scope is two moving cubes plus a floor with separate collision events,
then a small simultaneous normal-contact problem. General rotating/frictional
multi-body response, impact-time remainders and moving8 retain NO_GO or
NOT_QUALIFIED. Public capacity is not physical accuracy. See PLAN.md for the
fixed dependency order and original criteria.

## Actual commands

```
node examples/physics-stack-dynamic-next-2276/run.mjs api-01
python3 -B examples/physics-stack-dynamic-next-2276/oracle-controls.py
node examples/physics-stack-dynamic-next-2276/server.mjs --build dynamic-desktop-03
node examples/physics-stack-dynamic-next-2276/server.mjs dynamic-desktop-03
node examples/physics-stack-dynamic-next-2276/browser-run.mjs dynamic-desktop-03
```

Executed with explicit installed Node22/Python3.13 under original gates and
fresh owned command IDs. The api-01 output is immutable; do not rerun that ID.
