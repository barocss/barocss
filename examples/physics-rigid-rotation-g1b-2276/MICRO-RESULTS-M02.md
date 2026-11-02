# G1b one-step triaxial qualification M02

PASS_STAGED_G1B_MICRO_ONLY. The1kg primitive-COM box with half extents[0.1,0.2,0.3]m, identity q and world spin[1,1,1]rad/s passed one dt1/120s step in each graph. Both initial/accepted states were independently audited.

The graphs were the staged common-World source and its genuine strict NodeNext emitted published-root entry. Source physical/helper/ownership/count checks and disposal completed before Native root loading. This does not activate the installed package or qualify the canonical build root.

| Measured maximum | Error | Frozen limit |
| --- | ---: | --- |
| angularMomentum (kg*m^2/s) | 5.293341777308505e-18 | 2e-12 |
| rotationalEnergy (J) | 1.155697851391981e-17 | 2e-12 |
| quaternionSquaredNorm (dimensionless) | 2.421716569337831e-16 | 1e-12 |
| linearMomentum (kg*m/s) | 0 | 1e-12 |
| comPosition (m) | 0 | 1e-12 |
| Reference omega component | 1.547453095145349e-16 | 1e-11 + 1e-12 × abs(reference) |
| Reference R component | 2.283353505732965e-17 | 1e-11 + 1e-12 × abs(reference) |
| Reference q component | 1.210232936264873e-16 | 1e-11 + 1e-12 × abs(reference) |

The independent reference used volume-integral inertia and directed Decimal80/120 order32 Taylor integration, with a full degree64 residual and Picard enclosure proof. Each state was checked against both endpoints. The candidate used27 fixed signed midpoint/Cayley stages and4 Newton/direct3x3 updates per stage. No tolerance, iteration, order, precision or resource cap was increased. See [exact results](MICRO-RESULTS-M02.json) for rational errors, coefficient/helper counts, enclosure widths and resource bounds.

Actual totals:2 constructors,2 initial reads,2 accepted steps,2 disposals,4 independent state audits,216 direct3x3 solves,648 pivots,6 observed candidate Math.pow calls,4 build children and1 reference child. The reference performed4 validated Taylor windows,2,758,004 Decimal operations,15,662 Fraction operations,1,536 algebraic bisection decisions and8 endpoint square roots. Its ODE work is counted separately from the candidate.

The initial M01 run failed before any World because its reused integral helper still required axisymmetry. [That first failure](MICRO-RESULTS-M01.json), original reference and282-file archive remain unchanged. M02 adds a local general-cuboid volume certificate. The historic helper and solver/driver/overlay remain unchanged.

Command: installed Node22 runs `examples/physics-world-p5-2276/command-run.mjs g1b-micro-guard-02 . NODE22 examples/physics-rigid-rotation-g1b-2276/micro-campaign.mjs --run-id g1b-micro-02 --freeze ABS/MICRO-EXECUTION-FREEZE-M02.json --token d4813a7a39c809950accebe54c38acfe00d20146ded9ed829dd5355f99586bc1 --authorize-micro` under `gate.sh acquire heavy 300 g1b-micro-02`. The complete literal command is in the guard receipt. This is a record, not an instruction to rerun an immutable campaign.

The guard passed in7.533s including process cleanup; internal runtime was5.524s. No timeout, cleanup error or owned process group remained. These timings include build, transport and filesystem work and are not a performance benchmark. Logical ownership bounds passed; no RSS or heap measurement is claimed.

[The closed archive](MICRO-ARCHIVE-M02.json) preserves every runtime file and staged source/emitted payload with verified exact bytes. Local raw files are retained. Report generation decoded closed DATA only; it ran no new World, solver, reference or build.

Next is the separately planned0.1s three-grid trajectory and rollback campaign. Phase T, measured convergence order, long-time stability, wider admitted ranges, torque/contact/joint/domain/recorder integration, canonical build and production adoption remain NOT_RUN. Existing HOLD, NO_GO, tolerances and all first failures remain. No develop merge, push, deploy, release, hardware or manufacturing claim follows.
