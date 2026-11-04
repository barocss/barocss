---
work_id: physics-two-cubes-floor-2276
artifact_type: verification
status: done_bounded_numerical_and_desktop
owner_role: independent-physics-algorithm-work
source_request: qualify two cubes and a floor before coupled contact expansion
last_updated: 2026-11-04
---

# Stage A: two independent floor contacts

Two separated2kg cubes fall onto the same finite static floor. This is a
three-body public World case with two independent contact pairs. It does not
qualify a vertical coupled chain or moving8. No production solver/profile,
iteration limit or tolerance changes. All previous failures and HOLDs remain.
The static floor has zero inverse mass and prescribed fixed state; it is not
a zero-mass dynamic body. This clarifies the original contract's wording.

## Actual public Source and Native

`api-01` is `TWO_CUBES_FLOOR_NUMERICAL_SOURCE_NATIVE_CONFIRMED`.
The owned command completes in9028.068292ms. Each graph has9Worlds and1022
accepted steps, including four actual restore replay steps and one known/one
unknown failure. Primary counts are128/256/512 at60/120/240Hz,896 combined.
Repeated28-step controls include the first floor collision. State/model/log/
clock/command retention, clean retry and restore/continue pass. Complete
Source/Native packets and every numeric word agree, with only providerDigest
identity normalization. Tools, source and actual provider hashes remain unchanged.

| Hz | Left first contact | Right first contact | Maximum momentum residual Ns | Public point plane error m |
| --- | --- | --- | --- | --- |
|60 |14 |23 |8.336e-16 |4.815e-35 |
|120 |27 |47 |4.724e-16 |2.776e-17 |
|240 |54 |94 |8.503e-16 |2.776e-17 |

Independent Fraction geometry checks use original1e-12m public representative
point/finite boundary criteria. SI residuals remain1e-10, free velocity1e-11
and tangent impulse1e-12. Actual world-X cube separation remains strictly
positive, minimum0.5m; no dynamic cube pair is reported. These are public
aggregate-point checks, not private four-point or original32-point witness proof.

At matched precontact0.1s, maximum position errors are
0.008175000000000078 /0.004087500000000057 /0.0020437500000001574m. Per-body
maximum energy errors are0.1603935000000017 /0.08019675000000126 /
0.04009837500000322J. Both dt error ratios pass original[1.99,2.01]. The
integrator remains first-order, with energy defect and projection potential
work reported separately. End-step contacts are not exact continuous TOI.
Evidence per graph is2768468 /2768121bytes under16MiB; requests stay under2MiB.
These are evidence bounds, not process-memory qualification.

## Actual desktop

`two-cubes-floor-desktop-01` passes in13519.844625ms. Actual Chrome WebGPU
uses the same Native root/replay and120Hz authored inputs. Two formal Worlds
include a zero-step reset; one World then accepts256steps. All257complete public
states and ALLnumeric words compare exactly with the paid Native packet:
CAPTURE_EQUAL,767295captured bytes. The entire proof is about2.08MB under16MiB.

Actual left contact27, right contact47 and the intervening left-supported/
right-falling state are observed. Final two floor contacts remain independent.
Real GPU readback records5969changed flight pixels under the unchanged>10gate.
The initial20273blue pixels exceed100. Step/play/pause/reset, markers/camera,
1280/1440/1920desktop widths, independent submitted quaternion geometry and
separate kinetic/potential readings pass. Zero page/console/network errors;
input authentication passes and the owned proof browser closes. Screenshots
prove rendering only. Local preview: http://127.0.0.1:53046/.

## Observer failure and correction are preserved

The first saved-data negative-control run fails because removing the first
right contact is labelled INVALID_INPUT after momentum violations were already
detected. Independent review identifies a classification bug: valid-shaped
observations violating strict separation/contact-time criteria must report
physical failure and retain earlier violations. Original source and first
failure are preserved in baseline/observer-controls-first-01 and
baseline/oracle-classification-v1; no historical receipt is rewritten.

Only two predicates change from input rejection to bounded physical-violation
records. Strict gap>0 and the identical squared-time bracket remain unchanged.
All18saved-data controls then pass in3838.297791ms, including strict1e-11m
point displacement rejected by the1e-12m geometry gate. Three paid positives,
ten state/input negatives, four malformed-word controls and signed-zero
restoration make no new World calls.

An independent saved-packet re-audit runs all six original Source/Native CLI
requests through the repaired reference. Complete reply bytes equal the
original replies exactly; it passes in4556.727666ms with zero World/trajectory
calls. The first re-audit's duplicate-newline harness failure is also preserved.
The developer server accepts only this exact authenticated reference change;
every other frozen input stays exact. The revised build02 passes and its app,
Worker, HTML and CSS bytes equal the actually observed build01. This supports
reuse of the paid screen proof, without another physics campaign.

## Next dependency and remaining NO_GO

Stage B is the first vertical coupled chain: a falling upper cube loads a
lower cube already supported by the floor. It needs a separate first-failure
baseline and global mass-weighted contact/position reference. This Stage A does
not solve that coupled problem. General moving8, tilted/frictional coupling,
remaining-time CCD, equipment agreement and whole-engine completion remain
NO_GO or unqualified. Existing Studio/manufacturing/equipment/old-worker HOLDs,
all original tolerances and first failures remain. No mobile or deployment.

Actual commands use installed Node22/Python3.13 and existing gates/180s owner:

```
node examples/physics-two-cubes-floor-2276/run.mjs api-01
python3 -B examples/physics-two-cubes-floor-2276/oracle-controls.py
node examples/physics-two-cubes-floor-2276/server.mjs --build floor-desktop01
node examples/physics-two-cubes-floor-2276/server.mjs floor-desktop01
node examples/physics-two-cubes-floor-2276/browser-run.mjs floor-desktop01
node examples/physics-two-cubes-floor-2276/reference-reaudit.mjs reference-reaudit-02
node examples/physics-two-cubes-floor-2276/server.mjs --build floor-desktop02
```

Output IDs are immutable. Do not rerun them. The18-control command uses the
current observer; the immutable first control and re-audit failures stay separate.
