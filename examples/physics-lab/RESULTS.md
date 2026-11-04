# Physics Lab: desktop results

**PASS_DESKTOP_PHYSICS_LAB** on branch `codex/physics-world-p5-2276`, using
numerical source base0fd6d15f6a1642707fed37d202058dafc7299a21. Open the running
local preview at http://127.0.0.1:52889. No deployment or release occurred.

## Implemented

The independent page uses actual current public Physics root/replay and Viewer
source APIs. No numerical package, Viewer/GPU source, tolerance, dependency,
security flag or legacy compatibility path was changed. All597 bundle inputs
resolve inside the owned checkout; the browser bundle is2,059,655bytes.

- Box, sphere and uniform capsule; editable mass, dimensions, initial spin, orientation and fixed interval.
- Play/pause, single step, world torque and one-time angular impulse. Recorder exclusively owns stepping.
- In-page recording, original-model reconstruction, restore and actual continuation.
- Existing512-frame recorder stop; no truncation or unrecorded continuation.
- Primitive E/L/q diagnostics; torque work explicitly marked **approximate trapezoid**.
- Independent fixed-case three-grid comparison at six matched times through0.1s.
- Actual public Viewer poses and WebGPU pixels, with display-only proxy meshes.

## Actual checks

Current proof: `output/playwright/physics-lab/desktop-04/report.json`.
Chrome156.0.8078.74 ran twelve desktop checks; no page/console errors occurred.
The headless proof session was closed. The separate visible preview was left
untouched. No custom unsafe WebGPU flags or browser downloads were used.

1. Initial body has real non-background GPU pixels and the accepted pose.
2. Twelve UI steps append twelve records, rotate the body and change GPU pixels.
3. Save/restore reproduces state/log; the next actual step equals the original continuation.
4. Finite oversized torque returns NUMERIC_LIMIT; state/log/display remain unchanged; a valid next step recovers.
5. The preset applies J once and reissues constant world torque per step.
6. All18 matched reference frames pass; comparison preserves the current experiment.
7. Sphere inputs reset the actual model/interval; Enter steps and Space starts/pauses.
8. Capsule and a cyclic initial orientation pass unchanged-XYZW pose transport.
9. Saved capsule state/model reconstruct after a box reset.
10. Pointer orbit changes camera/GPU pixels without stepping Physics; home works.
11. Desktop resize at1280 and1920 widths retains state and draws; main capture width1440.
12. Play stops at512 records/steps, disables advancement and resets correctly. At240Hz the accepted time is2.1333333333333333s.

Four focused Source session tests PASS: invalid load/config retention, command
expiry/reissued torque, real restore/continuation/tamper retention, reset/horizon/
disposal. Source bundling, docs build and built-site checks PASS. The site check
covers5pages,818links,223anchors,28snippet regions and14unchanged historical
copies. The public roadmap copy is byte-identical. Remote-link checks are NOT_RUN.

## Fixed reference results

These are browser agreement errors against outward binary64 enclosures of the
saved directed80/120 Taylor32 bank. Exact independent physical qualification
remains in `examples/physics-general-rotation-2276/RESULTS.md`. The live approximate
work diagnostic is not used as the independent work oracle.

| dt | Steps | Max R entry | Max omega,rad/s | Max independent work residual,J |
| --- | --- | --- | --- | --- |
| 1/60s | 6 | 2.220446049250313e-16 | 2.4424906541753444e-15 | 7.670730370334944e-17 |
| 1/120s | 12 | 2.220446049250313e-16 | 1.7763568394002505e-15 | 6.429318882839041e-17 |
| 1/240s | 24 | 3.3306690738754696e-16 | 2.4424906541753444e-15 | 1.2674323396355547e-16 |

The bank SHA256 is02aa996a8540ec3d102e7e3c11f850ac0a658fa698c93072e442cf090f1f294e.
No new ODE reference integration was needed. All old gates remain: trajectory
1e-11+1e-12*abs(reference), E/L/work1e-12+1e-12*max(1,abs(actual),abs(expected)),
qnorm²1e-12. All three grids are below the old rounding floor; no empirical
order follows. Custom GUI inputs and long-time phase are not qualified by this
one fixed reference case. Same-runtime continuation equality is separate from
physical accuracy; no cross-runtime deterministic-bit claim follows.

## Preserved scope and evidence

After the owner's desktop-only instruction, the active driver was changed to
desktop resize. No further mobile checks ran. Earlier `lab-01` and its driver/
contract remain historical records; current proof uses `desktop-04` only.
`first-execution-inputs` preserves the initial contract and test program.
Every browser runner retains a failed comparison/current snapshot before closing
its own session. No failed algorithm case or threshold was deleted or relaxed.
The global npx wrapper failed on existing npm/tar code; the already installed
cached CLI was used directly with Node22, without changing global tools.

Raw reports, screenshots, source bundle and input hashes, unit-test build and
command receipts are in `EVIDENCE-01.tar.gz`; its file hashes and safe extraction
instructions are in `EVIDENCE-ARCHIVE.json`. Source/server and reproducible test
commands are in README.md. `EXECUTION-FREEZE-05.json` precedes the current run.
The old algorithm first failures and8-box NO_GO remain unchanged.

Compiled/published browser SDK, device-loss recovery, general contacts/joints,
eight-box stability and real machines are NOT_RUN. Existing Studio/manufacturing/
equipment HOLDs remain. Screenshots prove presentation only. No whole-engine,
engineering-safety, deployment or release claim follows.
